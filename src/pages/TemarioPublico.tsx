import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  describeSupabaseError,
  formatClientRuntimeContext,
  getClientRuntimeContext,
  isLikelyTransientNetworkError,
  supabase,
  type SupabaseQueryError,
} from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../types/contentBlocks';
import { getRenderableBlocks } from '../services/contentPublication';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { ArrowRight, GraduationCap, Microscope } from 'lucide-react';

interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

const PARCIALES: { key: 'primer' | 'segundo' | 'tercer'; label: string; num: string }[] = [
  { key: 'primer', label: 'PRIMER PARCIAL', num: '1' },
  { key: 'segundo', label: 'SEGUNDO PARCIAL', num: '2' },
  { key: 'tercer', label: 'TERCER PARCIAL', num: '3' },
];

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const fetchTemasViaRestFallback = async (): Promise<{ data: Tema[] | null; error: SupabaseQueryError | null }> => {
  const normalizedBaseUrl = (SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const normalizedAnonKey = (SUPABASE_ANON_KEY || '').trim();
  if (!normalizedBaseUrl || !normalizedAnonKey) {
    return {
      data: null,
      error: {
        code: 'FALLBACK_CONFIG_MISSING',
        message: 'No se pudo usar fallback REST por configuracion incompleta de Supabase.',
      },
    };
  }

  const url = `${normalizedBaseUrl}/rest/v1/temas?select=id,nombre,logo_url,parcial&order=sort_order.asc`;
  const headers: HeadersInit = {
    apikey: normalizedAnonKey,
    Authorization: `Bearer ${normalizedAnonKey}`,
    Accept: 'application/json',
    'Content-Profile': 'public',
  };

  let lastError: SupabaseQueryError | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        lastError = {
          code: `FALLBACK_HTTP_${response.status}`,
          message: `Fallback REST devolvio ${response.status} ${response.statusText}`,
          details: responseText.slice(0, 280),
        };
      } else {
        const data = (await response.json()) as Tema[];
        return { data, error: null };
      }
    } catch (error) {
      lastError = {
        message: describeSupabaseError(error),
      };
    }

    if (attempt < 2 && isLikelyTransientNetworkError(lastError)) {
      await wait(420 * attempt);
      continue;
    }
    break;
  }

  return {
    data: null,
    error: lastError ?? { message: 'Fallo fallback REST sin detalle adicional.' },
  };
};

const buildTemasLoadError = (error: SupabaseQueryError | null | undefined): string => {
  const details = describeSupabaseError(error).toLowerCase();
  if (details.includes('aborterror') || details.includes('operation was aborted')) {
    return 'La conexion se interrumpio mientras cargaba el temario. Revisa estabilidad de red e intenta de nuevo.';
  }

  if (isLikelyTransientNetworkError(error)) {
    return 'No se pudo cargar el temario por un problema de red. Revisa tu WiFi o DNS e intenta de nuevo.';
  }

  return 'No se pudo cargar el temario en este momento. Revisa tu conexion e intenta de nuevo.';
};

