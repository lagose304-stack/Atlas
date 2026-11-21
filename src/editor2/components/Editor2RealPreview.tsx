import React, { Component, Suspense, lazy, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CanvasDoc } from '../domain/schema';
import { Editor2PreviewDocProvider } from '../public/previewDoc';
import Editor2Renderer from '../render/Editor2Renderer';

const Home = lazy(() => import('../../pages/Home'));
const TemarioPublico = lazy(() => import('../../pages/TemarioPublico'));
const Subtemas = lazy(() => import('../../pages/Subtemas'));
const PlacasSubtema = lazy(() => import('../../pages/PlacasSubtema'));

type PreviewPage = {
  /** Ruta que se simula en la vista previa (la URL pública real). */
  path: string;
  /** Patrón de ruta con parámetros para que `useParams` reciba los ids. */
  pattern: string;
  Page: React.LazyExoticComponent<React.ComponentType>;
};

/**
 * Traduce la clave de Editor 2.0 a la ruta pública real donde se integra su
 * contenido. Las claves sin integración pública (por ejemplo `creditos`)
 * devuelven `null` y la vista previa cae al render del documento aislado.
 */
export function resolveEditor2PreviewPage(pageKey: string): PreviewPage | null {
  if (pageKey === 'home') return { path: '/', pattern: '/', Page: Home };
  if (pageKey === 'temario') {
    return { path: '/temario', pattern: '/temario', Page: TemarioPublico };
  }

  const tema = /^tema-(\d+)$/.exec(pageKey);
  if (tema) {
    return { path: `/subtemas/${tema[1]}`, pattern: '/subtemas/:temaId', Page: Subtemas };
  }

  const subtema = /^subtema-(\d+)$/.exec(pageKey);
  if (subtema) {
    return {
      path: `/ver-placas/${subtema[1]}`,
      pattern: '/ver-placas/:subtemaId',
      Page: PlacasSubtema,
    };
  }

  return null;
}

function PreviewLoading() {
  return (
    <div className="editor2-scope e2-real-preview__loading" role="status">
      <span>Preparando la vista previa pública…</span>
    </div>
  );
}

type PreviewBoundaryState = { error: Error | null };

/** Evita que un fallo de la página pública deje en blanco todo el editor. */
class PreviewBoundary extends Component<{ children: ReactNode }, PreviewBoundaryState> {
  state: PreviewBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('No se pudo montar la vista previa pública:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="editor2-scope e2-real-preview__error" role="alert">
          <p>No se pudo montar la página pública para la vista previa.</p>
          <p className="e2-real-preview__error-detail">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export type Editor2RealPreviewProps = {
  doc: CanvasDoc;
};

const PreviewInRoute: React.FC<{
  doc: CanvasDoc;
  resolved: PreviewPage;
}> = ({ doc, resolved }) => {
  const { path, pattern, Page } = resolved;

  return (
    <Editor2PreviewDocProvider value={{ pageKey: doc.pageKey, doc }}>
      <PreviewBoundary>
        <Suspense fallback={<PreviewLoading />}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={pattern} element={<Page />} />
            </Routes>
          </MemoryRouter>
        </Suspense>
      </PreviewBoundary>
    </Editor2PreviewDocProvider>
  );
};

/**
 * Monta la página pública sin contenedores adicionales para que sus selectores
 * y puntos de quiebre se apliquen desde la raíz del iframe.
 */
const Editor2RealPreview: React.FC<Editor2RealPreviewProps> = ({ doc }) => {
  const resolved = resolveEditor2PreviewPage(doc.pageKey);

  useEffect(() => {
    const preventActions = (event: Event) => {
      if (event.type === 'submit' || (event.target instanceof Element && event.target.closest('a, button'))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const events = ['click', 'auxclick', 'submit'];
    events.forEach((event) => document.addEventListener(event, preventActions, true));
    return () => events.forEach((event) => document.removeEventListener(event, preventActions, true));
  }, []);

  if (!resolved) {
    return (
      <div className="editor2-scope e2-real-preview--fallback">
        <p className="e2-real-preview__note" role="status">
          Esta página todavía no se integra en una página pública. La vista previa muestra solo su
          contenido.
        </p>
        <MemoryRouter><Editor2Renderer doc={doc} variant="public" /></MemoryRouter>
      </div>
    );
  }

  return <PreviewInRoute key={doc.pageKey} doc={doc} resolved={resolved} />;
};

export default Editor2RealPreview;
