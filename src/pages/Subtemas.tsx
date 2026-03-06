import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!temaId) return;

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
        .order('nombre', { ascending: true });

      if (subtemasData) setSubtemas(subtemasData);
      if (subtemasError) console.error('Error fetching subtemas:', subtemasError);

      setLoading(false);
    };
    fetchData();
  }, [temaId]);

  return (
    <div style={styles.container}>
      <Header />

      <main style={styles.main}>
        {/* Botón volver */}
        <button
          style={styles.backButton}
          onClick={() => navigate('/')}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(-3px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(0)';
          }}
        >
          ← Volver al inicio
        </button>

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Cargando subtemas...</p>
          </div>
        ) : (
          <section style={styles.card}>
            {/* Encabezado del tema */}
            <div style={styles.temaHeader}>
              {tema?.logo_url && (
                <div style={styles.temaLogoWrap}>
                  <img src={tema.logo_url} alt={tema.nombre} style={styles.temaLogo} />
                </div>
              )}
              <div style={styles.temaInfo}>
                <span style={styles.parciallBadge}>
                  {tema?.parcial ? `${tema.parcial.charAt(0).toUpperCase() + tema.parcial.slice(1)} parcial` : ''}
                </span>
                <h1 style={styles.temaTitle}>{tema?.nombre ?? 'Tema'}</h1>
              </div>
            </div>

            {/* Separador */}
            <div style={styles.divider} />

            {/* Grilla de subtemas */}
            <h2 style={styles.subtemasHeading}>Subtemas</h2>
            {subtemas.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyText}>Aún no hay subtemas registrados para este tema.</p>
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
                    {subtema.logo_url ? (
                      <div className="subtema-card-img-wrap" style={styles.subtemaLogoWrap}>
                        <img src={subtema.logo_url} alt={subtema.nombre} style={styles.subtemaLogo} />
                      </div>
                    ) : (
                      <div className="subtema-card-img-wrap" style={styles.subtemaIconFallback}>
                        <span style={styles.subtemaIconText}>📄</span>
                      </div>
                    )}
                    <h3 className="subtema-card-label" style={styles.subtemaTitle}>{subtema.nombre}</h3>
                    {subtema.descripcion && (
                      <p style={styles.subtemaDesc}>{subtema.descripcion}</p>
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
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 'clamp(8px, 2vw, 24px)',
    boxSizing: 'border-box',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#0f172a',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(12px, 3vw, 28px)',
    padding: 'clamp(16px, 4vw, 48px) clamp(8px, 3vw, 32px) clamp(32px, 8vw, 80px)',
    width: '100%',
    maxWidth: '1200px',
    boxSizing: 'border-box',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: '10px 20px',
    borderRadius: '50px',
    border: '1.5px solid rgba(255,255,255,0.5)',
    background: 'rgba(255,255,255,0.15)',
    color: '#1e40af',
    fontWeight: 600,
    fontSize: '0.95em',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    transition: 'background 0.2s ease, transform 0.2s ease',
    boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
  },
  card: {
    width: '100%',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: 'clamp(10px, 2vw, 20px)',
    padding: 'clamp(16px, 4vw, 40px)',
    boxShadow: '0 18px 40px rgba(15,23,42,0.13), 0 6px 14px rgba(15,23,42,0.07)',
    border: '1px solid rgba(15,23,42,0.05)',
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
    fontSize: 'clamp(1.4em, 4vw, 2.4em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)',
    margin: 'clamp(16px, 3vw, 28px) 0',
  },
  subtemasHeading: {
    fontSize: 'clamp(1em, 3vw, 1.5em)',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 'clamp(12px, 3vw, 24px)',
    letterSpacing: '-0.01em',
  },
  subtemasGrid: {
    display: 'grid',
    width: '100%',
    gap: 'clamp(8px, 2vw, 18px)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px, 22vw, 220px), 1fr))',
    boxSizing: 'border-box',
  },
  subtemaCard: {
    borderRadius: 'clamp(8px, 1.5vw, 14px)',
    padding: 'clamp(10px, 2vw, 18px)',
    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
    boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
    border: '1px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  subtemaCardHover: {
    transform: 'translateY(-6px)',
    boxShadow: '0 12px 32px rgba(14,165,233,0.18)',
    borderColor: '#38bdf8',
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
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.3,
    margin: 0,
  },
  subtemaDesc: {
    fontSize: '0.8em',
    color: '#64748b',
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
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: '1.05em',
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
    color: '#64748b',
    fontSize: '1em',
    fontWeight: 500,
  },
};

export default Subtemas;