const TemaCard: React.FC<{ tema: Tema; onClick: () => void }> = ({ tema, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoSrc, setLogoSrc] = useState(() =>
    tema.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'cardWide') : ''
  );
  const [logoSrcSet, setLogoSrcSet] = useState(() =>
    tema.logo_url
      ? `${getCloudinaryImageUrl(tema.logo_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(tema.logo_url, 'cardWide')} 960w`
      : undefined
  );

  useEffect(() => {
    setLogoFailed(false);
    setLogoSrc(tema.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'cardWide') : '');
    setLogoSrcSet(
      tema.logo_url
        ? `${getCloudinaryImageUrl(tema.logo_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(tema.logo_url, 'cardWide')} 960w`
        : undefined
    );
  }, [tema.logo_url]);

  return (
    <button
      type="button"
      className="temario-topic-card"
      style={{
        borderRadius: '18px',
        background: '#ffffff',
        boxShadow: hovered
          ? '0 18px 34px rgba(23, 65, 101, 0.16)'
          : '0 8px 22px rgba(23, 65, 101, 0.08)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease',
        border: hovered ? '1px solid rgba(97, 143, 202, 0.56)' : '1px solid rgba(199, 215, 232, 0.92)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        fontFamily: 'inherit',
        padding: 0,
        width: '100%',
        minHeight: '196px',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        filter: hovered ? 'saturate(1.02)' : 'none',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: '138px',
          width: '100%',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(201, 217, 233, 0.92)',
          background: 'linear-gradient(145deg, #e5f4fc, #d5e9f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {tema.logo_url && !logoFailed ? (
          <img
            src={logoSrc}
            srcSet={logoSrcSet}
            sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 420px"
            alt={tema.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (logoSrc !== tema.logo_url) {
                setLogoSrc(tema.logo_url);
                setLogoSrcSet(undefined);
                return;
              }
              setLogoFailed(true);
            }}
          />
        ) : (
          <span style={styles.topicFallback}><Microscope size={30} /><span>Atlas histológico</span></span>
        )}
        <span className="temario-topic-overlay"><span>Explorar tema</span><ArrowRight size={16} /></span>
      </div>

      <h4
        className="temario-card-title atlas-typo-card"
        style={{
          margin: '0',
          minHeight: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 13px',
          background: 'linear-gradient(180deg, #ffffff 0%, #f4f9fc 100%)',
          lineHeight: 1.25,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            whiteSpace: 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.25,
          }}
        >
          {tema.nombre}
        </span>
        <ArrowRight className="temario-topic-arrow" size={17} aria-hidden="true" />
      </h4>
    </button>
  );
};

