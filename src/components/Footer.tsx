import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface FooterProps {
  onEdicionClick?: () => void;
}

const Footer: React.FC<FooterProps> = () => {
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

  return (
    <footer style={s.footer}>
      {/* Línea de acento superior */}
      <div style={s.accentLine} />

      <div style={s.inner} className="footer-inner">
        {/* Sección Acerca de */}
        <div style={s.section} className="footer-col">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Acerca del Proyecto</h3>
          </div>
          <p style={s.text} className="footer-col-text">
            blablablabla
          </p>
          <button
            onClick={handleGoToEdicion}
            style={s.edicionBtn}
            className="footer-edicion-btn"
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #38bdf8, #818cf8)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(56,189,248,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#e0f2fe';
              e.currentTarget.style.color = '#0369a1';
              e.currentTarget.style.borderColor = '#bae6fd';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span>📝</span>
            <span>Ir a Edición</span>
          </button>
        </div>

        {/* Separador vertical */}
        <div style={s.vertDivider} className="footer-vert-div" />

        {/* Sección Contacto */}
        <div style={s.section} className="footer-col">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Contacto</h3>
          </div>
          <div style={s.contactItem} className="footer-contact-item">
            <div style={s.iconWrap} className="footer-icon-wrap">✉</div>
            <a
              href="mailto:ejemplo@gmail.com"
              style={s.link}
              className="footer-col-text"
              onMouseEnter={e => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              ejemplo@gmail.com
            </a>
          </div>
          <div style={s.contactItem} className="footer-contact-item">
            <div style={s.iconWrap} className="footer-icon-wrap">📞</div>
            <span style={s.text} className="footer-col-text">9999-9999</span>
          </div>
        </div>

        {/* Separador vertical */}
        <div style={s.vertDivider} className="footer-vert-div" />

        {/* Sección Redes Sociales */}
        <div style={s.section} className="footer-col">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Síguenos</h3>
          </div>
          <p style={s.text} className="footer-col-text">Mantente conectado con nosotros</p>
          <div style={s.socialRow} className="footer-social-row">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              style={s.socialIcon}
              title="Facebook"
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3b5998, #2d4373)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,89,152,0.5)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              📘
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              style={s.socialIcon}
              title="Instagram"
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #C13584, #E1306C)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(225,48,108,0.5)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              📷
            </a>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={s.divider} />

      {/* Copyright */}
      <p style={s.copyright} className="footer-copyright">
        © {currentYear} Atlas de Histología — UNAH. Todos los derechos reservados.
      </p>

      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
    </footer>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  footer: {
    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    color: '#475569',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    borderTop: '1px solid #e2e8f0',
    paddingTop: 0,
    width: '100%',
    alignSelf: 'stretch',
    boxSizing: 'border-box' as const,
  },
  accentLine: {
    height: '3px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8, #34d399)',
    width: '100%',
  },
  inner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: 'clamp(28px, 5vw, 52px) clamp(16px, 4vw, 40px) clamp(20px, 4vw, 36px)',
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 'clamp(24px, 4vw, 48px)',
    justifyContent: 'center',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'flex-start',
    flex: '1 1 180px',
    maxWidth: '280px',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '2px',
  },
  accentDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.82em',
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  text: {
    fontSize: '0.85em',
    lineHeight: 1.65,
    color: '#64748b',
    margin: 0,
  },
  link: {
    fontSize: '0.85em',
    color: '#64748b',
    textDecoration: 'none',
    transition: 'color 0.2s ease, transform 0.2s ease',
    display: 'inline-block',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconWrap: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.88em',
    flexShrink: 0,
    color: '#fff',
    boxShadow: '0 2px 8px rgba(14,165,233,0.25)',
  },
  edicionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 16px',
    borderRadius: '50px',
    border: '1.5px solid #bae6fd',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: '0.82em',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: 'all 0.2s ease',
    marginTop: '4px',
  } as React.CSSProperties,
  socialRow: {
    display: 'flex',
    gap: '10px',
  },
  socialIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: '#e2e8f0',
    border: '1px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1.1em',
    transition: 'all 0.25s ease',
    textDecoration: 'none',
  } as React.CSSProperties,
  vertDivider: {
    width: '1px',
    background: 'linear-gradient(180deg, transparent, #cbd5e1, transparent)',
    alignSelf: 'stretch',
    minHeight: '80px',
    flexShrink: 0,
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)',
    margin: '0 clamp(16px, 4vw, 40px)',
  },
  copyright: {
    textAlign: 'center',
    fontSize: '0.78em',
    color: '#94a3b8',
    letterSpacing: '0.3px',
    padding: 'clamp(12px, 2vw, 18px) 20px',
    margin: 0,
  },
};

export default Footer;
