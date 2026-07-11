import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ExternalLink, Eye, PanelLeftOpen, PencilLine } from 'lucide-react';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import PageContentEditor, { type PageContentEditorHandle } from '../components/PageContentEditor';
import PageDraftPreview, { type PreviewDevice } from '../components/page-editor/PageDraftPreview';
import PageNavigator, {
  type EditorSubtemaItem,
  type EditorTemaItem,
  type PageSelection,
} from '../components/page-editor/PageNavigator';
import VisualBlockProperties from '../components/page-editor/VisualBlockProperties';
import '../components/page-editor/pageEditor.css';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { supabase } from '../services/supabase';
import type { ContentBlock, PageEntityType } from '../types/contentBlocks';

type WorkspaceMode = 'edit' | 'preview';

interface EditorConfig {
  entityType: PageEntityType;
  entityId: number;
  title: string;
  context: string;
  publicUrl: string;
}

const getEditorConfig = (selection: PageSelection): EditorConfig => {
  if (selection.kind === 'home') {
    return { entityType: 'home_page', entityId: 0, title: 'Inicio', context: 'Portada pública', publicUrl: '/' };
  }
  if (selection.kind === 'temario') {
    return { entityType: 'subtemas_page', entityId: 0, title: 'Temario', context: 'Catálogo general', publicUrl: '/temario' };
  }
  if (selection.kind === 'tema') {
    return {
      entityType: 'subtemas_page', entityId: selection.id, title: selection.label,
      context: 'Página de tema', publicUrl: `/subtemas/${selection.id}`,
    };
  }
  return {
    entityType: 'placas_page', entityId: selection.id, title: selection.label,
    context: `Subtema de ${selection.parentLabel}`, publicUrl: `/ver-placas/${selection.id}`,
  };
};

