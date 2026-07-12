import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../types/contentBlocks';
import { getRenderableBlocks } from '../services/contentPublication';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { logTemaView } from '../services/analytics';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { ArrowLeft, ArrowRight, Layers3, Microscope } from 'lucide-react';

interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
  sort_order?: number | null;
}

interface Subtema {
  id: number;
  nombre: string;
  descripcion: string;
  tema_id: number;
  logo_url?: string;
}

const normalizeParcial = (parcial: string | null | undefined): string => {
  const normalized = (parcial ?? '').toString().trim().toLowerCase();
  if (normalized.startsWith('prim')) return 'primer';
  if (normalized.startsWith('seg')) return 'segundo';
  if (normalized.startsWith('ter')) return 'tercer';
  return normalized;
};

const Subtemas: React.FC = () => {
  const { temaId } = useParams<{ temaId: string }>();
  const navigate = useNavigate();
  const [tema, setTema] = useState<Tema | null>(null);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSubtema, setHoveredSubtema] = useState<number | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [temaLogoFailed, setTemaLogoFailed] = useState(false);
  const [temaLogoSrc, setTemaLogoSrc] = useState('');
  const [failedSubtemaLogos, setFailedSubtemaLogos] = useState<Record<number, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allTemas, setAllTemas] = useState<Tema[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (!temaId) {
      setTema(null);
      setSubtemas([]);
      setLoadError('No se recibio un tema valido para mostrar.');
      setLoading(false);
      return;
    }

    void logTemaView(Number(temaId));

    let nextError: string | null = null;

    const { data: temaData, error: temaError } = await supabase
      .from('temas')
      .select('*')
      .eq('id', temaId)
      .single();

    if (temaData) {
      setTema(temaData);
    } else {
      setTema(null);
    }

    if (temaError) {
      console.error('Error fetching tema:', temaError);
      nextError = 'No se pudo cargar la informacion del tema en este momento.';
    } else if (!temaData) {
      nextError = 'El tema solicitado no existe o ya no esta disponible.';
    }

    const { data: subtemasData, error: subtemasError } = await supabase
      .from('subtemas')
      .select('*')
      .eq('tema_id', temaId)
      .order('sort_order', { ascending: true });

    if (subtemasError) {
      console.error('Error fetching subtemas:', subtemasError);
      setSubtemas([]);
      nextError = nextError
        ? `${nextError} Tampoco fue posible cargar el listado de subtemas.`
        : 'No se pudo cargar el listado de subtemas en este momento.';
    } else {
      setSubtemas(subtemasData ?? []);
    }

    const { data: temasData, error: temasError } = await supabase
      .from('temas')
      .select('id, nombre, parcial, sort_order')
      .order('sort_order', { ascending: true });

    if (temasError) {
      console.error('Error fetching temas for navigation:', temasError);
      setAllTemas([]);
      nextError = nextError
        ? `${nextError} No fue posible preparar la navegacion entre temas.`
        : 'No se pudo preparar la navegacion entre temas en este momento.';
    } else {
      setAllTemas((temasData ?? []) as Tema[]);
    }

    // Cargar bloques de contenido editorial
    try {
      const blocks = await getRenderableBlocks('subtemas_page', Number(temaId));
      setContentBlocks(blocks as ContentBlock[]);
    } catch (error) {
      console.error('Error fetching content blocks:', error);
    }

    setLoadError(nextError);
    setLoading(false);
  }, [temaId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setTemaLogoFailed(false);
    setTemaLogoSrc(tema?.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'thumb') : '');
  }, [tema?.logo_url]);

  const orderedTemas = useMemo(() => {
    return [...allTemas].sort((a, b) => {
      const aSort = typeof a.sort_order === 'number' ? a.sort_order : Number.POSITIVE_INFINITY;
      const bSort = typeof b.sort_order === 'number' ? b.sort_order : Number.POSITIVE_INFINITY;
      if (aSort !== bSort) return aSort - bSort;

      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
  }, [allTemas]);

  const currentTemaId = Number(temaId ?? 0);

  const currentTemaParcial = useMemo(() => {
    const fromSelectedTema = orderedTemas.find((item) => item.id === currentTemaId)?.parcial;
    return normalizeParcial(tema?.parcial ?? fromSelectedTema ?? '');
  }, [orderedTemas, currentTemaId, tema?.parcial]);

  const temasDelParcial = useMemo(() => {
    return orderedTemas.filter((item) => normalizeParcial(item.parcial) === currentTemaParcial);
  }, [orderedTemas, currentTemaParcial]);

  const currentTemaParcialIndex = useMemo(() => {
    return temasDelParcial.findIndex((item) => item.id === currentTemaId);
  }, [temasDelParcial, currentTemaId]);

  const temaAnterior = currentTemaParcialIndex > 0 ? temasDelParcial[currentTemaParcialIndex - 1] : null;
  const temaSiguiente =
    currentTemaParcialIndex >= 0 && currentTemaParcialIndex < temasDelParcial.length - 1
      ? temasDelParcial[currentTemaParcialIndex + 1]
      : null;

  const navAnterior = useMemo(() => {
    if (temaAnterior) {
      return {
        targetId: temaAnterior.id,
        label: `← Tema anterior: ${temaAnterior.nombre}`,
      };
    }

    return null;
  }, [temaAnterior]);

  const navSiguiente = useMemo(() => {
    if (temaSiguiente) {
      return {
        targetId: temaSiguiente.id,
        label: `Siguiente tema: ${temaSiguiente.nombre} →`,
      };
    }

    return null;
  }, [temaSiguiente]);

  const handleGoBack = useSmartBackNavigation('/');

  return (
    <div className="atlas-temario-typography" style={styles.container}>
      <Header />

      <main style={styles.main}>
        <BackButton onClick={handleGoBack} />

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p className="atlas-typo-body" style={styles.loadingText}>Cargando subtemas...</p>
          </div>
        ) : loadError ? (
          <section style={styles.card}>
            <div style={styles.errorState}>
              <span style={styles.errorIcon}>⚠️</span>
              <p className="atlas-typo-section-title" style={styles.errorTitle}>No se pudo cargar el contenido</p>
              <p className="atlas-typo-body" style={styles.errorText}>{loadError}</p>
              <button
                type="button"
                style={styles.retryButton}
                onClick={() => {
                  void fetchData();
                }}
              >
                Reintentar
              </button>
            </div>
          </section>
        ) : (
          <section style={styles.card}>
            {/* Encabezado del tema */}
            <div style={styles.temaHeader}>
              {tema?.logo_url && !temaLogoFailed && (
                <div style={styles.temaLogoWrap}>
                  <img
                    src={temaLogoSrc}
                    alt={tema.nombre}
                    style={styles.temaLogo}
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      if (tema?.logo_url && temaLogoSrc !== tema.logo_url) {
                        setTemaLogoSrc(tema.logo_url);
                        return;
                      }
                      setTemaLogoFailed(true);
                    }}
                  />
                </div>
              )}
              <div style={styles.temaInfo}>
                <span style={styles.parciallBadge}>
                  {tema?.parcial ? `${tema.parcial.charAt(0).toUpperCase() + tema.parcial.slice(1)} parcial` : ''}
                </span>
                <h1 className="atlas-typo-title" style={styles.temaTitle}>{tema?.nombre ?? 'Tema'}</h1>
              </div>
            </div>

            {/* Separador */}
            <div style={styles.divider} />

            {/* Bloques de contenido editorial */}
            {contentBlocks.length > 0 && (
              <ContentBlockRenderer blocks={contentBlocks} />
            )}

            {/* Grilla de subtemas */}
            <h2 className="atlas-typo-section-title" style={styles.subtemasHeading}>Subtemas</h2>
            {subtemas.length === 0 ? (
              <div style={styles.emptyState}>
                <p className="atlas-typo-body" style={styles.emptyText}>Aún no hay subtemas registrados para este tema.</p>
              </div>
            ) : (
              <div className="subtemas-grid-page">
                {subtemas.map(subtema => (
                  <button
                    type="button"
                    className="subtema-public-card"
                    key={subtema.id}
                    style={{
                      ...styles.subtemaCard,
                      ...(hoveredSubtema === subtema.id ? styles.subtemaCardHover : {}),
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={() => setHoveredSubtema(subtema.id)}
                    onMouseLeave={() => setHoveredSubtema(null)}
                    onClick={() => navigate(`/ver-placas/${subtema.id}`)}
                  >
                    <div style={styles.subtemaAccent} />
                    {subtema.logo_url && !failedSubtemaLogos[subtema.id] ? (
                      <div className="subtema-card-img-wrap" style={styles.subtemaLogoWrap}>
                        <img
                          src={getCloudinaryImageUrl(subtema.logo_url, 'thumb')}
                          srcSet={`${getCloudinaryImageUrl(subtema.logo_url, 'thumbSmall')} 320w, ${getCloudinaryImageUrl(subtema.logo_url, 'thumb')} 560w`}
                          sizes="(max-width: 640px) 70px, (max-width: 900px) 86px, (max-width: 1200px) 100px, 115px"
                          alt={subtema.nombre}
                          style={styles.subtemaLogo}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.fallbackTried !== '1') {
                              img.dataset.fallbackTried = '1';
                              img.srcset = '';
                              img.sizes = '';
                              img.src = subtema.logo_url as string;
                              return;
                            }
                            setFailedSubtemaLogos((prev) => ({ ...prev, [subtema.id]: true }));
                          }}
                        />
                      </div>
                    ) : (
                      <div className="subtema-card-img-wrap" style={styles.subtemaIconFallback}>
                        <Microscope size={30} aria-hidden="true" />
                      </div>
                    )}
                    <div className="subtema-public-copy" style={styles.subtemaCopy}>
                      <span style={styles.subtemaEyebrow}><Layers3 size={13} /> Subtema</span>
                      <h3 className="subtema-card-label atlas-typo-card" style={styles.subtemaTitle}>{subtema.nombre}</h3>
                      {subtema.descripcion && (
                        <p className="atlas-typo-body" style={styles.subtemaDesc}>{subtema.descripcion}</p>
                      )}
                      <span style={styles.subtemaAction}>Ver placas <ArrowRight size={15} /></span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(navAnterior || navSiguiente) && (
              <section style={styles.navigationPanel}>
                <div style={styles.navigationButtonsWrap}>
                  {navAnterior && (
                    <button
                      type="button"
                      style={styles.navigationButton}
                      onClick={() => {
                        navigate(`/subtemas/${navAnterior.targetId}`);
                      }}
                    >
                      <ArrowLeft size={16} /> {navAnterior.label.replace('← ', '')}
                    </button>
                  )}

                  {navSiguiente && (
                    <button
                      type="button"
                      style={styles.navigationButton}
                      onClick={() => {
                        navigate(`/subtemas/${navSiguiente.targetId}`);
                      }}
                    >
                      {navSiguiente.label.replace(' →', '')} <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </section>
            )}
          </section>
        )}
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
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    background: 'radial-gradient(circle at 8% 10%, rgba(186,230,253,.4), transparent 27%), linear-gradient(180deg, #f8fcff 0%, #eef6fc 55%, #f8fbfe 100%)',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
    padding: 'clamp(18px, 3vw, 34px) 14px 48px',
    gap: '16px',
  },
  backButton: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#4b5563',
    borderRadius: '999px',
    padding: '8px 16px',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  card: {
    width: '100%',
    background: 'rgba(255,255,255,.74)',
    borderRadius: '26px',
    padding: 'clamp(18px, 3vw, 30px)',
    boxShadow: '0 18px 46px rgba(23,65,101,.08)',
    border: '1px solid rgba(195,216,232,.88)',
    boxSizing: 'border-box',
  },
  temaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(12px, 3vw, 28px)',
    flexWrap: 'wrap',
    padding: 'clamp(8px, 2vw, 16px)',
  },
  temaLogoWrap: {
    flexShrink: 0,
    width: 'clamp(70px, 12vw, 120px)',
    height: 'clamp(70px, 12vw, 120px)',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 12px 28px rgba(15,61,98,.16)',
    border: '3px solid rgba(255,255,255,.9)',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  temaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
  },
  temaInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  parciallBadge: {
    display: 'inline-block',
    padding: '5px 14px',
    borderRadius: '50px',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    color: '#075985',
    fontSize: '0.82em',
    fontWeight: 700,
    border: '1px solid #7dd3fc',
    letterSpacing: '0.4px',
    width: 'fit-content',
  },
  temaTitle: {
    margin: 0,
    color: '#123b66',
    fontSize: 'clamp(1.7rem, 4vw, 2.8rem)',
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)',
    margin: 'clamp(16px, 3vw, 28px) 0',
  },
  subtemasHeading: {
    marginBottom: 'clamp(12px, 3vw, 24px)',
    marginTop: 0,
    color: '#123b66',
  },
  subtemasGrid: {
    display: 'grid',
    width: '100%',
    gap: 'clamp(8px, 2vw, 18px)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px, 22vw, 220px), 1fr))',
    boxSizing: 'border-box',
  },
  subtemaCard: {
    borderRadius: '16px',
    padding: 0,
    background: '#fff',
    boxShadow: '0 8px 22px rgba(23,65,101,.08)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
    border: '1px solid rgba(186,230,253,0.8)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
  },
  subtemaCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 18px 36px rgba(23,65,101,.16)',
    border: '1px solid rgba(35,134,187,.55)',
  },
  subtemaAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '14px 14px 0 0',
  },
  subtemaLogoWrap: {
    borderRadius: 0,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  subtemaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
  },
  subtemaIconFallback: {
    borderRadius: 0,
    background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    border: '1px solid #7dd3fc',
  },
  subtemaCopy: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '5px', padding: '12px 14px', flex: 1 },
  subtemaEyebrow: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#2386bb', fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' },
  subtemaTitle: {
    lineHeight: 1.3,
    margin: 0,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    width: '100%',
    color: '#123b66',
  },
  subtemaDesc: {
    lineHeight: 1.5,
    margin: 0,
    color: '#64748b',
    fontSize: '.82rem',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  subtemaAction: { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#176a9d', fontSize: '.76rem', fontWeight: 900 },
  emptyState: {
    width: '100%',
    padding: 'clamp(20px, 5vw, 48px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
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
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontStyle: 'italic',
  },
  errorState: {
    width: '100%',
    padding: 'clamp(22px, 4vw, 42px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    borderRadius: '12px',
    border: '1px solid #fdba74',
    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
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
  errorText: {
    margin: 0,
    color: '#7c2d12',
    maxWidth: '680px',
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
  navigationPanel: {
    marginTop: 'clamp(18px, 4vw, 34px)',
    borderTop: '1px solid rgba(148, 163, 184, 0.28)',
    paddingTop: 'clamp(14px, 3vw, 20px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  navigationButtonsWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    width: '100%',
  },
  navigationButton: {
    border: '1px solid #cbd5e1',
    background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
    color: '#0f172a',
    borderRadius: '10px',
    padding: '10px 12px',
    fontWeight: 700,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
  },
};

export default Subtemas;




