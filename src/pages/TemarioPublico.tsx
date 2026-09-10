import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  describeSupabaseError,
  formatClientRuntimeContext,
  getClientRuntimeContext,
  isLikelyTransientNetworkError,
  type SupabaseQueryError,
} from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../types/contentBlocks';
import { getRenderableBlocks } from '../services/contentPublication';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { ArrowRight, Microscope, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isParcialDisabled,
  isTemaDisabled,
  type SiteMaintenanceStatus,
} from '../services/siteMaintenance';
import {
  getCachedTemas,
  getQuickTemas,
  prefetchCatalog,
  prefetchTema,
} from '../services/catalogService';
import { usePreservedParam } from '../hooks/usePreservedParam';

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

const TemaCard: React.FC<{
  tema: Tema;
  index: number;
  onClick: () => void;
  isDisabled?: boolean;
  isDeactivatedForPublic?: boolean;
}> = ({ tema, index, onClick, isDisabled, isDeactivatedForPublic }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    setLogoFailed(false);
    setFallbackUrl(null);
  }, [tema.logo_url]);

  return (
    <button
      type="button"
      className={`temario-real-slide ${isDisabled ? 'is-disabled' : ''}`}
      onClick={onClick}
      onMouseEnter={() => prefetchTema(tema.id)}
      onTouchStart={() => prefetchTema(tema.id)}
      disabled={isDisabled}
    >
      {/* Barra superior luminosa de acento cromático */}
      <div className="slide-top-accent-bar" aria-hidden="true" />

      {/* Reflejo dinámico del vidrio */}
      <div className="slide-sheen-sweep" aria-hidden="true" />

      {/* Tema desactivado para visitantes públicos, pero accesible con sesión iniciada */}
      {isDeactivatedForPublic && !isDisabled && (
        <div className="slide-session-access-badge" title="Tema desactivado para público. Acceso habilitado con sesión iniciada.">
          Desactivado
        </div>
      )}

      {/* Desactivado estricto para usuarios sin sesión iniciada */}
      {isDisabled && (
        <div className="slide-disabled-badge">
          Desactivado
        </div>
      )}

      {/* 1. RÓTULO ESMERILADO SUPERIOR */}
      <div className="real-slide-label-top">
        <div className="slide-label-frosted-texture" aria-hidden="true" />
        <div className="slide-label-header">
          <span className="slide-serial-badge">
            <span className="slide-pulse-dot" />
            {String(index + 1).padStart(2, '0')}
          </span>
          <h4 className="slide-label-title">
            {tema.nombre}
          </h4>
          <div className="slide-action-btn" aria-hidden="true">
            <ArrowRight size={15} />
          </div>
        </div>
      </div>

      {/* 2. CUERPO DE CRISTAL TRANSPARENTE CON MÁRGENES Y CUBREOBJETOS */}
      <div className="real-slide-glass-body">
        {/* Calibrador micrométrico óptico decorativo en el cristal */}
        <div className="slide-micrometer-ruler" aria-hidden="true">
          <span className="ruler-tick major" />
          <span className="ruler-tick" />
          <span className="ruler-tick" />
          <span className="ruler-tick major" />
          <span className="ruler-tick" />
          <span className="ruler-tick" />
          <span className="ruler-tick major" />
        </div>

        <div className="real-slide-coverslip">
          {/* Sujetadores mecánicos de platina en las 4 esquinas */}
          <span className="stage-clip clip-tl" aria-hidden="true" />
          <span className="stage-clip clip-tr" aria-hidden="true" />
          <span className="stage-clip clip-bl" aria-hidden="true" />
          <span className="stage-clip clip-br" aria-hidden="true" />

          {tema.logo_url && !logoFailed ? (
            <div className="slide-tissue-wrap">
              <img
                src={fallbackUrl || getCloudinaryImageUrl(tema.logo_url, 'thumb')}
                alt={tema.nombre}
                className="slide-tissue-img"
                loading="lazy"
                decoding="async"
                onError={() => {
                  if (!fallbackUrl && tema.logo_url) {
                    setFallbackUrl(tema.logo_url);
                  } else {
                    setLogoFailed(true);
                  }
                }}
              />
              <div className="slide-glass-glare" />
            </div>
          ) : (
            <div className="slide-fallback-wrap">
              <div className="slide-fallback-ambient" />
              <div className="slide-fallback-icon-ring">
                <Microscope size={34} />
              </div>
              <span className="slide-fallback-label">Histología</span>
            </div>
          )}

          {/* Enfoque óptico interactivo en hover */}
          <div className="slide-focus-overlay">
            <span className="focus-crosshair">⊕</span>
            <span>Enfocar</span>
          </div>
        </div>
      </div>
    </button>
  );
};