const EditorPaginas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const [selection, setSelection] = useState<PageSelection>({ kind: 'home', label: 'Inicio' });
  const [temas, setTemas] = useState<EditorTemaItem[]>([]);
  const [subtemas, setSubtemas] = useState<EditorSubtemaItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<WorkspaceMode>('edit');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [draftBlocks, setDraftBlocks] = useState<ContentBlock[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPageNavigatorOpen, setIsPageNavigatorOpen] = useState(true);
  const editorRef = useRef<PageContentEditorHandle>(null);

  const config = useMemo(() => getEditorConfig(selection), [selection]);
  const editorKey = `${config.entityType}:${config.entityId}`;
  const selectedBlock = useMemo(
    () => draftBlocks.find(block => block.id === selectedBlockId) ?? null,
    [draftBlocks, selectedBlockId],
  );

  useEffect(() => {
    const loadPages = async () => {
      setLoadingPages(true);
      setLoadError('');
      const [temasResult, subtemasResult] = await Promise.all([
        supabase.from('temas').select('id, nombre, parcial, sort_order').order('parcial').order('sort_order'),
        supabase.from('subtemas').select('id, nombre, tema_id, sort_order').order('sort_order'),
      ]);
      if (temasResult.error || subtemasResult.error) {
        setLoadError('No se pudo cargar el listado de páginas.');
      }
      setTemas((temasResult.data ?? []) as EditorTemaItem[]);
      setSubtemas((subtemasResult.data ?? []) as EditorSubtemaItem[]);
      setLoadingPages(false);
    };
    void loadPages();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSelectPage = useCallback((nextSelection: PageSelection) => {
    const sameSelection = nextSelection.kind === selection.kind && (
      nextSelection.kind === 'home' || nextSelection.kind === 'temario' ||
      ('id' in nextSelection && 'id' in selection && nextSelection.id === selection.id)
    );
    if (sameSelection) return;
    if (isDirty && !window.confirm('Hay cambios sin guardar en esta página. ¿Deseas cambiar de página y descartarlos?')) return;
    setDraftBlocks([]);
    setSelectedBlockId(null);
    setIsDirty(false);
    setSelection(nextSelection);
    setMode('edit');
  }, [isDirty, selection]);

  useEffect(() => {
    if (selectedBlockId && !draftBlocks.some(block => block.id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [draftBlocks, selectedBlockId]);

  return (
    <div className="page-editor-page">
      <Header />
      <main className="page-editor-page-main">
        <BackButton onClick={handleGoBack} />

        <header className="page-editor-intro">
          <div>
            <span className="page-editor-eyebrow">Editor visual</span>
            <h1>Diseña las páginas públicas sin programar</h1>
            <p>Elige una página, agrega contenido y revisa el resultado antes de publicarlo. El Header y el Footer permanecen protegidos.</p>
          </div>
          <a href={config.publicUrl} target="_blank" rel="noopener noreferrer" className="page-editor-open-public">
            <ExternalLink size={17} /> Abrir página pública
          </a>
        </header>

        {loadError && <div className="page-editor-global-error"><AlertCircle size={18} /> {loadError}</div>}

        <section className={`page-editor-workspace ${isPageNavigatorOpen ? '' : 'is-nav-collapsed'}`}>
          {isPageNavigatorOpen && <PageNavigator
              selection={selection}
              temas={temas}
              subtemas={subtemas}
              loading={loadingPages}
              onSelect={handleSelectPage}
              onClose={() => setIsPageNavigatorOpen(false)}
            />}

          <div className="page-editor-main">
            <div className="page-editor-topbar">
              <button
                type="button"
                className={`page-editor-pages-toggle ${isPageNavigatorOpen ? 'is-open' : ''}`}
                onClick={() => setIsPageNavigatorOpen(open => !open)}
                aria-expanded={isPageNavigatorOpen}
                title={isPageNavigatorOpen ? 'Ocultar selector de páginas' : 'Elegir otra página'}
              >
                <PanelLeftOpen size={17} />
                <span>{isPageNavigatorOpen ? 'Ocultar páginas' : 'Páginas'}</span>
              </button>
              <div className="page-editor-current">
                <small>{config.context}</small>
                <h1>{config.title}</h1>
              </div>
              <span className={isDirty ? 'page-editor-dirty' : 'page-editor-saved'}>
                {isDirty ? '● Autoguardado pendiente' : '✓ Borrador guardado'}
              </span>
              <div className="page-editor-mode-tabs" role="tablist" aria-label="Modo del editor">
                <button className={mode === 'edit' ? 'is-active' : ''} onClick={() => setMode('edit')}>
                  <PencilLine size={15} /> Editar contenido
                </button>
                <button className={mode === 'preview' ? 'is-active' : ''} onClick={() => setMode('preview')}>
                  <Eye size={15} /> Vista previa
                </button>
              </div>
            </div>

            <div className="page-editor-content">
              <div hidden={mode !== 'edit'}>
                  <div className="page-editor-engine-note">
                    <AlertCircle size={18} />
                    <span><strong>Estás editando un borrador.</strong> La página pública seguirá mostrando la última versión publicada hasta que pulses “Publicar”.</span>
                  </div>
                  <PageContentEditor
                    ref={editorRef}
                    key={editorKey}
                    entityType={config.entityType}
                    entityId={config.entityId}
                    onBlocksChange={setDraftBlocks}
                    onDirtyChange={setIsDirty}
                    experienceMode="advanced"
                    autoSave
                  />
              </div>
              {mode === 'preview' && (
                <PageDraftPreview
                  selection={selection}
                  blocks={draftBlocks}
                  device={device}
                  onDeviceChange={setDevice}
                  selectedBlockId={selectedBlockId}
                  onBlockSelect={blockId => setSelectedBlockId(blockId || null)}
                  propertiesPanel={selectedBlock ? (
                    <VisualBlockProperties
                      block={selectedBlock}
                      onChange={updates => editorRef.current?.updateBlock(selectedBlock.id, updates)}
                      onDuplicate={() => editorRef.current?.duplicateBlock(selectedBlock.id)}
                      onDelete={() => {
                        setMode('edit');
                        window.setTimeout(() => editorRef.current?.requestDeleteBlock(selectedBlock.id), 0);
                      }}
                      onPickImage={fieldKey => {
                        setMode('edit');
                        window.setTimeout(() => editorRef.current?.openImagePicker(selectedBlock.id, fieldKey), 0);
                      }}
                      onClose={() => setSelectedBlockId(null)}
                    />
                  ) : undefined}
                />
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default EditorPaginas;
