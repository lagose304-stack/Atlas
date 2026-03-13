import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Footer from '../components/Footer';
import Header from '../components/Header';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../components/PageContentEditor';
import { getRenderableBlocks } from '../services/contentPublication';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

const PARCIALES: { key: 'primer' | 'segundo' | 'tercer'; label: string; num: string; color: string; accent: string; badgeBg: string }[] = [
  { key: 'primer',  label: 'Primer parcial',  num: 'I',   color: '#f0f9ff', accent: 'linear-gradient(90deg, #38bdf8, #818cf8)', badgeBg: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  { key: 'segundo', label: 'Segundo parcial', num: 'II',  color: '#faf5ff', accent: 'linear-gradient(90deg, #a78bfa, #c084fc)', badgeBg: 'linear-gradient(135deg, #8b5cf6, #d946ef)' },
  { key: 'tercer',  label: 'Tercer parcial',  num: 'III', color: '#f0fdf4', accent: 'linear-gradient(90deg, #34d399, #38bdf8)', badgeBg: 'linear-gradient(135deg, #10b981, #0ea5e9)' },
];

const TemaCard: React.FC<{ tema: Tema; onClick: () => void }> = ({ tema, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        borderRadius: '18px',
        padding: 'clamp(8px, 1.4vw, 14px)',
        background: hovered
          ? 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(224,242,254,0.9) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
        boxShadow: hovered
          ? '0 20px 40px rgba(14,165,233,0.2), 0 10px 24px rgba(37,99,235,0.16)'
          : '0 8px 20px rgba(15,23,42,0.08)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease, border-color 0.3s ease',
        border: hovered ? '1.5px solid #38bdf8' : '1px solid rgba(186,230,253,0.75)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Barra de acento superior */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
        borderRadius: '14px 14px 0 0',
      }} />

      {/* Imagen */}
      <div
        className="tema-card-img-wrap"
        style={{
          borderRadius: '14px',
          overflow: 'hidden',
          border: hovered ? '2px solid #7dd3fc' : '1px solid #dbeafe',
          background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hovered ? '0 8px 18px rgba(56,189,248,0.24)' : '0 3px 10px rgba(15,23,42,0.08)',
          transition: 'border 0.3s ease, box-shadow 0.3s ease',
        }}>
        {tema.logo_url
          ? <img src={tema.logo_url} alt={tema.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 'clamp(1.4em, 3vw, 2em)' }}>🔬</span>
        }
      </div>

      {/* Nombre */}
      <h4
        className="tema-card-label"
        style={{
          color: hovered ? '#0369a1' : '#0f172a',
          transition: 'color 0.2s ease',
        }}
      >
        {tema.nombre}
      </h4>

      {/* Flecha indicadora */}
      <span style={{
        fontSize: '0.75em',
        color: hovered ? '#38bdf8' : '#94a3b8',
        fontWeight: 600,
        transition: 'color 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateX(3px)' : 'translateX(0)',
        display: 'inline-block',
      }}>
        Ver subtemas →
      </span>
    </div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    const fetchTemas = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('temas').select('*').order('sort_order', { ascending: true });
      if (data) setTemas(data);
      if (error) console.error('Error fetching temas:', error);
      setLoading(false);
    };
    const fetchBlocks = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching content blocks:', error);
      }
    };
    fetchTemas();
    fetchBlocks();
  }, []);

  return (
    <div style={styles.container}>
      <Header />

      <main style={styles.main}>
        {contentBlocks.length > 0 && (
          <section style={styles.temarioCard}>
            <ContentBlockRenderer blocks={contentBlocks} />
          </section>
        )}

        <section style={styles.temarioCard}>

          {/* Encabezado de la sección */}
          <div style={styles.sectionHeader}>
            <h2 style={styles.temarioHeading}>Temario</h2>
            <p style={styles.temarioSubtitle}>Selecciona un tema para explorar sus subtemas y placas histológicas</p>
            <div style={styles.headingDivider} />
          </div>

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Cargando temario...</p>
            </div>
          ) : (
            <div style={styles.temarioSectionsContainer}>
              {PARCIALES.map(({ key, label, num, color, accent, badgeBg }) => {
                const temasParcial = temas.filter(t => t.parcial === key);
                return (
                  <div key={key} style={{ ...styles.temarioSection, background: color }}>
                    {/* Cabecera del parcial */}
                    <div style={styles.parcialHeaderRow}>
                      <span style={{ ...styles.parcialNumBadge, background: badgeBg }}>{num}</span>
                      <h3 style={styles.parcialTitle}>{label}</h3>
                      <span style={styles.parcialCountPill}>
                        {temasParcial.length} {temasParcial.length === 1 ? 'tema' : 'temas'}
                      </span>
                    </div>
                    <div style={{ height: '2px', background: accent, borderRadius: '2px' }} />

                    {temasParcial.length > 0 ? (
                      <div className="temas-grid-home">
                        {temasParcial.map(tema => (
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
                        <p style={styles.noTemasMessage}>Aún no hay temas asignados a este parcial.</p>
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
    background: 'radial-gradient(circle at 15% -5%, #bfdbfe 0%, transparent 40%), radial-gradient(circle at 90% 10%, #ddd6fe 0%, transparent 32%), linear-gradient(160deg, #f8fbff 0%, #eef4ff 48%, #f3f7ff 100%)',
    color: '#0f172a',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 'clamp(8px, 2vw, 24px)',
    boxSizing: 'border-box',
  },
  main: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 'clamp(12px, 3vw, 32px)',
    padding: 'clamp(20px, 5vw, 48px) clamp(8px, 3vw, 32px) clamp(32px, 8vw, 80px)',
    width: '100%',
    maxWidth: '1400px',
    boxSizing: 'border-box',
  },
  temarioCard: {
    width: '100%',
    maxWidth: '1200px',
    background: 'linear-gradient(155deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.85) 100%)',
    backdropFilter: 'blur(8px)',
    borderRadius: 'clamp(14px, 2vw, 24px)',
    padding: 'clamp(16px, 3vw, 40px)',
    boxShadow: '0 24px 45px rgba(15,23,42,0.11), 0 8px 20px rgba(30,64,175,0.08)',
    border: '1px solid rgba(186,230,253,0.7)',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    marginBottom: 'clamp(16px, 4vw, 36px)',
  },
  temarioHeading: {
    fontSize: 'clamp(1.5em, 4vw, 2.6em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px 0',
    textAlign: 'center',
  },
  temarioSubtitle: {
    fontSize: 'clamp(0.82em, 1.8vw, 1em)',
    color: '#64748b',
    margin: '0 0 16px 0',
    textAlign: 'center',
  },
  headingDivider: {
    width: '60px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },
  temarioSectionsContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(16px, 4vw, 32px)',
  },
  temarioSection: {
    width: '100%',
    borderRadius: 'clamp(10px, 1.5vw, 18px)',
    padding: 'clamp(12px, 2.5vw, 24px)',
    boxShadow: '0 10px 24px rgba(15,23,42,0.08), 0 2px 8px rgba(56,189,248,0.1)',
    border: '1px solid rgba(148,163,184,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(10px, 2vw, 18px)',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  parcialHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  parcialNumBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.9em',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
    letterSpacing: '0.02em',
  },
  parcialTitle: {
    fontSize: 'clamp(1em, 2.2vw, 1.2em)',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.01em',
    flex: 1,
  },
  parcialCountPill: {
    padding: '4px 12px',
    borderRadius: '50px',
    background: 'rgba(255,255,255,0.7)',
    fontSize: '0.8em',
    fontWeight: 600,
    color: '#475569',
    flexShrink: 0,
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
    fontSize: '1.8em',
  },
  noTemasMessage: {
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: '0.92em',
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

export default Home;
