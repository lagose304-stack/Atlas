import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, FileQuestion } from 'lucide-react';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { pageKeySchema } from '../domain/schema';
import Editor2Renderer from '../render/Editor2Renderer';
import { editor2Api, type Editor2PublicDoc } from '../services/editor2Api';
import '../styles/editor2.css';

// Caché pública en memoria indexada por `${pageKey}:${versionId}` y puntero por `pageKey`.
const publicDocCacheByKeyVersion = new Map<string, Editor2PublicDoc>();
const latestVersionByPageKey = new Map<string, string>();

export function clearEditor2PublicCache(): void {
  publicDocCacheByKeyVersion.clear();
  latestVersionByPageKey.clear();
}

export type Editor2PublicViewProps = {
  loadPublicDoc?: (pageKey: string) => Promise<Editor2PublicDoc | null>;
};

const Editor2PublicView: React.FC<Editor2PublicViewProps> = ({
  loadPublicDoc = (key) => editor2Api.getPublicDoc(key),
}) => {
  const { pageKey } = useParams<{ pageKey: string }>();
  const parsedKey = pageKeySchema.safeParse(pageKey);
  const safePageKey = parsedKey.success ? parsedKey.data : null;

  const [doc, setDoc] = useState<Editor2PublicDoc | null>(() => {
    if (!safePageKey) return null;
    const versionId = latestVersionByPageKey.get(safePageKey);
    return versionId ? publicDocCacheByKeyVersion.get(`${safePageKey}:${versionId}`) ?? null : null;
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(() =>
    safePageKey ? (doc ? 'ready' : 'loading') : 'error',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!safePageKey) {
      setStatus('error');
      setErrorMessage('La clave de la página no es válida.');
      return;
    }

    let active = true;
    setErrorMessage(null);
    const cachedVersion = latestVersionByPageKey.get(safePageKey);
    if (!cachedVersion) setStatus('loading');

    loadPublicDoc(safePageKey)
      .then((result) => {
        if (!active) return;
        if (!result) {
          latestVersionByPageKey.delete(safePageKey);
          setDoc(null);
          setStatus('empty');
          return;
        }
        const cacheKey = `${result.pageKey}:${result.versionId}`;
        publicDocCacheByKeyVersion.set(cacheKey, result);
        latestVersionByPageKey.set(result.pageKey, result.versionId);
        setDoc(result);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setDoc(null);
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'No se pudo cargar la versión publicada.',
        );
      });

    return () => {
      active = false;
    };
  }, [loadPublicDoc, safePageKey]);

  return (
    <div className="editor2-scope">
      <Header />
      <main className="e2-main e2-public-main">
        {status === 'loading' && (
          <div className="e2-loading" role="status">
            <span className="e2-loading__ring" aria-hidden="true" />
            <span>Cargando página publicada…</span>
          </div>
        )}

        {status === 'error' && (
          <section className="e2-alert e2-alert--error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <h1>No se pudo mostrar la página</h1>
              <p>{errorMessage ?? 'Ocurrió un error al consultar la publicación.'}</p>
              <Link className="e2-button" to="/">
                Volver al inicio
              </Link>
            </div>
          </section>
        )}

        {status === 'empty' && (
          <section className="e2-public-empty" role="status">
            <FileQuestion size={28} aria-hidden="true" />
            <h1>Sin versión publicada</h1>
            <p>
              Esta página aún no tiene una versión publicada en Editor 2.0. Los borradores nunca se
              muestran públicamente.
            </p>
            <Link className="e2-button e2-button--quiet" to="/">
              Volver al inicio
            </Link>
          </section>
        )}

        {status === 'ready' && doc && (
          <div className="e2-public-page" data-e2-public-version={doc.versionId}>
            <Editor2Renderer doc={doc.doc} variant="public" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Editor2PublicView;
