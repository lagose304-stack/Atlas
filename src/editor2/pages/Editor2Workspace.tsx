import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Layers } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { useSmartBackNavigation } from '../../hooks/useSmartBackNavigation';
import Editor2Canvas from '../components/Editor2Canvas';
import PageFrame from '../components/PageFrame';
import SaveBar from '../components/SaveBar';
import TemplateDrawer from '../components/TemplateDrawer';
import ThemeDrawer from '../components/ThemeDrawer';
import VersionDrawer from '../components/VersionDrawer';
import { createEmptyCanvasDoc, createNestedCanvasNode, createPlacedBlock } from '../domain/defaults';
import { pageKeySchema, type CanvasDoc } from '../domain/schema';
import PageBreadcrumb from '../navigation/PageBreadcrumb';
import Editor2Renderer from '../render/Editor2Renderer';
import { editor2Api } from '../services/editor2Api';
import {
  EDITOR2_HOME_PATH,
  focusSearchPath,
  loadPageIndex,
  readVersionParam,
  rememberPage,
  type Editor2PageSummary,
} from '../services/pageIndex';
import { readEditor2Draft, writeEditor2Draft } from '../store/draftCache';
import { useEditor2Store } from '../store/editor2Store';
import '../styles/editor2.css';



const kindLabelFor = (page: Editor2PageSummary | undefined): string => {
  if (page?.kind === 'tema') return 'Tema';
  if (page?.kind === 'subtema') return 'Subtema';
  if (page?.kind === 'fixed') return 'Página base';
  return 'Página';
};

type PlacedLike = {
  block: {
    type: string;
    slots?: { children: PlacedLike[] };
    props?: { items?: Array<{ children?: PlacedLike[] }> };
  };
};

function countBlocks(doc: CanvasDoc | null): number {
  if (!doc) return 0;

  const walk = (items: readonly PlacedLike[]): number =>
    items.reduce((total, item) => {
      const slotChildren = item.block.slots ? walk(item.block.slots.children) : 0;
      const tabChildren = Array.isArray(item.block.props?.items)
        ? item.block.props.items.reduce(
            (sum, tab) => sum + (Array.isArray(tab.children) ? walk(tab.children) : 0),
            0,
          )
        : 0;
      return total + 1 + slotChildren + tabChildren;
    }, 0);

  return walk(doc.root.slots.children as unknown as readonly PlacedLike[]);
}

