import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Eye,
  PanelLeftOpen,
  CheckCircle,
  Clock,
  ArrowLeft,
  ShieldCheck,
  FileEdit,
  Save,
} from 'lucide-react';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import PageContentEditor, { type PageContentEditorHandle } from '../components/PageContentEditor';
import PageNavigator, {
  type EditorSubtemaItem,
  type EditorTemaItem,
  type PageSelection,
} from '../components/page-editor/PageNavigator';
import PageVersionsHub from '../components/page-editor/PageVersionsHub';
import RealPageDraftViewer from '../components/page-editor/RealPageDraftViewer';
import FullScreenPageSelector from '../components/page-editor/FullScreenPageSelector';
import CreditsAdminPanel from '../components/CreditsAdminPanel';
import '../components/page-editor/pageEditor.css';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import type { ContentBlock, PageEntityType } from '../types/contentBlocks';
import { useAuth } from '../contexts/AuthContext';
import {
  createPageVersion,
  publishPageVersion,
  deletePageVersion,
  ensurePageHasInitialVersion,
  type PageVersionRow,
} from '../services/pageVersionsService';
import { getCachedTemas, getCachedSubtemas, getQuickTemas, getQuickSubtemas } from '../services/catalogService';
import { clearPreservedRouteState, syncUrlSearchParam } from '../services/navigationStateKeeper';

type WorkspaceMode = 'edit' | 'preview';
type ViewMode = 'versions_hub' | 'editor';

interface EditorConfig {
  entityType: PageEntityType;
  entityId: number;
  title: string;
  context: string;
  publicUrl: string;
}

