import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Facebook, Instagram, Mail, PenSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import FloatingVisitorsIndicator from './FloatingVisitorsIndicator';
import footerTexture from '../assets/imagenes/fondo3.jpg';

interface FooterProps {
  onEdicionClick?: () => void;
}

const Footer: React.FC<FooterProps> = () => {
  const currentYear = new Date().getFullYear();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const contactEmail = 'laboratoriohistologiaoficial@gmail.com';
  const reportEmail = 'denunciashistolab@gmail.com';

  const handleContactEmailClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const mailtoUrl = `mailto:${contactEmail}`;
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}`;
    const isMobileOrTablet = /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent);

    if (isMobileOrTablet) {
      window.location.href = mailtoUrl;
      return;
    }

    const opened = window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = mailtoUrl;
    }
  };

  const handleReportEmailClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const mailtoUrl = `mailto:${reportEmail}`;
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(reportEmail)}`;
    const isMobileOrTablet = /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent);

    if (isMobileOrTablet) {
      window.location.href = mailtoUrl;
      return;
    }

    const opened = window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = mailtoUrl;
    }
  };

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

      <div style={s.backgroundOverlay} />

      <div style={s.inner} className="footer-inner">
        {/* Sección Acerca de */}
        <div style={s.section} className="footer-col footer-col-about footer-reveal footer-reveal-1">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Acerca del Proyecto</h3>
          </div>
          <div className="footer-about-body">
            <p style={s.text} className="footer-col-text footer-about-text">
              Este recurso digital didáctico está diseñado para facilitar el aprendizaje de la histología, desarrollado por el Laboratorio de Histología de la UNAH.
            </p>
            <div style={s.edicionRow} className="footer-about-actions">
              <button
                onClick={handleGoToEdicion}
                style={s.edicionBtn}
                className="footer-edicion-btn"
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, #e8f4ff 0%, #c4def7 100%)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.82), 0 7px 14px rgba(8, 32, 72, 0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(180deg, #f3f9ff 0%, #d2e6fa 100%)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.75), 0 4px 10px rgba(8, 32, 72, 0.28)';
                }}
              >
                <PenSquare size={15} strokeWidth={2.2} />
                <span>Ir a Edición</span>
              </button>
              <div className="footer-visits-wrap">
                <FloatingVisitorsIndicator />
              </div>
            </div>
          </div>
        </div>

        {/* Separador vertical */}
        <div style={s.vertDivider} className="footer-vert-div" />

        {/* Sección Contacto */}
        <div style={s.section} className="footer-col footer-col-contact footer-reveal footer-reveal-2">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Contacto</h3>
          </div>
          <div style={s.contactItem} className="footer-contact-item">
            <div style={s.iconWrap} className="footer-icon-wrap">
              <Mail size={18} strokeWidth={2.2} style={s.contactIcon} aria-hidden="true" />
            </div>
            <a
              href={`mailto:${contactEmail}`}
              title={contactEmail}
              style={s.link}
              className="footer-col-text"
              onClick={handleContactEmailClick}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#1f65b5';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#173f72';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {contactEmail}
            </a>
          </div>
          <div style={s.contactItem} className="footer-contact-item">
            <div style={s.iconWrapAlert} className="footer-icon-wrap footer-icon-wrap-alert">
              <AlertTriangle size={19} strokeWidth={2.2} style={{ color: '#ffffff' }} />
            </div>
            <a
              href={`mailto:${reportEmail}`}
              title={reportEmail}
              style={s.link}
              className="footer-col-text"
              onClick={handleReportEmailClick}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#1f65b5';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#173f72';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {reportEmail}
            </a>
          </div>
        </div>

        {/* Separador vertical */}
        <div style={s.vertDivider} className="footer-vert-div" />

        {/* Sección Redes Sociales */}
        <div style={{ ...s.section, ...s.sectionCentered }} className="footer-col footer-col-social footer-reveal footer-reveal-3">
          <div style={s.sectionTitleRow} className="footer-title-row">
            <div style={s.accentDot} className="footer-dot" />
            <h3 style={s.sectionTitle} className="footer-col-title">Síguenos</h3>
          </div>
          <p style={{ ...s.text, ...s.textCentered }} className="footer-col-text">Mantente conectado con nosotros</p>
          <div style={s.socialRowWrap}>
            <div style={s.socialRow} className="footer-social-row">
              <a
                href="https://www.facebook.com/LabHistologiaFCM/"
                target="_blank"
                rel="noopener noreferrer"
                style={s.socialIcon}
                title="Facebook"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(10, 30, 58, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 11px rgba(8, 26, 53, 0.38)';
                }}
              >
                <Facebook size={18} strokeWidth={2.15} style={s.socialLucide} aria-hidden="true" />
              </a>
              <div style={s.goldDivider} aria-hidden="true" />
              <a
                href="https://www.instagram.com/histolabunah/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                style={s.socialIcon}
                title="Instagram"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 18px rgba(10, 30, 58, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 11px rgba(8, 26, 53, 0.38)';
                }}
              >
                <Instagram size={18} strokeWidth={2.15} style={s.socialLucide} aria-hidden="true" />
              </a>
            </div>
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
    backgroundImage: `linear-gradient(135deg, rgba(12, 45, 106, 0.68) 0%, rgba(56, 112, 184, 0.48) 32%, rgba(220, 239, 255, 0.66) 62%, rgba(14, 54, 122, 0.6) 100%), url(${footerTexture})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundBlendMode: 'normal',
    color: '#0f2542',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    borderRadius: '0 0 18px 18px',
    overflow: 'hidden',
    paddingTop: 0,
    width: '100%',
    alignSelf: 'stretch',
    position: 'relative',
    boxSizing: 'border-box' as const,
    boxShadow: '0 12px 34px rgba(8, 33, 75, 0.24)',
    border: '1px solid rgba(206, 234, 255, 0.9)',
  },
  backgroundOverlay: {
    display: 'block',
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(circle at 18% 16%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 34%), radial-gradient(circle at 84% 80%, rgba(215, 237, 255, 0.22) 0%, rgba(215, 237, 255, 0) 32%)',
  },
  accentLine: {
    display: 'block',
    height: '2px',
    background: 'linear-gradient(90deg, rgba(158, 207, 255, 0) 0%, rgba(186, 225, 255, 0.95) 50%, rgba(158, 207, 255, 0) 100%)',
  },
  inner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: 'clamp(10px, 2.2vw, 16px) clamp(10px, 2.4vw, 18px) clamp(10px, 2.2vw, 16px)',
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 'clamp(8px, 1.4vw, 12px)',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    position: 'relative',
    zIndex: 1,
    boxSizing: 'border-box',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    alignItems: 'flex-start',
    flex: '1 1 0',
    minHeight: '138px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'linear-gradient(180deg, rgba(246, 251, 255, 0.88) 0%, rgba(228, 241, 253, 0.76) 100%)',
    border: '1px solid rgba(174, 216, 255, 0.82)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.58), 0 8px 20px rgba(9, 33, 74, 0.22)',
    backdropFilter: 'blur(4px)',
    textAlign: 'left',
    justifyContent: 'flex-start',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
  },
  sectionCentered: {
    alignItems: 'center',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '1px',
  },
  accentDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#1d4e93',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#113e79',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  text: {
    fontSize: '0.82rem',
    lineHeight: 1.38,
    color: '#214166',
    margin: 0,
    textAlign: 'left',
  },
  textCentered: {
    textAlign: 'center',
    width: '100%',
  },
  link: {
    fontSize: '0.82rem',
    color: '#173f72',
    textDecoration: 'none',
    transition: 'color 0.2s ease, transform 0.2s ease',
    display: 'block',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    textAlign: 'left',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    width: '100%',
  },
  iconWrap: {
    width: '31px',
    height: '31px',
    borderRadius: '8px',
    background: 'linear-gradient(145deg, #19437d, #0f2d55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95em',
    flexShrink: 0,
    color: '#fff',
    border: '1px solid rgba(171, 208, 245, 0.85)',
    boxShadow: '0 4px 10px rgba(10, 37, 76, 0.35)',
  },
  contactIcon: {
    color: '#ffffff',
  },
  edicionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '5px 11px',
    borderRadius: '20px',
    border: '1px solid #95bee8',
    background: 'linear-gradient(180deg, #f3f9ff 0%, #d2e6fa 100%)',
    color: '#143d72',
    fontSize: '0.75em',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    transition: 'all 0.2s ease',
    marginTop: '1px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 4px 10px rgba(8, 32, 72, 0.28)',
  } as React.CSSProperties,
  edicionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    marginTop: '4px',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
  },
  socialRowWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    marginTop: '4px',
  },
  socialRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '9px',
    background: 'linear-gradient(145deg, #19437d, #0f2d55)',
    border: '1px solid rgba(171, 208, 245, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 0.25s ease',
    textDecoration: 'none',
    boxShadow: '0 4px 11px rgba(8, 26, 53, 0.38)',
  } as React.CSSProperties,
  socialLucide: {
    color: '#f4faff',
  },
  goldDivider: {
    width: '2px',
    height: '24px',
    background: 'linear-gradient(180deg, transparent 0%, rgba(42, 110, 192, 0.78) 50%, transparent 100%)',
    margin: '0 8px',
  },
  iconWrapAlert: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '31px',
    height: '31px',
    borderRadius: '8px',
    background: 'linear-gradient(145deg, #c23333, #8c1f1f)',
    border: '1px solid rgba(255, 206, 206, 0.8)',
    boxShadow: '0 4px 11px rgba(88, 16, 16, 0.42)',
    color: '#ffffff',
    flexShrink: 0,
  },
  vertDivider: {
    display: 'none',
  },
  divider: {
    height: '2px',
    background: 'linear-gradient(90deg, rgba(183, 221, 255, 0.15) 0%, rgba(190, 226, 255, 0.9) 50%, rgba(183, 221, 255, 0.15) 100%)',
    margin: '0',
    borderTop: '1px solid rgba(232, 245, 255, 0.55)',
    borderBottom: 'none',
    boxShadow: 'none',
    position: 'relative',
    zIndex: 1,
  },
  copyright: {
    textAlign: 'center',
    fontSize: '0.74em',
    color: '#e7f3ff',
    letterSpacing: '0.2px',
    padding: '7px 14px',
    background: 'linear-gradient(180deg, rgba(8, 32, 72, 0.64) 0%, rgba(6, 25, 57, 0.78) 100%)',
    margin: 0,
    fontWeight: 500,
    textShadow: '0 1px 2px rgba(3, 10, 24, 0.45)',
    position: 'relative',
    zIndex: 1,
  },
};

export default Footer;
