import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { supabase } from '../services/supabase';
import { deleteFromCloudinary, getCloudinaryPublicId, uploadToCloudinary } from '../services/cloudinary';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { BLOCK_TYPES, createDefaultBlockContent, getBlockMeta, normalizeBlockContent } from './blocks/blockRegistry';
import { getPublicationInfo, publishBlocksSnapshot, setPublicationDraft } from '../services/contentPublication';
import { createContentVersion, listContentVersions, restoreContentVersion, type ContentBlockVersionRow } from '../services/contentVersioning';
import LoadingToast from './LoadingToast';
import BoldField from './BoldField';
import ContentBlockRenderer from './ContentBlockRenderer';

// ── Tipos exportados (también los usa ContentBlockRenderer) ───────────────────

export type BlockType = 'heading' | 'subheading' | 'paragraph' | 'image' | 'text_image' | 'two_images' | 'three_images' | 'callout' | 'list' | 'divider' | 'carousel' | 'text_carousel' | 'double_carousel' | 'section' | 'columns_2';

export interface ContentBlock {
  id: string;
  entity_type: string;
  entity_id: number;
  block_type: BlockType;
  sort_order: number;
  content: Record<string, string>;
}

// ── Tipo interno del editor (añade flag de bloque nuevo) ─────────────────────
type EditorBlock = ContentBlock & { _isNew: boolean };

const getSortedContentRecord = (content: Record<string, string>): Record<string, string> => {
  return Object.keys(content)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = content[key] ?? '';
      return acc;
    }, {});
};

const getBlocksFingerprint = (list: EditorBlock[]): string => {
  const normalized = list.map(block => ({
    id: block.id,
    entity_type: block.entity_type,
    entity_id: block.entity_id,
    block_type: block.block_type,
    sort_order: block.sort_order,
    content: getSortedContentRecord(block.content),
  }));
  return JSON.stringify(normalized);
};

interface PickerPlaca {
  id: number;
  photo_url: string;
}

interface AllTema {
  id: number;
  nombre: string;
}

interface AllSubtema {
  id: number;
  nombre: string;
  tema_id: number;
}

const ATLAS_CONTENT_PREFIX = 'atlas-content/';

const STYLE_CONTENT_KEYS = [
  'style_bg',
  'style_text',
  'style_border',
  'style_radius',
  'style_padding',
  'style_max_width',
  'style_align',
  'style_shadow',
  'style_font_size',
  'style_font_weight',
] as const;

const STYLE_PRESETS_STORAGE_KEY = 'atlas-style-presets-v1';
const SECTION_TEMPLATES_STORAGE_KEY = 'atlas-section-templates-v1';

interface StylePreset {
  id: string;
  name: string;
  style: Record<string, string>;
}

interface SectionTemplateBlock {
  block_type: BlockType;
  content: Record<string, string>;
}

interface SectionTemplate {
  id: string;
  name: string;
  blocks: SectionTemplateBlock[];
}

const sanitizeImportedContent = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
      return acc;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      acc[key] = String(value);
    }
    return acc;
  }, {});
};

const pickStyleContent = (content: Record<string, string>): Record<string, string> => {
  return STYLE_CONTENT_KEYS.reduce<Record<string, string>>((acc, key) => {
    acc[key] = content[key] ?? '';
    return acc;
  }, {});
};

const getAtlasContentPublicIdsFromBlock = (block: Pick<ContentBlock, 'content'>): string[] => {
  const values = Object.values(block.content ?? {});
  const ids = values
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(url => getCloudinaryPublicId(url))
    .filter(pid => pid.startsWith(ATLAS_CONTENT_PREFIX));
  return [...new Set(ids)];
};

// ── Props del componente ─────────────────────────────────────────────────────
interface PageContentEditorProps {
  entityType: 'subtemas_page' | 'placas_page' | 'home_page';
  entityId: number;
}

const BLOCK_TOOLBAR_GROUPS: Array<{ title: string; types: BlockType[] }> = [
  {
    title: 'Texto',
    types: ['heading', 'subheading', 'paragraph', 'list', 'callout'],
  },
  {
    title: 'Imagenes y galerias',
    types: ['image', 'text_image', 'two_images', 'three_images', 'carousel', 'text_carousel', 'double_carousel'],
  },
  {
    title: 'Estructura',
    types: ['section', 'columns_2', 'divider'],
  },
];

const BLOCK_GROUP_META: Record<string, { icon: string; accent: string }> = {
  Texto: { icon: 'Aa', accent: '#0ea5e9' },
  'Imagenes y galerias': { icon: 'IMG', accent: '#8b5cf6' },
  Estructura: { icon: 'LAY', accent: '#14b8a6' },
};

const BLOCK_TYPE_VISUAL_ICON: Record<BlockType, string> = {
  heading: 'T',
  subheading: 'ST',
  paragraph: 'TXT',
  image: 'IMG',
  text_image: 'T+I',
  two_images: '2IMG',
  three_images: '3IMG',
  callout: 'TIP',
  list: 'LIST',
  divider: 'SEP',
  carousel: 'GAL',
  text_carousel: 'T+GAL',
  double_carousel: '2GAL',
  section: 'SEC',
  columns_2: 'COL',
};

