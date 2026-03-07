import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Footer from '../components/Footer';
import Header from '../components/Header';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

const PARCIALES: { key: 'primer' | 'segundo' | 'tercer'; label: string; color: string; accent: string }[] = [
  { key: 'primer',  label: 'Primer parcial',  color: '#e0f2fe', accent: 'linear-gradient(90deg, #38bdf8, #818cf8)' },
  { key: 'segundo', label: 'Segundo parcial', color: '#ede9fe', accent: 'linear-gradient(90deg, #818cf8, #c084fc)' },
  { key: 'tercer',  label: 'Tercer parcial',  color: '#dcfce7', accent: 'linear-gradient(90deg, #34d399, #38bdf8)' },
];

const TemaCard: React.FC<{ tema: Tema; onClick: () => void }> = ({ tema, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        borderRadius: '14px',
        padding: 'clamp(10px, 2vw, 18px)',
        background: hovered
          ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: hovered
          ? '0 16px 40px rgba(14,165,233,0.18), 0 4px 12px rgba(14,165,233,0.1)'
          : '0 2px 10px rgba(15,23,42,0.08)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease, border-color 0.25s ease',
        border: hovered ? '1.5px solid #38bdf8' : '1px solid #e0f2fe',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
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
          borderRadius: '12px',
          overflow: 'hidden',
          border: hovered ? '2px solid #7dd3fc' : '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: '8px',
          boxShadow: hovered ? '0 6px 16px rgba(56,189,248,0.2)' : '0 2px 8px rgba(15,23,42,0.07)',
          transition: 'border 0.25s ease, box-shadow 0.25s ease',
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

  useEffect(() => {
    const fetchTemas = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('temas').select('*').order('sort_order', { ascending: true }).order('nombre', { ascending: true });
      if (data) setTemas(data);
      if (error) console.error('Error fetching temas:', error);
      setLoading(false);
    };
    fetchTemas();
  }, []);

  return (
    <div style={styles.container}>
      <Header />

      <main style={styles.main}>
        <section style={styles.temarioCard}>

          {/* Encabezado de la sección */}
          <div style={styles.sectionHeader}>
            <h2 style={styles.temarioHeading}>Temario</h2>
            <p style={styles.temarioSubtitle}>Selecciona un tema para explorar sus subtemas</p>
            <div style={styles.headingDivider} />
          </div>

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Cargando temario...</p>
            </div>
          ) : (
            <div style={styles.temarioSectionsContainer}>
              {PARCIALES.map(({ key, label, color, accent }) => {
                const temasParcial = temas.filter(t => t.parcial === key);
                return (
                  <div key={key} style={styles.temarioSection}>
                    {/* Badge de parcial */}
                    <div style={styles.parcialBadgeRow}>
                      <div style={{ ...styles.parcialAccentBar, background: accent }} />
                      <span style={{ ...styles.parcialBadge, background: color }}>
                        {label}
                      </span>
                      <span style={styles.parcialCount}>
                        {temasParcial.length} {temasParcial.length === 1 ? 'tema' : 'temas'}
                      </span>
                    </div>

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
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
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
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: 'clamp(12px, 2vw, 24px)',
    padding: 'clamp(16px, 3vw, 40px)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.12), 0 6px 16px rgba(15,23,42,0.06)',
    border: '1px solid rgba(15,23,42,0.05)',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
    borderRadius: 'clamp(10px, 1.5vw, 18px)',
    padding: 'clamp(12px, 2.5vw, 24px)',
    boxShadow: '0 4px 16px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(10px, 2vw, 18px)',
    boxSizing: 'border-box',
  },
  parcialBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  parcialAccentBar: {
    width: '4px',
    height: '22px',
    borderRadius: '4px',
    flexShrink: 0,
  },
  parcialBadge: {
    display: 'inline-block',
    padding: '5px 16px',
    borderRadius: '50px',
    fontSize: 'clamp(0.78em, 1.6vw, 0.92em)',
    fontWeight: 700,
    color: '#1e293b',
    letterSpacing: '0.2px',
  },
  parcialCount: {
    fontSize: '0.82em',
    color: '#94a3b8',
    fontWeight: 500,
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
