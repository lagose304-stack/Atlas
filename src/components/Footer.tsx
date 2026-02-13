import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface FooterProps {
  onEdicionClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onEdicionClick }) => {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  const handleGoToEdicion = () => {
    if (isAuthenticated) {
      navigate('/edicion');
    } else {
      setShowLogin(true);
    }
  };

  const styles: { [key: string]: React.CSSProperties } = {
    footer: {
      backgroundColor: '#f8f9fa',
      color: '#2c3e50',
      padding: 'clamp(20px, 4vw, 30px) clamp(12px, 3vw, 20px) 15px',
      marginTop: 'clamp(20px, 5vw, 50px)',
      fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
      borderTop: '3px solid #3498db',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 'clamp(15px, 3vw, 30px)',
      marginBottom: '20px',
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      alignItems: 'center',
      textAlign: 'center',
      minWidth: '200px',
      maxWidth: '280px',
      flex: '1 1 200px',
    },
    title: {
      fontSize: '1.05em',
      fontWeight: 700,
      color: '#2c3e50',
      marginBottom: '6px',
      position: 'relative',
      paddingBottom: '8px',
    },
    titleUnderline: {
      position: 'absolute',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '40px',
      height: '2px',
      backgroundColor: '#3498db',
      borderRadius: '2px',
    },
    text: {
      fontSize: '0.85em',
      lineHeight: '1.5',
      color: '#5a6c7d',
    },
    link: {
      color: '#5a6c7d',
      textDecoration: 'none',
      transition: 'color 0.3s ease, transform 0.3s ease',
      fontSize: '0.85em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    },
    socialLinks: {
      display: 'flex',
      gap: '10px',
      marginTop: '4px',
    },
    socialIcon: {
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      background: '#e8ecf1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      fontSize: '1.1em',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #dce1e7',
    },
    divider: {
      height: '1px',
      background: 'linear-gradient(90deg, transparent, #dce1e7, transparent)',
      margin: '15px 0 10px',
    },
    copyright: {
      textAlign: 'center',
      fontSize: '0.8em',
      color: '#7f8c8d',
      paddingTop: '5px',
      paddingBottom: '10px',
      letterSpacing: '0.3px',
    },
    contactItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '0.85em',
      padding: '4px 0',
    },
    iconWrapper: {
      width: '30px',
      height: '30px',
      borderRadius: '6px',
      background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.95em',
      flexShrink: 0,
      color: '#ffffff',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      backgroundColor: '#e8f4fd',
      borderRadius: '15px',
      fontSize: '0.75em',
      marginTop: '4px',
      border: '1px solid #3498db',
      color: '#2980b9',
    },
    edicionBadgeButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      backgroundColor: '#e8f4fd',
      borderRadius: '15px',
      fontSize: '0.75em',
      marginTop: '4px',
      border: '1px solid #3498db',
      color: '#2980b9',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    } as React.CSSProperties,
  };

  return (
    <footer className="footer-wrapper" style={styles.footer}>
      <div className="footer-container" style={styles.container}>
        {/* Sección Acerca de */}
        <div className="footer-section" style={styles.section}>
          <h3 style={styles.title}>
            Acerca del Proyecto
            <div style={styles.titleUnderline}></div>
          </h3>
          <p style={styles.text}>
            blablablabla
          </p>
          <button
            onClick={handleGoToEdicion}
            style={styles.edicionBadgeButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3498db';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e8f4fd';
              e.currentTarget.style.color = '#2980b9';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span>📝</span>
            <span>Ir a Edición</span>
          </button>
        </div>

        {/* Sección Contacto */}
        <div className="footer-section" style={styles.section}>
          <h3 style={styles.title}>
            Contacto
            <div style={styles.titleUnderline}></div>
          </h3>
          <div style={styles.contactItem}>
            <div style={styles.iconWrapper}>✉</div>
            <a 
              href="mailto:ejemplo@gmail.com" 
              style={styles.link}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#3498db';
                e.currentTarget.style.transform = 'translateX(5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#5a6c7d';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              ejemplo@gmail.com
            </a>
          </div>
          <div style={styles.contactItem}>
            <div style={styles.iconWrapper}>📞</div>
            <span style={styles.text}>9999-9999</span>
          </div>
        </div>

        {/* Sección Redes Sociales */}
        <div className="footer-section" style={styles.section}>
          <h3 style={styles.title}>
            Síguenos
            <div style={styles.titleUnderline}></div>
          </h3>
          <p style={styles.text}>Mantente conectado con nosotros</p>
          <div style={styles.socialLinks}>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.socialIcon}
              title="Facebook"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3b5998 0%, #2d4373 100%)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 89, 152, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#e8ecf1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              📘
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.socialIcon}
              title="Instagram"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #C13584 0%, #E1306C 100%)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(225, 48, 108, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#e8ecf1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              📷
            </a>
          </div>
        </div>
      </div>

      <div style={styles.divider}></div>

      <div style={styles.copyright}>
        © {currentYear} Atlas de Histología - UNAH. Todos los derechos reservados.
      </div>
      
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
    </footer>
  );
};

export default Footer;