const TemarioPublico: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const canBypass = canBypassMaintenance(user, isAuthenticated);
  const initialTemas = getQuickTemas();
  const [temas, setTemas] = useState<Tema[]>((initialTemas as Tema[]) ?? []);
  const [maintenanceStatus, setMaintenanceStatus] = useState<SiteMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(!initialTemas || initialTemas.length === 0);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [temasLoadDebug, setTemasLoadDebug] = useState<string | null>(null);
  const [selectedParcial, setSelectedParcial] = usePreservedParam<(typeof PARCIALES)[number]['key']>('parcial', 'primer');

  const fetchTemas = useCallback(async () => {
    setTemasLoadError(null);
    setTemasLoadDebug(null);

    try {
      const data = await getCachedTemas();
      if (data && data.length > 0) {
        setTemas(data as Tema[]);
        setLoading(false);
        return;
      }
      throw new Error('No se recibieron temas del catálogo');
    } catch (lastError: any) {
      const fallbackResult = await fetchTemasViaRestFallback();
      if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
        setTemas(fallbackResult.data);
        setLoading(false);
        return;
      }

      const technicalDetails = describeSupabaseError(lastError);
      const runtimeContext = getClientRuntimeContext();
      const contextDetails = formatClientRuntimeContext(runtimeContext);
      const combinedDetails = `${technicalDetails} || contexto: ${contextDetails}`;

      console.error('Error fetching temas:', {
        error: lastError,
        technicalDetails,
        runtimeContext,
      });

      // Solo si no tenemos datos en memoria mostramos el estado de error
      setTemas((prev) => {
        if (prev.length === 0) {
          setTemasLoadError(buildTemasLoadError(lastError));
          setTemasLoadDebug(combinedDetails);
        }
        return prev;
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    prefetchCatalog();

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
    void fetchSiteMaintenanceStatus().then(setMaintenanceStatus);
  }, [fetchTemas]);

  return (
    <div className="atlas-temario-page atlas-temario-typography" style={styles.container}>
      <Header />

      <main className="atlas-temario-main" style={styles.main}>
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
            <div className="temario-unified-board">
              <nav className="temario-partial-nav-integrated" aria-label="Seleccionar parcial">
                {PARCIALES.map(({ key, label, num }) => {
                  const isActive = selectedParcial === key;
                  const isParcialOff = isParcialDisabled(key, maintenanceStatus?.disabledFeatures ?? []);
                  const temasParcial = temas.filter((tema) => tema.parcial === key);
                  const hasBypassAccess = Boolean(canBypass || isAuthenticated);
                  const visibleTemasCount = hasBypassAccess
                    ? temasParcial.length
                    : temasParcial.filter((t) => !isTemaDisabled(t.id, t.parcial, maintenanceStatus?.disabledFeatures ?? [])).length;

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`temario-integrated-tab ${isActive ? 'is-active' : ''}`}
                      style={{ opacity: isParcialOff && !isActive && !hasBypassAccess ? 0.7 : 1 }}
                      onClick={() => setSelectedParcial(key)}
                    >
                      {isActive && <span className="integrated-tab-indicator" aria-hidden="true" />}
                      <span className="integrated-tab-num">
                        {num}
                      </span>
                      <span className="integrated-tab-copy">
                        <strong className="integrated-tab-name">
                          {label}
                          {isParcialOff && (
                            <span className="temario-maint-tag">
                              (Mantenimiento)
                            </span>
                          )}
                        </strong>
                        <span className="integrated-tab-count">
                          {visibleTemasCount} {visibleTemasCount === 1 ? 'tema' : 'temas'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              {PARCIALES.filter(({ key }) => key === selectedParcial).map(({ key, label }) => {
                const isParcialOff = isParcialDisabled(key, maintenanceStatus?.disabledFeatures ?? []);
                const temasParcial = temas.filter((tema) => tema.parcial === key);
                const hasBypassAccess = Boolean(canBypass || isAuthenticated);
                const displayedTemas = hasBypassAccess
                  ? temasParcial
                  : temasParcial.filter((t) => !isTemaDisabled(t.id, t.parcial, maintenanceStatus?.disabledFeatures ?? []));

                return (
                  <div className="temario-main-section temario-section-enter" key={key}>
                    <h2
                      style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: 0,
                        margin: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    >
                      {label}
                    </h2>

                    {isParcialOff && hasBypassAccess && (
                      <div style={{ padding: '10px 16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <AlertTriangle size={18} color="#d97706" />
                        <span>Este parcial está desactivado para el público, pero tienes acceso con tu sesión.</span>
                      </div>
                    )}

                    {isParcialOff && !hasBypassAccess ? (
                      <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fff5f5', borderRadius: '16px', border: '1px solid #fecaca', margin: '14px 0' }}>
                        <AlertTriangle size={36} color="#dc2626" style={{ margin: '0 auto 10px' }} />
                        <h4 style={{ margin: '0 0 6px', color: '#991b1b', fontSize: '1.1rem', fontWeight: 700 }}>
                          Parcial en mantenimiento
                        </h4>
                        <p style={{ margin: 0, color: '#7f1d1d', fontSize: '0.92rem' }}>
                          El contenido de este parcial se encuentra temporalmente fuera de servicio por actualización.
                        </p>
                      </div>
                    ) : displayedTemas.length > 0 ? (
                      <div className="temario-grid-public">
                        {displayedTemas.map((tema, idx) => {
                          const isOff = isTemaDisabled(tema.id, tema.parcial, maintenanceStatus?.disabledFeatures ?? []);
                          const isCardDisabled = isOff && !hasBypassAccess;
                          return (
                            <TemaCard
                              key={tema.id}
                              tema={tema}
                              index={idx}
                              isDisabled={isCardDisabled}
                              isDeactivatedForPublic={isOff && hasBypassAccess}
                              onClick={() => {
                                if (isCardDisabled) return;
                                navigate(`/subtemas/${tema.id}`);
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div style={styles.emptyState}>
                        <span style={styles.emptyIcon}>📋</span>
                        <p className="atlas-typo-body" style={styles.noTemasMessage}>
                          {isParcialOff ? 'No hay temas activos disponibles en este parcial.' : 'Aún no hay temas asignados a este parcial.'}
                        </p>
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
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    boxSizing: 'border-box',
    width: '100%',
    padding: 'clamp(8px, 2vw, 24px)',
  },
  main: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    gap: 0,
    padding: 0,
    margin: '0 auto',
    background: '#ffffff',
    borderLeft: '1px solid rgba(186, 225, 249, 0.92)',
    borderRight: '1px solid rgba(186, 225, 249, 0.92)',
    borderTop: 'none',
    borderBottom: 'none',
    boxShadow: '0 16px 42px rgba(8, 33, 75, 0.16)',
    boxSizing: 'border-box',
    flex: 1,
  },
  auxContentCard: {
    width: '100%',
    maxWidth: '100%',
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
    maxWidth: '100%',
    background: '#ffffff',
    borderRadius: 0,
    padding: 0,
    boxShadow: 'none',
    border: 'none',
    margin: 0,
    boxSizing: 'border-box',
  },
  panelTexture: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
    pointerEvents: 'none',
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
  parcialHeadingCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
  },
  parcialEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#2875a6',
    fontSize: '.68rem',
    fontWeight: 850,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
  },
  parcialTitle: {
    margin: 0,
    color: '#123b66',
    fontSize: '1.1rem',
  },
  parcialCount: {
    borderRadius: '999px',
    padding: '6px 10px',
    background: '#e6f3fb',
    color: '#176a9d',
    fontSize: '.74rem',
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },
  partialNav: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '11px',
    padding: '10px',
    borderRadius: '22px',
    border: '1px solid rgba(195,216,232,.9)',
    background: 'rgba(255,255,255,.72)',
    boxShadow: '0 10px 28px rgba(23,65,101,.06)',
  },
  partialTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    minWidth: 0,
    padding: '11px 13px',
    borderRadius: '15px',
    border: '1px solid transparent',
    background: 'transparent',
    color: '#315b82',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  partialTabActive: {
    background: 'linear-gradient(135deg, #2284b8, #185586)',
    color: '#ffffff',
    borderColor: '#195584',
    boxShadow: '0 10px 24px rgba(24,85,134,.28)',
  },
  partialTabNumber: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    background: 'rgba(255,255,255,.24)',
    fontSize: '.86rem',
    fontWeight: 900,
    flexShrink: 0,
  },
  partialTabCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  temasGrid: {
    display: 'grid',
    width: '100%',
    gap: '14px 16px',
    alignItems: 'start',
  },
  topicFallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
    color: '#315b82',
    fontSize: '.78rem',
    fontWeight: 800,
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
