import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import BackButton from '../../components/BackButton';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { useSmartBackNavigation } from '../../hooks/useSmartBackNavigation';
import PageSearch from '../navigation/PageSearch';
import {
  clearRecentPages,
  loadPageIndex,
  readRecentPageKeys,
  type Editor2PageSummary,
} from '../services/pageIndex';
import '../styles/editor2.css';

const Editor2Home: React.FC = () => {
  const [searchParams] = useSearchParams();
  const handleGoBack = useSmartBackNavigation('/edicion');
  const [pages, setPages] = useState<Editor2PageSummary[]>([]);
  const [recentPages, setRecentPages] = useState<Editor2PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  const section = searchParams.get('seccion') ?? 'Todas';
  const focusOnMount = searchParams.get('foco') === 'buscador';

  useEffect(() => {
    let active = true;
    loadPageIndex()
      .then((result) => {
        if (!active) return;
        setPages(result.pages);
        setWarning(result.warning);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('No se pudo preparar el índice de páginas. Vuelve a intentarlo.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const knownPages = new Map(pages.map((page) => [page.pageKey, page]));
    setRecentPages(readRecentPageKeys().map((key) => knownPages.get(key)).filter(
      (page): page is Editor2PageSummary => page !== undefined,
    ));
  }, [pages]);

  const handleClearRecents = () => {
    clearRecentPages();
    setRecentPages([]);
  };

  return (
    <div className="editor2-scope">
      <Header />
      <main className="e2-main">
        <div className="e2-home-page">
          <BackButton onClick={handleGoBack} />

          {warning && (
            <div className="e2-alert" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <p>{warning}</p>
            </div>
          )}

          {loading && (
            <div className="e2-loading" role="status">
              <span className="e2-loading__ring" aria-hidden="true" />
              <p>Preparando el índice de páginas…</p>
            </div>
          )}

          {error && (
            <div className="e2-alert e2-alert--error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <p>{error}</p>
              <button
                type="button"
                className="e2-button e2-button--quiet"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && (
            <PageSearch
              pages={pages}
              recentPages={recentPages}
              onClearRecents={handleClearRecents}
              initialQuery={query}
              initialSection={section}
              focusOnMount={focusOnMount}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Editor2Home;
