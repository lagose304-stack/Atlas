import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';
import Footer from '../components/Footer';

const Home: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleGoToEdicion = () => {
    setSidebarOpen(false);
    if (isAuthenticated) {
      navigate('/edicion');
    } else {
      setShowLogin(true);
    }
  };

  return (
    <div style={styles.container}>
      {/* Botón hamburguesa */}
      {!sidebarOpen && (
        <button 
          style={styles.hamburger}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Abrir menú"
        >
          <div style={styles.hamburgerLine}></div>
          <div style={styles.hamburgerLine}></div>
          <div style={styles.hamburgerLine}></div>
        </button>
      )}

      {/* Overlay cuando la barra lateral está abierta */}
      {sidebarOpen && (
        <div 
          style={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Barra lateral */}
      <div style={{
        ...styles.sidebar,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
      }}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>Menú</h3>
          <button 
            style={styles.closeButton}
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav style={styles.nav}>
          <button 
            style={styles.navButton}
            onClick={handleGoToEdicion}
          >
            📝 Ir a Edición
          </button>
        </nav>
      </div>

      {/* Contenido principal */}
      <main style={styles.main}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Bienvenido a Atlas</h1>
          <p style={styles.subtitle}>
            Tu plataforma de gestión de contenido educativo
          </p>
          <div style={styles.features}>
            <div style={styles.featureCard}>
              <span style={styles.icon}>📚</span>
              <h3 style={styles.featureTitle}>Temario</h3>
              <p style={styles.featureText}>Organiza y gestiona tus temas educativos</p>
            </div>
            <div style={styles.featureCard}>
              <span style={styles.icon}>🖼️</span>
              <h3 style={styles.featureTitle}>Placas</h3>
              <p style={styles.featureText}>Administra recursos visuales y multimedia</p>
            </div>
            <div style={styles.featureCard}>
              <span style={styles.icon}>✏️</span>
              <h3 style={styles.featureTitle}>Edición</h3>
              <p style={styles.featureText}>Accede al panel de edición completo</p>
            </div>
          </div>
        </div>
      </main>

      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
      
      <Footer />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    position: 'relative',
  },
  hamburger: {
    position: 'fixed',
    top: '20px',
    left: '20px',
    zIndex: 1001,
    backgroundColor: '#3498db',
    border: 'none',
    borderRadius: '8px',
    width: '50px',
    height: '50px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '5px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'background-color 0.3s ease',
  },
  hamburgerLine: {
    width: '25px',
    height: '3px',
    backgroundColor: 'white',
    borderRadius: '2px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '280px',
    height: '100vh',
    backgroundColor: '#2c3e50',
    zIndex: 1000,
    transition: 'transform 0.3s ease',
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  sidebarTitle: {
    color: 'white',
    margin: 0,
    fontSize: '1.5rem',
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '5px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.3s ease',
  },
  nav: {
    padding: '20px',
  },
  navButton: {
    width: '100%',
    padding: '15px 20px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
    textAlign: 'left',
  },
  main: {
    paddingTop: '80px',
    paddingBottom: '40px',
  },
  hero: {
    textAlign: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 700,
    color: '#2c3e50',
    marginBottom: '20px',
  },
  subtitle: {
    fontSize: '1.3rem',
    color: '#7f8c8d',
    marginBottom: '60px',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '30px',
    marginTop: '40px',
  },
  featureCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px 30px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '20px',
    display: 'block',
  },
  featureTitle: {
    fontSize: '1.5rem',
    color: '#2c3e50',
    marginBottom: '15px',
  },
  featureText: {
    color: '#7f8c8d',
    lineHeight: '1.6',
    margin: 0,
  },
};

export default Home;