const getEditorConfig = (selection: PageSelection): EditorConfig => {
  if (selection.kind === 'credits') {
    return { entityType: 'home_page', entityId: 0, title: 'Créditos', context: 'Reconocimientos del sitio', publicUrl: '/creditos' };
  }
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
  const { user } = useAuth();
  const isAdministrator = user?.rol === 'Administrador';
  const handleGoBack = useSmartBackNavigation('/edicion');
  
  const quickTemas = (getQuickTemas() ?? []) as EditorTemaItem[];
  const quickSubtemas = (getQuickSubtemas() ?? []) as EditorSubtemaItem[];
  const [temas, setTemas] = useState<EditorTemaItem[]>(quickTemas);
  const [subtemas, setSubtemas] = useState<EditorSubtemaItem[]>(quickSubtemas);
  const [loadingPages, setLoadingPages] = useState(quickTemas.length === 0);
  const [loadError, setLoadError] = useState('');

  // 1. Restaurar página seleccionada inmediatamente solo si viene en los parámetros de la URL actual
  const [selection, setSelection] = useState<PageSelection | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tipo = urlParams.get('tipo') || urlParams.get('pagina');
    const idRaw = urlParams.get('id');
    const id = idRaw ? Number(idRaw) : null;

    if (tipo === 'credits' && isAdministrator) {
      return { kind: 'credits', label: 'Créditos' };
    }
    if (tipo === 'home') {
      return { kind: 'home', label: 'Inicio' };
    }
    if (tipo === 'temario') {
      return { kind: 'temario', label: 'Temario' };
    }
    if (tipo === 'tema' && id) {
      const t = quickTemas.find((item) => item.id === id);
      return { kind: 'tema', id, label: t?.nombre || `Tema ${id}` };
    }
    if (tipo === 'subtema' && id) {
      const s = quickSubtemas.find((item) => item.id === id);
      const parent = quickTemas.find((t) => t.id === s?.tema_id);
      return {
        kind: 'subtema',
        id,
        temaId: s?.tema_id ?? 0,
        label: s?.nombre || `Subtema ${id}`,
        parentLabel: parent?.nombre ?? '',
      };
    }
    return null;
  });

  // 2. Comprobar si hay una versión inicial solicitada en URL para restaurar al recargar (F5)
  const initialVersionParam = new URLSearchParams(window.location.search).get('version');
  const initialVersionId = initialVersionParam ? Number(initialVersionParam) : null;

  // Ref que guarda la versión pendiente de restaurar en el primer ciclo (se consume y se limpia)
  const pendingVersionRestoreRef = useRef<number | null>(initialVersionId);

  // Estado de vista: Hub de Versiones vs Editor de Bloques
  const [viewMode, setViewMode] = useState<ViewMode>(() => (initialVersionId ? 'editor' : 'versions_hub'));
  const [activeVersion, setActiveVersion] = useState<PageVersionRow | null>(null);
  const activeVersionRef = useRef<PageVersionRow | null>(null);
  activeVersionRef.current = activeVersion;
  const [versions, setVersions] = useState<PageVersionRow[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [mode, setMode] = useState<WorkspaceMode>('edit');
  const [draftBlocks, setDraftBlocks] = useState<ContentBlock[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isPageNavigatorOpen, setIsPageNavigatorOpen] = useState(false);
  const editorRef = useRef<PageContentEditorHandle>(null);

  // Notificación flotante de guardado
  const [saveToast, setSaveToast] = useState<{
    type: 'success' | 'error' | 'saving';
    message: string;
  } | null>(null);
  const [isSavingChanges, setIsSavingChanges] = useState(false);

  const config = useMemo(() => (selection ? getEditorConfig(selection) : null), [selection]);

  // Carga de catálogo de temas y subtemas
  useEffect(() => {
    const loadPages = async () => {
      if (temas.length === 0) {
        setLoadingPages(true);
      }
      setLoadError('');
      try {
        const [temasData, subtemasData] = await Promise.all([
          getCachedTemas(),
          getCachedSubtemas(),
        ]);
        setTemas(temasData as EditorTemaItem[]);
        setSubtemas(subtemasData as EditorSubtemaItem[]);
      } catch (err) {
        console.error('Error al cargar páginas:', err);
        if (temas.length === 0) {
          setLoadError('No se pudo cargar el listado de páginas.');
        }
      } finally {
        setLoadingPages(false);
      }
    };
    void loadPages();
  }, []);

  // Actualizar etiquetas de página cuando termine de cargar el catálogo completo
  useEffect(() => {
    if (selection && (selection.kind === 'tema' || selection.kind === 'subtema') && (temas.length > 0 || subtemas.length > 0)) {
      if (selection.kind === 'tema') {
        const t = temas.find((item) => item.id === selection.id);
        if (t && t.nombre !== selection.label) {
          setSelection(prev => (prev ? { ...prev, label: t.nombre } : prev));
        }
      } else if (selection.kind === 'subtema') {
        const s = subtemas.find((item) => item.id === selection.id);
        const parent = temas.find((t) => t.id === s?.tema_id);
        if (s && (s.nombre !== selection.label || (parent && parent.nombre !== selection.parentLabel))) {
          setSelection(prev => (prev ? {
            ...prev,
            temaId: s.tema_id,
            label: s.nombre,
            parentLabel: parent?.nombre ?? '',
          } : prev));
        }
      }
    }
  }, [selection, temas, subtemas]);

  // Sincronizar selección y versión activa en la URL para que no se pierda al recargar
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selection) {
      syncUrlSearchParam('tipo', selection.kind);
      syncUrlSearchParam('id', 'id' in selection ? selection.id : null);
      if (viewMode === 'editor' && activeVersion) {
        syncUrlSearchParam('version', activeVersion.id);
      } else if (viewMode === 'versions_hub') {
        syncUrlSearchParam('version', null);
      }
    }
  }, [selection, viewMode, activeVersion]);

  // Carga del historial de versiones para la página seleccionada
  const loadVersions = useCallback(async () => {
    if (!config || !selection || selection.kind === 'credits') return;
    setLoadingVersions(true);
    try {
      const rows = await ensurePageHasInitialVersion(config.entityType, config.entityId, {
        id: user?.id,
        nombre: user?.nombre,
        username: user?.username,
      });
      setVersions(rows);

      // Si ya hay una versión activa, actualizarla con los datos frescos de la BD
      setActiveVersion(prev => {
        if (!prev) return null;
        const fresh = rows.find(r => r.id === prev.id);
        return fresh ?? prev;
      });

      // Si acabamos de recargar la página (F5) con un parámetro 'version' guardado en URL, restaurar directamente el editor
      const targetVer = pendingVersionRestoreRef.current;
      if (targetVer) {
        pendingVersionRestoreRef.current = null;
        const match = rows.find(r => r.id === targetVer);
        if (match) {
          setActiveVersion(match);
          setDraftBlocks(match.blocks ?? []);
          setViewMode('editor');
          syncUrlSearchParam('version', match.id);
        } else if (rows.length > 0) {
          setViewMode('versions_hub');
          syncUrlSearchParam('version', null);
        }
      }
    } catch (err) {
      console.warn('Error al cargar versiones de página:', err);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [config, selection, user]);

  useEffect(() => {
    if (selection) {
      void loadVersions();
    }
  }, [loadVersions, selection]);

  // Protección contra pérdida de datos al cerrar pestaña
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Selección de página en el explorador
  const handleSelectPage = useCallback((nextSelection: PageSelection) => {
    const sameSelection = selection && nextSelection.kind === selection.kind && (
      nextSelection.kind === 'home' || nextSelection.kind === 'temario' || nextSelection.kind === 'credits' ||
      ('id' in nextSelection && 'id' in selection && nextSelection.id === selection.id)
    );
    if (sameSelection) {
      setIsPageNavigatorOpen(false);
      return;
    }
    if (isDirty && !window.confirm('Hay cambios sin guardar en esta versión. ¿Deseas cambiar de página y descartarlos?')) return;
    pendingVersionRestoreRef.current = null;
    setDraftBlocks([]);
    setIsDirty(false);
    setSelection(nextSelection);
    setViewMode('versions_hub');
    setActiveVersion(null);
    syncUrlSearchParam('tipo', nextSelection.kind);
    syncUrlSearchParam('id', 'id' in nextSelection ? nextSelection.id : null);
    syncUrlSearchParam('version', null);
    setMode('edit');
    setIsPageNavigatorOpen(false);
  }, [isDirty, selection]);

  // Acción: Editar una versión específica
  const handleEditVersion = (version: PageVersionRow) => {
    pendingVersionRestoreRef.current = null;
    setActiveVersion(version);
    setDraftBlocks(version.blocks ?? []);
    setViewMode('editor');
    setMode('edit');
    syncUrlSearchParam('version', version.id);
  };

  // Acción: Guardar cambios manualmente con notificación visual
  const handleManualSaveVersion = async () => {
    if (!editorRef.current?.saveChanges) return;
    setIsSavingChanges(true);
    setSaveToast({
      type: 'saving',
      message: 'Guardando cambios de la versión...',
    });
    try {
      const ok = await editorRef.current.saveChanges();
      if (ok) {
        setIsDirty(false);
        setActiveVersion(prev => (prev ? { ...prev, blocks: draftBlocks } : prev));
        void loadVersions();
        setSaveToast({
          type: 'success',
          message: `¡Guardado con éxito! Los cambios de "${activeVersion?.version_name || 'la versión'}" se guardaron correctamente.`,
        });
        window.setTimeout(() => setSaveToast(null), 3800);
      } else {
        setSaveToast({
          type: 'error',
          message: 'Error al guardar. Por favor, verifica los campos e inténtalo nuevamente.',
        });
        window.setTimeout(() => setSaveToast(null), 4500);
      }
    } catch (err) {
      console.error('Error al guardar versión:', err);
      setSaveToast({
        type: 'error',
        message: 'Error de conexión al guardar los cambios en la base de datos.',
      });
      window.setTimeout(() => setSaveToast(null), 4500);
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Acción: Volver al Hub de Versiones o al catálogo inicial
  const handleSmartBack = async () => {
    if (viewMode === 'editor') {
      // Si estamos en preview mode, volvemos a edit mode
      if (mode === 'preview') {
        setMode('edit');
        return;
      }

      // 1. Guardar los cambios de la versión automáticamente
      if (isDirty && editorRef.current?.saveChanges) {
        try {
          await editorRef.current.saveChanges();
        } catch (err) {
          console.warn('Error al autoguardar antes de regresar:', err);
        }
      }
      setIsDirty(false);
      pendingVersionRestoreRef.current = null;
      setViewMode('versions_hub');
      setActiveVersion(null);
      syncUrlSearchParam('version', null);
      void loadVersions();
      return;
    }

    // Si estamos en el Hub de Versiones de una página, regresar al catálogo general de páginas
    if (selection !== null) {
      pendingVersionRestoreRef.current = null;
      setSelection(null);
      setViewMode('versions_hub');
      setActiveVersion(null);
      syncUrlSearchParam('tipo', null);
      syncUrlSearchParam('id', null);
      syncUrlSearchParam('version', null);
      clearPreservedRouteState('/editor-paginas');
      return;
    }

    // 2. Si ya está en la pantalla inicial, salir al panel de administración /edicion
    clearPreservedRouteState('/editor-paginas');
    handleGoBack();
  };

  // Acción: Publicar versión
  const handlePublishVersion = async (version: PageVersionRow) => {
    await publishPageVersion(version.id, {
      id: user?.id,
      nombre: user?.nombre,
      username: user?.username,
    });
    await loadVersions();
  };

  // Acción: Crear nueva versión
  const handleCreateVersion = async ({
    versionName,
    description,
    fromVersionId,
  }: {
    versionName: string;
    description: string;
    fromVersionId?: number | null;
  }) => {
    if (!config) return;
    let sourceBlocks: ContentBlock[] = [];
    if (fromVersionId) {
      const sourceVer = versions.find(v => v.id === fromVersionId);
      if (sourceVer) {
        sourceBlocks = sourceVer.blocks;
      }
    }

    const created = await createPageVersion({
      entityType: config.entityType,
      entityId: config.entityId,
      versionName,
      description,
      sourceBlocks,
      user: {
        id: user?.id,
        nombre: user?.nombre,
        username: user?.username,
      },
    });

    await loadVersions();
    // Abrir de inmediato la nueva versión en el editor
    handleEditVersion(created);
  };

  // Acción: Eliminar versión
  const handleDeleteVersion = async (version: PageVersionRow) => {
    await deletePageVersion(version.id);
    await loadVersions();
  };

  return (
    <>
      {/* ─── VISTA PREVIA EN VIVO REAL (sin desmontar el editor de contenido) ─── */}
      {selection && viewMode === 'editor' && mode === 'preview' && (
        <RealPageDraftViewer
          selection={selection}
          blocks={draftBlocks}
          versionName={activeVersion?.version_name}
          isPublished={activeVersion?.is_published}
          onBackToEditor={() => setMode('edit')}
        />
      )}

      <div
        className="page-editor-page"
        style={{ display: mode === 'preview' ? 'none' : 'block' }}
      >
        <Header />
        <main className="page-editor-page-main">
          <BackButton onClick={handleSmartBack} />

        {/* ─── NOTIFICACIÓN FLOTANTE DE GUARDADO ─── */}
        {saveToast && (
          <aside
            aria-live="polite"
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 22px',
              borderRadius: '16px',
              background:
                saveToast.type === 'success'
                  ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                  : saveToast.type === 'error'
                  ? 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              color: '#ffffff',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              fontSize: '0.9rem',
              fontWeight: 800,
              border: '1.5px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
              animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
              maxWidth: '480px',
            }}
          >
            {saveToast.type === 'success' && <CheckCircle size={20} color="#a7f3d0" />}
            {saveToast.type === 'error' && <AlertCircle size={20} color="#fecaca" />}
            {saveToast.type === 'saving' && (
              <div style={{
                width: '18px',
                height: '18px',
                border: '2.5px solid rgba(255,255,255,0.35)',
                borderTop: '2.5px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                flexShrink: 0,
              }} />
            )}
            <span style={{ lineHeight: 1.4 }}>{saveToast.message}</span>
          </aside>
        )}

        {/* ─── HEADER DEL EDITOR CON ACCIÓN DIRECTA ─── */}
        <header className="page-editor-intro">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="page-editor-eyebrow">Suite de Edición Visual</span>
              <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                Sistema de Versiones
              </span>
            </div>
            <h1>Diseña y personaliza el contenido del Atlas</h1>
            <p>Gestiona versiones publicadas y borradores con edición en vivo y control total de autoría.</p>
          </div>
          {config && (
            <a href={config.publicUrl} target="_blank" rel="noopener noreferrer" className="page-editor-open-public">
              <ExternalLink size={16} />
              <span>Ver página pública</span>
            </a>
          )}
        </header>

        {loadError && <div className="page-editor-global-error"><AlertCircle size={18} /> {loadError}</div>}

        {/* ─── CASO 1: PANTALLA INICIAL (EXPLORADOR A PANTALLA COMPLETA) ─── */}
        {!selection ? (
          <FullScreenPageSelector
            temas={temas}
            subtemas={subtemas}
            loading={loadingPages}
            onSelect={handleSelectPage}
            showCredits={isAdministrator}
          />
        ) : (
          /* ─── CASO 2: PÁGINA SELECCIONADA (WORKSPACE CON EXPLORADOR LATERAL) ─── */
          <section className={`page-editor-workspace ${isPageNavigatorOpen ? '' : 'is-nav-collapsed'}`}>
            {isPageNavigatorOpen && (
              <PageNavigator
                selection={selection}
                temas={temas}
                subtemas={subtemas}
                loading={loadingPages}
                onSelect={handleSelectPage}
                onClose={() => setIsPageNavigatorOpen(false)}
                showCredits={isAdministrator}
              />
            )}

            <div className="page-editor-main">
              {selection.kind === 'credits' ? (
                /* ─── CASO ESPECIAL: CRÉDITOS ─── */
                <CreditsAdminPanel />
              ) : viewMode === 'versions_hub' && config ? (
                /* ─── VISTA 1: HUB DE HISTORIAL DE VERSIONES ─── */
                <div>
                  {/* Barra superior toggle del explorador */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      className={`page-editor-pages-toggle ${isPageNavigatorOpen ? 'is-open' : ''}`}
                      onClick={() => setIsPageNavigatorOpen(open => !open)}
                      aria-expanded={isPageNavigatorOpen}
                      title={isPageNavigatorOpen ? 'Ocultar explorador de páginas' : 'Abrir explorador de páginas'}
                    >
                      <PanelLeftOpen size={16} />
                      <span>{isPageNavigatorOpen ? 'Ocultar páginas' : 'Explorar páginas'}</span>
                    </button>
                  </div>

                  <PageVersionsHub
                    pageTitle={config.title}
                    pageContext={config.context}
                    publicUrl={config.publicUrl}
                    entityType={config.entityType}
                    entityId={config.entityId}
                    versions={versions}
                    loading={loadingVersions}
                    onEditVersion={handleEditVersion}
                    onPublishVersion={handlePublishVersion}
                    onCreateVersion={handleCreateVersion}
                    onDeleteVersion={handleDeleteVersion}
                    onRefresh={loadVersions}
                  />
                </div>
              ) : config ? (
                /* ─── VISTA 2: LIENZO EDITOR DE CONTENIDO VISUAL ─── */
                viewMode === 'editor' && !activeVersion ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '420px',
                    gap: '14px',
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    padding: '40px 20px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    margin: '12px 0',
                  }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: '3.5px solid #e2e8f0',
                      borderTopColor: '#2563eb',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                      Cargando editor de la versión...
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Restaurando componentes y diseño de la plantilla.
                    </span>
                  </div>
                ) : (
                <div>
                  {/* ─── BARRA SUPERIOR DE EDICIÓN DE VERSIÓN ─── */}
                  <div className="page-editor-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {/* Botón Volver a Versiones */}
                      <button
                        type="button"
                        onClick={handleSmartBack}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        title="Regresar a la lista de versiones de esta página"
                      >
                        <ArrowLeft size={15} strokeWidth={2.5} />
                        <span>Versiones</span>
                      </button>

                      <button
                        type="button"
                        className={`page-editor-pages-toggle ${isPageNavigatorOpen ? 'is-open' : ''}`}
                        onClick={() => setIsPageNavigatorOpen(open => !open)}
                        aria-expanded={isPageNavigatorOpen}
                        title={isPageNavigatorOpen ? 'Ocultar explorador de páginas' : 'Abrir explorador de páginas'}
                      >
                        <PanelLeftOpen size={16} />
                        <span>{isPageNavigatorOpen ? 'Ocultar' : 'Páginas'}</span>
                      </button>

                      <div className="page-editor-current">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <small>{config.title}</small>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>•</span>
                          {activeVersion?.is_published ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 900, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px' }}>
                              PUBLICADA
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                              BORRADOR
                            </span>
                          )}
                        </div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileEdit size={16} color="#2563eb" />
                          {activeVersion?.version_name || 'Editando Versión'}
                        </h1>
                      </div>
                    </div>

                    {/* Indicador de Estado, Botón Guardar y Vista Previa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={isDirty ? 'page-editor-dirty' : 'page-editor-saved'}>
                        {isDirty ? (
                          <>
                            <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                            Cambios pendientes
                          </>
                        ) : (
                          <>
                            <CheckCircle size={13} style={{ display: 'inline', marginRight: '4px' }} />
                            Guardado
                          </>
                        )}
                      </span>

                      {/* Botón Guardar Cambios */}
                      <button
                        type="button"
                        onClick={handleManualSaveVersion}
                        disabled={isSavingChanges}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '9px',
                          background: isSavingChanges ? '#93c5fd' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: isSavingChanges ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                          transition: 'all 0.15s ease',
                        }}
                        title="Guardar todos los cambios de esta versión"
                      >
                        <Save size={14} />
                        <span>{isSavingChanges ? 'Guardando...' : 'Guardar Cambios'}</span>
                      </button>

                      {/* Botón Vista Previa en Vivo Real */}
                      <button
                        type="button"
                        onClick={() => setMode('preview')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '9px',
                          background: '#f1f5f9',
                          color: '#0f172a',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Ver exactamente cómo se verá esta versión en la página real pública"
                      >
                        <Eye size={15} color="#0284c7" />
                        <span>Vista Previa</span>
                      </button>
                    </div>
                  </div>

                  {/* ─── CONTENEDOR DEL CANVAS DE EDICIÓN ─── */}
                  <div className="page-editor-content mode-edit">
                    <div>
                      <div className="page-editor-engine-note">
                        <ShieldCheck size={17} color={activeVersion?.is_published ? '#059669' : '#2563eb'} />
                        <span>
                          {activeVersion?.is_published ? (
                            <><strong>Editando Versión Publicada:</strong> Al guardar cambios, la web pública se sincronizará automáticamente.</>
                          ) : (
                            <><strong>Editando Borrador Privado:</strong> Los cambios no serán visibles en la web pública hasta que pulses <strong>Publicar</strong> desde el historial de versiones.</>
                          )}
                        </span>
                      </div>
                      <PageContentEditor
                        ref={editorRef}
                        key={activeVersion ? `version-${activeVersion.id}` : `${config.entityType}:${config.entityId}`}
                        entityType={config.entityType}
                        entityId={config.entityId}
                        activeVersion={activeVersion}
                        onBlocksChange={setDraftBlocks}
                        onDirtyChange={setIsDirty}
                        onVersionSaved={() => {
                          setActiveVersion(prev => (prev ? { ...prev, blocks: draftBlocks } : prev));
                          void loadVersions();
                        }}
                        onManualSaveRequest={handleManualSaveVersion}
                        experienceMode="advanced"
                        autoSave
                      />
                    </div>
                  </div>
                </div>
                )
              ) : null}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  </>
);
};

export default EditorPaginas;