const TemarioPublico: React.FC = () => {
  const navigate = useNavigate();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [temasLoadDebug, setTemasLoadDebug] = useState<string | null>(null);
  const [selectedParcial, setSelectedParcial] = useState<(typeof PARCIALES)[number]['key']>('primer');

  const fetchTemas = useCallback(async () => {
    setLoading(true);
    setTemasLoadError(null);
    setTemasLoadDebug(null);

    let lastError: SupabaseQueryError | null = null;
    let fallbackErrorDetails: string | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { data, error } = await supabase.from('temas').select('*').order('sort_order', { ascending: true });
      if (!error) {
        setTemas(data ?? []);
        setLoading(false);
        return;
      }

      lastError = error as SupabaseQueryError;
      const shouldRetry = attempt < 2 && isLikelyTransientNetworkError(lastError);
      if (!shouldRetry) {
        break;
      }

      await wait(450 * attempt);
    }

    if (lastError && isLikelyTransientNetworkError(lastError)) {
      const fallbackResult = await fetchTemasViaRestFallback();
      if (!fallbackResult.error) {
        setTemas(fallbackResult.data ?? []);
        setLoading(false);
        return;
      }
      fallbackErrorDetails = describeSupabaseError(fallbackResult.error);
    }

    const technicalDetails = describeSupabaseError(lastError);
    const runtimeContext = getClientRuntimeContext();
    const contextDetails = formatClientRuntimeContext(runtimeContext);
    const fallbackDetails = fallbackErrorDetails ? ` || fallback: ${fallbackErrorDetails}` : '';
    const combinedDetails = `${technicalDetails}${fallbackDetails} || contexto: ${contextDetails}`;

    console.error('Error fetching temas:', {
      error: lastError,
      technicalDetails,
      runtimeContext,
    });
    setTemas([]);
    setTemasLoadError(buildTemasLoadError(lastError));
    setTemasLoadDebug(combinedDetails);
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const blocks = await getRenderableBlocks('subtemas_page', 0);
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching content blocks:', error);
      }
    };

    void fetchTemas();
    void fetchBlocks();
  }, [fetchTemas]);

  return (
    <div className="atlas-temario-typography" style={styles.container}>
      <Header />

      <main style={styles.main}>
        {contentBlocks.length > 0 && (
          <section className="public-editor-content public-editor-content-before-system" style={styles.auxContentCard}>
            <ContentBlockRenderer blocks={contentBlocks} />
          </section>
        )}

        <section className="temario-main-block" style={styles.temarioCard}>
          <div style={styles.panelTexture} />

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p className="atlas-typo-body" style={styles.loadingText}>Cargando temario...</p>
            </div>
          ) : temasLoadError ? (
            <div style={styles.errorState}>
              <span style={styles.errorIcon}>⚠️</span>
              <p className="atlas-typo-section-title" style={styles.errorTitle}>No se pudo cargar el temario</p>
              <p className="atlas-typo-body" style={styles.errorMessage}>{temasLoadError}</p>
              {temasLoadDebug && (
                <p className="atlas-typo-body" style={styles.errorDetails}>Detalle tecnico: {temasLoadDebug}</p>
              )}
              <button
                type="button"
                style={styles.retryButton}
                onClick={() => {
                  void fetchTemas();
                }}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div style={styles.temarioSectionsContainer}>
              <nav className="temario-partial-nav" style={styles.partialNav} aria-label="Seleccionar parcial">
                {PARCIALES.map(({ key, label, num }) => {
                  const count = temas.filter((tema) => tema.parcial === key).length;
                  const isActive = selectedParcial === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`temario-partial-tab${isActive ? ' is-active' : ''}`}
                      style={styles.partialTab}
                      aria-pressed={isActive}
                      onClick={() => setSelectedParcial(key)}
                    >
                      <span style={styles.partialTabNumber}>{num}</span>
                      <span style={styles.partialTabCopy}><strong>{label}</strong><small>{count} {count === 1 ? 'tema' : 'temas'}</small></span>
                    </button>
                  );
                })}
              </nav>

              {PARCIALES.filter(({ key }) => key === selectedParcial).map(({ key, label, num }) => {
                const temasParcial = temas.filter((tema) => tema.parcial === key);
                return (
                  <div className="temario-main-section temario-section-enter" key={key} style={styles.temarioSection}>
                    <div style={styles.parcialHeaderRow}>
                      <span style={styles.parcialIconWrap}>{num}</span>
                      <div style={styles.parcialHeadingCopy}>
                        <span style={styles.parcialEyebrow}><GraduationCap size={14} /> Ruta de aprendizaje</span>
                        <h3 className="temario-partial-title atlas-typo-section-title" style={styles.parcialTitle}>{label}</h3>
                      </div>
                      <span style={styles.parcialCount}>{temasParcial.length} {temasParcial.length === 1 ? 'tema' : 'temas'}</span>
                    </div>

                    {temasParcial.length > 0 ? (
                      <div className="temario-grid-public" style={styles.temasGrid}>
                        {temasParcial.map((tema) => (
                          <TemaCard
                            key={tema.id}
                            tema={tema}
                            onClick={() => navigate(`/subtemas/${tema.id}`)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={styles.emptyState}>
                        <span style={styles.emptyIcon}>📋</span>
                        <p className="atlas-typo-body" style={styles.noTemasMessage}>Aun no hay temas asignados a este parcial.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'radial-gradient(circle at 8% 10%, rgba(186,230,253,.38), transparent 26%), linear-gradient(180deg, #f8fcff 0%, #eef6fc 55%, #f8fbfe 100%)',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    boxSizing: 'border-box',
  },
  main: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 0,
    padding: 'clamp(18px, 3vw, 34px) 14px 48px',
    boxSizing: 'border-box',
  },
  auxContentCard: {
    width: '100%',
    maxWidth: '1280px',
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    padding: 0,
    boxSizing: 'border-box',
  },
  temarioCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '1280px',
    background: 'transparent',
    borderRadius: 0,
    padding: 0,
    boxShadow: 'none',
    border: 'none',
    borderTop: 'none',
    marginTop: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  panelTexture: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
    pointerEvents: 'none',
  },
  sectionHeader: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: 'clamp(14px, 2vw, 20px)',
  },
  temarioHeading: {
    margin: 0,
    textAlign: 'center',
  },
  temarioSubtitle: {
    margin: '2px 0 0',
    textAlign: 'center',
  },
  temarioSectionsContainer: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(20px, 3vw, 32px)',
  },
  temarioSection: {
    width: '100%',
    borderRadius: '24px',
    padding: 'clamp(17px, 2.5vw, 26px)',
    background: 'rgba(255,255,255,.76)',
    border: '1px solid rgba(195,216,232,.88)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxSizing: 'border-box',
    boxShadow: '0 14px 36px rgba(23,65,101,.07)',
  },
  parcialHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
    paddingBottom: '15px',
    borderBottom: '1px solid #dce7ef',
  },
  parcialIconWrap: {
    width: '45px',
    height: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '15px',
    color: '#fff',
    fontWeight: 950,
    fontSize: '1.05rem',
    background: 'linear-gradient(145deg, #2386bb, #225d8f)',
    boxShadow: '0 8px 18px rgba(34,93,143,.2)',
  },
  parcialIconEmoji: {
    fontSize: '18px',
    lineHeight: 1,
    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  },
  parcialTitle: {
    margin: 0,
    color: '#123b66',
    fontSize: '1.1rem',
  },
  partialNav: {
    display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '11px',
    padding: '10px', borderRadius: '22px', border: '1px solid rgba(195,216,232,.9)',
    background: 'rgba(255,255,255,.72)', boxShadow: '0 10px 28px rgba(23,65,101,.06)',
  },
  partialTab: {
    display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, padding: '11px 13px', borderRadius: '15px',
    border: '1px solid transparent', background: 'transparent', color: '#315b82', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
  },
  partialTabNumber: {
    width: '36px', height: '36px', display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: '12px',
    background: '#e5f2fa', color: '#176a9d', fontWeight: 950,
  },
  partialTabCopy: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, fontSize: '.82rem' },
  parcialHeadingCopy: { minWidth: 0, flex: 1 },
  parcialEyebrow: {
    display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', color: '#64829b',
    fontSize: '.68rem', fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase',
  },
  parcialCount: {
    borderRadius: '999px', padding: '6px 10px', background: '#e6f3fb', color: '#176a9d',
    fontSize: '.74rem', fontWeight: 850, whiteSpace: 'nowrap',
  },
  temasGrid: {
    display: 'grid',
    width: '100%',
    gap: '14px 16px',
    alignItems: 'start',
  },
  topicFallback: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', color: '#315b82',
    fontSize: '.78rem', fontWeight: 800,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: 'clamp(20px, 4vw, 36px)',
    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
  },
  emptyIcon: {
    fontSize: '1.6em',
  },
  noTemasMessage: {
    fontStyle: 'italic',
    textAlign: 'center',
    margin: 0,
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '60px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #d8e8f7',
    borderTop: '4px solid #5a97d3',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontStyle: 'italic',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: 'clamp(24px, 4vw, 42px)',
    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
    borderRadius: '12px',
    border: '1px solid #fdba74',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '1.8em',
    lineHeight: 1,
  },
  errorTitle: {
    margin: 0,
    color: '#9a3412',
  },
  errorMessage: {
    margin: 0,
    color: '#7c2d12',
    maxWidth: '640px',
  },
  errorDetails: {
    margin: 0,
    color: '#7c2d12',
    opacity: 0.82,
    maxWidth: '700px',
    wordBreak: 'break-word',
    fontSize: '0.9rem',
  },
  retryButton: {
    border: '1px solid #fdba74',
    background: '#fff',
    color: '#9a3412',
    borderRadius: '8px',
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default TemarioPublico;



