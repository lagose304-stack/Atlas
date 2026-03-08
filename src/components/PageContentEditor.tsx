import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { uploadToCloudinary } from '../services/cloudinary';

// ── Tipos exportados (también los usa ContentBlockRenderer) ───────────────────

export type BlockType = 'heading' | 'subheading' | 'paragraph' | 'image' | 'text_image';

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

// ── Metadatos visuales por tipo de bloque ────────────────────────────────────
const BLOCK_META: Record<BlockType, { label: string; icon: string; color: string }> = {
  heading:    { label: 'Título',         icon: 'H1', color: '#6366f1' },
  subheading: { label: 'Subtítulo',      icon: 'H2', color: '#8b5cf6' },
  paragraph:  { label: 'Párrafo',        icon: 'P',  color: '#0ea5e9' },
  image:      { label: 'Imagen',         icon: '🖼',  color: '#10b981' },
  text_image: { label: 'Texto + Imagen', icon: '⊞',  color: '#f59e0b' },
};

// ── Props del componente ─────────────────────────────────────────────────────
interface PageContentEditorProps {
  entityType: 'subtemas_page' | 'placas_page';
  entityId: number;
}

// ── Componente principal ─────────────────────────────────────────────────────
const PageContentEditor: React.FC<PageContentEditorProps> = ({ entityType, entityId }) => {
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

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

  // Guard contra respuestas de peticiones obsoletas
  const reqIdRef = useRef(0);

  // ── Carga de bloques ─────────────────────────────────────────────────────
  useEffect(() => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setBlocks([]);
    setHasChanges(false);
    setSaveSuccess(false);
    setSaveError(null);

    supabase
      .from('content_blocks')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (reqId !== reqIdRef.current) return; // petición obsoleta
        if (error) console.error('Error al cargar bloques:', error);
        const loaded: EditorBlock[] = (data ?? []).map((b: ContentBlock) => ({
          ...b,
          _isNew: false,
        }));
        setBlocks(loaded);
        setSavedIds(new Set(loaded.map(b => b.id)));
        setLoading(false);
      });
  }, [entityType, entityId]);

  // ── Operaciones sobre bloques ────────────────────────────────────────────
  const addBlock = useCallback(
    (type: BlockType) => {
      const defaultContent: Record<string, string> =
        type === 'image'
          ? { url: '', caption: '' }
          : type === 'text_image'
          ? { text: '', image_url: '', image_position: 'right', image_caption: '' }
          : { text: '' };

      const newBlock: EditorBlock = {
        id: crypto.randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        block_type: type,
        sort_order: blocks.length,
        content: defaultContent,
        _isNew: true,
      };
      setBlocks(prev => [...prev, newBlock]);
      setHasChanges(true);
    },
    [blocks.length, entityType, entityId]
  );

  const updateBlockContent = useCallback(
    (blockId: string, updates: Record<string, string>) => {
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId ? { ...b, content: { ...b.content, ...updates } } : b
        )
      );
      setHasChanges(true);
    },
    []
  );

  const deleteBlock = useCallback((blockId: string) => {
    if (!window.confirm('¿Eliminar este bloque de contenido?')) return;
    setBlocks(prev => prev.filter(b => b.id !== blockId));
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
    if (dragIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newDrop = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
    if (newDrop !== dropIdx) setDropIdx(newDrop);
  };

  const handleBlockDrop = (e: React.DragEvent) => {
    e.preventDefault();
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
  const openImageModal = (blockId: string, fieldKey: string) => {
    setImageModal({ blockId, fieldKey });
    setPickerTab('upload');
    setAvailablePlacas([]);
    setAllPlacas([]);
    setAllFilterTema('');
    setAllFilterSubtema('');
    setLoadingPlacas(true);
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
  };

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
      const result = await uploadToCloudinary(file, { folder: 'atlas-content' });
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
    setIsSaving(true);
    setSaveError(null);
    try {
      // 1. Eliminar bloques que ya no existen en la lista local
      const currentIds = new Set(blocks.map(b => b.id));
      const idsToDelete = [...savedIds].filter(id => !currentIds.has(id));
      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('content_blocks')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
      }

      // 2. Upsert de todos los bloques actuales con sort_order correcto
      if (blocks.length > 0) {
        const rows = blocks.map((b, i) => ({
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

      // 3. Actualizar estado local
      setSavedIds(new Set(blocks.map(b => b.id)));
      setBlocks(prev => prev.map((b, i) => ({ ...b, sort_order: i, _isNew: false })));
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

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={es.sectionCard}>
        <SectionHeader />
        <div style={es.loadingWrap}>
          <div style={es.spinner} />
          <p style={es.loadingText}>Cargando bloques de contenido...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={es.sectionCard}>
      <SectionHeader />

      {/* Lista de bloques */}
      <div
        style={es.blockList}
        onDragOver={e => {
          if (dragIdx !== null) {
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
              Aún no hay bloques. Usa los botones de abajo para añadir contenido.
            </p>
          </div>
        )}

        {blocks.map((block, idx) => {
          const meta = BLOCK_META[block.block_type];
          const isDragging = dragIdx === idx;
          const isDropBefore = dropIdx === idx;
          const isDropAfterLast = idx === blocks.length - 1 && dropIdx === blocks.length;

          return (
            <React.Fragment key={block.id}>
              {isDropBefore && <div style={es.dropIndicator} />}
              <div
                draggable
                style={{
                  ...es.blockCard,
                  borderLeft: `4px solid ${meta.color}`,
                  opacity: isDragging ? 0.3 : 1,
                  transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                }}
                onDragStart={e => handleBlockDragStart(e, idx)}
                onDragOver={e => handleBlockDragOver(e, idx)}
                onDragEnd={handleBlockDragEnd}
              >
                {/* Barra de cabecera del bloque */}
                <div style={es.blockHeader}>
                  <div style={es.blockHeaderLeft}>
                    <span style={es.dragHandle} title="Arrastra para reordenar">⠿</span>
                    <span style={{ ...es.typeBadge, background: meta.color }}>
                      {meta.icon}
                    </span>
                    <span style={es.typeLabel}>{meta.label}</span>
                  </div>
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

                {/* Área de edición según tipo */}
                <div style={es.blockContent}>
                  {(block.block_type === 'heading' ||
                    block.block_type === 'subheading' ||
                    block.block_type === 'paragraph') && (
                    <>
                      {/* Controles de alineación */}
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
                              onClick={() => updateBlockContent(block.id, { text_align: align })}
                              title={icons[align]}
                            >
                              {icons[align]}
                            </button>
                          );
                        })}
                      </div>
                      <AutoTextarea
                        value={block.content.text ?? ''}
                        onChange={text => updateBlockContent(block.id, { text })}
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

                  {block.block_type === 'image' && (
                    <ImageBlockEditor
                      url={block.content.url ?? ''}
                      caption={block.content.caption ?? ''}
                      onCaptionChange={caption => updateBlockContent(block.id, { caption })}
                      onPickImage={() => openImageModal(block.id, 'url')}
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
                      onTextChange={text => updateBlockContent(block.id, { text })}
                      onPositionChange={pos =>
                        updateBlockContent(block.id, { image_position: pos })
                      }
                      onCaptionChange={caption =>
                        updateBlockContent(block.id, { image_caption: caption })
                      }
                      onTextAlignChange={align =>
                        updateBlockContent(block.id, { ti_text_align: align })
                      }
                      onPickImage={() => openImageModal(block.id, 'image_url')}
                    />
                  )}
                </div>
              </div>
              {isDropAfterLast && <div style={es.dropIndicator} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Toolbar para añadir bloques */}
      <div style={es.toolbar}>
        <span style={es.toolbarLabel}>Añadir:</span>
        {(Object.keys(BLOCK_META) as BlockType[]).map(type => {
          const meta = BLOCK_META[type];
          return (
            <button
              key={type}
              style={es.toolbarBtn}
              onClick={() => addBlock(type)}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = meta.color;
                el.style.color = '#fff';
                el.style.borderColor = meta.color;
                el.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = '#f8fafc';
                el.style.color = '#475569';
                el.style.borderColor = '#e2e8f0';
                el.style.transform = 'translateY(0)';
              }}
              title={`Añadir ${meta.label}`}
            >
              <span style={es.toolbarBtnIcon}>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Barra de guardado */}
      <div style={es.saveBar}>
        <div style={es.saveBarLeft}>
          {saveError && <p style={es.saveError}>⚠️ {saveError}</p>}
          {saveSuccess && <p style={es.saveSuccess}>✅ Contenido guardado correctamente</p>}
          {hasChanges && !saveError && !saveSuccess && (
            <p style={es.pendingMsg}>• Cambios pendientes de guardar</p>
          )}
        </div>
        <button
          style={hasChanges && !isSaving ? es.saveBtn : es.saveBtnDisabled}
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? '⏳ Guardando...' : hasChanges ? '💾 Guardar contenido' : '✓ Sin cambios'}
        </button>
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
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
    </div>
  );
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

const SectionHeader: React.FC = () => (
  <div style={es.sectionHeader}>
    <h3 style={es.sectionTitle}>✏️ Contenido de la página</h3>
    <p style={es.sectionSubtitle}>
      Añade títulos, párrafos, imágenes y bloques de texto con imagen. Arrastra{' '}
      <strong>⠿</strong> para reordenar.
    </p>
    <div style={es.divider} />
  </div>
);

// Textarea con auto-resize
interface AutoTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  extraStyle?: React.CSSProperties;
}
const AutoTextarea: React.FC<AutoTextareaProps> = ({
  value,
  onChange,
  placeholder,
  extraStyle,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      style={{ ...es.textarea, ...extraStyle }}
      value={value}
      placeholder={placeholder}
      spellCheck
      lang="es"
      onChange={e => onChange(e.target.value)}
      onInput={e => {
        const el = e.currentTarget as HTMLTextAreaElement;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
};

// Editor de bloque imagen
interface ImageBlockEditorProps {
  url: string;
  caption: string;
  onCaptionChange: (v: string) => void;
  onPickImage: () => void;
}
const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({
  url,
  caption,
  onCaptionChange,
  onPickImage,
}) => (
  <div style={es.imageBlockWrap}>
    <div style={es.imageBlockRow}>
      {url ? (
        <div style={es.imagePreviewWrap}>
          <img src={url} alt="Vista previa" style={es.imagePreview} />
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
    </div>
    <div style={es.captionRow}>
      <label style={es.fieldLabel}>Pie de foto (opcional)</label>
      <input
        style={es.captionInput}
        value={caption}
        onChange={e => onCaptionChange(e.target.value)}
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
            <img src={imageUrl} alt="Vista previa" style={es.tiImgPreview} />
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
        <input
          style={{ ...es.captionInput, marginTop: '6px' }}
          value={imageCaption}
          onChange={e => onCaptionChange(e.target.value)}
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
  entityType: 'subtemas_page' | 'placas_page';
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
                        src={p.photo_url}
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
                        src={p.photo_url}
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
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.05)',
    border: '1px solid rgba(15,23,42,0.05)',
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
    background: '#ffffff',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    overflow: 'hidden',
    transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
    userSelect: 'none',
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  blockHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  blockContent: {
    padding: '14px 16px',
    userSelect: 'text',
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
  },
  imagePreviewWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
  },
  imagePreview: {
    maxWidth: '420px',
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
    gridTemplateColumns: '1fr 1fr',
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

  // Toolbar
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
    padding: '16px 0',
    borderTop: '1.5px solid #e2e8f0',
    borderBottom: '1.5px solid #e2e8f0',
    marginBottom: '16px',
  },
  toolbarLabel: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginRight: '4px',
  },
  toolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#475569',
    fontSize: '0.85em',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  toolbarBtnIcon: {
    fontSize: '0.95em',
    lineHeight: 1,
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
    gap: '14px',
    flexWrap: 'wrap',
  },
  saveBarLeft: {
    flex: 1,
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
    boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
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