const Editor2Workspace: React.FC = () => {
  const { pageKey } = useParams<{ pageKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleGoBack = useSmartBackNavigation(EDITOR2_HOME_PATH);
  const [pages, setPages] = useState<Editor2PageSummary[]>([]);
  const [preview, setPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState('auto');
  const pageWidth = previewSize === 'auto' ? undefined : Number(previewSize);
  const togglePreview = () => setPreview(!preview);

  const doc = useEditor2Store((state) => state.doc);
  const dirty = useEditor2Store((state) => state.dirty);
  const saveDraftNow = useEditor2Store((state) => state.saveDraftNow);
  const publishDraftNow = useEditor2Store((state) => state.publishDraftNow);
  const unpublishNow = useEditor2Store((state) => state.unpublishNow);

  const parsedKey = pageKeySchema.safeParse(pageKey);
  const parsedPageKey = parsedKey.success ? parsedKey.data : null;
  const versionInfo = readVersionParam(searchParams.get('version'));

  useEffect(() => {
    let active = true;
    loadPageIndex()
      .then((result) => { if (active) setPages(result.pages); })
      .catch(() => { if (active) setPages([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (parsedKey.success) rememberPage(parsedKey.data);
  }, [pageKey, parsedKey.success]);

  useEffect(() => {
    setPreview(false);
    setHistoryOpen(false);
    if (!parsedPageKey) return;

    const state = useEditor2Store.getState();
    if (state.doc?.pageKey !== parsedPageKey) {
      state.setDoc(readEditor2Draft(parsedPageKey) ?? createEmptyCanvasDoc(parsedPageKey, {
        children: [createPlacedBlock(createNestedCanvasNode())],
      }));
      state.setWorkspaceMeta({ versions: [], publication: null, baseVersionId: null, updatedAt: null });
      const loaded = useEditor2Store.getState().doc;
      if (loaded) writeEditor2Draft(loaded);
    }

    let active = true;
    editor2Api
      .getWorkspace(parsedPageKey)
      .then((ws) => {
        if (!active) return;
        const current = useEditor2Store.getState();
        current.setWorkspaceMeta({
          versions: ws.versions,
          publication: ws.publication,
          baseVersionId: ws.draft?.baseVersionId ?? ws.publication?.versionId ?? null,
          updatedAt: ws.draft?.updatedAt ?? null,
        });
        if (ws.draft && !current.dirty) {
          current.setDoc(ws.draft.doc);
          writeEditor2Draft(ws.draft.doc);
        }
      })
      .catch(() => {
        // En modo sin sesión o pruebas simuladas se conserva el borrador local en memoria.
      });

    return () => {
      active = false;
    };
  }, [parsedPageKey]);

  useEffect(() => {
    if (!dirty || !parsedPageKey) return;
    const timer = window.setTimeout(() => {
      const current = useEditor2Store.getState();
      if (current.dirty && current.doc?.pageKey === parsedPageKey) {
        void current.saveDraftNow();
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dirty, doc, parsedPageKey]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(
    () =>
      useEditor2Store.subscribe((state, previous) => {
        if (state.doc && state.doc !== previous.doc) writeEditor2Draft(state.doc);
      }),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate(focusSearchPath());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const page = parsedKey.success ? pages.find((item) => item.pageKey === parsedKey.data) : undefined;
  const parentPage = page?.parentPageKey
    ? pages.find((item) => item.pageKey === page.parentPageKey)
    : undefined;
  const title = page?.title ?? (parsedKey.success ? parsedKey.data : 'Página no encontrada');
  const kindLabel = kindLabelFor(page);

  const activeDoc = doc && doc.pageKey === parsedPageKey ? doc : null;
  const blockCount = useMemo(() => countBlocks(activeDoc), [activeDoc]);

  return (
    <div className="editor2-scope">
      <Header />
      <main className="e2-main">
        <div className="e2-workspace-page">
          <header className="e2-studio-header">
            <div className="e2-studio-header__left">
              <BackButton onClick={handleGoBack} />
              <div className="e2-studio-header__meta">
                <PageBreadcrumb
                  section={page?.section}
                  parentTitle={parentPage?.title}
                  parentPageKey={parentPage?.pageKey}
                  pageTitle={parsedKey.success ? title : undefined}
                />
                {parsedKey.success && (
                  <div className="e2-studio-header__title-row">
                    <h1>{title}</h1>
                    <span className="e2-eyebrow e2-studio-header__kind">
                      {kindLabel}
                      {page?.parcial ? ` · ${page.parcial}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="e2-studio-header__actions">
              <Link className="e2-button e2-button--quiet" to={EDITOR2_HOME_PATH}>
                Ver índice
              </Link>
              {parsedKey.success && page && (
                <a
                  className="e2-button e2-button--quiet"
                  href={page.publicPath}
                  target="_blank" rel="noopener noreferrer"
                >
                  Ver pública
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </header>

          {!parsedKey.success ? (
            <section className="e2-alert e2-alert--error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <h1>Enlace de página no válido</h1>
                <p>La clave de la página solo admite minúsculas, números y guiones.</p>
                <Link className="e2-button" to={EDITOR2_HOME_PATH}>Volver al índice</Link>
              </div>
            </section>
          ) : (
            <>
              {versionInfo.invalid && (
                <div className="e2-alert e2-alert--error" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <p>El parámetro <code>version</code> no es válido y se ignoró.</p>
                </div>
              )}
              {versionInfo.version !== null && (
                <div className="e2-version-note" role="status">
                  Este enlace solicita la revisión n.º {versionInfo.version}.
                </div>
              )}

              <div className="e2-workspace-grid">
                <section className="e2-canvas-shell" aria-label="Lienzo de la página">
                  {activeDoc ? (
                    <>
                      <SaveBar
                        preview={preview}
                        onTogglePreview={togglePreview}
                        previewSize={previewSize}
                        onPreviewSizeChange={setPreviewSize}
                        onSave={() => void saveDraftNow()}
                        onPublish={() => void publishDraftNow()}
                        onUnpublish={() => void unpublishNow()}
                        onOpenTemplates={() => setTemplatesOpen(true)}
                        onOpenTheme={() => setThemeOpen(true)}
                        onOpenHistory={() => setHistoryOpen(true)}
                        publicViewPath={parsedPageKey ? `/vista-v2/${encodeURIComponent(parsedPageKey)}` : undefined}
                        publicSitePath={page?.publicPath}
                      />
                      <TemplateDrawer open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
                      <ThemeDrawer open={themeOpen} onClose={() => setThemeOpen(false)} />
                      {parsedPageKey && (
                        <VersionDrawer
                          open={historyOpen}
                          pageKey={parsedPageKey}
                          onClose={() => setHistoryOpen(false)}
                        />
                      )}
                      <div
                        className={`e2-canvas-shell__body${preview ? ' e2-canvas-shell__body--preview' : ''}`}
                      >
                        {preview ? (
                          <div className="e2-canvas-stage">
                            <PageFrame width={pageWidth}><Editor2Renderer doc={activeDoc} /></PageFrame>
                          </div>
                        ) : (
                          <Editor2Canvas doc={activeDoc} width={pageWidth} />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="e2-canvas-loading" role="status">
                      Preparando el lienzo…
                    </div>
                  )}
                </section>

                <details className="e2-inspector">
                  <summary>Detalles de la página</summary>
                  <dl>
                    <div>
                      <dt>Clave</dt>
                      <dd className="e2-mono">{parsedKey.data}</dd>
                    </div>
                    <div>
                      <dt>Ruta pública</dt>
                      <dd className="e2-mono">{page?.publicPath ?? 'No disponible'}</dd>
                    </div>
                    <div>
                      <dt>Tipo</dt>
                      <dd>{kindLabel}</dd>
                    </div>
                    {page?.parcial && (
                      <div>
                        <dt>Parcial</dt>
                        <dd>{page.parcial}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Revisión</dt>
                      <dd>
                        {versionInfo.version !== null
                          ? `n.º ${versionInfo.version}`
                          : 'Sin revisión'}
                      </dd>
                    </div>
                    <div>
                      <dt>Bloques</dt>
                      <dd>
                        <span className="e2-inspector__count">
                          <Layers size={13} aria-hidden="true" />
                          {blockCount}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>{preview ? 'Vista previa en memoria' : 'Borrador en memoria'}</dd>
                    </div>
                  </dl>
                  <p className="e2-inspector__note">
                    El lienzo, el historial y las versiones viven solo en esta pestaña hasta la
                    Parte 6. Este espacio no modifica el editor actual.
                  </p>
                </details>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Editor2Workspace;
