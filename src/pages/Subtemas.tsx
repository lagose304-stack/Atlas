import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../components/PageContentEditor';
import { getRenderableBlocks } from '../services/contentPublication';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { logTemaView } from '../services/analytics';

interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

interface Subtema {
  id: number;
  nombre: string;
  descripcion: string;
  tema_id: number;
  logo_url?: string;
}

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!temaId) return;

      void logTemaView(Number(temaId));

      const { data: temaData, error: temaError } = await supabase
        .from('temas')
        .select('*')
        .eq('id', temaId)
        .single();

      if (temaData) setTema(temaData);
      if (temaError) console.error('Error fetching tema:', temaError);

      const { data: subtemasData, error: subtemasError } = await supabase
        .from('subtemas')
        .select('*')
        .eq('tema_id', temaId)
        .order('sort_order', { ascending: true });

      if (subtemasData) setSubtemas(subtemasData);
      if (subtemasError) console.error('Error fetching subtemas:', subtemasError);

      // Cargar bloques de contenido editorial
      try {
        const blocks = await getRenderableBlocks('subtemas_page', Number(temaId));
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching content blocks:', error);
      }

      setLoading(false);
    };
    fetchData();
  }, [temaId]);

  useEffect(() => {
    setTemaLogoFailed(false);
    setTemaLogoSrc(tema?.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'thumb') : '');
  }, [tema?.logo_url]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

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
                  <div
                    key={subtema.id}
                    style={{
                      ...styles.subtemaCard,
                      ...(hoveredSubtema === subtema.id ? styles.subtemaCardHover : {}),
                      cursor: 'pointer',
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
                          alt={subtema.nombre}
                          style={styles.subtemaLogo}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.fallbackTried !== '1') {
                              img.dataset.fallbackTried = '1';
                              img.src = subtema.logo_url as string;
                              return;
                            }
                            setFailedSubtemaLogos((prev) => ({ ...prev, [subtema.id]: true }));
                          }}
                        />
                      </div>
                    ) : (
                      <div className="subtema-card-img-wrap" style={styles.subtemaIconFallback}>
                        <span style={styles.subtemaIconText}>📄</span>
                      </div>
                    )}
                    <h3 className="subtema-card-label atlas-typo-card" style={styles.subtemaTitle}>{subtema.nombre}</h3>
                    {subtema.descripcion && (
                      <p className="atlas-typo-body" style={styles.subtemaDesc}>{subtema.descripcion}</p>
                    )}
                  </div>
                ))}
              </div>
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
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
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
    background: 'transparent',
    borderRadius: '18px',
    padding: '0',
    boxShadow: 'none',
    border: 'none',
    boxSizing: 'border-box',
  },
  temaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(12px, 3vw, 28px)',
    flexWrap: 'wrap',
  },
  temaLogoWrap: {
    flexShrink: 0,
    width: 'clamp(70px, 12vw, 120px)',
    height: 'clamp(70px, 12vw, 120px)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(15,23,42,0.12)',
    border: '2px solid #e0f2fe',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  temaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
  },
  subtemasGrid: {
    display: 'grid',
    width: '100%',
    gap: 'clamp(8px, 2vw, 18px)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px, 22vw, 220px), 1fr))',
    boxSizing: 'border-box',
  },
  subtemaCard: {
    borderRadius: 'clamp(10px, 1.6vw, 16px)',
    padding: 'clamp(10px, 2vw, 18px)',
    background: 'linear-gradient(150deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.9) 100%)',
    boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
    border: '1px solid rgba(186,230,253,0.8)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  subtemaCardHover: {
    transform: 'translateY(-8px)',
    boxShadow: '0 18px 34px rgba(14,165,233,0.22)',
    border: '1px solid #38bdf8',
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
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
  },
  subtemaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  subtemaIconFallback: {
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    border: '1px solid #7dd3fc',
  },
  subtemaIconText: {
    fontSize: 'clamp(1.5em, 3vw, 2.2em)',
  },
  subtemaTitle: {
    lineHeight: 1.3,
    margin: 0,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    width: '100%',
  },
  subtemaDesc: {
    lineHeight: 1.5,
    margin: 0,
  },
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
};

export default Subtemas;




