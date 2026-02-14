import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import LoginForm from '../components/LoginForm';
import Footer from '../components/Footer';
import Header from '../components/Header';

// --- Interfaces ---
interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

const Home: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [temas, setTemas] = useState<Tema[]>([]);
  const [hoveredTema, setHoveredTema] = useState<number | null>(null);

  useEffect(() => {
    const fetchTemas = async () => {
      const { data, error } = await supabase.from('temas').select('*').order('nombre', { ascending: true });
      if (data) setTemas(data);
      if (error) console.error('Error fetching temas:', error);
    };
    fetchTemas();
  }, []);

  return (
    <div style={styles.container}>
      <Header />
      
      <main style={styles.main}>
        <section style={styles.maintenanceCard}>
          <div style={styles.badge}>Mantenimiento en curso</div>
          <h1 style={styles.heading}>Estamos afinando detalles</h1>
          <p style={styles.copy}>
            El home está en mantenimiento programado mientras mejoramos la experiencia.
            Por favor, vuelve más tarde.
          </p>
          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            <span style={styles.statusText}>Estado: mantenimiento activo</span>
          </div>
        </section>

        <section style={styles.maintenanceCard}>
          <div style={styles.badge}>Mantenimiento en curso</div>
          <h1 style={styles.heading}>Estamos afinando detalles</h1>
          <p style={styles.copy}>
            El home está en mantenimiento programado mientras mejoramos la experiencia.
            Por favor, vuelve más tarde.
          </p>
          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            <span style={styles.statusText}>Estado: mantenimiento activo</span>
          </div>
        </section>

        <section style={styles.temarioCard}>
          <h2 style={styles.temarioHeading}>Temario</h2>
          <div style={styles.temarioSectionsContainer}>
            <div style={styles.temarioSection}>
              <h3 style={styles.temarioSectionHeading}>Primer parcial</h3>
              {(() => {
                const temasParcial = temas.filter(t => t.parcial === 'primer');
                return temasParcial.length > 0 ? (
                  <div style={styles.temasGrid}>
                    {temasParcial.map(tema => (
                      <div
                        key={tema.id}
                        style={{ ...styles.temaCard, ...(hoveredTema === tema.id ? styles.temaCardHover : {}) }}
                        onClick={() => {}}
                        onMouseEnter={() => setHoveredTema(tema.id)}
                        onMouseLeave={() => setHoveredTema(null)}
                      >
                        <h4 style={styles.temaTitle}>{tema.nombre}</h4>
                        <img src={tema.logo_url} alt={tema.nombre} style={styles.temaLogo} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.noTemasMessage}>Aún no hay temas asignados a este parcial.</p>
                );
              })()}
            </div>
            <div style={styles.temarioSection}>
              <h3 style={styles.temarioSectionHeading}>Segundo parcial</h3>
              {(() => {
                const temasParcial = temas.filter(t => t.parcial === 'segundo');
                return temasParcial.length > 0 ? (
                  <div style={styles.temasGrid}>
                    {temasParcial.map(tema => (
                      <div
                        key={tema.id}
                        style={{ ...styles.temaCard, ...(hoveredTema === tema.id ? styles.temaCardHover : {}) }}
                        onClick={() => {}}
                        onMouseEnter={() => setHoveredTema(tema.id)}
                        onMouseLeave={() => setHoveredTema(null)}
                      >
                        <h4 style={styles.temaTitle}>{tema.nombre}</h4>
                        <img src={tema.logo_url} alt={tema.nombre} style={styles.temaLogo} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.noTemasMessage}>Aún no hay temas asignados a este parcial.</p>
                );
              })()}
            </div>
            <div style={styles.temarioSection}>
              <h3 style={styles.temarioSectionHeading}>Tercer parcial</h3>
              {(() => {
                const temasParcial = temas.filter(t => t.parcial === 'tercer');
                return temasParcial.length > 0 ? (
                  <div style={styles.temasGrid}>
                    {temasParcial.map(tema => (
                      <div
                        key={tema.id}
                        style={{ ...styles.temaCard, ...(hoveredTema === tema.id ? styles.temaCardHover : {}) }}
                        onClick={() => {}}
                        onMouseEnter={() => setHoveredTema(tema.id)}
                        onMouseLeave={() => setHoveredTema(null)}
                      >
                        <h4 style={styles.temaTitle}>{tema.nombre}</h4>
                        <img src={tema.logo_url} alt={tema.nombre} style={styles.temaLogo} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.noTemasMessage}>Aún no hay temas asignados a este parcial.</p>
                );
              })()}
            </div>
          </div>
        </section>
      </main>
      
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
      
      <Footer />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  temarioCard: {
    width: '100%',
    maxWidth: '1000px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    color: '#0f172a',
    borderRadius: '24px',
    padding: '56px',
    boxShadow: '0 25px 60px rgba(15, 23, 42, 0.15), 0 10px 20px rgba(15, 23, 42, 0.08)',
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '140px',
    border: '1px solid rgba(15, 23, 42, 0.05)',
  },
  temarioHeading: {
    fontSize: '2.2em',
    fontWeight: 800,
    marginBottom: '20px',
    color: '#0f172a',
    letterSpacing: '-0.02em',
    textAlign: 'center',
  },
  temarioSectionsContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    marginTop: '20px',
  },
  temarioSection: {
    width: '100%',
    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(15,23,42,0.1), 0 4px 16px rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    border: '1px solid rgba(15, 23, 42, 0.03)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  temarioSectionHeading: {
    fontSize: '1.5em',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '16px',
    letterSpacing: '-0.01em',
  },
  temasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  temaCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    border: '1px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '160px',
  },
  temaCardHover: {
     transform: 'translateY(-6px)',
     boxShadow: '0 12px 32px rgba(14,165,233,0.15)',
     borderColor: '#38bdf8',
     border: '1.5px solid #38bdf8', // Borde azul claro, sin negro
  },
  temaLogo: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '10px',
    maxHeight: '110px',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
    border: '1px solid #e0f2fe',
    background: '#f8fafc',
  },
  temaTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '10px',
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  temaLogo: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '10px',
    maxHeight: '110px',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  temaTitle: {
    fontSize: '1.18em',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '10px',
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
    textShadow: '0 1px 2px rgba(14,165,233,0.08)',
  },
  temaLogo: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '12px',
    maxHeight: '110px',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(14,165,233,0.10)',
    border: '1px solid #e0f2fe',
    background: '#f8fafc',
  },
  temaTitle: {
    fontSize: '1.1em',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '12px',
    lineHeight: 1.3,
  },
  temaLogo: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    maxHeight: '120px',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  noTemasMessage: {
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: '1.1em',
    textAlign: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    borderRadius: '12px',
    border: '1px solid rgba(100, 116, 139, 0.2)',
  },
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    position: 'relative',
    color: '#0f172a',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  main: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '32px',
    padding: '80px 32px 112px',
  },
  maintenanceCard: {
    width: '100%',
    maxWidth: '1000px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    color: '#0f172a',
    borderRadius: '24px',
    padding: '56px',
    boxShadow: '0 25px 60px rgba(15, 23, 42, 0.15), 0 10px 20px rgba(15, 23, 42, 0.08)',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(15, 23, 42, 0.05)',
    transition: 'transform 0.3s ease',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    color: '#075985',
    borderRadius: '50px',
    fontSize: '15px',
    letterSpacing: '0.4px',
    border: '1px solid #7dd3fc',
    fontWeight: 600,
  },
  heading: {
    fontSize: '40px',
    margin: '28px 0 16px',
    fontWeight: 800,
    letterSpacing: '-0.6px',
    lineHeight: 1.2,
  },
  copy: {
    fontSize: '20px',
    lineHeight: 1.6,
    color: '#334155',
    maxWidth: '720px',
    marginBottom: '40px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#475569',
    fontSize: '16px',
  },
  statusDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, #22c55e 0%, #16a34a 70%)',
    boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)',
    display: 'inline-block',
  },
  statusText: {
    fontWeight: 600,
    letterSpacing: '0.1px',
  },
};

export default Home;