// ── Componente principal ─────────────────────────────────────────────────────
const PageContentEditor: React.FC<PageContentEditorProps> = ({ entityType, entityId }) => {
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [styleClipboard, setStyleClipboard] = useState<Record<string, string> | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [sectionTemplates, setSectionTemplates] = useState<SectionTemplate[]>([]);
  const [selectedSectionTemplateId, setSelectedSectionTemplateId] = useState<string>('');
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'published'>('draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSwitchingToDraft, setIsSwitchingToDraft] = useState(false);
  const [versions, setVersions] = useState<ContentBlockVersionRow[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [collapsedToolbarGroups, setCollapsedToolbarGroups] = useState<Set<string>>(new Set());
  const [compactToolbar, setCompactToolbar] = useState(false);

  // Modal selector de imagen
  const [imageModal, setImageModal] = useState<{
    blockId: string;
    fieldKey: string;
  } | null>(null);
  const [pickerTab, setPickerTab] = useState<'upload' | 'placas' | 'all'>('upload');
  const [availablePlacas, setAvailablePlacas] = useState<PickerPlaca[]>([]);
  const [loadingPlacas, setLoadingPlacas] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // Estados para "Todas las placas"
  const [allTemas, setAllTemas] = useState<AllTema[]>([]);
  const [allSubtemas, setAllSubtemas] = useState<AllSubtema[]>([]);
  const [allPlacas, setAllPlacas] = useState<PickerPlaca[]>([]);
  const [allFilterTema, setAllFilterTema] = useState<string>('');
  const [allFilterSubtema, setAllFilterSubtema] = useState<string>('');
  const [loadingAll, setLoadingAll] = useState(false);

  // Drag-and-drop de bloques (por índice, no por id numérico)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());
  const blocksRef = useRef<EditorBlock[]>([]);
  const pendingAssetDeleteIdsRef = useRef<Set<string>>(new Set());
  const persistedBlocksFingerprintRef = useRef<string>('[]');

  // Guard contra respuestas de peticiones obsoletas
  const reqIdRef = useRef(0);

  const hasPendingChangesFor = useCallback((list: EditorBlock[]) => {
    return getBlocksFingerprint(list) !== persistedBlocksFingerprintRef.current;
  }, []);

  const toggleToolbarGroup = (groupTitle: string) => {
    setCollapsedToolbarGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupTitle)) next.delete(groupTitle);
      else next.add(groupTitle);
      return next;
    });
  };

  // ── Carga de bloques ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STYLE_PRESETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StylePreset[];
      if (!Array.isArray(parsed)) return;
      setStylePresets(parsed);
    } catch (error) {
      console.warn('No se pudieron cargar presets de estilo.', error);
    }
  }, []);

  const refreshVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    try {
      const rows = await listContentVersions(entityType, entityId, 30);
      setVersions(rows);
      setSelectedVersionId(prev => (prev && rows.some(r => String(r.id) === prev) ? prev : ''));
    } catch (error) {
      console.warn('No se pudo cargar historial de versiones.', error);
      setVersions([]);
      setSelectedVersionId('');
    } finally {
      setIsLoadingVersions(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SECTION_TEMPLATES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SectionTemplate[];
      if (!Array.isArray(parsed)) return;
      setSectionTemplates(parsed);
    } catch (error) {
      console.warn('No se pudieron cargar plantillas de seccion.', error);
    }
  }, [sectionTemplates]);

  useEffect(() => {
    let active = true;

    const loadRouteReferences = async () => {
      const [{ data: temasData }, { data: subtemasData }] = await Promise.all([
        supabase.from('temas').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('subtemas').select('id, nombre, tema_id').order('nombre', { ascending: true }),
      ]);

      if (!active) return;
      setAllTemas(temasData ?? []);
      setAllSubtemas(subtemasData ?? []);
    };

    void loadRouteReferences();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STYLE_PRESETS_STORAGE_KEY, JSON.stringify(stylePresets));
    } catch (error) {
      console.warn('No se pudieron guardar presets de estilo.', error);
    }
  }, [stylePresets]);

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_TEMPLATES_STORAGE_KEY, JSON.stringify(sectionTemplates));
    } catch (error) {
      console.warn('No se pudieron guardar plantillas de seccion.', error);
    }
  }, [sectionTemplates]);

  const getSectionRangeById = useCallback((list: EditorBlock[], sectionId: string) => {
    const start = list.findIndex(b => b.id === sectionId && b.block_type === 'section');
    if (start === -1) return null;
    let endExclusive = list.length;
    for (let i = start + 1; i < list.length; i++) {
      if (list[i].block_type === 'section') {
        endExclusive = i;
        break;
      }
    }
    return { start, endExclusive };
  }, []);

  const saveSectionTemplate = useCallback((sectionId: string) => {
    const name = window.prompt('Nombre de la plantilla de seccion:');
    if (!name || !name.trim()) return;
    const range = getSectionRangeById(blocks, sectionId);
    if (!range) return;

    const templateBlocks = blocks.slice(range.start, range.endExclusive).map(block => ({
      block_type: block.block_type,
      content: { ...block.content },
    }));

    const template: SectionTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      blocks: templateBlocks,
    };
    setSectionTemplates(prev => [template, ...prev].slice(0, 30));
  }, [blocks, getSectionRangeById]);

  const renameSectionTemplate = useCallback((templateId: string) => {
    const template = sectionTemplates.find(t => t.id === templateId);
    if (!template) return;
    const nextName = window.prompt('Nuevo nombre de la plantilla:', template.name);
    if (!nextName || !nextName.trim()) return;
    setSectionTemplates(prev => prev.map(t => (t.id === templateId ? { ...t, name: nextName.trim() } : t)));
  }, [sectionTemplates]);

  const deleteSectionTemplate = useCallback((templateId: string) => {
    const template = sectionTemplates.find(t => t.id === templateId);
    if (!template) return;
    if (!window.confirm(`Eliminar plantilla "${template.name}"?`)) return;
    setSectionTemplates(prev => prev.filter(t => t.id !== templateId));
    setSelectedSectionTemplateId(prev => (prev === templateId ? '' : prev));
  }, [sectionTemplates]);

  const applySectionTemplate = useCallback((sectionId: string, templateId: string) => {
    const template = sectionTemplates.find(t => t.id === templateId);
    if (!template || template.blocks.length === 0) return;

    setBlocks(prev => {
      const range = getSectionRangeById(prev, sectionId);
      if (!range) return prev;

      const sectionRef = prev[range.start];
      const inserted: EditorBlock[] = template.blocks.map((tb, idx) => ({
        id: crypto.randomUUID(),
        entity_type: sectionRef.entity_type,
        entity_id: sectionRef.entity_id,
        block_type: tb.block_type,
        sort_order: range.start + idx,
        content: normalizeBlockContent(tb.block_type, tb.content),
        _isNew: true,
      }));

      const next = [...prev.slice(0, range.start), ...inserted, ...prev.slice(range.endExclusive)];
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setHasChanges(true);
  }, [getSectionRangeById, sectionTemplates]);

  const insertSectionTemplateAtEnd = useCallback((templateId: string) => {
    const template = sectionTemplates.find(t => t.id === templateId);
    if (!template || template.blocks.length === 0) return;
    setBlocks(prev => {
      const inserted: EditorBlock[] = template.blocks.map((tb, idx) => ({
        id: crypto.randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        block_type: tb.block_type,
        sort_order: prev.length + idx,
        content: normalizeBlockContent(tb.block_type, tb.content),
        _isNew: true,
      }));
      const next = [...prev, ...inserted];
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setHasChanges(true);
  }, [entityId, entityType, sectionTemplates]);

  const insertSectionTemplateBelow = useCallback((sectionId: string, templateId: string) => {
    const template = sectionTemplates.find(t => t.id === templateId);
    if (!template || template.blocks.length === 0) return;
    setBlocks(prev => {
      const range = getSectionRangeById(prev, sectionId);
      if (!range) return prev;

      const sectionRef = prev[range.start];
      const insertAt = range.endExclusive;
      const inserted: EditorBlock[] = template.blocks.map((tb, idx) => ({
        id: crypto.randomUUID(),
        entity_type: sectionRef.entity_type,
        entity_id: sectionRef.entity_id,
        block_type: tb.block_type,
        sort_order: insertAt + idx,
        content: normalizeBlockContent(tb.block_type, tb.content),
        _isNew: true,
      }));

      const next = [...prev.slice(0, insertAt), ...inserted, ...prev.slice(insertAt)];
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setHasChanges(true);
  }, [getSectionRangeById, sectionTemplates]);

  const exportSectionTemplates = useCallback(() => {
    if (sectionTemplates.length === 0) {
      window.alert('No hay plantillas para exportar.');
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: sectionTemplates,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atlas-section-templates.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sectionTemplates]);

  const handleImportSectionTemplates = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const sourceTemplates =
        Array.isArray(parsed)
          ? parsed
          : (parsed as { templates?: unknown })?.templates;

      if (!Array.isArray(sourceTemplates)) {
        throw new Error('Formato invalido de archivo');
      }

      const validTemplates: SectionTemplate[] = [];
      let invalidSectionRootCount = 0;
      sourceTemplates.forEach((rawTemplate, index) => {
        if (!rawTemplate || typeof rawTemplate !== 'object') return;
        const candidate = rawTemplate as { name?: unknown; blocks?: unknown };
        const name = typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim()
          : `Plantilla importada ${index + 1}`;
        if (!Array.isArray(candidate.blocks)) return;

        const blocks = candidate.blocks
          .map(rawBlock => {
            if (!rawBlock || typeof rawBlock !== 'object') return null;
            const block = rawBlock as { block_type?: unknown; content?: unknown };
            if (typeof block.block_type !== 'string') return null;
            if (!(BLOCK_TYPES as ReadonlyArray<string>).includes(block.block_type)) return null;
            const safeContent = sanitizeImportedContent(block.content);
            return {
              block_type: block.block_type as BlockType,
              content: normalizeBlockContent(block.block_type as BlockType, safeContent),
            };
          })
          .filter((b): b is SectionTemplateBlock => Boolean(b));

        if (blocks.length === 0) return;
        if (blocks[0].block_type !== 'section') {
          invalidSectionRootCount += 1;
          return;
        }
        validTemplates.push({
          id: crypto.randomUUID(),
          name,
          blocks,
        });
      });

      if (validTemplates.length === 0) {
        const reason = invalidSectionRootCount > 0
          ? ' Todas deben iniciar con un bloque de tipo Seccion.'
          : '';
        window.alert(`No se encontraron plantillas validas en el archivo.${reason}`);
      } else {
        const maxTemplates = 30;
        const currentCount = sectionTemplates.length;
        const droppedByCap = Math.max(0, currentCount + validTemplates.length - maxTemplates);
        if (droppedByCap > 0) {
          const proceed = window.confirm(
            `Se importaran ${validTemplates.length} plantillas y se descartaran ${droppedByCap} antiguas por el limite de ${maxTemplates}. Continuar?`
          );
          if (!proceed) return;
        }
        setSectionTemplates(prev => [...validTemplates, ...prev].slice(0, maxTemplates));

        const extraMsg = invalidSectionRootCount > 0
          ? ` ${invalidSectionRootCount} plantillas fueron omitidas por no iniciar con Seccion.`
          : '';
        window.alert(`Se importaron ${validTemplates.length} plantillas.${extraMsg}`);
      }
    } catch (error) {
      console.error('Error al importar plantillas de seccion:', error);
      window.alert('No se pudo importar el archivo JSON de plantillas.');
    } finally {
      e.currentTarget.value = '';
    }
  }, [sectionTemplates]);

  const moveBlockToAdjacentSection = useCallback((blockId: string, direction: 'prev' | 'next') => {
    setBlocks(prev => {
      const blockIdx = prev.findIndex(b => b.id === blockId);
      if (blockIdx === -1) return prev;
      if (prev[blockIdx].block_type === 'section') return prev;

      const sectionIndexes = prev
        .map((b, i) => (b.block_type === 'section' ? i : -1))
        .filter(i => i !== -1);

      if (sectionIndexes.length === 0) return prev;

      let currentSectionPos = -1;
      for (let i = 0; i < sectionIndexes.length; i++) {
        if (sectionIndexes[i] < blockIdx) currentSectionPos = i;
      }

      let targetSectionPos: number;
      if (direction === 'prev') {
        if (currentSectionPos <= 0) return prev;
        targetSectionPos = currentSectionPos - 1;
      } else {
        if (currentSectionPos === -1) {
          targetSectionPos = 0;
        } else {
          if (currentSectionPos >= sectionIndexes.length - 1) return prev;
          targetSectionPos = currentSectionPos + 1;
        }
      }

      const targetSectionId = prev[sectionIndexes[targetSectionPos]].id;

      const next = [...prev];
      const [moved] = next.splice(blockIdx, 1);

      const targetStart = next.findIndex(b => b.id === targetSectionId);
      if (targetStart === -1) return prev;

      let targetEnd = next.length;
      for (let i = targetStart + 1; i < next.length; i++) {
        if (next[i].block_type === 'section') {
          targetEnd = i;
          break;
        }
      }

      next.splice(targetEnd, 0, moved);
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setHasChanges(true);
  }, []);

  useEffect(() => {
    const reqId = ++reqIdRef.current;

    const load = async () => {
      setLoading(true);
      setBlocks([]);
      setHasChanges(false);
      setSaveSuccess(false);
      setSaveError(null);

      const [{ data, error }, publication, versionRows] = await Promise.all([
        supabase
          .from('content_blocks')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('sort_order', { ascending: true }),
        getPublicationInfo(entityType, entityId).catch(() => null),
        listContentVersions(entityType, entityId, 30).catch(() => []),
      ]);

      if (reqId !== reqIdRef.current) return;

      if (error) console.error('Error al cargar bloques:', error);
      const loaded: EditorBlock[] = (data ?? []).map((b: ContentBlock) => ({
        ...b,
        content: normalizeBlockContent(b.block_type, b.content),
        _isNew: false,
      }));
      persistedBlocksFingerprintRef.current = getBlocksFingerprint(loaded);
      blocksRef.current = loaded;
      setBlocks(loaded);
      setSavedIds(new Set(loaded.map(b => b.id)));
      setSelectedBlockIds(new Set());
      setCollapsedBlockIds(new Set());
      setPublicationStatus(publication?.status === 'published' ? 'published' : 'draft');
      setPublishedAt(publication?.published_at ?? null);
      setVersions(versionRows);
      setSelectedVersionId('');
      setLoading(false);
    };

    load();
  }, [entityType, entityId]);

  useEffect(() => {
    blocksRef.current = blocks;
    const currentFingerprint = getBlocksFingerprint(blocks);
    setHasChanges(currentFingerprint !== persistedBlocksFingerprintRef.current);
  }, [blocks]);

  // ── Operaciones sobre bloques ────────────────────────────────────────────
  const addBlock = useCallback(
    (type: BlockType, insertAt?: number) => {
      const newBlock: EditorBlock = {
        id: crypto.randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        block_type: type,
        sort_order: insertAt ?? blocks.length,
        content: createDefaultBlockContent(type),
        _isNew: true,
      };
      setBlocks(prev => {
        const index = Math.max(0, Math.min(insertAt ?? prev.length, prev.length));
        const next = [...prev];
        next.splice(index, 0, newBlock);
        return next.map((b, i) => ({ ...b, sort_order: i }));
      });
      setHasChanges(true);
    },
    [blocks.length, entityType, entityId]
  );

  const updateBlockContent = useCallback(
    (blockId: string, updates: Record<string, string>) => {
      const replacedAtlasContentIds: string[] = [];

      setBlocks(prev =>
        prev.map(b => {
          if (b.id !== blockId) return b;

          Object.entries(updates).forEach(([key, nextValue]) => {
            const prevValue = b.content[key];
            if (typeof prevValue !== 'string' || !prevValue || prevValue === nextValue) return;
            const oldPublicId = getCloudinaryPublicId(prevValue);
            if (oldPublicId.startsWith(ATLAS_CONTENT_PREFIX)) {
              replacedAtlasContentIds.push(oldPublicId);
            }
          });

          return { ...b, content: { ...b.content, ...updates } };
        })
      );

      replacedAtlasContentIds.forEach(pid => pendingAssetDeleteIdsRef.current.add(pid));
      setHasChanges(true);
    },
    []
  );

  const deleteBlock = useCallback((blockId: string) => {
    if (!window.confirm('¿Eliminar este bloque de contenido?')) return;
    setBlocks(prev => {
      const toDelete = prev.find(b => b.id === blockId);
      if (toDelete) {
        const publicIds = getAtlasContentPublicIdsFromBlock(toDelete);
        publicIds.forEach(pid => pendingAssetDeleteIdsRef.current.add(pid));
      }
      return prev.filter(b => b.id !== blockId);
    });
    setSelectedBlockIds(prev => {
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
    setCollapsedBlockIds(prev => {
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
    setHasChanges(true);
  }, []);

  const toggleBlockCollapsed = useCallback((blockId: string) => {
    setCollapsedBlockIds(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  const collapseAllBlocks = useCallback(() => {
    setCollapsedBlockIds(new Set(blocks.map(b => b.id)));
  }, [blocks]);

  const expandAllBlocks = useCallback(() => {
    setCollapsedBlockIds(new Set());
  }, []);

  const toggleBlockSelection = useCallback((blockId: string, checked: boolean) => {
    setSelectedBlockIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(blockId);
      else next.delete(blockId);
      return next;
    });
  }, []);

  const applyStyleToBlockSelection = useCallback((style: Record<string, string>) => {
    if (selectedBlockIds.size === 0) return;
    setBlocks(prev => prev.map(block => {
      if (!selectedBlockIds.has(block.id)) return block;
      return { ...block, content: { ...block.content, ...style } };
    }));
    setHasChanges(true);
  }, [selectedBlockIds]);

  const selectAllBlocks = useCallback(() => {
    setSelectedBlockIds(new Set(blocks.map(b => b.id)));
  }, [blocks]);

  const clearBlockSelection = useCallback(() => {
    setSelectedBlockIds(new Set());
  }, []);

  const saveStylePreset = useCallback((style: Record<string, string>) => {
    const name = window.prompt('Nombre del preset de estilo:');
    if (!name || !name.trim()) return;
    const preset: StylePreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      style,
    };
    setStylePresets(prev => [preset, ...prev].slice(0, 20));
  }, []);

  const deleteStylePreset = useCallback((presetId: string) => {
    setStylePresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  const duplicateBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone: EditorBlock = {
        ...original,
        id: crypto.randomUUID(),
        content: { ...original.content },
        _isNew: true,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setHasChanges(true);
  }, []);

  // ── Drag-and-drop de bloques ─────────────────────────────────────────────
  const handleBlockDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleBlockDragOver = (e: React.DragEvent, idx: number) => {
    const paletteType = e.dataTransfer.getData('application/x-atlas-block-type');
    const isPaletteDrag = (BLOCK_TYPES as ReadonlyArray<string>).includes(paletteType);
    if (dragIdx === null && !isPaletteDrag) return;

    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newDrop = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
    if (newDrop !== dropIdx) setDropIdx(newDrop);
  };

  const handleBlockDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const paletteType = e.dataTransfer.getData('application/x-atlas-block-type');
    const isPaletteDrag = (BLOCK_TYPES as ReadonlyArray<string>).includes(paletteType);

    if (isPaletteDrag) {
      const insertIndex = dropIdx ?? blocks.length;
      addBlock(paletteType as BlockType, insertIndex);
      setDragIdx(null);
      setDropIdx(null);
      return;
    }

    if (dragIdx === null || dropIdx === null) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }
    let to = dropIdx;
    if (dragIdx < to) to--;
    if (to !== dragIdx) {
      const next = [...blocks];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(to, 0, moved);
      setBlocks(next);
      setHasChanges(true);
    }
    setDragIdx(null);
    setDropIdx(null);
  };

  const handleBlockDragEnd = () => {
    setDragIdx(null);
    setDropIdx(null);
  };

  // ── Selector de imagen ───────────────────────────────────────────────────
  const openImageModal = useCallback((blockId: string, fieldKey: string) => {
    setImageModal({ blockId, fieldKey });
    setPickerTab('upload');
    setAvailablePlacas([]);
    setAllPlacas([]);
    setAllFilterTema('');
    setAllFilterSubtema('');
    setLoadingPlacas(true);
    if (entityType === 'home_page') {
      setAvailablePlacas([]);
      setLoadingPlacas(false);
    } else {
      const col = entityType === 'placas_page' ? 'subtema_id' : 'tema_id';
      supabase
        .from('placas')
        .select('id, photo_url')
        .eq(col, entityId)
        .order('sort_order', { ascending: true })
        .then(({ data }) => {
          setAvailablePlacas(data ?? []);
          setLoadingPlacas(false);
        });
    }
    // Cargar temas para la pestaña "Todas"
    supabase
      .from('temas')
      .select('id, nombre')
      .order('nombre', { ascending: true })
      .then(({ data }) => setAllTemas(data ?? []));
    supabase
      .from('subtemas')
      .select('id, nombre, tema_id')
      .order('nombre', { ascending: true })
      .then(({ data }) => setAllSubtemas(data ?? []));
  }, [entityId, entityType]);

  // Cargar placas cuando cambia el filtro de la pestaña "Todas"
  const handleAllFilterTema = (temaId: string) => {
    setAllFilterTema(temaId);
    setAllFilterSubtema('');
    setAllPlacas([]);
    if (!temaId) return;
    setLoadingAll(true);
    supabase
      .from('placas')
      .select('id, photo_url')
      .eq('tema_id', temaId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setAllPlacas(data ?? []); setLoadingAll(false); });
  };

  const handleAllFilterSubtema = (subtemaId: string) => {
    setAllFilterSubtema(subtemaId);
    setAllPlacas([]);
    if (!subtemaId) {
      // Volver a mostrar todas las del tema
      if (!allFilterTema) return;
      setLoadingAll(true);
      supabase
        .from('placas')
        .select('id, photo_url')
        .eq('tema_id', allFilterTema)
        .order('sort_order', { ascending: true })
        .then(({ data }) => { setAllPlacas(data ?? []); setLoadingAll(false); });
      return;
    }
    setLoadingAll(true);
    supabase
      .from('placas')
      .select('id, photo_url')
      .eq('subtema_id', subtemaId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setAllPlacas(data ?? []); setLoadingAll(false); });
  };

  const closeImageModal = () => setImageModal(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !imageModal) return;
    setUploadingImage(true);
    try {
      const result = await uploadToCloudinary(file, { folder: 'atlas-content', optimizeImage: true });
      updateBlockContent(imageModal.blockId, {
        [imageModal.fieldKey]: result.secure_url,
      });
      closeImageModal();
    } catch (err) {
      console.error('Error al subir imagen:', err);
      alert('Error al subir la imagen. Por favor intenta de nuevo.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePickPlaca = (photoUrl: string) => {
    if (!imageModal) return;
    updateBlockContent(imageModal.blockId, { [imageModal.fieldKey]: photoUrl });
    closeImageModal();
  };

  // ── Guardar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const blocksToSave = blocksRef.current;
    if (!hasPendingChangesFor(blocksToSave)) {
      setHasChanges(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // 1. Eliminar bloques que ya no existen en la lista local
      const currentIds = new Set(blocksToSave.map(b => b.id));
      const idsToDelete = [...savedIds].filter(id => !currentIds.has(id));
      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('content_blocks')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
      }

      // 2. Upsert de todos los bloques actuales con sort_order correcto
      if (blocksToSave.length > 0) {
        const rows = blocksToSave.map((b, i) => ({
          id: b.id,
          entity_type: entityType,
          entity_id: entityId,
          block_type: b.block_type,
          sort_order: i,
          content: b.content,
        }));
        const { error } = await supabase.from('content_blocks').upsert(rows);
        if (error) throw error;
      }

      // 3. Limpia assets de atlas-content que hayan quedado huérfanos tras persistir cambios.
      const pendingAssetDeletes = [...pendingAssetDeleteIdsRef.current];
      if (pendingAssetDeletes.length > 0) {
        const { data: allBlocks, error: allBlocksError } = await supabase
          .from('content_blocks')
          .select('content');

        // No bloquear el guardado si la verificacion global de referencias falla.
        if (allBlocksError) {
          console.warn('No se pudo verificar referencias globales de assets. Se omite limpieza en este guardado.', allBlocksError);
        } else {
          const stillReferenced = new Set<string>();
          (allBlocks ?? []).forEach(row => {
            const content = (row as { content: Record<string, string> }).content ?? {};
            const ids = getAtlasContentPublicIdsFromBlock({ content });
            ids.forEach(pid => stillReferenced.add(pid));
          });

          for (const publicId of pendingAssetDeletes) {
            if (!stillReferenced.has(publicId)) {
              try {
                await deleteFromCloudinary(publicId);
              } catch (cleanupError) {
                console.warn('No se pudo limpiar asset huérfano en Cloudinary:', publicId, cleanupError);
              }
            }
          }
        }
      }

      // 4. Actualizar estado local
      const persistedBlocks = blocksToSave.map((b, i) => ({ ...b, sort_order: i, _isNew: false }));
      persistedBlocksFingerprintRef.current = getBlocksFingerprint(persistedBlocks);
      blocksRef.current = persistedBlocks;
      setSavedIds(new Set(persistedBlocks.map(b => b.id)));
      setBlocks(persistedBlocks);
      pendingAssetDeleteIdsRef.current.clear();
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar bloques:', err);
      setSaveError('Error al guardar. Por favor, intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (hasPendingChangesFor(blocksRef.current)) {
      setSaveError('Guarda primero los cambios antes de publicar.');
      return;
    }

    setIsPublishing(true);
    setSaveError(null);
    try {
      try {
        await createContentVersion(entityType, entityId, 'Pre-publicacion automatica', 'Auto pre-publicacion');
      } catch (versionError) {
        console.warn('No se pudo crear snapshot previo a publicar.', versionError);
      }

      const currentBlocks = blocksRef.current;
      const payload = currentBlocks.map((b, idx) => ({
        id: b.id,
        entity_type: entityType,
        entity_id: entityId,
        block_type: b.block_type,
        sort_order: idx,
        content: normalizeBlockContent(b.block_type, b.content),
      }));

      const publishedIso = await publishBlocksSnapshot(entityType, entityId, payload);
      setPublicationStatus('published');
      setPublishedAt(publishedIso);
      await refreshVersions();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al publicar bloques:', err);
      setSaveError('No se pudo publicar. Verifica el script de publicaciones en Supabase.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCreateVersion = async () => {
    setIsCreatingVersion(true);
    setSaveError(null);
    try {
      const name = window.prompt('Nombre opcional de la version:', 'Snapshot manual') ?? '';
      const reason = window.prompt('Motivo opcional de la version:', 'Respaldo manual antes de cambios') ?? '';
      await createContentVersion(entityType, entityId, reason.trim() || undefined, name.trim() || undefined);
      await refreshVersions();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error al crear version:', err);
      setSaveError('No se pudo crear la version. Verifica el script setup_content_block_versions.sql en Supabase.');
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersionId) return;
    if (hasPendingChangesFor(blocksRef.current)) {
      const proceed = window.confirm('Tienes cambios sin guardar. Restaurar version los sobrescribira. Continuar?');
      if (!proceed) return;
    }

    const versionNum = Number(selectedVersionId);
    if (!Number.isFinite(versionNum)) return;

    const proceed = window.confirm('Se restaurara la version seleccionada y se reemplazara el contenido actual. La pagina quedara en borrador. Deseas continuar?');
    if (!proceed) return;

    setIsRestoringVersion(true);
    setSaveError(null);
    try {
      await restoreContentVersion(versionNum, true);

      const { data, error } = await supabase
        .from('content_blocks')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      const loaded: EditorBlock[] = (data ?? []).map((b: ContentBlock) => ({
        ...b,
        content: normalizeBlockContent(b.block_type, b.content),
        _isNew: false,
      }));

      persistedBlocksFingerprintRef.current = getBlocksFingerprint(loaded);
      setBlocks(loaded);
      setSavedIds(new Set(loaded.map(b => b.id)));
      setSelectedBlockIds(new Set());
      setCollapsedBlockIds(new Set());
      setHasChanges(false);

      const publication = await getPublicationInfo(entityType, entityId).catch(() => null);
      setPublicationStatus(publication?.status === 'published' ? 'published' : 'draft');
      setPublishedAt(publication?.published_at ?? null);

      await refreshVersions();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error al restaurar version:', err);
      setSaveError('No se pudo restaurar la version seleccionada.');
    } finally {
      setIsRestoringVersion(false);
    }
  };

  const handleSwitchToDraft = async () => {
    setIsSwitchingToDraft(true);
    setSaveError(null);
    try {
      await setPublicationDraft(entityType, entityId);
      setPublicationStatus('draft');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al pasar a borrador:', err);
      setSaveError('No se pudo cambiar a borrador. Verifica el script de publicaciones en Supabase.');
    } finally {
      setIsSwitchingToDraft(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={es.sectionCard}>
        <div style={es.loadingWrap}>
          <div style={es.spinner} />
          <p style={es.loadingText}>Cargando bloques de contenido...</p>
        </div>
      </div>
    );
  }

  const hasPendingChanges = hasPendingChangesFor(blocks) || hasChanges;

  const sectionIndexes = blocks
    .map((b, i) => (b.block_type === 'section' ? i : -1))
    .filter(i => i !== -1);

  const getSectionPosForIndex = (idx: number) => {
    let sectionPos = -1;
    for (let i = 0; i < sectionIndexes.length; i++) {
      if (sectionIndexes[i] < idx) sectionPos = i;
    }
    return sectionPos;
  };

  const selectedTemplate = sectionTemplates.find(t => t.id === selectedSectionTemplateId) ?? null;

  return (
    <div style={es.sectionCard} className="block-editor-root">
      <div style={es.builderLayout} className="block-editor-builder-layout">
        <aside style={es.toolbar} className="block-editor-sidebar">
        <div style={es.toolbarTopRow}>
          <span style={es.toolbarLabel}>Componentes</span>
          <button
            type="button"
            style={{ ...es.toolbarModeToggle, ...(compactToolbar ? es.toolbarModeToggleActive : {}) }}
            onClick={() => setCompactToolbar(v => !v)}
            title={compactToolbar ? 'Cambiar a vista expandida' : 'Cambiar a vista compacta'}
            aria-pressed={compactToolbar}
          >
            {compactToolbar ? 'Vista compacta: activada' : 'Vista compacta: desactivada'}
          </button>
        </div>
        <div style={es.toolbarGroupsWrap}>
          {BLOCK_TOOLBAR_GROUPS.map(group => (
            <div key={group.title} style={es.toolbarGroup}>
              <button
                type="button"
                style={{
                  ...es.toolbarGroupHeader,
                  borderColor: BLOCK_GROUP_META[group.title]?.accent ?? '#dbeafe',
                }}
                onClick={() => toggleToolbarGroup(group.title)}
                aria-expanded={!collapsedToolbarGroups.has(group.title)}
                title={`Mostrar u ocultar grupo ${group.title}`}
              >
                <span style={es.toolbarGroupHeaderLeft}>
                  <span
                    style={{
                      ...es.toolbarGroupIcon,
                      background: BLOCK_GROUP_META[group.title]?.accent ?? '#334155',
                    }}
                  >
                    {BLOCK_GROUP_META[group.title]?.icon ?? 'GR'}
                  </span>
                  <span style={es.toolbarGroupTitle}>{group.title}</span>
                  <span style={es.toolbarGroupCount}>{group.types.length} tipos</span>
                </span>
                <span style={es.toolbarGroupChevron}>{collapsedToolbarGroups.has(group.title) ? '+' : '-'}</span>
              </button>

              {!collapsedToolbarGroups.has(group.title) && (
                <div style={es.toolbarGroupButtons}>
                  {group.types.map(type => {
                    const meta = getBlockMeta(type);
                    return (
                      <button
                        key={type}
                        draggable
                        style={{ ...es.toolbarBtn, ...(compactToolbar ? es.toolbarBtnCompact : {}) }}
                        onClick={() => addBlock(type)}
                        onDragStart={e => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/x-atlas-block-type', type);
                          const ghost = document.createElement('div');
                          ghost.style.position = 'fixed';
                          ghost.style.top = '-9999px';
                          document.body.appendChild(ghost);
                          e.dataTransfer.setDragImage(ghost, 0, 0);
                          setTimeout(() => document.body.removeChild(ghost), 0);
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = meta.color;
                          el.style.color = '#fff';
                          el.style.borderColor = meta.color;
                          el.style.transform = 'translateY(-2px)';
                          el.style.boxShadow = '0 8px 18px rgba(15,23,42,0.16)';
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = '#f8fafc';
                          el.style.color = '#475569';
                          el.style.borderColor = '#e2e8f0';
                          el.style.transform = 'translateY(0)';
                          el.style.boxShadow = 'none';
                        }}
                        title={`Añadir ${meta.label}. ${meta.description}`}
                        aria-label={`Añadir ${meta.label}. ${meta.description}`}
                      >
                        <span style={es.toolbarBtnTopRow}>
                          <span style={es.toolbarBtnIconPill}>{BLOCK_TYPE_VISUAL_ICON[type]}</span>
                          <span>{meta.label}</span>
                        </span>
                        {!compactToolbar && <span style={es.toolbarBtnDescription}>{meta.description}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={es.toolbarHint}>Arrastra un componente al área de edición o haz clic para añadirlo al final.</p>

        <div style={es.templateManagerRow} className="block-editor-template-manager">
          <select
            style={es.styleSelect}
            value={selectedSectionTemplateId}
            onChange={e => setSelectedSectionTemplateId(e.target.value)}
          >
            <option value="">Plantilla de seccion...</option>
            {sectionTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={selectedSectionTemplateId ? es.selectionBtn : es.saveBtnDisabled}
            disabled={!selectedSectionTemplateId}
            onClick={() => insertSectionTemplateAtEnd(selectedSectionTemplateId)}
            title="Inserta al final una seccion completa desde plantilla"
          >
            Insertar plantilla
          </button>
          <button
            type="button"
            style={selectedSectionTemplateId ? es.selectionBtn : es.saveBtnDisabled}
            disabled={!selectedSectionTemplateId}
            onClick={() => renameSectionTemplate(selectedSectionTemplateId)}
            title="Renombrar plantilla seleccionada"
          >
            Renombrar
          </button>
          <button
            type="button"
            style={selectedSectionTemplateId ? es.templateDeleteBtn : es.saveBtnDisabled}
            disabled={!selectedSectionTemplateId}
            onClick={() => deleteSectionTemplate(selectedSectionTemplateId)}
            title="Eliminar plantilla seleccionada"
          >
            Eliminar
          </button>
          <button
            type="button"
            style={sectionTemplates.length > 0 ? es.selectionBtn : es.saveBtnDisabled}
            disabled={sectionTemplates.length === 0}
            onClick={exportSectionTemplates}
            title="Exportar plantillas a archivo JSON"
          >
            Exportar JSON
          </button>
          <button
            type="button"
            style={es.selectionBtn}
            onClick={() => templateFileInputRef.current?.click()}
            title="Importar plantillas desde archivo JSON"
          >
            Importar JSON
          </button>
        </div>

        {selectedTemplate && (
          <div style={es.templatePreviewPanel}>
            <div style={es.templatePreviewTitleRow}>
              <strong style={es.templatePreviewTitle}>Vista previa</strong>
              <span style={es.templatePreviewMeta}>{selectedTemplate.blocks.length} bloques</span>
            </div>
            <div style={es.templatePreviewChips}>
              {selectedTemplate.blocks.slice(0, 10).map((tb, index) => (
                <span key={`${selectedTemplate.id}-${index}`} style={es.templatePreviewChip}>
                  {getBlockMeta(tb.block_type).label}
                </span>
              ))}
              {selectedTemplate.blocks.length > 10 && (
                <span style={es.templatePreviewMore}>+{selectedTemplate.blocks.length - 10}</span>
              )}
            </div>
          </div>
        )}
        </aside>

        <div style={es.builderMain} className="block-editor-main">
          {blocks.length > 0 && (
            <div style={es.selectionBar}>
              <span style={es.selectionBarText}>Seleccionados: {selectedBlockIds.size}</span>
              <div style={es.selectionBarActions} className="block-editor-selection-actions">
                <button type="button" style={es.selectionBtn} onClick={selectAllBlocks}>Seleccionar todos</button>
                <button type="button" style={es.selectionBtn} onClick={clearBlockSelection}>Limpiar selección</button>
                <button type="button" style={es.selectionBtn} onClick={collapseAllBlocks}>Contraer todos</button>
                <button type="button" style={es.selectionBtn} onClick={expandAllBlocks}>Expandir todos</button>
              </div>
            </div>
          )}

          {/* Lista de bloques */}
          <div
            style={es.blockList}
            onDragOver={e => {
              const paletteType = e.dataTransfer.getData('application/x-atlas-block-type');
              const isPaletteDrag = (BLOCK_TYPES as ReadonlyArray<string>).includes(paletteType);
              if (dragIdx !== null || isPaletteDrag) {
                e.preventDefault();
                setDropIdx(blocks.length);
              }
            }}
            onDrop={handleBlockDrop}
          >
            {blocks.length === 0 && (
              <div style={es.emptyBlocks}>
                <span style={es.emptyBlocksIcon}>📄</span>
                <p style={es.emptyBlocksText}>
                  Aún no hay bloques. Arrastra componentes desde el menú lateral.
                </p>
              </div>
            )}

            {blocks.map((block, idx) => {
              const meta = getBlockMeta(block.block_type);
              const isDragging = dragIdx === idx;
              const isDropBefore = dropIdx === idx;
              const isDropAfterLast = idx === blocks.length - 1 && dropIdx === blocks.length;
              const isCollapsed = collapsedBlockIds.has(block.id);
              const currentSectionPos = getSectionPosForIndex(idx);
              const canMoveToPrevSection =
                block.block_type !== 'section' && sectionIndexes.length > 0 && currentSectionPos > 0;
              const canMoveToNextSection =
                block.block_type !== 'section' &&
                sectionIndexes.length > 0 &&
                (currentSectionPos === -1 || currentSectionPos < sectionIndexes.length - 1);

              return (
                <React.Fragment key={block.id}>
                  {isDropBefore && <div style={es.dropIndicator} />}
                  <div
                    style={{
                      ...es.blockCard,
                      borderLeft: `4px solid ${meta.color}`,
                      opacity: isDragging ? 0.3 : 1,
                      transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                    }}
                    onDragOver={e => handleBlockDragOver(e, idx)}
                  >
                    {/* Barra de cabecera del bloque */}
                    <div style={es.blockHeader}>
                      <div style={es.blockHeaderLeft} className="block-editor-header-left">
                        <label style={es.selectBlockLabel} title="Seleccionar bloque para aplicar estilo en lote">
                          <input
                            type="checkbox"
                            checked={selectedBlockIds.has(block.id)}
                            onChange={e => toggleBlockSelection(block.id, e.target.checked)}
                          />
                          Sel
                        </label>
                        <span
                          draggable
                          style={es.dragHandle}
                          title="Arrastra para reordenar"
                          onDragStart={e => handleBlockDragStart(e, idx)}
                          onDragEnd={handleBlockDragEnd}
                        >
                          ⠿
                        </span>
                        <span style={{ ...es.typeBadge, background: meta.color }}>
                          {meta.icon}
                        </span>
                        <span style={es.typeLabel}>{meta.label}</span>
                      </div>
                      <div className="block-editor-header-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {isCollapsed && <span style={es.previewStateBadge}>Vista previa</span>}
                        <button
                          type="button"
                          style={es.collapseBtn}
                          onClick={() => toggleBlockCollapsed(block.id)}
                          title={isCollapsed ? 'Expandir bloque' : 'Contraer bloque'}
                        >
                          {isCollapsed ? 'Editar' : 'Listo'}
                        </button>
                        <button
                          type="button"
                          style={canMoveToPrevSection ? es.sectionMoveBtn : es.sectionMoveBtnDisabled}
                          onClick={() => moveBlockToAdjacentSection(block.id, 'prev')}
                          title="Mover a la seccion anterior"
                          disabled={!canMoveToPrevSection}
                        >
                          ↑ Sec
                        </button>
                        <button
                          type="button"
                          style={canMoveToNextSection ? es.sectionMoveBtn : es.sectionMoveBtnDisabled}
                          onClick={() => moveBlockToAdjacentSection(block.id, 'next')}
                          title="Mover a la seccion siguiente"
                          disabled={!canMoveToNextSection}
                        >
                          ↓ Sec
                        </button>
                        <button
                          style={es.duplicateBtn}
                          onClick={() => duplicateBlock(block.id)}
                          title="Duplicar bloque"
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                        >
                          ⧉
                        </button>
                        <button
                          style={es.deleteBtn}
                          onClick={() => deleteBlock(block.id)}
                          title="Eliminar bloque"
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fee2e2')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Área de edición según tipo */}
                    {!isCollapsed && (
                      <MemoBlockContentEditor
                        block={block}
                        styleClipboard={styleClipboard}
                        selectedCount={selectedBlockIds.size}
                        stylePresets={stylePresets}
                        sectionTemplates={sectionTemplates}
                        allTemas={allTemas}
                        allSubtemas={allSubtemas}
                        onUpdateBlockContent={updateBlockContent}
                        onSetStyleClipboard={setStyleClipboard}
                        onApplyStyleToSelection={applyStyleToBlockSelection}
                        onSaveStylePreset={saveStylePreset}
                        onDeleteStylePreset={deleteStylePreset}
                        onSaveSectionTemplate={saveSectionTemplate}
                        onApplySectionTemplate={applySectionTemplate}
                        onInsertSectionTemplateBelow={insertSectionTemplateBelow}
                        onOpenImageModal={openImageModal}
                      />
                    )}

                    {isCollapsed && (
                      <div style={es.collapsedPreviewWrap}>
                        <ContentBlockRenderer blocks={[block]} />
                      </div>
                    )}
                  </div>
                  {isDropAfterLast && <div style={es.dropIndicator} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div style={es.versionPanel}>
        <div style={es.versionPanelHeader}>
          <strong style={es.versionPanelTitle}>Versiones de contenido</strong>
          <span style={es.versionPanelMeta}>{versions.length} registradas</span>
        </div>
        <div style={es.versionPanelActions} className="block-editor-version-actions">
          <button
            type="button"
            style={!isCreatingVersion ? es.selectionBtn : es.saveBtnDisabled}
            disabled={isCreatingVersion}
            onClick={handleCreateVersion}
          >
            {isCreatingVersion ? 'Creando version...' : 'Crear version'}
          </button>
          <button
            type="button"
            style={!isLoadingVersions ? es.selectionBtn : es.saveBtnDisabled}
            disabled={isLoadingVersions}
            onClick={refreshVersions}
          >
            {isLoadingVersions ? 'Actualizando...' : 'Refrescar historial'}
          </button>
          <select
            style={es.versionSelect}
            value={selectedVersionId}
            onChange={e => setSelectedVersionId(e.target.value)}
          >
            <option value="">Selecciona una version...</option>
            {versions.map(v => (
              <option key={v.id} value={String(v.id)}>
                #{v.id} · {new Date(v.created_at).toLocaleString()} · {v.blocks_count} bloques
                {v.snapshot_name ? ` · ${v.snapshot_name}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={selectedVersionId && !isRestoringVersion ? es.templateDeleteBtn : es.saveBtnDisabled}
            disabled={!selectedVersionId || isRestoringVersion}
            onClick={handleRestoreVersion}
          >
            {isRestoringVersion ? 'Restaurando...' : 'Restaurar version'}
          </button>
        </div>
      </div>

      {/* Barra de guardado */}
      <div style={es.saveBar}>
        <div style={es.saveBarLeft}>
          {saveError && <p style={es.saveError}>⚠️ {saveError}</p>}
          {saveSuccess && <p style={es.saveSuccess}>✅ Contenido guardado correctamente</p>}
          {hasPendingChanges && !saveError && !saveSuccess && (
            <p style={es.pendingMsg}>• Cambios pendientes de guardar</p>
          )}
          {!hasPendingChanges && !saveError && !saveSuccess && (
            <p style={es.publicationMsg}>
              Estado: {publicationStatus === 'published' ? 'Publicado' : 'Borrador'}
              {publishedAt ? ` • Ultima publicacion: ${new Date(publishedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <div style={es.saveBarActions} className="block-editor-save-actions">
          <button
            style={hasPendingChanges && !isSaving ? es.saveBtn : es.saveBtnDisabled}
            onClick={handleSave}
            disabled={!hasPendingChanges || isSaving}
          >
            {isSaving ? 'Guardando...' : hasPendingChanges ? 'Guardar contenido' : 'Sin cambios'}
          </button>
          <button
            style={!hasPendingChanges && !isPublishing && !isSaving ? es.publishBtn : es.saveBtnDisabled}
            onClick={handlePublish}
            disabled={hasPendingChanges || isPublishing || isSaving}
          >
            {isPublishing ? 'Publicando...' : 'Publicar'}
          </button>
          <button
            style={publicationStatus === 'published' && !isSwitchingToDraft ? es.draftBtn : es.saveBtnDisabled}
            onClick={handleSwitchToDraft}
            disabled={publicationStatus !== 'published' || isSwitchingToDraft}
          >
            {isSwitchingToDraft ? 'Cambiando...' : 'Pasar a borrador'}
          </button>
        </div>
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.tif,.tiff,.bmp,.avif,.webp"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <input
        ref={templateFileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleImportSectionTemplates}
      />

      {/* Modal selector de imagen */}
      {imageModal && (
        <ImagePickerModal
          tab={pickerTab}
          onTabChange={setPickerTab}
          placas={availablePlacas}
          loadingPlacas={loadingPlacas}
          uploadingImage={uploadingImage}
          fileInputRef={fileInputRef}
          onFileChange={handleFileUpload}
          onPickPlaca={handlePickPlaca}
          onClose={closeImageModal}
          entityType={entityType}
          allTemas={allTemas}
          allSubtemas={allSubtemas}
          allPlacas={allPlacas}
          allFilterTema={allFilterTema}
          allFilterSubtema={allFilterSubtema}
          loadingAll={loadingAll}
          onAllFilterTema={handleAllFilterTema}
          onAllFilterSubtema={handleAllFilterSubtema}
        />
      )}
      <LoadingToast visible={isSaving} type="saving" message="Guardando contenido" />
    </div>
  );
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface MemoBlockContentEditorProps {
  block: EditorBlock;
  styleClipboard: Record<string, string> | null;
  selectedCount: number;
  stylePresets: StylePreset[];
  sectionTemplates: SectionTemplate[];
  allTemas: AllTema[];
  allSubtemas: AllSubtema[];
  onUpdateBlockContent: (blockId: string, updates: Record<string, string>) => void;
  onSetStyleClipboard: React.Dispatch<React.SetStateAction<Record<string, string> | null>>;
  onApplyStyleToSelection: (style: Record<string, string>) => void;
  onSaveStylePreset: (style: Record<string, string>) => void;
  onDeleteStylePreset: (presetId: string) => void;
  onSaveSectionTemplate: (sectionId: string) => void;
  onApplySectionTemplate: (sectionId: string, templateId: string) => void;
  onInsertSectionTemplateBelow: (sectionId: string, templateId: string) => void;
  onOpenImageModal: (blockId: string, fieldKey: string) => void;
}

const MemoBlockContentEditor = React.memo(({
  block,
  styleClipboard,
  selectedCount,
  stylePresets,
  sectionTemplates,
  allTemas,
  allSubtemas,
  onUpdateBlockContent,
  onSetStyleClipboard,
  onApplyStyleToSelection,
  onSaveStylePreset,
  onDeleteStylePreset,
  onSaveSectionTemplate,
  onApplySectionTemplate,
  onInsertSectionTemplateBelow,
  onOpenImageModal,
}: MemoBlockContentEditorProps) => {
  return (
    <div style={es.blockContent}>
      <BlockStyleEditor
        bgColor={block.content.style_bg ?? ''}
        textColor={block.content.style_text ?? ''}
        borderColor={block.content.style_border ?? ''}
        radius={block.content.style_radius ?? '0'}
        padding={block.content.style_padding ?? '0'}
        maxWidth={block.content.style_max_width ?? 'full'}
        alignSelf={block.content.style_align ?? 'left'}
        shadow={block.content.style_shadow ?? 'none'}
        fontSize={block.content.style_font_size ?? 'default'}
        fontWeight={block.content.style_font_weight ?? 'default'}
        onChange={updates => onUpdateBlockContent(block.id, updates)}
        onCopyStyle={() => onSetStyleClipboard(pickStyleContent(block.content))}
        onPasteStyle={() => {
          if (!styleClipboard) return;
          onUpdateBlockContent(block.id, styleClipboard);
        }}
        canPasteStyle={Boolean(styleClipboard)}
        onPasteStyleToSelection={() => {
          if (!styleClipboard) return;
          onApplyStyleToSelection(styleClipboard);
        }}
        canPasteStyleToSelection={Boolean(styleClipboard) && selectedCount > 0}
        selectedCount={selectedCount}
        presets={stylePresets}
        onSavePreset={() => onSaveStylePreset(pickStyleContent(block.content))}
        onApplyPreset={presetId => {
          const preset = stylePresets.find(p => p.id === presetId);
          if (!preset) return;
          onUpdateBlockContent(block.id, preset.style);
        }}
        onDeletePreset={onDeleteStylePreset}
      />

      {(block.block_type === 'heading' ||
        block.block_type === 'subheading' ||
        block.block_type === 'paragraph') && (
        <>
          <div style={es.alignRow}>
            {(['left', 'center', 'right'] as const).map(align => {
              const current = block.content.text_align ?? 'left';
              const icons = { left: '⇤ Izq', center: '≡ Centro', right: 'Der ⇥' };
              return (
                <button
                  key={align}
                  style={{
                    ...es.alignBtn,
                    ...(current === align ? es.alignBtnActive : {}),
                  }}
                  onClick={() => onUpdateBlockContent(block.id, { text_align: align })}
                  title={icons[align]}
                >
                  {icons[align]}
                </button>
              );
            })}
          </div>
          <AutoTextarea
            value={block.content.text ?? ''}
            onChange={text => onUpdateBlockContent(block.id, { text })}
            placeholder={
              block.block_type === 'heading'
                ? 'Escribe el título...'
                : block.block_type === 'subheading'
                ? 'Escribe el subtítulo...'
                : 'Escribe el párrafo de texto descriptivo...'
            }
            extraStyle={{
              ...(block.block_type === 'heading'
                ? es.textareaHeading
                : block.block_type === 'subheading'
                ? es.textareaSubheading
                : es.textareaParagraph),
              textAlign: (block.content.text_align as React.CSSProperties['textAlign']) ?? 'left',
            }}
          />
        </>
      )}

      {block.block_type === 'section' && (
        <>
          <div style={es.sectionTemplateRow}>
            <button
              type="button"
              style={es.selectionBtn}
              onClick={() => onSaveSectionTemplate(block.id)}
            >
              Guardar plantilla de seccion
            </button>
            <select
              style={es.styleSelect}
              defaultValue=""
              onChange={e => {
                const templateId = e.target.value;
                if (!templateId) return;
                onApplySectionTemplate(block.id, templateId);
                e.currentTarget.value = '';
              }}
            >
              <option value="">Aplicar plantilla...</option>
              {sectionTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <select
              style={es.styleSelect}
              defaultValue=""
              onChange={e => {
                const templateId = e.target.value;
                if (!templateId) return;
                onInsertSectionTemplateBelow(block.id, templateId);
                e.currentTarget.value = '';
              }}
            >
              <option value="">Insertar plantilla debajo...</option>
              {sectionTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <SectionBlockEditor
            title={block.content.title ?? ''}
            subtitle={block.content.subtitle ?? ''}
            tone={(block.content.tone as 'neutral' | 'info' | 'accent') ?? 'neutral'}
            onTitleChange={title => onUpdateBlockContent(block.id, { title })}
            onSubtitleChange={subtitle => onUpdateBlockContent(block.id, { subtitle })}
            onToneChange={tone => onUpdateBlockContent(block.id, { tone })}
          />
        </>
      )}

      {block.block_type === 'columns_2' && (
        <ColumnsBlockEditor
          content={block.content}
          onContentChange={changes => onUpdateBlockContent(block.id, changes)}
        />
      )}

      {block.block_type === 'image' && (
        <ImageBlockEditor
          url={block.content.url ?? ''}
          caption={block.content.caption ?? ''}
          size={(block.content.size as 'small' | 'medium' | 'large') ?? 'large'}
          align={(block.content.align as 'left' | 'center' | 'right') ?? 'center'}
          onCaptionChange={caption => onUpdateBlockContent(block.id, { caption })}
          onSizeChange={size => onUpdateBlockContent(block.id, { size })}
          onAlignChange={align => onUpdateBlockContent(block.id, { align })}
          onPickImage={() => onOpenImageModal(block.id, 'url')}
        />
      )}

      {block.block_type === 'text_image' && (
        <TextImageBlockEditor
          text={block.content.text ?? ''}
          imageUrl={block.content.image_url ?? ''}
          imagePosition={
            (block.content.image_position as 'left' | 'right') ?? 'right'
          }
          imageCaption={block.content.image_caption ?? ''}
          textAlign={block.content.ti_text_align ?? 'left'}
          onTextChange={text => onUpdateBlockContent(block.id, { text })}
          onPositionChange={pos => onUpdateBlockContent(block.id, { image_position: pos })}
          onCaptionChange={caption => onUpdateBlockContent(block.id, { image_caption: caption })}
          onTextAlignChange={align => onUpdateBlockContent(block.id, { ti_text_align: align })}
          onPickImage={() => onOpenImageModal(block.id, 'image_url')}
        />
      )}

      {block.block_type === 'two_images' && (
        <TwoImagesBlockEditor
          imageUrlLeft={block.content.image_url_left ?? ''}
          imageCaptionLeft={block.content.image_caption_left ?? ''}
          imageUrlRight={block.content.image_url_right ?? ''}
          imageCaptionRight={block.content.image_caption_right ?? ''}
          onPickLeft={() => onOpenImageModal(block.id, 'image_url_left')}
          onPickRight={() => onOpenImageModal(block.id, 'image_url_right')}
          onCaptionLeftChange={v => onUpdateBlockContent(block.id, { image_caption_left: v })}
          onCaptionRightChange={v => onUpdateBlockContent(block.id, { image_caption_right: v })}
        />
      )}

      {block.block_type === 'three_images' && (
        <ThreeImagesBlockEditor
          urls={[block.content.image_url_1 ?? '', block.content.image_url_2 ?? '', block.content.image_url_3 ?? '']}
          captions={[block.content.image_caption_1 ?? '', block.content.image_caption_2 ?? '', block.content.image_caption_3 ?? '']}
          onPick={i => onOpenImageModal(block.id, `image_url_${i + 1}`)}
          onCaptionChange={(i, v) => onUpdateBlockContent(block.id, { [`image_caption_${i + 1}`]: v })}
        />
      )}

      {block.block_type === 'callout' && (
        <CalloutBlockEditor
          text={block.content.text ?? ''}
          variant={(block.content.variant as CalloutVariant) ?? 'info'}
          onTextChange={text => onUpdateBlockContent(block.id, { text })}
          onVariantChange={variant => onUpdateBlockContent(block.id, { variant })}
        />
      )}

      {block.block_type === 'list' && (
        <ListBlockEditor
          items={block.content.items ?? ''}
          style={(block.content.style as 'bullet' | 'numbered') ?? 'bullet'}
          onItemsChange={items => onUpdateBlockContent(block.id, { items })}
          onStyleChange={style => onUpdateBlockContent(block.id, { style })}
        />
      )}

      {block.block_type === 'divider' && (
        <DividerBlockEditor
          style={(block.content.style as DividerStyle) ?? 'gradient'}
          onStyleChange={style => onUpdateBlockContent(block.id, { style })}
        />
      )}

      {block.block_type === 'carousel' && (
        <CarouselBlockEditor
          content={block.content as Record<string, unknown>}
          onContentChange={changes => onUpdateBlockContent(block.id, changes as Record<string, string>)}
          onPickImage={field => onOpenImageModal(block.id, field)}
        />
      )}

      {block.block_type === 'text_carousel' && (
        <TextCarouselBlockEditor
          content={block.content as Record<string, unknown>}
          onContentChange={changes => onUpdateBlockContent(block.id, changes as Record<string, string>)}
          onPickImage={field => onOpenImageModal(block.id, field)}
        />
      )}

      {block.block_type === 'double_carousel' && (
        <DoubleCarouselBlockEditor
          content={block.content as Record<string, unknown>}
          onContentChange={changes => onUpdateBlockContent(block.id, changes as Record<string, string>)}
          onPickImage={field => onOpenImageModal(block.id, field)}
        />
      )}

      <BlockCtaLinksEditor
        content={block.content}
        allTemas={allTemas}
        allSubtemas={allSubtemas}
        onContentChange={changes => onUpdateBlockContent(block.id, changes)}
      />

    </div>
  );
});

// Editor de texto enriquecido
const AutoTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraStyle?: React.CSSProperties;
}> = ({ value, onChange, placeholder, extraStyle }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Escribe aquí...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        spellcheck: 'true',
        lang: 'es',
        autocorrect: 'on',
        autocapitalize: 'sentences',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    const current = editor.getHTML();
    if (incoming !== current) {
      editor.commands.setContent(incoming || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  const applyColor = (format: 'text' | 'highlight', color: string | false) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (format === 'text') {
      if (color === false) chain.unsetColor().run();
      else chain.setColor(color).run();
      return;
    }
    if (color === false) chain.unsetHighlight().run();
    else chain.setHighlight({ color }).run();
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace:', previousUrl ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  return (
    <div style={es.richTextWrap}>
      <div style={es.richQuickToolbar}>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleBold().run()}>
          Negrita
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          Cursiva
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          Subrayado
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          Tachado
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          Lista
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          Numerada
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
          Izq
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
          Centro
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
          Der
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={setLink}>
          Enlace
        </button>
        <label style={es.richQuickLabel}>
          Color texto
          <input
            type="color"
            defaultValue="#1e293b"
            onChange={e => applyColor('text', e.currentTarget.value)}
            style={es.richQuickColorInput}
            title="Aplicar color al texto seleccionado"
          />
        </label>
        <label style={es.richQuickLabel}>
          Fondo texto
          <input
            type="color"
            defaultValue="#fff59d"
            onChange={e => applyColor('highlight', e.currentTarget.value)}
            style={es.richQuickColorInput}
            title="Aplicar resaltado al texto seleccionado"
          />
        </label>
        <button type="button" style={es.richQuickResetBtn} onClick={() => applyColor('text', false)}>
          Limpiar color
        </button>
        <button type="button" style={es.richQuickResetBtn} onClick={() => applyColor('highlight', false)}>
          Limpiar fondo
        </button>
      </div>
      <EditorContent editor={editor} style={{ ...es.richEditorContent, ...extraStyle }} />
    </div>
  );
};

interface BlockStyleEditorProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
  radius: string;
  padding: string;
  maxWidth: string;
  alignSelf: string;
  shadow: string;
  fontSize: string;
  fontWeight: string;
  onChange: (updates: Record<string, string>) => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
  canPasteStyle: boolean;
  onPasteStyleToSelection: () => void;
  canPasteStyleToSelection: boolean;
  selectedCount: number;
  presets: StylePreset[];
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onDeletePreset: (presetId: string) => void;
}

const BlockStyleEditor: React.FC<BlockStyleEditorProps> = ({
  bgColor,
  textColor,
  borderColor,
  radius,
  padding,
  maxWidth,
  alignSelf,
  shadow,
  fontSize,
  fontWeight,
  onChange,
  onCopyStyle,
  onPasteStyle,
  canPasteStyle,
  onPasteStyleToSelection,
  canPasteStyleToSelection,
  selectedCount,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) => {
  const applyBgColor = (value: string) => {
    onChange({
      style_bg: value,
      ...(Number(radius || 0) <= 0 ? { style_radius: '12' } : {}),
      ...(Number(padding || 0) <= 0 ? { style_padding: '14' } : {}),
    });
  };

  const applyBorderColor = (value: string) => {
    onChange({
      style_border: value,
      ...(Number(radius || 0) <= 0 ? { style_radius: '12' } : {}),
      ...(Number(padding || 0) <= 0 ? { style_padding: '14' } : {}),
    });
  };

  const previewRadius = Number(radius || 0);
  const previewPadding = Number(padding || 0);
  const previewShadow =
    shadow === 'md'
      ? '0 10px 24px rgba(15,23,42,0.12)'
      : shadow === 'sm'
      ? '0 2px 10px rgba(15,23,42,0.08)'
      : 'none';
  const previewFontSize =
    fontSize === 'lg' ? '1.06em' : fontSize === 'sm' ? '0.9em' : '0.98em';
  const previewFontWeight =
    fontWeight !== 'default' ? Number(fontWeight) : 500;

  return (
  <div style={es.stylePanel}>
    <span style={es.stylePanelTitle}>Apariencia del bloque</span>
    <div style={es.stylePanelGrid}>
      <label style={es.styleFieldLabel}>
        Fondo del bloque
        <input
          type="color"
          value={bgColor || '#ffffff'}
          onChange={e => applyBgColor(e.target.value)}
          style={es.colorInput}
        />
      </label>
      <label style={es.styleFieldLabel}>
        Texto
        <input
          type="color"
          value={textColor || '#0f172a'}
          onChange={e => onChange({ style_text: e.target.value })}
          style={es.colorInput}
        />
      </label>
      <label style={es.styleFieldLabel}>
        Borde
        <input
          type="color"
          value={borderColor || '#e2e8f0'}
          onChange={e => applyBorderColor(e.target.value)}
          style={es.colorInput}
        />
      </label>
      <label style={es.styleFieldLabel}>
        Radio
        <input
          type="range"
          min={0}
          max={30}
          value={Number(radius || 0)}
          onChange={e => onChange({ style_radius: e.target.value })}
        />
      </label>
      <label style={es.styleFieldLabel}>
        Padding
        <input
          type="range"
          min={0}
          max={48}
          value={Number(padding || 0)}
          onChange={e => onChange({ style_padding: e.target.value })}
        />
      </label>
      <label style={es.styleFieldLabel}>
        Ancho
        <select value={maxWidth} onChange={e => onChange({ style_max_width: e.target.value })} style={es.styleSelect}>
          <option value="full">Completo</option>
          <option value="900">900px</option>
          <option value="700">700px</option>
          <option value="560">560px</option>
        </select>
      </label>
      <label style={es.styleFieldLabel}>
        Alineación
        <select value={alignSelf} onChange={e => onChange({ style_align: e.target.value })} style={es.styleSelect}>
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
        </select>
      </label>
      <label style={es.styleFieldLabel}>
        Sombra
        <select value={shadow} onChange={e => onChange({ style_shadow: e.target.value })} style={es.styleSelect}>
          <option value="none">Sin sombra</option>
          <option value="sm">Suave</option>
          <option value="md">Media</option>
        </select>
      </label>
      <label style={es.styleFieldLabel}>
        Tamaño texto
        <select value={fontSize} onChange={e => onChange({ style_font_size: e.target.value })} style={es.styleSelect}>
          <option value="default">Por defecto</option>
          <option value="sm">Pequeño</option>
          <option value="md">Medio</option>
          <option value="lg">Grande</option>
        </select>
      </label>
      <label style={es.styleFieldLabel}>
        Peso texto
        <select value={fontWeight} onChange={e => onChange({ style_font_weight: e.target.value })} style={es.styleSelect}>
          <option value="default">Normal</option>
          <option value="500">Semi</option>
          <option value="700">Negrita</option>
        </select>
      </label>
      <div style={es.stylePreviewWrap}>
        <span style={es.stylePreviewTitle}>Vista previa del bloque</span>
        <div
          style={{
            ...es.stylePreviewCard,
            background: bgColor || '#ffffff',
            color: textColor || '#0f172a',
            border: `1px solid ${borderColor || '#e2e8f0'}`,
            borderRadius: `${Number.isFinite(previewRadius) ? previewRadius : 0}px`,
            padding: `${Number.isFinite(previewPadding) ? previewPadding : 0}px`,
            boxShadow: previewShadow,
            fontSize: previewFontSize,
            fontWeight: previewFontWeight,
          }}
        >
          Este es el fondo del bloque
        </div>
      </div>
      <div style={es.styleActionsRow}>
        <button type="button" style={es.styleActionBtn} onClick={onCopyStyle}>
          Copiar estilo
        </button>
        <button
          type="button"
          style={canPasteStyle ? es.styleActionBtn : es.styleActionBtnDisabled}
          onClick={onPasteStyle}
          disabled={!canPasteStyle}
        >
          Pegar estilo
        </button>
        <button
          type="button"
          style={canPasteStyleToSelection ? es.styleActionBtn : es.styleActionBtnDisabled}
          onClick={onPasteStyleToSelection}
          disabled={!canPasteStyleToSelection}
        >
          Pegar en seleccion ({selectedCount})
        </button>
        <button type="button" style={es.styleActionBtn} onClick={onSavePreset}>
          Guardar preset
        </button>
      </div>
      <div style={es.stylePresetRow}>
        <label style={es.styleFieldLabel}>
          Presets
          <select
            defaultValue=""
            onChange={e => {
              if (!e.target.value) return;
              onApplyPreset(e.target.value);
              e.currentTarget.value = '';
            }}
            style={es.styleSelect}
          >
            <option value="">Aplicar preset...</option>
            {presets.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>
        <label style={es.styleFieldLabel}>
          Eliminar preset
          <select
            defaultValue=""
            onChange={e => {
              if (!e.target.value) return;
              onDeletePreset(e.target.value);
              e.currentTarget.value = '';
            }}
            style={es.styleSelect}
          >
            <option value="">Selecciona para borrar...</option>
            {presets.map(preset => (
              <option key={`del-${preset.id}`} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        style={es.styleResetBtn}
        onClick={() => onChange({
          style_bg: '',
          style_text: '',
          style_border: '',
          style_radius: '0',
          style_padding: '0',
          style_max_width: 'full',
          style_align: 'left',
          style_shadow: 'none',
          style_font_size: 'default',
          style_font_weight: 'default',
        })}
      >
        Restablecer
      </button>
    </div>
  </div>
  );
};

interface BlockCtaLinksEditorProps {
  content: Record<string, string>;
  allTemas: AllTema[];
  allSubtemas: AllSubtema[];
  onContentChange: (changes: Record<string, string>) => void;
}

const BlockCtaLinksEditor: React.FC<BlockCtaLinksEditorProps> = ({ content, allTemas, allSubtemas, onContentChange }) => {
  const position = (content.cta_position as 'before' | 'after') ?? 'after';
  const layout = (content.cta_layout as 'row' | 'column') ?? 'row';
  const align = (content.cta_align as 'left' | 'center' | 'right') ?? 'left';
  const gap = content.cta_gap ?? '12';
  const style = (content.cta_style as 'solid' | 'outline' | 'soft') ?? 'solid';
  const size = (content.cta_size as 'sm' | 'md' | 'lg') ?? 'md';
  const shape = (content.cta_shape as 'rounded' | 'pill' | 'square') ?? 'rounded';
  const hasAnyCta = CTA_SLOTS.some(slot => {
    const text = (content[`cta_${slot}_text`] ?? '').trim();
    const url = (content[`cta_${slot}_url`] ?? '').trim();
    return text.length > 0 || url.length > 0;
  });
  const highestConfiguredSlot = CTA_SLOTS.reduce((max, slot) => {
    const text = (content[`cta_${slot}_text`] ?? '').trim();
    const url = (content[`cta_${slot}_url`] ?? '').trim();
    return text.length > 0 || url.length > 0 ? slot : max;
  }, 0);
  const [enabled, setEnabled] = useState(hasAnyCta);
  const [visibleSlots, setVisibleSlots] = useState<number>(Math.max(1, highestConfiguredSlot || 1));

  useEffect(() => {
    if (hasAnyCta && !enabled) {
      setEnabled(true);
    }
    if (highestConfiguredSlot > visibleSlots) {
      setVisibleSlots(highestConfiguredSlot);
    }
  }, [enabled, hasAnyCta, highestConfiguredSlot, visibleSlots]);

  const clearAllCtas = () => {
    const updates: Record<string, string> = {};
    CTA_SLOTS.forEach(slot => {
      updates[`cta_${slot}_text`] = '';
      updates[`cta_${slot}_url`] = '';
      updates[`cta_${slot}_new_tab`] = 'false';
    });
    onContentChange(updates);
    setEnabled(false);
    setVisibleSlots(1);
  };

  const removeSlot = (slot: number) => {
    const updates: Record<string, string> = {};
    const lastSlot = CTA_SLOTS.length;

    // Compacta slots: al eliminar uno, sube los siguientes para evitar huecos.
    for (let i = slot; i <= lastSlot; i++) {
      const textKey = `cta_${i}_text`;
      const urlKey = `cta_${i}_url`;
      const tabKey = `cta_${i}_new_tab`;

      if (i < lastSlot) {
        updates[textKey] = content[`cta_${i + 1}_text`] ?? '';
        updates[urlKey] = content[`cta_${i + 1}_url`] ?? '';
        updates[tabKey] = content[`cta_${i + 1}_new_tab`] ?? 'false';
      } else {
        updates[textKey] = '';
        updates[urlKey] = '';
        updates[tabKey] = 'false';
      }
    }

    onContentChange(updates);
    setVisibleSlots(prev => Math.max(1, prev - 1));
  };

  const temaNameById = allTemas.reduce<Record<number, string>>((acc, tema) => {
    acc[tema.id] = tema.nombre;
    return acc;
  }, {});

  if (!enabled) {
    return (
      <div style={{ ...es.tiEditorWrap, border: '1px dashed #bfdbfe', background: '#f8fbff' }}>
        <button
          type="button"
          style={es.selectionBtn}
          onClick={() => {
            setEnabled(true);
            setVisibleSlots(Math.max(1, highestConfiguredSlot || 1));
          }}
        >
          + Agregar botones
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...es.tiEditorWrap, border: '1px solid #dbeafe', background: '#f8fbff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
        <p style={{ margin: 0, fontWeight: 800, color: '#1e3a8a', fontSize: '0.88em' }}>
          Botones del bloque
        </p>
        <button type="button" style={es.deleteBtn} onClick={clearAllCtas}>Ocultar botones</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
        <span style={es.fieldLabel}>Posición en el bloque:</span>
        {(['before', 'after'] as const).map(v => (
          <button
            key={v}
            type="button"
            style={{ ...es.posBtn, ...(position === v ? es.posBtnActive : {}) }}
            onClick={() => onContentChange({ cta_position: v })}
          >
            {v === 'before' ? 'Antes del contenido' : 'Al final del contenido'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '12px', marginTop: '6px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
          <span style={es.fieldLabel}>Distribución:</span>
          {(['row', 'column'] as const).map(v => (
            <button key={v} style={{ ...es.posBtn, ...(layout === v ? es.posBtnActive : {}) }} onClick={() => onContentChange({ cta_layout: v })}>
              {v === 'row' ? 'Fila' : 'Columna'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
          <span style={es.fieldLabel}>Alineación:</span>
          {(['left', 'center', 'right'] as const).map(v => (
            <button key={v} style={{ ...es.posBtn, ...(align === v ? es.posBtnActive : {}) }} onClick={() => onContentChange({ cta_align: v })}>
              {v === 'left' ? '⇤ Izq' : v === 'center' ? '≡ Centro' : 'Der ⇥'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <label style={es.fieldLabel}>
          Espaciado
          <input
            type="number"
            min={0}
            max={32}
            step={1}
            value={gap}
            onChange={e => onContentChange({ cta_gap: e.currentTarget.value || '12' })}
            style={{ ...es.captionInput, marginTop: '4px' }}
          />
        </label>
        <label style={es.fieldLabel}>
          Estilo
          <select value={style} onChange={e => onContentChange({ cta_style: e.currentTarget.value })} style={{ ...es.styleSelect, marginTop: '4px' }}>
            <option value="solid">Sólido</option>
            <option value="outline">Borde</option>
            <option value="soft">Suave</option>
          </select>
        </label>
        <label style={es.fieldLabel}>
          Tamaño
          <select value={size} onChange={e => onContentChange({ cta_size: e.currentTarget.value })} style={{ ...es.styleSelect, marginTop: '4px' }}>
            <option value="sm">Pequeño</option>
            <option value="md">Mediano</option>
            <option value="lg">Grande</option>
          </select>
        </label>
        <label style={es.fieldLabel}>
          Forma
          <select value={shape} onChange={e => onContentChange({ cta_shape: e.currentTarget.value })} style={{ ...es.styleSelect, marginTop: '4px' }}>
            <option value="rounded">Redondeado</option>
            <option value="pill">Píldora</option>
            <option value="square">Recto</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <label style={es.fieldLabel}>
          Color del botón
          <input
            type="color"
            value={content.cta_color ?? '#2563eb'}
            onChange={e => onContentChange({ cta_color: e.currentTarget.value })}
            style={{ ...es.colorInput, marginTop: '4px' }}
          />
        </label>
        <label style={es.fieldLabel}>
          Color del texto
          <input
            type="color"
            value={content.cta_text_color ?? '#ffffff'}
            onChange={e => onContentChange({ cta_text_color: e.currentTarget.value })}
            style={{ ...es.colorInput, marginTop: '4px' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
        {CTA_SLOTS.slice(0, visibleSlots).map(slot => {
          const textKey = `cta_${slot}_text`;
          const urlKey = `cta_${slot}_url`;
          const tabKey = `cta_${slot}_new_tab`;
          const opensNewTab = (content[tabKey] ?? 'false') === 'true';

          return (
            <div key={slot} style={{ border: '1px solid #dbeafe', borderRadius: '10px', padding: '10px', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <p style={{ ...es.fieldLabel, margin: 0 }}>Botón {slot}</p>
                {visibleSlots > 1 && (
                  <button type="button" style={es.deleteBtn} onClick={() => removeSlot(slot)}>Quitar</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr auto', gap: '8px', alignItems: 'center' }}>
                <BoldField
                  as="input"
                  style={es.captionInput}
                  value={content[textKey] ?? ''}
                  onChange={v => onContentChange({ [textKey]: v })}
                  placeholder="Texto"
                />
                <BoldField
                  as="input"
                  style={es.captionInput}
                  value={content[urlKey] ?? ''}
                  onChange={v => onContentChange({ [urlKey]: v })}
                  placeholder="/ruta o https://..."
                />
                <button
                  type="button"
                  style={{ ...es.posBtn, ...(opensNewTab ? es.posBtnActive : {}) }}
                  onClick={() => onContentChange({ [tabKey]: String(!opensNewTab) })}
                >
                  Nueva pestaña
                </button>
              </div>

              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', color: '#1d4ed8', fontWeight: 600, fontSize: '0.82em' }}>
                  Rutas internas sugeridas
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginTop: '8px' }}>
                  {INTERNAL_ROUTE_OPTIONS.map(route => (
                    <button
                      key={`${slot}-${route.path}`}
                      type="button"
                      style={es.selectionBtn}
                      onClick={() => onContentChange({ [urlKey]: route.path })}
                    >
                      {route.label}: {route.path}
                    </button>
                  ))}

                  {allTemas.length > 0 && (
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#334155', fontWeight: 600, fontSize: '0.8em' }}>
                        Temas
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '6px' }}>
                        {allTemas.map(tema => {
                          const route = `/subtemas/${tema.id}`;
                          return (
                            <button
                              key={`${slot}-tema-${tema.id}`}
                              type="button"
                              style={es.selectionBtn}
                              onClick={() => onContentChange({ [urlKey]: route })}
                              title={route}
                            >
                              {tema.nombre}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {allSubtemas.length > 0 && (
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#334155', fontWeight: 600, fontSize: '0.8em' }}>
                        Subtemas
                      </summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: '6px' }}>
                        {allSubtemas.map(subtema => {
                          const route = `/ver-placas/${subtema.id}`;
                          const temaName = temaNameById[subtema.tema_id] ?? 'Tema';
                          return (
                            <button
                              key={`${slot}-subtema-${subtema.id}`}
                              type="button"
                              style={es.selectionBtn}
                              onClick={() => onContentChange({ [urlKey]: route })}
                              title={route}
                            >
                              {temaName} / {subtema.nombre}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </details>
            </div>
          );
        })}

        {visibleSlots < CTA_SLOTS.length && (
          <button
            type="button"
            style={es.selectionBtn}
            onClick={() => setVisibleSlots(prev => Math.min(CTA_SLOTS.length, prev + 1))}
          >
            + Añadir otro botón
          </button>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.78em', color: '#64748b' }}>
        Internos: usa rutas como /temario. Externos: usa https://... Esto funciona igual en local y Cloudflare Pages.
      </p>
    </div>
  );
};

// Editor de bloque imagen
interface ImageBlockEditorProps {
  url: string;
  caption: string;
  size: 'small' | 'medium' | 'large';
  align: 'left' | 'center' | 'right';
  onCaptionChange: (v: string) => void;
  onSizeChange: (v: string) => void;
  onAlignChange: (v: string) => void;
  onPickImage: () => void;
}
const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({
  url, caption, size, align, onCaptionChange, onSizeChange, onAlignChange, onPickImage,
}) => (
  <div style={es.imageBlockWrap}>
    <div style={es.imageBlockRow}>
      {url ? (
        <div style={es.imagePreviewWrap}>
          <img src={getCloudinaryImageUrl(url, 'thumb')} alt="Vista previa" style={es.imagePreview} />
          <button
            style={es.changeImgBtn}
            onClick={onPickImage}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f8fafc')}
          >
            🔄 Cambiar imagen
          </button>
        </div>
      ) : (
        <button
          style={es.pickImgBtn}
          onClick={onPickImage}
          onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#38bdf8'; el.style.background = '#f0f9ff'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#cbd5e1'; el.style.background = '#f8fafc'; }}
        >
          🖼 Seleccionar imagen
        </button>
      )}
    </div>
    {/* Tamaño y alineación */}
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const, marginTop: '10px' }}>
      <div>
        <span style={es.fieldLabel}>Tamaño:</span>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          {(['small', 'medium', 'large'] as const).map(s => (
            <button key={s} style={{ ...es.posBtn, ...(size === s ? es.posBtnActive : {}) }} onClick={() => onSizeChange(s)}>
              {s === 'small' ? 'Pequeña' : s === 'medium' ? 'Mediana' : 'Grande'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span style={es.fieldLabel}>Alineación:</span>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          {(['left', 'center', 'right'] as const).map(a => {
            const icons = { left: '⇤ Izq', center: '≡ Centro', right: 'Der ⇥' };
            return (
              <button key={a} style={{ ...es.alignBtn, ...(align === a ? es.alignBtnActive : {}) }} onClick={() => onAlignChange(a)}>{icons[a]}</button>
            );
          })}
        </div>
      </div>
    </div>
    <div style={es.captionRow}>
      <label style={es.fieldLabel}>Pie de foto (opcional)</label>
      <BoldField
        as="input"
        style={es.captionInput}
        value={caption}
        onChange={onCaptionChange}
        placeholder="Descripción de la imagen..."
      />
    </div>
  </div>
);

// Editor de bloque texto + imagen
interface TextImageBlockEditorProps {
  text: string;
  imageUrl: string;
  imagePosition: 'left' | 'right';
  imageCaption: string;
  textAlign: string;
  onTextChange: (v: string) => void;
  onPositionChange: (v: 'left' | 'right') => void;
  onCaptionChange: (v: string) => void;
  onTextAlignChange: (v: string) => void;
  onPickImage: () => void;
}
const TextImageBlockEditor: React.FC<TextImageBlockEditorProps> = ({
  text,
  imageUrl,
  imagePosition,
  imageCaption,
  textAlign,
  onTextChange,
  onPositionChange,
  onCaptionChange,
  onTextAlignChange,
  onPickImage,
}) => (
  <div style={es.tiEditorWrap}>
    <div style={es.tiEditorGrid}>
      {/* Columna de texto */}
      <div style={es.tiCol}>
        <label style={es.fieldLabel}>Texto</label>
        {/* Controles de alineación */}
        <div style={es.alignRow}>
          {(['left', 'center', 'right'] as const).map(align => {
            const icons = { left: '⇤ Izq', center: '≡ Centro', right: 'Der ⇥' };
            return (
              <button
                key={align}
                style={{
                  ...es.alignBtn,
                  ...(textAlign === align ? es.alignBtnActive : {}),
                }}
                onClick={() => onTextAlignChange(align)}
                title={icons[align]}
              >
                {icons[align]}
              </button>
            );
          })}
        </div>
        <AutoTextarea
          value={text}
          onChange={onTextChange}
          placeholder="Escribe el contenido descriptivo aquí..."
          extraStyle={{ ...es.textareaParagraph, textAlign: textAlign as React.CSSProperties['textAlign'] }}
        />
      </div>

      {/* Columna de imagen */}
      <div style={es.tiCol}>
        <label style={es.fieldLabel}>Imagen</label>
        {imageUrl ? (
          <>
            <img src={getCloudinaryImageUrl(imageUrl, 'thumb')} alt="Vista previa" style={es.tiImgPreview} />
            <button
              style={es.changeImgBtn}
              onClick={onPickImage}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f8fafc')}
            >
              🔄 Cambiar imagen
            </button>
          </>
        ) : (
          <button
            style={{ ...es.pickImgBtn, minHeight: '100px' }}
            onClick={onPickImage}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = '#38bdf8';
              el.style.background = '#f0f9ff';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = '#cbd5e1';
              el.style.background = '#f8fafc';
            }}
          >
            🖼 Seleccionar imagen
          </button>
        )}
        <BoldField
          as="input"
          style={{ ...es.captionInput, marginTop: '6px' }}
          value={imageCaption}
          onChange={onCaptionChange}
          placeholder="Pie de foto..."
        />
      </div>
    </div>

    {/* Toggle posición de imagen */}
    <div style={es.positionRow}>
      <span style={es.fieldLabel}>Posición de la imagen:</span>
      <div style={es.positionBtns}>
        <button
          style={{
            ...es.posBtn,
            ...(imagePosition === 'left' ? es.posBtnActive : {}),
          }}
          onClick={() => onPositionChange('left')}
        >
          ⬅ Izquierda
        </button>
        <button
          style={{
            ...es.posBtn,
            ...(imagePosition === 'right' ? es.posBtnActive : {}),
          }}
          onClick={() => onPositionChange('right')}
        >
          Derecha ➡
        </button>
      </div>
    </div>
  </div>
);

// Editor de bloque dos imágenes
interface TwoImagesBlockEditorProps {
  imageUrlLeft: string;
  imageCaptionLeft: string;
  imageUrlRight: string;
  imageCaptionRight: string;
  onPickLeft: () => void;
  onPickRight: () => void;
  onCaptionLeftChange: (v: string) => void;
  onCaptionRightChange: (v: string) => void;
}
const TwoImagesBlockEditor: React.FC<TwoImagesBlockEditorProps> = ({
  imageUrlLeft, imageCaptionLeft, imageUrlRight, imageCaptionRight,
  onPickLeft, onPickRight, onCaptionLeftChange, onCaptionRightChange,
}) => (
  <div style={es.tiEditorWrap}>
    <div style={es.tiEditorGrid}>
      {/* Imagen izquierda */}
      <div style={es.tiCol}>
        <label style={es.fieldLabel}>Imagen izquierda</label>
        {imageUrlLeft ? (
          <>
            <img src={getCloudinaryImageUrl(imageUrlLeft, 'thumb')} alt="Vista previa" style={es.tiImgPreview} />
            <button
              style={es.changeImgBtn}
              onClick={onPickLeft}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f8fafc')}
            >🔄 Cambiar imagen</button>
          </>
        ) : (
          <button
            style={{ ...es.pickImgBtn, minHeight: '100px' }}
            onClick={onPickLeft}
            onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#38bdf8'; el.style.background = '#f0f9ff'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#cbd5e1'; el.style.background = '#f8fafc'; }}
          >🖼 Seleccionar imagen</button>
        )}
        <BoldField
          as="input"
          style={{ ...es.captionInput, marginTop: '6px' }}
          value={imageCaptionLeft}
          onChange={onCaptionLeftChange}
          placeholder="Pie de foto izquierda..."
        />
      </div>

      {/* Imagen derecha */}
      <div style={es.tiCol}>
        <label style={es.fieldLabel}>Imagen derecha</label>
        {imageUrlRight ? (
          <>
            <img src={getCloudinaryImageUrl(imageUrlRight, 'thumb')} alt="Vista previa" style={es.tiImgPreview} />
            <button
              style={es.changeImgBtn}
              onClick={onPickRight}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f8fafc')}
            >🔄 Cambiar imagen</button>
          </>
        ) : (
          <button
            style={{ ...es.pickImgBtn, minHeight: '100px' }}
            onClick={onPickRight}
            onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#38bdf8'; el.style.background = '#f0f9ff'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#cbd5e1'; el.style.background = '#f8fafc'; }}
          >🖼 Seleccionar imagen</button>
        )}
        <BoldField
          as="input"
          style={{ ...es.captionInput, marginTop: '6px' }}
          value={imageCaptionRight}
          onChange={onCaptionRightChange}
          placeholder="Pie de foto derecha..."
        />
      </div>
    </div>
  </div>
);

// Editor de bloque tres imágenes
interface ThreeImagesBlockEditorProps {
  urls: string[];
  captions: string[];
  onPick: (i: number) => void;
  onCaptionChange: (i: number, v: string) => void;
}
const LABEL_3 = ['Imagen izquierda', 'Imagen central', 'Imagen derecha'];
const ThreeImagesBlockEditor: React.FC<ThreeImagesBlockEditorProps> = ({ urls, captions, onPick, onCaptionChange }) => (
  <div style={es.tiEditorWrap}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={es.tiCol}>
          <label style={es.fieldLabel}>{LABEL_3[i]}</label>
          {urls[i] ? (
            <>
              <img src={getCloudinaryImageUrl(urls[i], 'thumb')} alt="Vista previa" style={es.tiImgPreview} />
              <button style={es.changeImgBtn} onClick={() => onPick(i)}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e0f2fe')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f8fafc')}
              >🔄 Cambiar</button>
            </>
          ) : (
            <button style={{ ...es.pickImgBtn, minHeight: '80px' }} onClick={() => onPick(i)}
              onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#38bdf8'; el.style.background = '#f0f9ff'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#cbd5e1'; el.style.background = '#f8fafc'; }}
            >🖼 Seleccionar</button>
          )}
          <BoldField as="input" style={{ ...es.captionInput, marginTop: '6px' }}
            value={captions[i]} onChange={v => onCaptionChange(i, v)} placeholder="Pie de foto..." />
        </div>
      ))}
    </div>
  </div>
);

interface SectionBlockEditorProps {
  title: string;
  subtitle: string;
  tone: 'neutral' | 'info' | 'accent';
  onTitleChange: (v: string) => void;
  onSubtitleChange: (v: string) => void;
  onToneChange: (v: 'neutral' | 'info' | 'accent') => void;
}
const SectionBlockEditor: React.FC<SectionBlockEditorProps> = ({
  title,
  subtitle,
  tone,
  onTitleChange,
  onSubtitleChange,
  onToneChange,
}) => (
  <div style={es.tiEditorWrap}>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
      <span style={es.fieldLabel}>Tono visual:</span>
      {(['neutral', 'info', 'accent'] as const).map(v => (
        <button key={v} style={{ ...es.posBtn, ...(tone === v ? es.posBtnActive : {}) }} onClick={() => onToneChange(v)}>
          {v === 'neutral' ? 'Neutro' : v === 'info' ? 'Informativo' : 'Acento'}
        </button>
      ))}
    </div>
    <p style={{ margin: 0, fontSize: '0.78em', color: '#64748b' }}>
      Los bloques colocados debajo de esta seccion (hasta la siguiente seccion) quedaran agrupados dentro de ella en la vista publica.
    </p>
    <BoldField as="input" style={es.captionInput} value={title} onChange={onTitleChange} placeholder="Título de sección (opcional)..." />
    <AutoTextarea value={subtitle} onChange={onSubtitleChange} placeholder="Subtítulo o descripción breve de la sección..." extraStyle={es.textareaParagraph} />
  </div>
);

interface ColumnsBlockEditorProps {
  content: Record<string, string>;
  onContentChange: (changes: Record<string, string>) => void;
}
const ColumnsBlockEditor: React.FC<ColumnsBlockEditorProps> = ({ content, onContentChange }) => {
  const columns = (() => {
    const raw = Number(content.columns ?? 2);
    if (!Number.isFinite(raw)) return 2;
    return Math.max(2, Math.min(4, raw));
  })();

  const values = [
    content.col_1 ?? content.left ?? '',
    content.col_2 ?? content.right ?? '',
    content.col_3 ?? '',
    content.col_4 ?? '',
  ];

  const ratio = (content.ratio as '1:1' | '2:1' | '1:2') ?? '1:1';

  return (
    <div style={es.tiEditorWrap}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
          <span style={es.fieldLabel}>Columnas:</span>
          {[2, 3, 4].map(v => (
            <button
              key={v}
              style={{ ...es.posBtn, ...(columns === v ? es.posBtnActive : {}) }}
              onClick={() => onContentChange({ columns: String(v) })}
            >
              {v}
            </button>
          ))}
        </div>
        {columns === 2 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <span style={es.fieldLabel}>Proporción:</span>
            {(['1:1', '2:1', '1:2'] as const).map(v => (
              <button key={v} style={{ ...es.posBtn, ...(ratio === v ? es.posBtnActive : {}) }} onClick={() => onContentChange({ ratio: v })}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '12px' }}>
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} style={es.tiCol}>
            <label style={es.fieldLabel}>Columna {idx + 1}</label>
            <AutoTextarea
              value={values[idx]}
              onChange={v => onContentChange({ [`col_${idx + 1}`]: v })}
              placeholder={`Contenido columna ${idx + 1}...`}
              extraStyle={es.textareaParagraph}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Editor de bloque callout
type CalloutVariant = 'info' | 'tip' | 'warning' | 'clinical';
const CALLOUT_META: Record<CalloutVariant, { icon: string; label: string; bg: string; border: string; color: string }> = {
  info:     { icon: 'ℹ️',  label: 'Información', bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
  tip:      { icon: '💡',  label: 'Consejo',      bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
  warning:  { icon: '⚠️',  label: 'Importante',  bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
  clinical: { icon: '🔬',  label: 'Dato clínico', bg: '#fdf4ff', border: '#d8b4fe', color: '#7e22ce' },
};
interface CalloutBlockEditorProps {
  text: string;
  variant: CalloutVariant;
  onTextChange: (v: string) => void;
  onVariantChange: (v: CalloutVariant) => void;
}
const CalloutBlockEditor: React.FC<CalloutBlockEditorProps> = ({ text, variant, onTextChange, onVariantChange }) => (
  <div style={es.tiEditorWrap}>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
      <span style={es.fieldLabel}>Tipo:</span>
      {(Object.keys(CALLOUT_META) as CalloutVariant[]).map(v => {
        const m = CALLOUT_META[v];
        const active = variant === v;
        return (
          <button key={v} onClick={() => onVariantChange(v)} style={{
            ...es.posBtn, ...(active ? { ...es.posBtnActive, background: m.bg, color: m.color, borderColor: m.border } : {}),
          }}>{m.icon} {m.label}</button>
        );
      })}
    </div>
    <AutoTextarea value={text} onChange={onTextChange} placeholder="Escribe el contenido destacado..." extraStyle={es.textareaParagraph} />
  </div>
);

// Editor de bloque lista
interface ListBlockEditorProps {
  items: string;
  style: 'bullet' | 'numbered';
  onItemsChange: (v: string) => void;
  onStyleChange: (v: string) => void;
}
const ListBlockEditor: React.FC<ListBlockEditorProps> = ({ items, style, onItemsChange, onStyleChange }) => (
  <div style={es.tiEditorWrap}>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
      <span style={es.fieldLabel}>Estilo:</span>
      {(['bullet', 'numbered'] as const).map(s => (
        <button key={s} style={{ ...es.posBtn, ...(style === s ? es.posBtnActive : {}) }} onClick={() => onStyleChange(s)}>
          {s === 'bullet' ? '• Viñetas' : '1. Numerada'}
        </button>
      ))}
    </div>
    <AutoTextarea
      value={items}
      onChange={onItemsChange}
      placeholder="Escribe cada ítem en una línea separada..."
      extraStyle={es.textareaParagraph}
    />
    <p style={{ margin: '6px 0 0', fontSize: '0.78em', color: '#94a3b8' }}>
      Cada línea es un ítem de la lista. Líneas vacías se ignoran.
    </p>
  </div>
);

// Editor de bloque divisor
type DividerStyle = 'gradient' | 'simple' | 'labeled';
interface DividerBlockEditorProps {
  style: DividerStyle;
  onStyleChange: (v: string) => void;
}
const DividerBlockEditor: React.FC<DividerBlockEditorProps> = ({ style, onStyleChange }) => (
  <div style={es.tiEditorWrap}>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span style={es.fieldLabel}>Estilo del separador:</span>
      {(['gradient', 'simple', 'labeled'] as const).map(s => (
        <button key={s} style={{ ...es.posBtn, ...(style === s ? es.posBtnActive : {}) }} onClick={() => onStyleChange(s)}>
          {s === 'gradient' ? '— Degradado' : s === 'simple' ? '— Simple' : '— Con puntos'}
        </button>
      ))}
    </div>
    <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
      {style === 'gradient' && <div style={{ height: '3px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px' }} />}
      {style === 'simple' && <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />}
      {style === 'labeled' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span style={{ display: 'flex', gap: '4px' }}>
            {[0,1,2].map(i => <span key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />)}
          </span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>
      )}
    </div>
  </div>
);

// ── Utilidades para bloques de carrusel ────────────────────────────────────────
const MAX_CAROUSEL_SLIDES = 8;
const MAX_HALF_SLIDES = 5;
const CTA_SLOTS = [1, 2, 3, 4] as const;

const INTERNAL_ROUTE_OPTIONS: Array<{ label: string; path: string }> = [
  { label: 'Inicio', path: '/' },
  { label: 'Temario público', path: '/temario' },
  { label: 'Subtemas (ejemplo)', path: '/subtemas/1' },
  { label: 'Placas por subtema (ejemplo)', path: '/ver-placas/1' },
];

function getSlidesFromContent(
  content: Record<string, unknown>,
  prefix: string,
  max: number,
): { url: string; caption: string }[] {
  const slides: { url: string; caption: string }[] = [];
  for (let i = 1; i <= max; i++) {
    const url = (content[`${prefix}url_${i}`] as string) ?? '';
    if (!url) break;
    slides.push({ url, caption: (content[`${prefix}cap_${i}`] as string) ?? '' });
  }
  return slides;
}

function slidesToContent(
  slides: { url: string; caption: string }[],
  prefix: string,
  max: number,
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 1; i <= max; i++) {
    const s = slides[i - 1];
    obj[`${prefix}url_${i}`] = s?.url ?? '';
    obj[`${prefix}cap_${i}`] = s?.caption ?? '';
  }
  return obj;
}

interface CarouselSlotsEditorProps {
  slides: { url: string; caption: string }[];
  maxSlides: number;
  onPickSlot: (idx: number) => void;
  onCaptionChange: (idx: number, cap: string) => void;
  onRemoveSlot: (idx: number) => void;
  label?: string;
}
const CarouselSlotsEditor: React.FC<CarouselSlotsEditorProps> = ({
  slides, maxSlides, onPickSlot, onCaptionChange, onRemoveSlot, label,
}) => (
  <div>
    {label && <p style={{ ...es.fieldLabel, marginBottom: '8px', fontWeight: 700 }}>{label}</p>}
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
      {slides.map((slide, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <img
            src={getCloudinaryImageUrl(slide.url, 'thumbSmall')} alt="Vista previa"
            style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => onPickSlot(idx)}
            title="Cambiar imagen"
            loading="lazy"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <BoldField as="input" value={slide.caption} onChange={v => onCaptionChange(idx, v)} placeholder="Pie de foto..." style={es.captionInput} />
          </div>
          <button
            style={{ ...es.deleteBtn, fontSize: '0.78em', padding: '4px 8px' }}
            onClick={() => onRemoveSlot(idx)} title="Quitar"
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fee2e2')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
          >✕</button>
        </div>
      ))}
      {slides.length < maxSlides && (
        <button
          style={{ ...es.pickImgBtn, padding: '8px 14px' }}
          onClick={() => onPickSlot(slides.length)}
          onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#38bdf8'; el.style.background = '#f0f9ff'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#cbd5e1'; el.style.background = '#f8fafc'; }}
        >+ Añadir imagen ({slides.length}/{maxSlides})</button>
      )}
      {slides.length >= maxSlides && (
        <p style={{ margin: 0, fontSize: '0.76em', color: '#94a3b8' }}>Máximo alcanzado ({maxSlides} imágenes)</p>
      )}
    </div>
  </div>
);

// Fila de configuración de intervalo
interface IntervalRowProps {
  interval: number;
  auto: boolean;
  onIntervalChange: (v: number) => void;
  onAutoChange: (v: boolean) => void;
}
const IntervalRow: React.FC<IntervalRowProps> = ({ interval, auto, onIntervalChange, onAutoChange }) => (
  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
    <div>
      <span style={es.fieldLabel}>Auto-avance:</span>
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <button style={{ ...es.posBtn, ...(auto ? es.posBtnActive : {}) }} onClick={() => onAutoChange(true)}>✓ Automático</button>
        <button style={{ ...es.posBtn, ...(!auto ? es.posBtnActive : {}) }} onClick={() => onAutoChange(false)}>Solo flechas</button>
      </div>
    </div>
    {auto && (
      <div>
        <span style={es.fieldLabel}>Intervalo:</span>
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          {[2, 3, 4, 5, 8].map(s => (
            <button key={s} style={{ ...es.posBtn, ...(interval === s ? es.posBtnActive : {}) }} onClick={() => onIntervalChange(s)}>{s}s</button>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Editor de bloque galería (carrusel individual)
interface CarouselBlockEditorProps {
  content: Record<string, unknown>;
  onContentChange: (changes: Record<string, unknown>) => void;
  onPickImage: (field: string) => void;
}
const CarouselBlockEditor: React.FC<CarouselBlockEditorProps> = ({ content, onContentChange, onPickImage }) => {
  const slides = getSlidesFromContent(content, 'image_', MAX_CAROUSEL_SLIDES);
  return (
    <div style={es.tiEditorWrap}>
      <CarouselSlotsEditor
        slides={slides}
        maxSlides={MAX_CAROUSEL_SLIDES}
        onPickSlot={idx => onPickImage(`image_url_${idx + 1}`)}
        onCaptionChange={(idx, cap) =>
          onContentChange({ [`image_cap_${idx + 1}`]: cap })
        }
        onRemoveSlot={idx =>
          onContentChange(slidesToContent(slides.filter((_, i) => i !== idx), 'image_', MAX_CAROUSEL_SLIDES))
        }
      />
      <IntervalRow
        interval={Number(content.interval ?? 4)}
        auto={(content.auto as string) !== 'false'}
        onIntervalChange={v => onContentChange({ interval: String(v) })}
        onAutoChange={v => onContentChange({ auto: String(v) })}
      />
    </div>
  );
};

// Editor de bloque texto + galería
interface TextCarouselBlockEditorProps {
  content: Record<string, unknown>;
  onContentChange: (changes: Record<string, unknown>) => void;
  onPickImage: (field: string) => void;
}
const TextCarouselBlockEditor: React.FC<TextCarouselBlockEditorProps> = ({ content, onContentChange, onPickImage }) => {
  const slides = getSlidesFromContent(content, 'image_', 6);
  const pos = (content.image_position as string) ?? 'right';
  const tiAlign = (content.ti_text_align as string) ?? 'left';
  return (
    <div style={es.tiEditorWrap}>
      {/* Posición de la galería */}
      <div style={es.positionRow}>
        <span style={es.fieldLabel}>Galería:</span>
        <div style={es.positionBtns}>
          <button style={{ ...es.posBtn, ...(pos === 'left' ? es.posBtnActive : {}) }} onClick={() => onContentChange({ image_position: 'left' })}>⇤ Izquierda</button>
          <button style={{ ...es.posBtn, ...(pos === 'right' ? es.posBtnActive : {}) }} onClick={() => onContentChange({ image_position: 'right' })}>Derecha ⇥</button>
        </div>
      </div>
      {/* Alineación del texto */}
      <div style={es.alignRow}>
        {(['left', 'center', 'right'] as const).map(a => {
          const icons = { left: '⇤ Izq', center: '≡ Centro', right: 'Der ⇥' };
          return <button key={a} style={{ ...es.alignBtn, ...(tiAlign === a ? es.alignBtnActive : {}) }} onClick={() => onContentChange({ ti_text_align: a })}>{icons[a]}</button>;
        })}
      </div>
      {/* Texto */}
      <AutoTextarea value={(content.text as string) ?? ''} onChange={text => onContentChange({ text })} placeholder="Escribe el texto que acompañará la galería..." extraStyle={es.textareaParagraph} />
      {/* Slots de imágenes */}
      <div style={{ marginTop: '12px' }}>
        <CarouselSlotsEditor
          label="Imágenes de la galería (máx. 6)"
          slides={slides}
          maxSlides={6}
          onPickSlot={idx => onPickImage(`image_url_${idx + 1}`)}
          onCaptionChange={(idx, cap) => onContentChange({ [`image_cap_${idx + 1}`]: cap })}
          onRemoveSlot={idx => onContentChange(slidesToContent(slides.filter((_, i) => i !== idx), 'image_', 6))}
        />
      </div>
      <IntervalRow
        interval={Number(content.interval ?? 4)}
        auto={(content.auto as string) !== 'false'}
        onIntervalChange={v => onContentChange({ interval: String(v) })}
        onAutoChange={v => onContentChange({ auto: String(v) })}
      />
    </div>
  );
};

// Editor de bloque doble galería
interface DoubleCarouselBlockEditorProps {
  content: Record<string, unknown>;
  onContentChange: (changes: Record<string, unknown>) => void;
  onPickImage: (field: string) => void;
}
const DoubleCarouselBlockEditor: React.FC<DoubleCarouselBlockEditorProps> = ({ content, onContentChange, onPickImage }) => {
  const leftSlides = getSlidesFromContent(content, 'left_image_', MAX_HALF_SLIDES);
  const rightSlides = getSlidesFromContent(content, 'right_image_', MAX_HALF_SLIDES);
  return (
    <div style={es.tiEditorWrap}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <CarouselSlotsEditor
          label="Galería izquierda"
          slides={leftSlides}
          maxSlides={MAX_HALF_SLIDES}
          onPickSlot={idx => onPickImage(`left_image_url_${idx + 1}`)}
          onCaptionChange={(idx, cap) => onContentChange({ [`left_image_cap_${idx + 1}`]: cap })}
          onRemoveSlot={idx => onContentChange(slidesToContent(leftSlides.filter((_, i) => i !== idx), 'left_image_', MAX_HALF_SLIDES))}
        />
        <CarouselSlotsEditor
          label="Galería derecha"
          slides={rightSlides}
          maxSlides={MAX_HALF_SLIDES}
          onPickSlot={idx => onPickImage(`right_image_url_${idx + 1}`)}
          onCaptionChange={(idx, cap) => onContentChange({ [`right_image_cap_${idx + 1}`]: cap })}
          onRemoveSlot={idx => onContentChange(slidesToContent(rightSlides.filter((_, i) => i !== idx), 'right_image_', MAX_HALF_SLIDES))}
        />
      </div>
      <IntervalRow
        interval={Number(content.interval ?? 4)}
        auto={(content.auto as string) !== 'false'}
        onIntervalChange={v => onContentChange({ interval: String(v) })}
        onAutoChange={v => onContentChange({ auto: String(v) })}
      />
    </div>
  );
};

// Modal selector de imagen (subir o elegir placa)
interface ImagePickerModalProps {
  tab: 'upload' | 'placas' | 'all';
  onTabChange: (t: 'upload' | 'placas' | 'all') => void;
  placas: PickerPlaca[];
  loadingPlacas: boolean;
  uploadingImage: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPickPlaca: (url: string) => void;
  onClose: () => void;
  entityType: 'subtemas_page' | 'placas_page' | 'home_page';
  allTemas: AllTema[];
  allSubtemas: AllSubtema[];
  allPlacas: PickerPlaca[];
  allFilterTema: string;
  allFilterSubtema: string;
  loadingAll: boolean;
  onAllFilterTema: (id: string) => void;
  onAllFilterSubtema: (id: string) => void;
}
const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  tab,
  onTabChange,
  placas,
  loadingPlacas,
  uploadingImage,
  fileInputRef,
  onFileChange,
  onPickPlaca,
  onClose,
  entityType,
  allTemas,
  allSubtemas,
  allPlacas,
  allFilterTema,
  allFilterSubtema,
  loadingAll,
  onAllFilterTema,
  onAllFilterSubtema,
}) => {
  const subtemasFiltered = allTemas.length > 0 && allFilterTema
    ? allSubtemas.filter(s => String(s.tema_id) === allFilterTema)
    : [];

  return (
  <div style={es.overlay} onClick={onClose}>
    <div style={es.modalBox} onClick={e => e.stopPropagation()}>
      {/* Cabecera del modal */}
      <div style={es.modalHeader}>
        <h3 style={es.modalTitle}>Seleccionar imagen</h3>
        <button
          style={es.modalCloseBtn}
          onClick={onClose}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9')}
        >
          ✕
        </button>
      </div>

      {/* Pestañas */}
      <div style={es.modalTabs}>
        <button
          style={{ ...es.modalTab, ...(tab === 'upload' ? es.modalTabActive : {}) }}
          onClick={() => onTabChange('upload')}
        >
          📤 Subir imagen
        </button>
        <button
          style={{ ...es.modalTab, ...(tab === 'placas' ? es.modalTabActive : {}) }}
          onClick={() => onTabChange('placas')}
        >
          🔬 {entityType === 'placas_page' ? 'Placas del subtema' : 'Placas del tema'}
        </button>
        <button
          style={{ ...es.modalTab, ...(tab === 'all' ? es.modalTabActive : {}) }}
          onClick={() => onTabChange('all')}
        >
          🗂 Todas las placas
        </button>
      </div>

      {/* Cuerpo del modal */}
      <div style={es.modalBody}>
        {tab === 'upload' && (
          <div style={es.uploadTab}>
            {uploadingImage ? (
              <div style={es.uploadingState}>
                <div style={es.spinner} />
                <p style={{ color: '#64748b', margin: 0 }}>Subiendo imagen a Cloudinary...</p>
              </div>
            ) : (
              <div
                style={es.dropZone}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).style.borderColor = '#38bdf8';
                  (e.currentTarget as HTMLElement).style.background = '#f0f9ff';
                }}
                onDragLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
                  (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                }}
                onDrop={e => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
                  (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                  const file = e.dataTransfer.files?.[0];
                  if (file && fileInputRef.current) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    const fakeEvt = {
                      target: { files: dt.files },
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    onFileChange(fakeEvt);
                  }
                }}
              >
                <span style={es.dropZoneIcon}>📁</span>
                <p style={es.dropZoneText}>Haz clic o arrastra una imagen aquí</p>
                <p style={es.dropZoneHint}>PNG, JPG, WEBP — máximo 10 MB</p>
              </div>
            )}
          </div>
        )}

        {tab === 'placas' && (
          <div style={es.placasTab}>
            {loadingPlacas ? (
              <div style={es.uploadingState}>
                <div style={es.spinner} />
                <p style={{ color: '#64748b', margin: 0 }}>Cargando placas...</p>
              </div>
            ) : placas.length === 0 ? (
              <p style={es.noPlacasText}>
                No hay placas disponibles para este elemento.
              </p>
            ) : (
              <>
                <p style={es.placasHint}>Haz clic en una placa para usarla como imagen.</p>
                <div style={es.placasGrid}>
                  {placas.map(p => (
                    <div
                      key={p.id}
                      style={es.placaThumb}
                      onClick={() => onPickPlaca(p.photo_url)}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = '#38bdf8';
                        el.style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = '#e2e8f0';
                        el.style.transform = 'scale(1)';
                      }}
                      title="Usar esta placa"
                    >
                      <img
                        src={getCloudinaryImageUrl(p.photo_url, 'thumb')}
                        alt={`Placa ${p.id}`}
                        style={es.placaThumbImg}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'all' && (
          <div style={es.placasTab}>
            {/* Filtros */}
            <div style={es.allFiltersRow}>
              <select
                style={es.allSelect}
                value={allFilterTema}
                onChange={e => onAllFilterTema(e.target.value)}
              >
                <option value="">— Selecciona un tema —</option>
                {allTemas.map(t => (
                  <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                ))}
              </select>
              <select
                style={{
                  ...es.allSelect,
                  opacity: subtemasFiltered.length === 0 ? 0.5 : 1,
                  cursor: subtemasFiltered.length === 0 ? 'not-allowed' : 'pointer',
                }}
                value={allFilterSubtema}
                onChange={e => onAllFilterSubtema(e.target.value)}
                disabled={subtemasFiltered.length === 0}
              >
                <option value="">— Todos los subtemas —</option>
                {subtemasFiltered.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                ))}
              </select>
            </div>

            {/* Resultados */}
            {!allFilterTema ? (
              <p style={es.noPlacasText}>Selecciona un tema para ver sus placas.</p>
            ) : loadingAll ? (
              <div style={es.uploadingState}>
                <div style={es.spinner} />
                <p style={{ color: '#64748b', margin: 0 }}>Cargando placas...</p>
              </div>
            ) : allPlacas.length === 0 ? (
              <p style={es.noPlacasText}>No hay placas disponibles para esta selección.</p>
            ) : (
              <>
                <p style={es.placasHint}>Haz clic en una placa para usarla como imagen.</p>
                <div style={es.placasGrid}>
                  {allPlacas.map(p => (
                    <div
                      key={p.id}
                      style={es.placaThumb}
                      onClick={() => onPickPlaca(p.photo_url)}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = '#38bdf8';
                        el.style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = '#e2e8f0';
                        el.style.transform = 'scale(1)';
                      }}
                      title="Usar esta placa"
                    >
                      <img
                        src={getCloudinaryImageUrl(p.photo_url, 'thumb')}
                        alt={`Placa ${p.id}`}
                        style={es.placaThumbImg}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const es: Record<string, React.CSSProperties> = {
  // Tarjeta contenedora (igual que las demás cards de edición)
  sectionCard: {
    background: 'transparent',
    borderRadius: 0,
    padding: 'clamp(6px, 1vw, 12px) 0',
    boxShadow: 'none',
    border: 'none',
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: 'clamp(1.2em, 2.5vw, 1.8em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    margin: '0 0 6px',
  },
  sectionSubtitle: {
    fontSize: '0.88em',
    color: '#64748b',
    margin: '0 0 14px',
  },
  divider: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },

  // Lista de bloques
  blockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
    minHeight: '20px',
    width: '100%',
  },
  selectionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #dbeafe',
    background: '#f8fbff',
  },
  selectionBarText: {
    fontSize: '0.82em',
    fontWeight: 700,
    color: '#334155',
  },
  selectionBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  selectionBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    fontSize: '0.78em',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  emptyBlocks: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 24px',
    background: '#f8fafc',
    borderRadius: '14px',
    border: '2px dashed #e2e8f0',
    textAlign: 'center',
  },
  emptyBlocksIcon: { fontSize: '2.2em', marginBottom: '10px' },
  emptyBlocksText: { color: '#94a3b8', fontSize: '0.9em', margin: 0 },
  dropIndicator: {
    height: '3px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
    boxShadow: '0 0 8px rgba(56,189,248,0.5)',
    margin: '0 4px',
  },

  // Tarjeta de bloque individual
  blockCard: {
    background: 'linear-gradient(155deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '14px',
    border: '1px solid #dbeafe',
    overflow: 'visible',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 10px 20px rgba(15,23,42,0.07)',
    userSelect: 'none',
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '10px',
    padding: '10px 14px',
    background: 'linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%)',
    borderBottom: '1px solid #dbeafe',
  },
  blockHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    minWidth: 0,
  },
  selectBlockLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7em',
    fontWeight: 700,
    color: '#64748b',
    padding: '2px 6px',
    borderRadius: '999px',
    border: '1px solid #dbeafe',
    background: '#f8fbff',
    userSelect: 'none',
  },
  dragHandle: {
    fontSize: '1.15em',
    color: '#94a3b8',
    cursor: 'grab',
    padding: '2px 6px',
    borderRadius: '5px',
    lineHeight: 1,
    userSelect: 'none',
  },
  typeBadge: {
    fontSize: '0.65em',
    fontWeight: 800,
    color: '#fff',
    padding: '3px 8px',
    borderRadius: '6px',
    letterSpacing: '0.06em',
  },
  typeLabel: {
    fontSize: '0.82em',
    fontWeight: 600,
    color: '#475569',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#ef4444',
    fontSize: '0.85em',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: '6px',
    fontFamily: 'inherit',
    lineHeight: 1,
    transition: 'background 0.15s',
  },
  duplicateBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#0ea5e9',
    fontSize: '1em',
    padding: '4px 8px',
    borderRadius: '6px',
    lineHeight: 1,
    transition: 'background 0.15s',
  },
  collapseBtn: {
    background: '#f8fafc',
    border: '1px solid #dbeafe',
    cursor: 'pointer',
    color: '#0f172a',
    fontSize: '0.78em',
    fontWeight: 700,
    padding: '4px 7px',
    borderRadius: '6px',
    lineHeight: 1,
    transition: 'background 0.15s',
  },
  previewStateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '0.72em',
    fontWeight: 700,
    lineHeight: 1,
  },
  sectionMoveBtn: {
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    borderRadius: '6px',
    fontSize: '0.72em',
    fontWeight: 700,
    padding: '4px 8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  sectionMoveBtnDisabled: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#94a3b8',
    borderRadius: '6px',
    fontSize: '0.72em',
    fontWeight: 700,
    padding: '4px 8px',
    cursor: 'not-allowed',
    opacity: 0.8,
  },
  blockContent: {
    padding: '14px 16px',
    userSelect: 'text',
  },
  collapsedPreviewWrap: {
    padding: '12px 14px 14px',
    borderTop: '1px solid #e2e8f0',
    background: '#ffffff',
    borderBottomLeftRadius: '14px',
    borderBottomRightRadius: '14px',
  },
  sectionTemplateRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },

  stylePanel: {
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    background: 'linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%)',
    padding: '10px 12px',
    marginBottom: '12px',
  },
  stylePanelTitle: {
    display: 'block',
    fontSize: '0.78em',
    color: '#64748b',
    fontWeight: 700,
    marginBottom: '8px',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  stylePanelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
    gap: '8px 12px',
    alignItems: 'center',
  },
  styleFieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.78em',
    color: '#475569',
    fontWeight: 600,
  },
  colorInput: {
    width: '100%',
    height: '32px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: '#fff',
    padding: '2px',
    cursor: 'pointer',
  },
  styleResetBtn: {
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.8em',
    fontFamily: 'inherit',
  },
  styleSelect: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '7px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#1e293b',
    fontSize: '0.82em',
    fontFamily: 'inherit',
  },
  stylePreviewWrap: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '4px',
  },
  stylePreviewTitle: {
    fontSize: '0.75em',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  stylePreviewCard: {
    minHeight: '46px',
    borderRadius: '10px',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    transition: 'all 0.2s ease',
  },
  styleActionsRow: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  stylePresetRow: {
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: '8px 12px',
  },
  styleActionBtn: {
    padding: '7px 11px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    fontSize: '0.8em',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  styleActionBtnDisabled: {
    padding: '7px 11px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#f1f5f9',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '0.8em',
    fontFamily: 'inherit',
    cursor: 'not-allowed',
  },

  richTextWrap: {
    border: '1.5px solid #dbeafe',
    borderRadius: '10px',
    background: '#fff',
    boxShadow: 'inset 0 1px 1px rgba(15,23,42,0.03)',
    overflow: 'visible',
  },
  richQuickToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    padding: '7px 10px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fbff',
    borderRadius: '10px 10px 0 0',
  },
  richQuickLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75em',
    fontWeight: 700,
    color: '#475569',
  },
  richQuickColorInput: {
    width: '30px',
    height: '22px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#fff',
    padding: '0',
  },
  richQuickActionBtn: {
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    borderRadius: '8px',
    padding: '4px 8px',
    fontSize: '0.72em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  richQuickResetBtn: {
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '0.72em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  richEditorContent: {
    minHeight: '110px',
    padding: '10px 12px',
    fontSize: '0.95em',
    lineHeight: 1.65,
    color: '#1e293b',
  },

  // Textareas
  textarea: {
    width: '100%',
    padding: '10px 14px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#1e293b',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.7,
    transition: 'border-color 0.15s',
    overflow: 'hidden',
    minHeight: '60px',
    fontSize: '0.95em',
    userSelect: 'text',
    WebkitUserSelect: 'text',
  },
  // Barra de negrita sobre textareas
  boldToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderBottom: 'none',
    borderRadius: '8px 8px 0 0',
  },
  boldBtn: {
    fontWeight: 900,
    fontSize: '0.82em',
    padding: '3px 10px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '5px',
    background: '#fff',
    cursor: 'pointer',
    color: '#1e293b',
    lineHeight: 1.3,
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    transition: 'background 0.12s, border-color 0.12s',
    fontFamily: 'inherit',
  },
  boldHint: {
    fontSize: '0.7em',
    color: '#94a3b8',
    fontStyle: 'italic',
    userSelect: 'none',
  },
  textareaHeading: {
    fontSize: '1.5em',
    fontWeight: 800,
    lineHeight: 1.25,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  textareaSubheading: {
    fontSize: '1.15em',
    fontWeight: 700,
    lineHeight: 1.3,
    color: '#1e293b',
  },
  textareaParagraph: {
    fontSize: '0.95em',
    lineHeight: 1.75,
  },

  // Bloque imagen
  imageBlockWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  imageBlockRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  imagePreviewWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
  },
  imagePreview: {
    maxWidth: 'min(100%, 420px)',
    maxHeight: '280px',
    width: '100%',
    objectFit: 'contain',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
    display: 'block',
  },
  pickImgBtn: {
    padding: '16px 24px',
    border: '2px dashed #cbd5e1',
    borderRadius: '12px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.95em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'center',
    display: 'block',
  },
  changeImgBtn: {
    padding: '6px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.82em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  captionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  captionInput: {
    width: '100%',
    padding: '8px 12px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: '0.88em',
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#64748b',
    outline: 'none',
    boxSizing: 'border-box',
    fontStyle: 'italic',
    transition: 'border-color 0.15s',
  },

  // Bloque texto + imagen
  tiEditorWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  tiEditorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  tiCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tiImgPreview: {
    width: '100%',
    maxHeight: '200px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f1f5f9',
    display: 'block',
  },
  positionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    paddingTop: '6px',
    borderTop: '1px solid #f1f5f9',
  },
  positionBtns: {
    display: 'flex',
    gap: '8px',
  },
  posBtn: {
    padding: '6px 16px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '20px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.82em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  posBtnActive: {
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    border: '1.5px solid transparent',
    boxShadow: '0 2px 8px rgba(14,165,233,0.25)',
  },
  fieldLabel: {
    fontSize: '0.75em',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },

  builderLayout: {
    display: 'grid',
    gridTemplateColumns: 'clamp(220px, 22vw, 290px) minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'start',
    marginBottom: '14px',
    width: '100%',
  },
  builderMain: {
    minWidth: 0,
    width: '100%',
  },

  // Toolbar
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'stretch',
    padding: '12px 10px',
    border: '1.5px solid #dbeafe',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(239,246,255,0.65) 0%, rgba(248,250,252,0.88) 100%)',
    position: 'sticky',
    top: '10px',
    maxHeight: '78vh',
    overflowY: 'auto',
  },
  toolbarHint: {
    margin: '0',
    fontSize: '0.75em',
    color: '#475569',
    lineHeight: 1.35,
  },
  toolbarLabel: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginRight: '4px',
  },
  toolbarTopRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  toolbarModeToggle: {
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1e3a8a',
    borderRadius: '999px',
    padding: '5px 11px',
    fontSize: '0.74em',
    fontWeight: 700,
    cursor: 'pointer',
  },
  toolbarModeToggleActive: {
    border: '1px solid #93c5fd',
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  toolbarGroupsWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  toolbarGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#ffffff',
  },
  toolbarGroupHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    background: '#f8fbff',
    cursor: 'pointer',
  },
  toolbarGroupHeaderLeft: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  toolbarGroupIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '34px',
    height: '22px',
    padding: '0 6px',
    borderRadius: '999px',
    color: '#ffffff',
    fontSize: '0.66em',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  toolbarGroupTitle: {
    margin: 0,
    color: '#334155',
    fontSize: '0.8em',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  toolbarGroupCount: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: '999px',
    border: '1px solid #dbeafe',
    background: '#eff6ff',
    color: '#1e3a8a',
    fontSize: '0.7em',
    fontWeight: 700,
  },
  toolbarGroupChevron: {
    fontSize: '1.1em',
    color: '#1e3a8a',
    fontWeight: 800,
    lineHeight: 1,
  },
  toolbarGroupButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'stretch',
  },
  toolbarBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '8px 12px',
    minWidth: '182px',
    border: '1.5px solid #dbeafe',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#475569',
    fontSize: '0.85em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  toolbarBtnCompact: {
    minWidth: '132px',
    padding: '7px 10px',
    gap: '2px',
    fontSize: '0.8em',
  },
  toolbarBtnIcon: {
    fontSize: '0.95em',
    lineHeight: 1,
  },
  toolbarBtnIconPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '38px',
    height: '22px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.4)',
    background: 'rgba(255,255,255,0.55)',
    color: 'inherit',
    fontSize: '0.66em',
    fontWeight: 800,
    letterSpacing: '0.03em',
  },
  toolbarBtnTopRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  toolbarBtnDescription: {
    fontSize: '0.72em',
    fontWeight: 500,
    lineHeight: 1.2,
    opacity: 0.9,
    textAlign: 'left',
  },
  templateManagerRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginLeft: 0,
    paddingLeft: 0,
    borderLeft: 'none',
    borderTop: '1px solid #dbeafe',
    paddingTop: '10px',
  },
  templateDeleteBtn: {
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    borderRadius: '999px',
    padding: '6px 11px',
    fontSize: '0.78em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.16s ease',
  },
  templatePreviewPanel: {
    width: '100%',
    border: '1px dashed #cbd5e1',
    borderRadius: '10px',
    background: '#f8fbff',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '4px',
  },
  templatePreviewTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  templatePreviewTitle: {
    fontSize: '0.82em',
    color: '#334155',
  },
  templatePreviewMeta: {
    fontSize: '0.78em',
    color: '#64748b',
  },
  templatePreviewChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  templatePreviewChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '999px',
    border: '1px solid #dbeafe',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '0.75em',
    fontWeight: 600,
  },
  templatePreviewMore: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    color: '#64748b',
    fontSize: '0.74em',
    fontWeight: 700,
  },
  versionPanel: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%)',
    padding: '10px 12px',
    marginBottom: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  versionPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  versionPanelTitle: {
    fontSize: '0.84em',
    color: '#0f172a',
  },
  versionPanelMeta: {
    fontSize: '0.76em',
    color: '#64748b',
  },
  versionPanelActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  versionSelect: {
    minWidth: 0,
    maxWidth: '100%',
    flex: 1,
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#1e293b',
    fontSize: '0.82em',
    fontFamily: 'inherit',
  },

  // Controles de alineación de texto
  alignRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  },
  alignBtn: {
    padding: '4px 11px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '20px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.76em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    lineHeight: 1.4,
  },
  alignBtnActive: {
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    border: '1.5px solid transparent',
    boxShadow: '0 2px 8px rgba(14,165,233,0.25)',
  },

  // Barra de guardado
  saveBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    paddingTop: '6px',
  },
  saveBarLeft: {
    flex: 1,
  },
  saveBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  saveBtn: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: 'white',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: '0 8px 16px rgba(14,165,233,0.28)',
    whiteSpace: 'nowrap',
  },
  saveBtnDisabled: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  publishBtn: {
    padding: '11px 18px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.95em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
    whiteSpace: 'nowrap',
  },
  draftBtn: {
    padding: '11px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 700,
    fontSize: '0.9em',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  saveError: {
    color: '#ef4444',
    fontSize: '0.875em',
    fontWeight: 600,
    margin: 0,
  },
  saveSuccess: {
    color: '#15803d',
    fontSize: '0.875em',
    fontWeight: 600,
    margin: 0,
  },
  pendingMsg: {
    color: '#d97706',
    fontSize: '0.875em',
    fontWeight: 600,
    margin: 0,
  },
  publicationMsg: {
    color: '#475569',
    fontSize: '0.84em',
    fontWeight: 600,
    margin: 0,
  },

  // Loading
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    padding: '40px 0',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.9em',
    fontWeight: 500,
    margin: 0,
  },

  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.72)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalBox: {
    background: '#ffffff',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '660px',
    maxHeight: '88vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 40px 100px rgba(15,23,42,0.3)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '1.1em',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  modalCloseBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 11px',
    cursor: 'pointer',
    fontSize: '0.88em',
    fontWeight: 700,
    color: '#64748b',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  modalTab: {
    padding: '12px 20px',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    background: 'transparent',
    fontSize: '0.9em',
    fontWeight: 600,
    color: '#64748b',
    fontFamily: 'inherit',
    transition: 'color 0.15s, border-color 0.15s',
  },
  modalTabActive: {
    color: '#0ea5e9',
    borderBottom: '3px solid #0ea5e9',
  },
  modalBody: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  uploadTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  uploadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 0',
  },
  dropZone: {
    border: '2.5px dashed #cbd5e1',
    borderRadius: '16px',
    padding: '56px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'all 0.15s',
    width: '100%',
    boxSizing: 'border-box',
  },
  dropZoneIcon: { fontSize: '2.8em', display: 'block', marginBottom: '12px' },
  dropZoneText: {
    fontSize: '1em',
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 6px',
  },
  dropZoneHint: {
    fontSize: '0.82em',
    color: '#94a3b8',
    margin: 0,
  },
  placasTab: {
    minHeight: '200px',
  },
  noPlacasText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.9em',
    fontStyle: 'italic',
    marginTop: '48px',
  },
  placasHint: {
    fontSize: '0.85em',
    color: '#64748b',
    marginTop: 0,
    marginBottom: '14px',
  },
  placasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
    gap: '10px',
  },
  placaThumb: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '2.5px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.15s',
    aspectRatio: '1 / 1',
    background: '#f1f5f9',
  },
  placaThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  // Estilos para "Todas las placas"
  allFiltersRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '14px',
    flexWrap: 'wrap' as const,
  },
  allSelect: {
    flex: '1 1 180px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#1e293b',
    fontSize: '0.88em',
    fontFamily: 'inherit',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
  },
};

export default PageContentEditor;
