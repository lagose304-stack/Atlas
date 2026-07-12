import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Extension, type Editor } from '@tiptap/core';
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
import ContentBlockRenderer from './ContentBlockRenderer';
import VisualBlockProperties from './page-editor/VisualBlockProperties';
import type { BlockType, ContentBlock } from '../types/contentBlocks';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily || null,
            renderHTML: attributes => attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
          },
          fontWeight: {
            default: null,
            parseHTML: element => element.style.fontWeight || null,
            renderHTML: attributes => attributes.fontWeight ? { style: `font-weight: ${attributes.fontWeight}` } : {},
          },
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight || null,
            renderHTML: attributes => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          letterSpacing: {
            default: null,
            parseHTML: element => element.style.letterSpacing || null,
            renderHTML: attributes => attributes.letterSpacing ? { style: `letter-spacing: ${attributes.letterSpacing}` } : {},
          },
          textTransform: {
            default: null,
            parseHTML: element => element.style.textTransform || null,
            renderHTML: attributes => attributes.textTransform ? { style: `text-transform: ${attributes.textTransform}` } : {},
          },
          textStrokeColor: {
            default: null,
            parseHTML: element => element.style.webkitTextStrokeColor || null,
            renderHTML: attributes => attributes.textStrokeColor ? { style: `-webkit-text-stroke-color: ${attributes.textStrokeColor}` } : {},
          },
          textStrokeWidth: {
            default: null,
            parseHTML: element => element.style.webkitTextStrokeWidth || null,
            renderHTML: attributes => attributes.textStrokeWidth ? { style: `-webkit-text-stroke-width: ${attributes.textStrokeWidth}; paint-order: stroke fill` } : {},
          },
        },
      },
    ];
  },
});

// ── Tipos exportados (también los usa ContentBlockRenderer) ───────────────────

export type { BlockType, ContentBlock } from '../types/contentBlocks';

// ── Tipo interno del editor (añade flag de bloque nuevo) ─────────────────────
type EditorBlock = ContentBlock & { _isNew: boolean };

const cloneEditorBlocks = (list: EditorBlock[]): EditorBlock[] => list.map(block => ({
  ...block,
  content: { ...block.content },
}));

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
  logo_url?: string | null;
  parcial?: string | null;
  sort_order?: number | null;
}

interface AllSubtema {
  id: number;
  nombre: string;
  tema_id: number;
}

const ATLAS_CONTENT_PREFIX = 'atlas-content/';
const AUTO_SAVE_DELAY_MS = 30_000;

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
  'style_font_family',
  'style_line_height',
  'style_letter_spacing',
  'style_text_transform',
  'style_text_indent',
  'style_text_space_top',
  'style_text_space_bottom',
  'style_link_color',
  'style_link_decoration',
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
  const content = block.content ?? {};
  const ids = Object.entries(content)
    .filter(([key, value]) => {
      if (typeof value !== 'string' || !value) return false;
      if (key === 'image_url' && content.weekly_image_source === 'existing') return false;
      return true;
    })
    .map(([, url]) => getCloudinaryPublicId(url))
    .filter(pid => pid.startsWith(ATLAS_CONTENT_PREFIX));
  return [...new Set(ids)];
};

// ── Props del componente ─────────────────────────────────────────────────────
interface PageContentEditorProps {
  entityType: 'subtemas_page' | 'placas_page' | 'home_page';
  entityId: number;
  onBlocksChange?: (blocks: ContentBlock[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  experienceMode?: 'simple' | 'advanced';
  autoSave?: boolean;
}

export interface PageContentEditorHandle {
  updateBlock: (blockId: string, updates: Record<string, string>) => void;
  duplicateBlock: (blockId: string) => void;
  requestDeleteBlock: (blockId: string) => void;
  openImagePicker: (blockId: string, fieldKey: string) => void;
  undo: () => void;
  redo: () => void;
}

const BLOCK_TOOLBAR_GROUPS: Array<{ title: string; types: BlockType[] }> = [
  {
    title: 'Texto',
    types: ['heading', 'subheading', 'paragraph', 'list', 'callout', 'weekly_publication'],
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
  weekly_publication: 'SEM',
  list: 'LIST',
  divider: 'SEP',
  carousel: 'GAL',
  text_carousel: 'T+GAL',
  double_carousel: '2GAL',
  section: 'SEC',
  section_end: 'FIN',
  columns_2: 'COL',
};

// ── Componente principal ─────────────────────────────────────────────────────
const PageContentEditor = React.forwardRef<PageContentEditorHandle, PageContentEditorProps>(({
  entityType,
  entityId,
  onBlocksChange,
  onDirtyChange,
  experienceMode = 'advanced',
  autoSave = true,
}, ref) => {
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [, setHistoryRevision] = useState(0);

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
  const historyPastRef = useRef<EditorBlock[][]>([]);
  const historyFutureRef = useRef<EditorBlock[][]>([]);
  const historyCurrentRef = useRef<EditorBlock[]>([]);
  const historyFingerprintRef = useRef('[]');
  const historyTimerRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);

  // Guard contra respuestas de peticiones obsoletas
  const reqIdRef = useRef(0);

  const hasPendingChangesFor = useCallback((list: EditorBlock[]) => {
    return getBlocksFingerprint(list) !== persistedBlocksFingerprintRef.current;
  }, []);

  useEffect(() => {
    onBlocksChange?.(blocks.map(({ _isNew: _ignored, ...block }) => block));
  }, [blocks, onBlocksChange]);

  useEffect(() => {
    onDirtyChange?.(hasPendingChangesFor(blocks) || hasChanges);
  }, [blocks, hasChanges, hasPendingChangesFor, onDirtyChange]);

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
        supabase.from('temas').select('id, nombre, logo_url, parcial, sort_order').order('sort_order', { ascending: true }),
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
      if (list[i].block_type === 'section' || list[i].block_type === 'section_end') {
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
        if (next[i].block_type === 'section' || next[i].block_type === 'section_end') {
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
      historyPastRef.current = [];
      historyFutureRef.current = [];
      historyCurrentRef.current = cloneEditorBlocks(loaded);
      historyFingerprintRef.current = getBlocksFingerprint(loaded);
      setHistoryRevision(value => value + 1);
      setBlocks(loaded);
      setSavedIds(new Set(loaded.map(b => b.id)));
      setSelectedBlockIds(new Set());
      setCollapsedBlockIds(new Set(loaded.map(b => b.id)));
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

  useEffect(() => {
    if (loading) return;
    const fingerprint = getBlocksFingerprint(blocks);
    if (fingerprint === historyFingerprintRef.current) return;

    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      historyCurrentRef.current = cloneEditorBlocks(blocks);
      historyFingerprintRef.current = fingerprint;
      return;
    }

    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    const previous = cloneEditorBlocks(historyCurrentRef.current);
    const next = cloneEditorBlocks(blocks);
    historyTimerRef.current = window.setTimeout(() => {
      historyPastRef.current = [...historyPastRef.current.slice(-59), previous];
      historyFutureRef.current = [];
      historyCurrentRef.current = next;
      historyFingerprintRef.current = getBlocksFingerprint(next);
      historyTimerRef.current = null;
      setHistoryRevision(value => value + 1);
    }, 450);

    return () => {
      if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    };
  }, [blocks, loading]);

  const undoBlocks = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const previous = historyPastRef.current[historyPastRef.current.length - 1];
    if (!previous) return;
    historyPastRef.current = historyPastRef.current.slice(0, -1);
    historyFutureRef.current = [cloneEditorBlocks(historyCurrentRef.current), ...historyFutureRef.current].slice(0, 60);
    applyingHistoryRef.current = true;
    setBlocks(cloneEditorBlocks(previous));
    setHasChanges(true);
    setHistoryRevision(value => value + 1);
  }, []);

  const redoBlocks = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const next = historyFutureRef.current[0];
    if (!next) return;
    historyFutureRef.current = historyFutureRef.current.slice(1);
    historyPastRef.current = [...historyPastRef.current.slice(-59), cloneEditorBlocks(historyCurrentRef.current)];
    applyingHistoryRef.current = true;
    setBlocks(cloneEditorBlocks(next));
    setHasChanges(true);
    setHistoryRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoBlocks();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoBlocks();
      }
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [redoBlocks, undoBlocks]);

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

