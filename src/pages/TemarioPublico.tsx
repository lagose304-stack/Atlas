import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../components/PageContentEditor';
import { getRenderableBlocks } from '../services/contentPublication';

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

const TemaCard: React.FC<{ tema: Tema; onClick: () => void }> = ({ tema, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        borderRadius: '12px',
        background: '#ffffff',
        boxShadow: hovered
          ? '0 12px 22px rgba(23, 50, 82, 0.18)'
          : '0 6px 14px rgba(23, 50, 82, 0.1)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease',
        border: hovered ? '1px solid rgba(97, 143, 202, 0.56)' : '1px solid rgba(199, 215, 232, 0.92)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'center',
        width: '100%',
        minHeight: '134px',
        maxHeight: '134px',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        filter: hovered ? 'saturate(1.02)' : 'none',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: '94px',
          width: '100%',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(201, 217, 233, 0.92)',
          background: '#e8f1fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {tema.logo_url
          ? <img src={tema.logo_url} alt={tema.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '1.1em', color: '#1e3a5f' }}>Microscopio</span>
        }
      </div>

      <h4
        className="temario-card-title"
        style={{
          margin: '0',
          minHeight: '32px',
          maxHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 10px',
          background: 'linear-gradient(180deg, #f7fbff 0%, #f1f6fb 100%)',
          color: '#2a4564',
          fontSize: '0.86rem',
          lineHeight: 1,
          fontWeight: 600,
          letterSpacing: '0.003em',
          fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.1,
          }}
        >
          {tema.nombre}
        </span>
      </h4>
    </div>
  );
};

const TemarioPublico: React.FC = () => {
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
          <section style={styles.auxContentCard}>
            <ContentBlockRenderer blocks={contentBlocks} />
          </section>
        )}

        <section className="temario-main-block" style={styles.temarioCard}>
          <div style={styles.panelTexture} />

          <div className="temario-main-header" style={styles.sectionHeader}>
            <h2 className="temario-title-text" style={styles.temarioHeading}>TEMARIO</h2>
            <p className="temario-subtitle-text" style={styles.temarioSubtitle}>Selecciona un tema para explorar sus subtemas y placas histologicas</p>
          </div>

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Cargando temario...</p>
            </div>
          ) : (
            <div style={styles.temarioSectionsContainer}>
              {PARCIALES.map(({ key, label, num }) => {
                const temasParcial = temas.filter((tema) => tema.parcial === key);
                return (
                  <div className="temario-main-section" key={key} style={styles.temarioSection}>
                    <div style={styles.parcialHeaderRow}>
                      <span style={styles.parcialIconWrap}>
                        <span style={styles.parcialIconEmoji}>🔬</span>
                      </span>
                      <h3 className="temario-partial-title" style={styles.parcialTitle}>{label} {num}</h3>
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
                        <p style={styles.noTemasMessage}>Aun no hay temas asignados a este parcial.</p>
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
    background:
      'radial-gradient(circle at 10% 0%, rgba(191, 219, 254, 0.65) 0%, transparent 40%), linear-gradient(165deg, #f8fbff 0%, #eef4ff 50%, #f3f7ff 100%)',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    padding: 'clamp(8px, 2vw, 24px)',
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
    padding: 0,
    boxSizing: 'border-box',
  },
  auxContentCard: {
    width: '100%',
    maxWidth: '1280px',
    background: 'rgba(255, 255, 255, 0.76)',
    borderRadius: '20px',
    border: '1px solid rgba(214, 228, 240, 0.9)',
    boxShadow: '0 12px 26px rgba(18, 45, 74, 0.08)',
    padding: 'clamp(14px, 2vw, 22px)',
    boxSizing: 'border-box',
  },
  temarioCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '1600px',
    background: 'linear-gradient(180deg, rgba(241, 246, 251, 0.96) 0%, rgba(236, 242, 248, 0.94) 100%)',
    borderRadius: 0,
    padding: 'clamp(18px, 2.4vw, 30px)',
    boxShadow: '0 18px 34px rgba(8, 29, 58, 0.12)',
    border: '1px solid rgba(206, 221, 237, 0.92)',
    borderTop: 'none',
    marginTop: '-1px',
    marginBottom: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  panelTexture: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 15% 85%, rgba(175, 207, 235, 0.14) 0%, transparent 45%), radial-gradient(circle at 82% 26%, rgba(168, 198, 228, 0.18) 0%, transparent 38%), linear-gradient(115deg, rgba(255,255,255,0.24), rgba(255,255,255,0))',
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
    fontSize: 'clamp(1.2rem, 1.7vw, 1.45rem)',
    fontWeight: 800,
    color: '#1d3656',
    letterSpacing: '0.015em',
    margin: 0,
    textAlign: 'center',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  temarioSubtitle: {
    fontSize: 'clamp(0.78rem, 0.95vw, 0.88rem)',
    color: '#57708f',
    margin: '2px 0 0',
    textAlign: 'center',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  temarioSectionsContainer: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(18px, 2.4vw, 26px)',
  },
  temarioSection: {
    width: '100%',
    borderRadius: '18px',
    padding: 'clamp(8px, 1vw, 14px) clamp(4px, 1vw, 8px)',
    background: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
  },
  parcialHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingLeft: '2px',
  },
  parcialIconWrap: {
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcialIconEmoji: {
    fontSize: '18px',
    lineHeight: 1,
    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  },
  parcialTitle: {
    fontSize: 'clamp(0.95rem, 1.15vw, 1.06rem)',
    fontWeight: 700,
    color: '#173654',
    margin: 0,
    letterSpacing: '0.01em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  temasGrid: {
    display: 'grid',
    width: '100%',
    gap: '14px 16px',
    alignItems: 'start',
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
    color: '#536b88',
    fontStyle: 'italic',
    fontSize: '0.9em',
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
    color: '#4b6584',
    fontSize: '1em',
    fontWeight: 500,
  },
};

export default TemarioPublico;
