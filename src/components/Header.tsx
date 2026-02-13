import React from 'react';

// Importar logos
import logoFacultad from '../assets/logos/facultad.png';
import logoLaboratorio from '../assets/logos/laboratorio.png';

const Header: React.FC = () => {
  return (
    <section className="header-section" style={styles.headerSection}>
      {/* Elementos decorativos de fondo */}
      <div style={styles.decorativeWave2}></div>
      <div style={styles.decorativeWave1}></div>
      <div style={styles.decorativeCircle1}></div>
      <div style={styles.decorativeCircle2}></div>
      <div className="decorative-circle-3" style={styles.decorativeCircle3}></div>
      <div style={styles.decorativeCircle4}></div>
      <div className="decorative-circle-5" style={styles.decorativeCircle5}></div>
      <div className="decorative-circle-6" style={styles.decorativeCircle6}></div>
      <div className="decorative-circle-7" style={styles.decorativeCircle7}></div>
      <div className="decorative-circle-8" style={styles.decorativeCircle8}></div>
      <div className="medical-hexagon" style={styles.medicalHexagon}></div>
      <div className="medical-hexagon-2" style={styles.medicalHexagon2}></div>
      
      <div className="header-container" style={styles.headerContainer}>
        {/* Logo Laboratorio - Lado Izquierdo */}
        <div 
          className="header-logo"
          style={styles.logoContainer}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15), 0 10px 20px rgba(52, 152, 219, 0.25)';
            e.currentTarget.style.backgroundColor = 'rgba(52, 152, 219, 0.05)';
            (e.currentTarget.querySelector('img') as HTMLImageElement).style.transform = 'scale(1.1) rotate(3deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.1), 0 6px 12px rgba(52, 152, 219, 0.15)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            (e.currentTarget.querySelector('img') as HTMLImageElement).style.transform = 'scale(1) rotate(0deg)';
          }}
        >
          <img 
            src={logoLaboratorio} 
            alt="Logo Laboratorio" 
            style={styles.logo}
          />
        </div>

        {/* Contenido Central */}
        <div className="header-content" style={styles.headerContent}>
          <h1 style={styles.title}>Atlas de Histología</h1>
          <p style={styles.subtitle}>
            Laboratorio de Histología - Dr. Rafael Perdomo Vaquero
          </p>
          <p style={styles.subtitle2}>
            Facultad de Ciencias Médicas - UNAH
          </p>
        </div>

        {/* Logo Facultad - Lado Derecho */}
        <div 
          className="header-logo"
          style={styles.logoContainer}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15), 0 10px 20px rgba(52, 152, 219, 0.25)';
            e.currentTarget.style.backgroundColor = 'rgba(52, 152, 219, 0.05)';
            (e.currentTarget.querySelector('img') as HTMLImageElement).style.transform = 'scale(1.1) rotate(-3deg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.1), 0 6px 12px rgba(52, 152, 219, 0.15)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            (e.currentTarget.querySelector('img') as HTMLImageElement).style.transform = 'scale(1) rotate(0deg)';
          }}
        >
          <img 
            src={logoFacultad} 
            alt="Logo Facultad" 
            style={styles.logo}
          />
        </div>
      </div>
    </section>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  headerSection: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f1f3f4 30%, #e8ecef 70%, #dde4e8 100%)',
    padding: 'clamp(30px, 5vw, 60px) clamp(15px, 4vw, 20px)',
    borderBottom: '3px solid transparent',
    borderImage: 'linear-gradient(90deg, #3498db, #2980b9) 1',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 16px rgba(52, 152, 219, 0.12)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 'clamp(200px, 25vw, 300px)',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: '-50px',
    left: '-50px',
    width: 'clamp(120px, 18vw, 200px)',
    height: 'clamp(120px, 18vw, 200px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 152, 219, 0.25) 0%, rgba(52, 152, 219, 0.08) 70%)',
    zIndex: 1,
  },
  decorativeCircle2: {
    position: 'absolute',
    top: '-100px',
    right: '-80px',
    width: 'clamp(180px, 25vw, 300px)',
    height: 'clamp(180px, 25vw, 300px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(41, 128, 185, 0.18) 0%, rgba(41, 128, 185, 0.05) 70%)',
    zIndex: 1,
  },
  decorativeCircle3: {
    position: 'absolute',
    bottom: '-80px',
    left: '30%',
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 152, 219, 0.15) 0%, rgba(52, 152, 219, 0.03) 70%)',
    zIndex: 1,
  },
  decorativeCircle5: {
    position: 'absolute',
    top: '20%',
    left: '8%',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 152, 219, 0.15) 0%, rgba(52, 152, 219, 0.04) 60%, transparent 80%)',
    zIndex: 1,
  },
  decorativeCircle6: {
    position: 'absolute',
    bottom: '20%',
    right: '5%',
    width: 'clamp(70px, 10vw, 120px)',
    height: 'clamp(70px, 10vw, 120px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(41, 128, 185, 0.12) 0%, rgba(41, 128, 185, 0.03) 70%)',
    zIndex: 1,
  },
  decorativeCircle7: {
    position: 'absolute',
    top: '15%',
    left: '5%',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52, 152, 219, 0.12) 0%, rgba(52, 152, 219, 0.04) 60%, transparent 80%)',
    zIndex: 1,
  },
  decorativeCircle8: {
    position: 'absolute',
    bottom: '15%',
    right: '3%',
    width: 'clamp(100px, 15vw, 180px)',
    height: 'clamp(100px, 15vw, 180px)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(41, 128, 185, 0.10) 0%, rgba(41, 128, 185, 0.02) 70%, transparent 90%)',
    zIndex: 1,
  },
  medicalHexagon: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    width: '60px',
    height: '60px',
    background: 'rgba(52, 152, 219, 0.12)',
    clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
    zIndex: 1,
  },
  medicalHexagon2: {
    position: 'absolute',
    top: '70%',
    right: '25%',
    width: '40px',
    height: '40px',
    background: 'rgba(41, 128, 185, 0.10)',
    clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
    zIndex: 1,
    transform: 'rotate(30deg)',
  },
  decorativeWave1: {
    position: 'absolute',
    bottom: '0px',
    left: '0px',
    width: '100%',
    height: 'clamp(25px, 5vw, 40px)',
    background: 'linear-gradient(90deg, rgba(52, 152, 219, 0.15) 0%, rgba(41, 128, 185, 0.10) 50%, rgba(52, 152, 219, 0.15) 100%)',
    clipPath: 'polygon(0 20px, 100% 0px, 100% 100%, 0 100%)',
    zIndex: 1,
  },
  decorativeWave2: {
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '100%',
    height: 'clamp(18px, 4vw, 30px)',
    background: 'linear-gradient(90deg, rgba(41, 128, 185, 0.12) 0%, rgba(52, 152, 219, 0.08) 50%, rgba(41, 128, 185, 0.12) 100%)',
    clipPath: 'polygon(0 0px, 100% 10px, 100% 100%, 0 80%)',
    zIndex: 1,
  },
  headerContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'clamp(10px, 2vw, 15px)',
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'clamp(120px, 15vw, 180px)',
    height: 'clamp(120px, 15vw, 180px)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(15px)',
    borderRadius: '50%',
    boxShadow: '0 12px 28px rgba(0,0,0,0.1), 0 6px 12px rgba(52, 152, 219, 0.15)',
    border: '2px solid rgba(52, 152, 219, 0.1)',
    transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  logo: {
    height: 'clamp(80px, 12vw, 140px)',
    width: 'clamp(80px, 12vw, 140px)',
    objectFit: 'contain',
    transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
  },
  headerContent: {
    flex: 1,
    textAlign: 'center',
    padding: 'clamp(10px, 3vw, 20px) clamp(5px, 2vw, 10px)',
    position: 'relative',
    zIndex: 3,
    minWidth: '200px',
  },
  title: {
    fontSize: 'clamp(1.8rem, 4vw + 0.5rem, 4rem)',
    fontWeight: 900,
    background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 30%, #2c3e50 70%, #34495e 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    backgroundSize: '200% 200%',
    animation: 'gradientShift 6s ease-in-out infinite',
    marginBottom: 'clamp(10px, 2vw, 24px)',
    margin: 0,
    letterSpacing: 'clamp(-0.02em, -0.01vw, -0.03em)',
    lineHeight: 1.2,
    paddingBottom: 'clamp(4px, 1vw, 8px)',
    textShadow: '0 4px 8px rgba(44, 62, 80, 0.2)',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    wordBreak: 'keep-all',
    hyphens: 'none',
  },
  subtitle: {
    fontSize: 'clamp(0.9rem, 2vw + 0.2rem, 1.4rem)',
    color: '#2c3e50',
    lineHeight: '1.4',
    margin: 'clamp(8px, 1.5vw, 16px) 0',
    fontWeight: 700,
    letterSpacing: 'clamp(0.2px, 0.1vw, 0.5px)',
    textShadow: '0 2px 4px rgba(0,0,0,0.08)',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
  },
  subtitle2: {
    fontSize: 'clamp(0.85rem, 1.8vw + 0.1rem, 1.2rem)',
    color: '#34495e',
    lineHeight: '1.4',
    margin: 'clamp(6px, 1.2vw, 12px) 0',
    fontWeight: 600,
    letterSpacing: 'clamp(0.1px, 0.05vw, 0.3px)',
    textShadow: '0 1px 3px rgba(0,0,0,0.06)',
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
  },
};

export default Header;