  const addBlockToColumn = useCallback((parentId: string, column: number, type: BlockType) => {
    if (type === 'columns_2' || type === 'section' || type === 'section_end') return;
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(), entity_type: entityType, entity_id: entityId, block_type: type,
      sort_order: blocks.length,
      content: { ...createDefaultBlockContent(type), layout_parent_id: parentId, layout_column: String(column) },
      _isNew: true,
    };
    setBlocks(prev => [...prev, newBlock].map((block, index) => ({ ...block, sort_order: index })));
    setCollapsedBlockIds(prev => { const next = new Set(prev); next.delete(newBlock.id); return next; });
    setHasChanges(true);
  }, [blocks.length, entityId, entityType]);

  const insertSectionEnd = useCallback((insertAfterId: string) => {
    setBlocks(prev => {
      const index = prev.findIndex(block => block.id === insertAfterId);
      if (index < 0 || prev[index + 1]?.block_type === 'section_end') return prev;
      const marker: EditorBlock = { id: crypto.randomUUID(), entity_type: entityType, entity_id: entityId, block_type: 'section_end', sort_order: index + 1, content: {}, _isNew: true };
      const next = [...prev];
      next.splice(index + 1, 0, marker);
      return next.map((block, sortOrder) => ({ ...block, sort_order: sortOrder }));
    });
    setHasChanges(true);
  }, [entityId, entityType]);

  const closeSectionAtCurrentEnd = useCallback((sectionId: string) => {
    setBlocks(prev => {
      const start = prev.findIndex(block => block.id === sectionId && block.block_type === 'section');
      if (start < 0) return prev;
      let boundary = start + 1;
      while (boundary < prev.length && prev[boundary].block_type !== 'section' && prev[boundary].block_type !== 'section_end') boundary += 1;
      if (prev[boundary]?.block_type === 'section_end') return prev;
      const marker: EditorBlock = { id: crypto.randomUUID(), entity_type: entityType, entity_id: entityId, block_type: 'section_end', sort_order: boundary, content: {}, _isNew: true };
      const next = [...prev]; next.splice(boundary, 0, marker);
      return next.map((block, index) => ({ ...block, sort_order: index }));
    });
    setHasChanges(true);
  }, [entityId, entityType]);

  const addBlockToSection = useCallback((sectionId: string, type: BlockType) => {
    if (type === 'section' || type === 'section_end') return;
    setBlocks(prev => {
      const start = prev.findIndex(block => block.id === sectionId && block.block_type === 'section');
      if (start < 0) return prev;
      let boundary = start + 1;
      while (boundary < prev.length && prev[boundary].block_type !== 'section' && prev[boundary].block_type !== 'section_end') boundary += 1;
      const newBlock: EditorBlock = { id: crypto.randomUUID(), entity_type: entityType, entity_id: entityId, block_type: type, sort_order: boundary, content: createDefaultBlockContent(type), _isNew: true };
      const next = [...prev]; next.splice(boundary, 0, newBlock);
      return next.map((block, index) => ({ ...block, sort_order: index }));
    });
    setHasChanges(true);
  }, [entityId, entityType]);

  const moveBlockIntoSection = useCallback((blockId: string, sectionId: string) => {
    setBlocks(prev => {
      const from = prev.findIndex(block => block.id === blockId);
      if (from < 0 || prev[from].block_type === 'section' || prev[from].block_type === 'section_end') return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const start = next.findIndex(block => block.id === sectionId && block.block_type === 'section');
      if (start < 0) return prev;
      let boundary = start + 1;
      while (boundary < next.length && next[boundary].block_type !== 'section' && next[boundary].block_type !== 'section_end') boundary += 1;
      next.splice(boundary, 0, { ...moved, content: { ...moved.content, layout_parent_id: '', layout_column: '' } });
      return next.map((block, index) => ({ ...block, sort_order: index }));
    });
    setHasChanges(true);
  }, []);

  const updateBlockContent = useCallback(
    (blockId: string, updates: Record<string, string>) => {
      const replacedAtlasContentIds: string[] = [];

      setBlocks(prev =>
        prev.map(b => {
          if (b.content.layout_parent_id === blockId && updates.columns) {
            const maxColumn = Math.max(2, Math.min(4, Number(updates.columns)));
            return { ...b, content: { ...b.content, layout_column: String(Math.min(maxColumn, Number(b.content.layout_column || 1))) } };
          }
          if (b.id !== blockId) return b;

          Object.entries(updates).forEach(([key, nextValue]) => {
            const prevValue = b.content[key];
            if (typeof prevValue !== 'string' || !prevValue || prevValue === nextValue) return;
            const oldPublicId = getCloudinaryPublicId(prevValue);
            const isSharedWeeklyImage = key === 'image_url' && b.block_type === 'weekly_publication' && b.content.weekly_image_source === 'existing';
            if (!isSharedWeeklyImage && oldPublicId.startsWith(ATLAS_CONTENT_PREFIX)) {
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
    setBlocks(prev => {
      const toDelete = prev.find(b => b.id === blockId);
      const deletingContainer = toDelete?.block_type === 'columns_2';
      let pairedSectionEndId = '';
      if (toDelete?.block_type === 'section') {
        const start = prev.findIndex(block => block.id === blockId);
        let boundary = start + 1;
        while (boundary < prev.length && prev[boundary].block_type !== 'section' && prev[boundary].block_type !== 'section_end') boundary += 1;
        if (prev[boundary]?.block_type === 'section_end') pairedSectionEndId = prev[boundary].id;
      }
      const blocksToDelete = prev.filter(block => block.id === blockId || (deletingContainer && block.content.layout_parent_id === blockId));
      blocksToDelete.forEach(block => {
        const publicIds = getAtlasContentPublicIdsFromBlock(block);
        publicIds.forEach(pid => pendingAssetDeleteIdsRef.current.add(pid));
      });
      return prev.filter(b => b.id !== blockId && b.id !== pairedSectionEndId && (!deletingContainer || b.content.layout_parent_id !== blockId)).map((block, index) => ({ ...block, sort_order: index }));
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

  const requestDeleteBlock = useCallback((blockId: string) => {
    setDeleteTargetId(blockId);
  }, []);

  const confirmDeleteBlock = useCallback(() => {
    if (!deleteTargetId) return;
    deleteBlock(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteBlock, deleteTargetId]);

  const toggleBlockCollapsed = useCallback((blockId: string) => {
    setCollapsedBlockIds(prev => {
      if (prev.has(blockId)) {
        return new Set(blocks.filter(block => block.id !== blockId).map(block => block.id));
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(`page-editor-block-${blockId}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        });
      });
      return new Set(blocks.map(block => block.id));
    });
  }, [blocks]);

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
      if (original.block_type === 'section') {
        let endExclusive = idx + 1;
        while (endExclusive < prev.length && prev[endExclusive].block_type !== 'section' && prev[endExclusive].block_type !== 'section_end') endExclusive += 1;
        if (prev[endExclusive]?.block_type === 'section_end') endExclusive += 1;
        const directRange = prev.slice(idx, endExclusive);
        const nestedParentIds = new Set(directRange.filter(block => block.block_type === 'columns_2').map(block => block.id));
        const nestedChildren = prev.filter(block => block.content.layout_parent_id && nestedParentIds.has(block.content.layout_parent_id) && !directRange.some(item => item.id === block.id));
        const source = [...directRange, ...nestedChildren];
        const idMap = new Map(source.map(block => [block.id, crypto.randomUUID()]));
        const clones = source.map(block => ({
          ...block,
          id: idMap.get(block.id)!,
          content: { ...block.content, ...(block.content.layout_parent_id && idMap.has(block.content.layout_parent_id) ? { layout_parent_id: idMap.get(block.content.layout_parent_id)! } : {}) },
          _isNew: true,
        }));
        const next = [...prev];
        next.splice(endExclusive, 0, ...clones);
        return next.map((block, index) => ({ ...block, sort_order: index }));
      }
      const cloneId = crypto.randomUUID();
      const clone: EditorBlock = {
        ...original,
        id: cloneId,
        content: { ...original.content },
        _isNew: true,
      };
      const childClones = original.block_type === 'columns_2'
        ? prev.filter(block => block.content.layout_parent_id === original.id).map(child => ({ ...child, id: crypto.randomUUID(), content: { ...child.content, layout_parent_id: cloneId }, _isNew: true }))
        : [];
      const next = [...prev];
      next.splice(idx + 1, 0, clone, ...childClones);
      return next.map((block, index) => ({ ...block, sort_order: index }));
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
      .select('id, nombre, logo_url, parcial, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setAllTemas(data ?? []));
    supabase
      .from('subtemas')
      .select('id, nombre, tema_id')
      .order('nombre', { ascending: true })
      .then(({ data }) => setAllSubtemas(data ?? []));
  }, [entityId, entityType]);

  React.useImperativeHandle(ref, () => ({
    updateBlock: updateBlockContent,
    duplicateBlock,
    requestDeleteBlock,
    openImagePicker: openImageModal,
    undo: undoBlocks,
    redo: redoBlocks,
  }), [duplicateBlock, openImageModal, redoBlocks, requestDeleteBlock, undoBlocks, updateBlockContent]);

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
        ...(imageModal.fieldKey === 'image_url' && blocksRef.current.find(block => block.id === imageModal.blockId)?.block_type === 'weekly_publication'
          ? { weekly_image_source: 'uploaded', weekly_placa_id: '' }
          : {}),
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

  const handlePickPlaca = (placa: PickerPlaca) => {
    if (!imageModal) return;
    const isWeeklyImage = imageModal.fieldKey === 'image_url' && blocksRef.current.find(block => block.id === imageModal.blockId)?.block_type === 'weekly_publication';
    updateBlockContent(imageModal.blockId, {
      [imageModal.fieldKey]: placa.photo_url,
      ...(isWeeklyImage ? { weekly_image_source: 'existing', weekly_placa_id: String(placa.id) } : {}),
    });
    closeImageModal();
  };

  // ── Guardar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isSaving) return;
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
      // Asegura que incluso una pagina nueva tenga una fila de publicacion vacia.
      // Asi el borrador recien guardado nunca se usa como contenido publico.
      await setPublicationDraft(entityType, entityId);
      setPublicationStatus('draft');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar bloques:', err);
      setSaveError('Error al guardar. Por favor, intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!autoSave || loading || isSaving || !hasPendingChangesFor(blocks) && !hasChanges) return;
    const timer = window.setTimeout(() => {
      void handleSave();
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoSave, blocks, hasChanges, isSaving, loading]);

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
      setCollapsedBlockIds(new Set(loaded.map(b => b.id)));
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
  const getOwningSectionForIndex = (idx: number): EditorBlock | null => {
    for (let cursor = idx - 1; cursor >= 0; cursor -= 1) {
      if (blocks[cursor].block_type === 'section_end') return null;
      if (blocks[cursor].block_type === 'section') return blocks[cursor];
    }
    return null;
  };

  const selectedTemplate = sectionTemplates.find(t => t.id === selectedSectionTemplateId) ?? null;
  const activeEditingBlock = blocks.find(block => !collapsedBlockIds.has(block.id)) ?? null;

  return (
    <div style={es.sectionCard} className="block-editor-root">
      <div className="visual-editor-commandbar">
        <div className="visual-editor-commandbar-help">
          <strong>Todas las herramientas están disponibles</strong>
          <span>Añade componentes, personaliza su diseño, reutiliza plantillas y consulta versiones anteriores. El borrador se guarda automáticamente.</span>
        </div>
        <div className="visual-editor-history-actions">
          <button type="button" onClick={undoBlocks} disabled={historyPastRef.current.length === 0} title="Deshacer (Ctrl+Z)">↶ Deshacer</button>
          <button type="button" onClick={redoBlocks} disabled={historyFutureRef.current.length === 0} title="Rehacer (Ctrl+Y)">↷ Rehacer</button>
        </div>
      </div>
      <div style={es.builderLayout} className="block-editor-builder-layout">
        <aside style={es.toolbar} className={`block-editor-sidebar ${activeEditingBlock ? 'has-active-properties' : ''}`}>
        {activeEditingBlock ? (
          <VisualBlockProperties
            key={activeEditingBlock.id}
            block={activeEditingBlock}
            embedded
            onChange={updates => updateBlockContent(activeEditingBlock.id, updates)}
            onDuplicate={() => duplicateBlock(activeEditingBlock.id)}
            onDelete={() => requestDeleteBlock(activeEditingBlock.id)}
            onPickImage={fieldKey => openImageModal(activeEditingBlock.id, fieldKey)}
            onClose={() => toggleBlockCollapsed(activeEditingBlock.id)}
          />
        ) : <>
        <div style={es.toolbarTopRow}>
          <span style={es.toolbarLabel}>Componentes</span>
          {experienceMode === 'advanced' && <button
            type="button"
            style={{ ...es.toolbarModeToggle, ...(compactToolbar ? es.toolbarModeToggleActive : {}) }}
            onClick={() => setCompactToolbar(v => !v)}
            title={compactToolbar ? 'Cambiar a vista expandida' : 'Cambiar a vista compacta'}
            aria-pressed={compactToolbar}
          >
            {compactToolbar ? 'Vista compacta: activada' : 'Vista compacta: desactivada'}
          </button>}
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

        {experienceMode === 'advanced' && <div style={es.templateManagerRow} className="block-editor-template-manager">
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
        </div>}

        {experienceMode === 'advanced' && selectedTemplate && (
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
        </>}
        </aside>

        <div style={es.builderMain} className="block-editor-main">
          {experienceMode === 'advanced' && blocks.length > 0 && (
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
              if (activeEditingBlock && block.id !== activeEditingBlock.id) return null;
              const meta = getBlockMeta(block.block_type);
              const isDragging = dragIdx === idx;
              const isDropBefore = dropIdx === idx;
              const isDropAfterLast = idx === blocks.length - 1 && dropIdx === blocks.length;
              const isCollapsed = collapsedBlockIds.has(block.id);
              const columnParent = block.content.layout_parent_id ? blocks.find(candidate => candidate.id === block.content.layout_parent_id && candidate.block_type === 'columns_2') : undefined;
              const parentColumnCount = columnParent ? Math.max(2, Math.min(4, Number(columnParent.content.columns || 2))) : 0;
              const currentSectionPos = getSectionPosForIndex(idx);
              const owningSection = block.block_type !== 'section' && block.block_type !== 'section_end' ? getOwningSectionForIndex(idx) : null;
              const directSectionChildren = block.block_type === 'section' ? blocks.slice(idx + 1, (() => { const relativeBoundary = blocks.slice(idx + 1).findIndex(candidate => candidate.block_type === 'section' || candidate.block_type === 'section_end'); return relativeBoundary < 0 ? blocks.length : idx + 1 + relativeBoundary; })()).filter(child => !child.content.layout_parent_id) : [];
              const canMoveToPrevSection =
                block.block_type !== 'section' && block.block_type !== 'section_end' && sectionIndexes.length > 0 && currentSectionPos > 0;
              const canMoveToNextSection =
                block.block_type !== 'section' && block.block_type !== 'section_end' &&
                sectionIndexes.length > 0 &&
                (currentSectionPos === -1 || currentSectionPos < sectionIndexes.length - 1);

              return (
                <React.Fragment key={block.id}>
                  {isDropBefore && <div style={es.dropIndicator} />}
                  <div
                    id={`page-editor-block-${block.id}`}
                    style={{
                      ...es.blockCard,
                      borderLeft: `4px solid ${meta.color}`,
                      opacity: isDragging ? 0.3 : 1,
                      transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                      marginLeft: columnParent ? 'clamp(18px, 4vw, 52px)' : owningSection ? 'clamp(10px, 2vw, 24px)' : undefined,
                      background: columnParent ? '#f8fbff' : owningSection ? '#fbfdff' : block.block_type === 'section_end' ? '#f8fafc' : undefined,
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
                        {columnParent && <span style={es.previewStateBadge}>Dentro de {getBlockMeta(columnParent.block_type).label} · Columna {block.content.layout_column || '1'}</span>}
                        {owningSection && !columnParent && <span style={es.previewStateBadge}>Dentro de: {owningSection.content.title || 'Sección sin título'}</span>}
                      </div>
                      <div className="block-editor-header-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {isCollapsed && <span style={es.previewStateBadge}>Vista previa</span>}
                        {block.block_type !== 'section_end' && <button
                          type="button"
                          style={es.collapseBtn}
                          onClick={() => toggleBlockCollapsed(block.id)}
                          title={isCollapsed ? 'Expandir bloque' : 'Contraer bloque'}
                        >
                          {isCollapsed ? 'Editar' : 'Listo'}
                        </button>}
                        {block.block_type === 'section' && <button type="button" style={es.sectionMoveBtn} onClick={() => closeSectionAtCurrentEnd(block.id)} title="Insertar un cierre al final de los componentes actuales">Cerrar sección</button>}
                        {owningSection && !columnParent && <button type="button" style={es.sectionMoveBtn} onClick={() => insertSectionEnd(block.id)} title="La sección terminará después de este componente">Terminar aquí</button>}
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
                          onClick={() => requestDeleteBlock(block.id)}
                          title="Eliminar bloque"
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fee2e2')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {block.block_type === 'section' && !isCollapsed && (
                      <div style={{ padding: '14px', background: '#f0fdfa', borderBottom: '1px solid #99f6e4' }} onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={event => {
                        event.preventDefault(); event.stopPropagation();
                        const paletteType = event.dataTransfer.getData('application/x-atlas-block-type') as BlockType;
                        if ((BLOCK_TYPES as ReadonlyArray<string>).includes(paletteType) && paletteType !== 'section' && paletteType !== 'section_end') addBlockToSection(block.id, paletteType);
                        else if (dragIdx !== null && blocks[dragIdx]) moveBlockIntoSection(blocks[dragIdx].id, block.id);
                        setDragIdx(null); setDropIdx(null);
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div><strong style={{ color: '#0f766e' }}>Contenido de esta sección</strong><small style={{ display: 'block', color: '#52706d' }}>{directSectionChildren.length} componente{directSectionChildren.length === 1 ? '' : 's'} · arrastra aquí o agrega desde la lista</small></div>
                          <button type="button" style={es.sectionMoveBtn} onClick={() => closeSectionAtCurrentEnd(block.id)}>Cerrar sección</button>
                        </div>
                        <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>{directSectionChildren.length ? directSectionChildren.map(child => <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '7px 9px', borderRadius: '8px', background: '#fff', border: '1px solid #ccfbf1', color: '#334155', fontSize: '.82em' }}><span>{getBlockMeta(child.block_type).label}</span><span style={{ color: '#0f766e' }}>Incluido</span></div>) : <div style={{ padding: '12px', border: '2px dashed #5eead4', borderRadius: '10px', textAlign: 'center', color: '#52706d' }}>La sección está vacía</div>}</div>
                        <select defaultValue="" aria-label="Agregar componente a la sección" onChange={event => { const type = event.target.value as BlockType; if (type) addBlockToSection(block.id, type); event.currentTarget.value = ''; }} style={es.styleSelect}>
                          <option value="">+ Agregar componente a la sección</option>
                          {BLOCK_TYPES.filter(type => type !== 'section' && type !== 'section_end').map(type => <option key={type} value={type}>{getBlockMeta(type).label}</option>)}
                        </select>
                      </div>
                    )}

                    {block.block_type === 'columns_2' && !isCollapsed && (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, Math.min(4, Number(block.content.columns || 2)))}, minmax(0,1fr))`, gap: '10px', padding: '12px', background: '#f8fbff', borderBottom: '1px solid #dbeafe' }} className="column-container-editor-zones">
                        {Array.from({ length: Math.max(2, Math.min(4, Number(block.content.columns || 2))) }, (_, columnIndex) => {
                          const children = blocks.filter(child => child.content.layout_parent_id === block.id && Number(child.content.layout_column || 1) === columnIndex + 1);
                          return <div key={columnIndex} style={{ minWidth: 0, padding: '10px', border: '2px dashed #93c5fd', borderRadius: '12px', background: '#fff' }} onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={event => {
                            event.preventDefault(); event.stopPropagation();
                            const paletteType = event.dataTransfer.getData('application/x-atlas-block-type') as BlockType;
                            if ((BLOCK_TYPES as ReadonlyArray<string>).includes(paletteType) && paletteType !== 'columns_2' && paletteType !== 'section') addBlockToColumn(block.id, columnIndex + 1, paletteType);
                            else if (dragIdx !== null) {
                              const moved = blocks[dragIdx];
                              if (moved && moved.id !== block.id && moved.block_type !== 'section' && moved.block_type !== 'columns_2') updateBlockContent(moved.id, { layout_parent_id: block.id, layout_column: String(columnIndex + 1) });
                            }
                            setDragIdx(null); setDropIdx(null);
                          }}>
                            <strong style={{ display: 'block', color: '#1d4ed8', marginBottom: '8px' }}>Columna {columnIndex + 1}</strong>
                            <div style={{ display: 'grid', gap: '5px', marginBottom: '8px' }}>{children.length ? children.map(child => <span key={child.id} style={{ padding: '5px 7px', borderRadius: '7px', background: '#eff6ff', color: '#334155', fontSize: '.78em' }}>{getBlockMeta(child.block_type).label}</span>) : <small style={{ color: '#64748b' }}>Vacía</small>}</div>
                            <select defaultValue="" aria-label={`Agregar componente a columna ${columnIndex + 1}`} onChange={event => { const type = event.target.value as BlockType; if (type) addBlockToColumn(block.id, columnIndex + 1, type); event.currentTarget.value = ''; }} style={es.styleSelect}>
                              <option value="">+ Agregar componente</option>
                              {BLOCK_TYPES.filter(type => type !== 'columns_2' && type !== 'section' && type !== 'section_end').map(type => <option key={type} value={type}>{getBlockMeta(type).label}</option>)}
                            </select>
                          </div>;
                        })}
                      </div>
                    )}

                    {columnParent && !isCollapsed && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
                        <label style={{ fontSize: '.82em', fontWeight: 700, color: '#1e3a8a' }}>Ubicación:</label>
                        <select value={block.content.layout_column || '1'} onChange={event => updateBlockContent(block.id, { layout_column: event.target.value })} style={es.styleSelect}>
                          {Array.from({ length: parentColumnCount }, (_, columnIndex) => <option key={columnIndex} value={String(columnIndex + 1)}>Columna {columnIndex + 1}</option>)}
                        </select>
                        <button type="button" style={es.selectionBtn} onClick={() => updateBlockContent(block.id, { layout_parent_id: '', layout_column: '' })}>Sacar de columnas</button>
                      </div>
                    )}

                    {/* Área de edición según tipo */}
                    {!isCollapsed && block.block_type !== 'section_end' && (
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
                        experienceMode={experienceMode}
                        showStyleEditor={false}
                      />
                    )}

                    {!isCollapsed && block.block_type === 'section_end' && <div style={{ padding: '14px', textAlign: 'center', color: '#475569', fontWeight: 700, borderTop: '2px dashed #94a3b8' }}>Los componentes que siguen ya no pertenecen a la sección anterior.</div>}

                    {isCollapsed && block.block_type !== 'section_end' && (
                      <div style={es.collapsedPreviewWrap}>
                        <ContentBlockRenderer blocks={[block]} />
                      </div>
                    )}
                    {isCollapsed && block.block_type === 'section_end' && <div style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', borderTop: '2px dashed #94a3b8', fontSize: '.82em', fontWeight: 700 }}>Fin de la sección anterior</div>}
                  </div>
                  {isDropAfterLast && <div style={es.dropIndicator} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {experienceMode === 'advanced' && <div style={es.versionPanel}>
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
      </div>}

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
            {isSaving ? 'Guardando borrador...' : hasPendingChanges ? 'Guardar ahora' : autoSave ? 'Borrador guardado' : 'Sin cambios'}
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
      {deleteTargetId && (
        <div className="visual-editor-dialog-backdrop" role="presentation" onMouseDown={() => setDeleteTargetId(null)}>
          <div className="visual-editor-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-block-title" onMouseDown={event => event.stopPropagation()}>
            <span className="visual-editor-dialog-icon" aria-hidden="true">!</span>
            <h3 id="delete-block-title">¿Eliminar este bloque?</h3>
            <p>{blocks.find(block => block.id === deleteTargetId)?.block_type === 'columns_2' ? `También se eliminarán los ${blocks.filter(block => block.content.layout_parent_id === deleteTargetId).length} componentes que contiene. Puedes recuperarlos inmediatamente con “Deshacer”.` : 'El bloque desaparecerá del borrador. Puedes recuperarlo inmediatamente con “Deshacer”.'}</p>
            <div className="visual-editor-dialog-actions">
              <button type="button" className="secondary" onClick={() => setDeleteTargetId(null)}>Cancelar</button>
              <button type="button" className="danger" onClick={confirmDeleteBlock}>Eliminar bloque</button>
            </div>
          </div>
        </div>
      )}
      <LoadingToast visible={isSaving} type="saving" message="Guardando contenido" />
    </div>
  );
});

PageContentEditor.displayName = 'PageContentEditor';

// ── Sub-componentes ───────────────────────────────────────────────────────────

const getParcialGroup = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.startsWith('prim')) return { key: 'primer', label: 'Primer parcial', order: 1 };
  if (normalized.startsWith('seg')) return { key: 'segundo', label: 'Segundo parcial', order: 2 };
  if (normalized.startsWith('ter')) return { key: 'tercer', label: 'Tercer parcial', order: 3 };
  return { key: normalized || 'otros', label: normalized ? value || 'Otros temas' : 'Otros temas', order: 4 };
};

const WeeklyTemaPicker: React.FC<{ label: string; value: string; temas: AllTema[]; optional?: boolean; onSelect: (tema: AllTema | null) => void }> = ({ label, value, temas, optional, onSelect }) => {
  const [isChoosing, setIsChoosing] = React.useState(!value);
  const selectedTema = temas.find(tema => String(tema.id) === value);
  const groups = Array.from(temas.reduce<Map<string, { label: string; order: number; items: AllTema[] }>>((map, tema) => {
    const group = getParcialGroup(tema.parcial);
    const current = map.get(group.key) || { label: group.label, order: group.order, items: [] };
    current.items.push(tema);
    map.set(group.key, current);
    return map;
  }, new Map()).values()).sort((a, b) => a.order - b.order);
  return <div style={{ display: 'grid', gap: '7px' }}>
    <strong style={{ color: '#315676', fontSize: '.78em' }}>{label}</strong>
    {selectedTema && !isChoosing ? <button type="button" onClick={() => setIsChoosing(true)} title="Cambiar tema" style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', alignItems: 'center', gap: '9px', width: '100%', padding: '9px', border: '2px solid #60a5fa', borderRadius: '12px', background: '#eff6ff', color: '#173a60', textAlign: 'left', cursor: 'pointer', fontWeight: 800 }}>
      {selectedTema.logo_url ? <img src={getCloudinaryImageUrl(selectedTema.logo_url, 'thumbSmall')} alt="" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '9px' }} /> : <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '38px', height: '38px', borderRadius: '9px', background: '#dbeafe' }}>⌬</span>}
      <span>{selectedTema.nombre}</span><span style={{ color: '#2563eb', fontSize: '.76em' }}>Cambiar</span>
    </button> : <div style={{ padding: '9px', border: '1px solid #c9d9e9', borderRadius: '12px', background: '#fff' }}>
      {optional && <button type="button" style={{ ...es.selectionBtn, width: '100%', marginBottom: '7px' }} onClick={() => { onSelect(null); setIsChoosing(false); }}>Sin segundo tema</button>}
      {groups.map((group, index) => <details key={group.label} style={{ borderTop: index ? '1px solid #e2e8f0' : undefined, paddingBlock: '6px' }}>
        <summary style={{ cursor: 'pointer', color: '#17466f', fontSize: '.78em', fontWeight: 850 }}>{group.label}</summary>
        <div style={{ display: 'grid', gap: '5px', marginTop: '7px' }}>{group.items.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999)).map(tema => <button key={tema.id} type="button" onClick={event => { onSelect(tema); setIsChoosing(false); event.currentTarget.closest('details')?.removeAttribute('open'); }} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', alignItems: 'center', gap: '8px', padding: '7px', border: String(tema.id) === value ? '2px solid #2563eb' : '1px solid #dbe5ef', borderRadius: '9px', background: String(tema.id) === value ? '#eff6ff' : '#fff', color: '#173a60', textAlign: 'left', cursor: 'pointer', fontWeight: 750 }}>{tema.logo_url ? <img src={getCloudinaryImageUrl(tema.logo_url, 'thumbSmall')} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '8px' }} /> : <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe' }}>⌬</span>}<span>{tema.nombre}</span></button>)}</div>
      </details>)}
    </div>}
  </div>;
};

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
  experienceMode: 'simple' | 'advanced';
  showStyleEditor?: boolean;
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
  experienceMode,
  showStyleEditor = true,
}: MemoBlockContentEditorProps) => {
  const editorSurfaceVars = {
    ['--atlas-editor-bg' as string]: block.content.style_bg || '#ffffff',
    ['--atlas-editor-text' as string]: block.content.style_text || '#000000',
    ['--atlas-editor-border' as string]: block.content.style_border || '#dbeafe',
  } as React.CSSProperties;

  return (
    <div style={{ ...es.blockContent, ...editorSurfaceVars }} className={!showStyleEditor ? 'block-editor-content-only' : undefined}>
      {showStyleEditor && <BlockStyleEditor
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
      />}

      {(block.block_type === 'heading' ||
        block.block_type === 'subheading' ||
        block.block_type === 'paragraph') && (
        <>
          <AutoTextarea
            editorId={block.id}
            showToolbar={showStyleEditor}
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
          {false && experienceMode === 'advanced' && <div style={es.sectionTemplateRow}>
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
          </div>}

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
          imageWidth={block.content.image_width ?? '100'}
          imageHeight={block.content.image_height ?? ''}
          imageFit={(block.content.image_fit as 'contain' | 'cover') ?? 'contain'}
          onCaptionChange={caption => onUpdateBlockContent(block.id, { caption })}
          onSizeChange={size => onUpdateBlockContent(block.id, { size })}
          onAlignChange={align => onUpdateBlockContent(block.id, { align })}
          onImageWidthChange={image_width => onUpdateBlockContent(block.id, { image_width })}
          onImageHeightChange={image_height => onUpdateBlockContent(block.id, { image_height })}
          onImageFitChange={image_fit => onUpdateBlockContent(block.id, { image_fit })}
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
          verticalAlign={(block.content.ti_vertical_align as 'start' | 'center' | 'end') ?? 'start'}
          imageWidth={block.content.ti_image_width ?? '42'}
          imageHeight={block.content.ti_image_height ?? ''}
          imageFit={(block.content.ti_image_fit as 'contain' | 'cover') ?? 'cover'}
          onTextChange={text => onUpdateBlockContent(block.id, { text })}
          onPositionChange={pos => onUpdateBlockContent(block.id, { image_position: pos })}
          onCaptionChange={caption => onUpdateBlockContent(block.id, { image_caption: caption })}
          onVerticalAlignChange={ti_vertical_align => onUpdateBlockContent(block.id, { ti_vertical_align })}
          onImageWidthChange={ti_image_width => onUpdateBlockContent(block.id, { ti_image_width })}
          onImageHeightChange={ti_image_height => onUpdateBlockContent(block.id, { ti_image_height })}
          onImageFitChange={ti_image_fit => onUpdateBlockContent(block.id, { ti_image_fit })}
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
          editorId={block.id}
          text={block.content.text ?? ''}
          variant={(block.content.variant as CalloutVariant) ?? 'info'}
          onTextChange={text => onUpdateBlockContent(block.id, { text })}
          onVariantChange={variant => onUpdateBlockContent(block.id, { variant })}
        />
      )}

      {block.block_type === 'weekly_publication' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(220px, .85fr)', gap: '18px', padding: '18px', border: '1px solid #bfdbfe', borderRadius: '18px', background: 'linear-gradient(135deg,#eef8ff,#ffffff)' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <AutoTextarea editorId={`${block.id}:eyebrow`} showToolbar={false} value={block.content.eyebrow ?? ''} onChange={eyebrow => onUpdateBlockContent(block.id, { eyebrow })} placeholder="Fecha, por ejemplo: 13–17 de julio de 2026" />
            <AutoTextarea editorId={`${block.id}:title`} showToolbar={false} extraStyle={{ fontSize: '1.2em', fontWeight: 800 }} value={block.content.title ?? ''} onChange={title => onUpdateBlockContent(block.id, { title })} placeholder="Título de la publicación" />
            <WeeklyTemaPicker label="Primer tema de la semana" value={block.content.topic_1_id ?? ''} temas={allTemas} onSelect={tema => onUpdateBlockContent(block.id, { topic_1_id: tema ? String(tema.id) : '', topic_1: tema?.nombre || '', topic_1_logo: tema?.logo_url || '' })} />
            <WeeklyTemaPicker label="Segundo tema (opcional)" value={block.content.topic_2_id ?? ''} temas={allTemas} optional onSelect={tema => onUpdateBlockContent(block.id, { topic_2_id: tema ? String(tema.id) : '', topic_2: tema?.nombre || '', topic_2_logo: tema?.logo_url || '' })} />
          </div>
          <div style={{ display: 'grid', alignContent: 'center', gap: '9px' }}>
            {block.content.image_url ? <img src={getCloudinaryImageUrl(block.content.image_url, 'cardWideSmall')} alt="Placa semanal" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '14px', border: '1px solid #bfdbfe' }} /> : <div style={{ display: 'grid', placeItems: 'center', minHeight: '180px', border: '2px dashed #93c5fd', borderRadius: '14px', color: '#53789d', background: '#fff' }}>Selecciona la placa semanal</div>}
            <button type="button" style={es.selectionBtn} onClick={() => onOpenImageModal(block.id, 'image_url')}>{block.content.image_url ? 'Cambiar imagen' : 'Subir o elegir imagen'}</button>
            <AutoTextarea editorId={`${block.id}:caption`} showToolbar={false} value={block.content.image_caption ?? ''} onChange={image_caption => onUpdateBlockContent(block.id, { image_caption })} placeholder="Nombre o descripción de la placa" />
          </div>
        </div>
      )}

      {block.block_type === 'list' && (
        <ListBlockEditor
          editorId={block.id}
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

      {showStyleEditor && <BlockCtaLinksEditor
        content={block.content}
        allTemas={allTemas}
        allSubtemas={allSubtemas}
        onContentChange={changes => onUpdateBlockContent(block.id, changes)}
      />}

    </div>
  );
});

// Editor de texto enriquecido
const AutoTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraStyle?: React.CSSProperties;
  editorId?: string;
  showToolbar?: boolean;
}> = ({ value, onChange, placeholder, extraStyle, editorId, showToolbar = true }) => {
  const emitTextState = (currentEditor: Editor) => {
    if (!editorId) return;
    window.dispatchEvent(new CustomEvent('atlas-rich-text-state', { detail: {
      editorId,
      attrs: currentEditor.getAttributes('textStyle'),
      align: currentEditor.getAttributes('paragraph').textAlign || 'left',
      bold: currentEditor.isActive('bold'), italic: currentEditor.isActive('italic'),
      underline: currentEditor.isActive('underline'), strike: currentEditor.isActive('strike'),
      bulletList: currentEditor.isActive('bulletList'), orderedList: currentEditor.isActive('orderedList'),
      link: currentEditor.isActive('link'), highlight: currentEditor.getAttributes('highlight').color || '',
    } }));
  };
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
      FontSize,
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
      emitTextState(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      emitTextState(currentEditor);
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

  const applySelectionFontSize = (sizePx: string) => {
    if (!editor) return;
    const safe = Number(sizePx);
    if (!Number.isFinite(safe) || safe < 10 || safe > 72) return;
    editor.chain().focus().setMark('textStyle', { fontSize: `${Math.round(safe)}px` }).run();
  };

  const clearSelectionFontSize = () => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
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

  useEffect(() => {
    if (!editorId || !editor) return;
    const handleCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ editorId: string; command: string; value?: string }>).detail;
      if (!detail || detail.editorId !== editorId) return;
      const chain = editor.chain().focus();
      switch (detail.command) {
        case 'bold': chain.toggleBold().run(); break;
        case 'underline': chain.toggleUnderline().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'strike': chain.toggleStrike().run(); break;
        case 'bulletList': chain.toggleBulletList().run(); break;
        case 'orderedList': chain.toggleOrderedList().run(); break;
        case 'align': chain.setTextAlign(detail.value || 'left').run(); break;
        case 'textColor': detail.value ? chain.setColor(detail.value).run() : chain.unsetColor().run(); break;
        case 'highlight': detail.value ? chain.setHighlight({ color: detail.value }).run() : chain.unsetHighlight().run(); break;
        case 'fontSize': detail.value ? applySelectionFontSize(detail.value) : clearSelectionFontSize(); break;
        case 'fontFamily': chain.setMark('textStyle', { fontFamily: detail.value || null }).run(); break;
        case 'fontWeight': chain.setMark('textStyle', { fontWeight: detail.value || null }).run(); break;
        case 'lineHeight': chain.setMark('textStyle', { lineHeight: detail.value || null }).run(); break;
        case 'letterSpacing': chain.setMark('textStyle', { letterSpacing: detail.value || null }).run(); break;
        case 'textTransform': chain.setMark('textStyle', { textTransform: detail.value || null }).run(); break;
        case 'textStrokeColor': chain.setMark('textStyle', { textStrokeColor: detail.value || null }).run(); break;
        case 'textStrokeWidth': chain.setMark('textStyle', { textStrokeWidth: detail.value || null }).run(); break;
        case 'clearTextStyle': chain.unsetAllMarks().run(); break;
        case 'link': setLink(); break;
      }
    };
    window.addEventListener('atlas-rich-text-command', handleCommand);
    return () => window.removeEventListener('atlas-rich-text-command', handleCommand);
  }, [editor, editorId]);

  return (
    <div style={es.richTextWrap}>
      {showToolbar && <div className="richQuickToolbar" style={es.richQuickToolbar}>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleBold().run()}>
          Negrita
        </button>
        <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          Subrayado
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
        <div style={{ width: '100%' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Formato adicional del texto</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginTop: '10px' }}>
            <button type="button" style={es.richQuickActionBtn} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              Cursiva
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
            <button type="button" style={es.richQuickActionBtn} onClick={setLink}>
              Enlace
            </button>
            <label style={es.richQuickLabel}>
              Tamaño seleccionado
              <select
                defaultValue=""
                onChange={e => {
                  if (!e.currentTarget.value) return;
                  applySelectionFontSize(e.currentTarget.value);
                  e.currentTarget.value = '';
                }}
                style={{ ...es.styleSelect, minWidth: '122px' }}
                title="Cambiar tamaño solo del texto seleccionado"
              >
                <option value="">Tamaño...</option>
                <option value="12">12 px</option>
                <option value="14">14 px</option>
                <option value="16">16 px</option>
                <option value="18">18 px</option>
                <option value="22">22 px</option>
                <option value="28">28 px</option>
              </select>
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
            <button type="button" style={es.richQuickResetBtn} onClick={clearSelectionFontSize}>
              Limpiar tamaño
            </button>
            <button type="button" style={es.richQuickResetBtn} onClick={() => applyColor('highlight', false)}>
              Limpiar fondo
            </button>
          </div>
        </div>
      </div>}
      <EditorContent
        editor={editor}
        style={{
          ...es.richEditorContent,
          ...extraStyle,
          background: 'var(--atlas-editor-bg, #ffffff)',
          color: 'var(--atlas-editor-text, inherit)',
          borderColor: 'var(--atlas-editor-border, #dbeafe)',
        }}
      />
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
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: '4px' }}>Texto, sombra y estilos reutilizables</div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <label style={es.styleFieldLabel}>
            Texto
            <input
              type="color"
              value={textColor || '#000000'}
              onChange={e => onChange({ style_text: e.target.value })}
              style={es.colorInput}
            />
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
                color: textColor || '#000000',
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

      <div style={{ marginTop: '10px' }}>
        <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: '8px' }}>Diseño de los botones</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginTop: '10px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                <AutoTextarea
                  value={content[textKey] ?? ''}
                  onChange={v => onContentChange({ [textKey]: v })}
                  placeholder="Texto del botón"
                  extraStyle={es.captionInput}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    style={es.captionInput}
                    value={content[urlKey] ?? ''}
                    onChange={e => onContentChange({ [urlKey]: e.currentTarget.value })}
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
  imageWidth: string;
  imageHeight: string;
  imageFit: 'contain' | 'cover';
  onCaptionChange: (v: string) => void;
  onSizeChange: (v: 'small' | 'medium' | 'large') => void;
  onAlignChange: (v: 'left' | 'center' | 'right') => void;
  onImageWidthChange: (v: string) => void;
  onImageHeightChange: (v: string) => void;
  onImageFitChange: (v: 'contain' | 'cover') => void;
  onPickImage: () => void;
}
const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({
  url,
  caption,
  size,
  align,
  imageWidth,
  imageHeight,
  imageFit,
  onCaptionChange,
  onSizeChange,
  onAlignChange,
  onImageWidthChange,
  onImageHeightChange,
  onImageFitChange,
  onPickImage,
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
    <div className="block-customization-control" style={{ marginTop: '14px' }}>
      <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: '8px' }}>Tamaño, posición y recorte</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px' }}>
        <label style={es.fieldLabel}>
          Ancho imagen (%)
          <input
            type="number"
            min={20}
            max={100}
            step={1}
            value={imageWidth || '100'}
            onChange={e => onImageWidthChange(e.currentTarget.value || '100')}
            style={{ ...es.captionInput, marginTop: '4px' }}
          />
        </label>
        <label style={es.fieldLabel}>
          Alto imagen (px)
          <input
            type="number"
            min={0}
            max={1200}
            step={10}
            value={imageHeight || ''}
            onChange={e => onImageHeightChange(e.currentTarget.value)}
            style={{ ...es.captionInput, marginTop: '4px' }}
            placeholder="Auto"
          />
        </label>
        <label style={es.fieldLabel}>
          Ajuste imagen
          <select
            value={imageFit}
            onChange={e => onImageFitChange(e.currentTarget.value as 'contain' | 'cover')}
            style={{ ...es.styleSelect, marginTop: '4px' }}
          >
            <option value="contain">Contener (sin recorte)</option>
            <option value="cover">Cubrir (puede recortar)</option>
          </select>
        </label>
      </div>
    </div>
    <div style={es.captionRow}>
      <label style={es.fieldLabel}>Pie de foto (opcional)</label>
      <AutoTextarea
        value={caption}
        onChange={onCaptionChange}
        placeholder="Descripción de la imagen..."
        extraStyle={es.captionInput}
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
  verticalAlign: 'start' | 'center' | 'end';
  imageWidth: string;
  imageHeight: string;
  imageFit: 'contain' | 'cover';
  onTextChange: (v: string) => void;
  onPositionChange: (v: 'left' | 'right') => void;
  onCaptionChange: (v: string) => void;
  onVerticalAlignChange: (v: 'start' | 'center' | 'end') => void;
  onImageWidthChange: (v: string) => void;
  onImageHeightChange: (v: string) => void;
  onImageFitChange: (v: 'contain' | 'cover') => void;
  onPickImage: () => void;
}
const TextImageBlockEditor: React.FC<TextImageBlockEditorProps> = ({
  text,
  imageUrl,
  imagePosition,
  imageCaption,
  verticalAlign,
  imageWidth,
  imageHeight,
  imageFit,
  onTextChange,
  onPositionChange,
  onCaptionChange,
  onVerticalAlignChange,
  onImageWidthChange,
  onImageHeightChange,
  onImageFitChange,
  onPickImage,
}) => (
  <div style={es.tiEditorWrap}>
    <div style={es.tiEditorGrid}>
      {/* Columna de texto */}
      <div style={es.tiCol}>
        <label style={es.fieldLabel}>Texto</label>
        <div className="block-customization-control" style={{ marginBottom: '8px' }}>
          <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: '8px' }}>Posición vertical del texto</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
              {([
                { key: 'start', label: '↑ Inicio' },
                { key: 'center', label: '↕ Centro' },
                { key: 'end', label: '↓ Final' },
              ] as const).map(v => (
                <button
                  key={v.key}
                  style={{ ...es.posBtn, ...(verticalAlign === v.key ? es.posBtnActive : {}) }}
                  onClick={() => onVerticalAlignChange(v.key)}
                  title={`Alineación vertical: ${v.label}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <AutoTextarea
          value={text}
          onChange={onTextChange}
          placeholder="Escribe el contenido descriptivo aquí..."
          extraStyle={es.textareaParagraph}
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
        <AutoTextarea
          value={imageCaption}
          onChange={onCaptionChange}
          placeholder="Pie de foto..."
          extraStyle={{ ...es.captionInput, marginTop: '6px' }}
        />
        <div className="block-customization-control" style={{ marginTop: '12px' }}>
          <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: '8px' }}>Tamaño y recorte de la imagen</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', marginTop: '8px' }}>
            <label style={es.fieldLabel}>
              Ancho imagen (%)
              <input
                type="number"
                min={20}
                max={70}
                step={1}
                value={imageWidth || '42'}
                onChange={e => onImageWidthChange(e.currentTarget.value || '42')}
                style={{ ...es.captionInput, marginTop: '4px' }}
              />
            </label>
            <label style={es.fieldLabel}>
              Alto imagen (px)
              <input
                type="number"
                min={0}
                max={1000}
                step={10}
                value={imageHeight || ''}
                onChange={e => onImageHeightChange(e.currentTarget.value)}
                placeholder="Auto"
                style={{ ...es.captionInput, marginTop: '4px' }}
              />
            </label>
            <label style={es.fieldLabel}>
              Ajuste
              <select
                value={imageFit}
                onChange={e => onImageFitChange(e.currentTarget.value as 'contain' | 'cover')}
                style={{ ...es.styleSelect, marginTop: '4px' }}
              >
                <option value="cover">Cubrir</option>
                <option value="contain">Contener</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>

    {/* Toggle posición de imagen */}
    <div className="block-customization-control" style={es.positionRow}>
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
        <AutoTextarea
          value={imageCaptionLeft}
          onChange={onCaptionLeftChange}
          placeholder="Pie de foto izquierda..."
          extraStyle={{ ...es.captionInput, marginTop: '6px' }}
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
        <AutoTextarea
          value={imageCaptionRight}
          onChange={onCaptionRightChange}
          placeholder="Pie de foto derecha..."
          extraStyle={{ ...es.captionInput, marginTop: '6px' }}
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
          <AutoTextarea
            value={captions[i]}
            onChange={v => onCaptionChange(i, v)}
            placeholder="Pie de foto..."
            extraStyle={{ ...es.captionInput, marginTop: '6px' }}
          />
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
    <div className="block-customization-control" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
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
    <AutoTextarea
      value={title}
      onChange={onTitleChange}
      placeholder="Título de sección (opcional)..."
      extraStyle={es.captionInput}
    />
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
      <div className="block-customization-control" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'space-between' }}>
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
  editorId: string;
  text: string;
  variant: CalloutVariant;
  onTextChange: (v: string) => void;
  onVariantChange: (v: CalloutVariant) => void;
}
const CalloutBlockEditor: React.FC<CalloutBlockEditorProps> = ({ editorId, text, variant, onTextChange, onVariantChange }) => (
  <div style={es.tiEditorWrap}>
    <div className="block-customization-control" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
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
    <AutoTextarea editorId={editorId} value={text} onChange={onTextChange} placeholder="Escribe el contenido destacado..." extraStyle={es.textareaParagraph} />
  </div>
);

// Editor de bloque lista
interface ListBlockEditorProps {
  editorId: string;
  items: string;
  style: 'bullet' | 'numbered';
  onItemsChange: (v: string) => void;
  onStyleChange: (v: string) => void;
}
const ListBlockEditor: React.FC<ListBlockEditorProps> = ({ editorId, items, style, onItemsChange, onStyleChange }) => (
  <div style={es.tiEditorWrap}>
    <div className="block-customization-control" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
      <span style={es.fieldLabel}>Estilo:</span>
      {(['bullet', 'numbered'] as const).map(s => (
        <button key={s} style={{ ...es.posBtn, ...(style === s ? es.posBtnActive : {}) }} onClick={() => onStyleChange(s)}>
          {s === 'bullet' ? '• Viñetas' : '1. Numerada'}
        </button>
      ))}
    </div>
    <AutoTextarea
      editorId={editorId}
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
    <div className="block-customization-control" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
            style={{ width: '64px', height: '48px', objectFit: 'cover', objectPosition: 'center center', borderRadius: '6px', flexShrink: 0, cursor: 'pointer' }}
            onClick={() => onPickSlot(idx)}
            title="Cambiar imagen"
            loading="lazy"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <AutoTextarea
              value={slide.caption}
              onChange={v => onCaptionChange(idx, v)}
              placeholder="Pie de foto..."
              extraStyle={es.captionInput}
            />
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
  <div className="block-customization-control" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as const, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
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
      <div className="block-customization-control" style={es.positionRow}>
        <span style={es.fieldLabel}>Galería:</span>
        <div style={es.positionBtns}>
          <button style={{ ...es.posBtn, ...(pos === 'left' ? es.posBtnActive : {}) }} onClick={() => onContentChange({ image_position: 'left' })}>⇤ Izquierda</button>
          <button style={{ ...es.posBtn, ...(pos === 'right' ? es.posBtnActive : {}) }} onClick={() => onContentChange({ image_position: 'right' })}>Derecha ⇥</button>
        </div>
      </div>
      {/* Alineación del texto */}
      <div className="block-customization-control" style={es.alignRow}>
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
  onPickPlaca: (placa: PickerPlaca) => void;
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
                      onClick={() => onPickPlaca(p)}
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
                <option value="">— Elige un tema —</option>
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
              <p style={es.noPlacasText}>Elige un tema para ver sus placas.</p>
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
                      onClick={() => onPickPlaca(p)}
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
    minHeight: '52px',
    padding: '12px 14px',
    fontSize: '0.95em',
    lineHeight: 1.65,
    color: '#000000',
  },

  // Textareas
  textarea: {
    width: '100%',
    padding: '10px 14px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#000000',
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
    color: '#000000',
    letterSpacing: '-0.02em',
  },
  textareaSubheading: {
    fontSize: '1.15em',
    fontWeight: 700,
    lineHeight: 1.3,
    color: '#000000',
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
    objectPosition: 'center center',
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
    objectPosition: 'center center',
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
    objectPosition: 'center center',
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
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: '1em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
};

export default PageContentEditor;
