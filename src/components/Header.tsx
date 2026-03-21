import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, House, Phone, Search } from 'lucide-react';

import logoFacultad from '../assets/logos/facultad.png';
import microscopioHeader from '../assets/logos/laboratorio.png';
import fondoHeader from '../assets/imagenes/fondo.webp';

const MENU_ITEMS = [
  { key: 'inicio', label: 'Inicio', icon: House, path: '/' },
  { key: 'temario', label: 'Temario', icon: BookOpen, path: '/temario' },
  { key: 'aprendizaje', label: 'Aprendizaje', icon: GraduationCap },
  { key: 'contacto', label: 'Contacto', icon: Phone },
] as const;

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const headerRef = React.useRef<HTMLElement | null>(null);
  const [isLeftLogoHover, setIsLeftLogoHover] = React.useState(false);
  const [isRightLogoHover, setIsRightLogoHover] = React.useState(false);
  const [showCompactBar, setShowCompactBar] = React.useState(false);

  const isInAdminEditingFlow = React.useMemo(() => {
    const adminPaths = [
      '/edicion',
      '/temario-admin',
      '/placas',
      '/editar-home',
      '/editar-inicio',
      '/editar-temario',
      '/editar-subtemas',
      '/editar-placas',
      '/eliminar-placas',
      '/mover-placa',
      '/lista-espera',
      '/gestion-usuarios',
      '/estadisticas',
      '/pruebas',
    ];

    return adminPaths.some((basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`));
  }, [pathname]);

  const navigateFromHeader = React.useCallback((targetPath: string) => {
    if (isInAdminEditingFlow) {
      window.location.replace(targetPath);
      return;
    }

    navigate(targetPath);
  }, [isInAdminEditingFlow, navigate]);

  React.useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) {
        setShowCompactBar(false);
        return;
      }

      const rect = headerRef.current.getBoundingClientRect();
      setShowCompactBar(rect.bottom <= 0);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <>
      <header ref={headerRef} className="atlas-header-wrapper" style={styles.wrapper}>
        <section
          className="atlas-header-hero"
          style={{
            ...styles.hero,
            backgroundImage: `linear-gradient(100deg, rgba(6, 33, 86, 0.82) 0%, rgba(36, 77, 145, 0.46) 22%, rgba(213, 237, 255, 0.62) 45%, rgba(170, 214, 249, 0.52) 67%, rgba(20, 58, 128, 0.32) 100%), url(${fondoHeader})`,
          }}
        >
          <div className="atlas-header-glass" style={styles.heroGlass} />
          <div className="atlas-header-readable-overlay" style={styles.heroReadableOverlay} />
          <div className="atlas-header-right-side-panel" style={styles.rightSidePanel} />

          <div className="atlas-header-main-row" style={styles.heroMainRow}>
            <div className="atlas-header-left-area" style={styles.leftArea}>
              <button
                type="button"
                onClick={() => navigateFromHeader('/')}
                className="atlas-header-logo-action-button"
                style={styles.logoActionButton}
                onMouseEnter={() => setIsLeftLogoHover(true)}
                onMouseLeave={() => setIsLeftLogoHover(false)}
                aria-label="Ir a inicio"
              >
                <div className="atlas-header-left-logo-aura" style={{ ...styles.leftLogoAura, ...(isLeftLogoHover ? styles.leftLogoAuraHover : {}) }}>
                  <img className="atlas-header-microscope-image" src={microscopioHeader} alt="Microscopio" style={styles.microscopeImage} />
                </div>
              </button>
            </div>

            <div className="atlas-header-center-area" style={styles.centerArea}>
              <h1 className="atlas-header-title" style={styles.title}>Atlas de Histología</h1>
              <p className="atlas-header-subtitle" style={styles.subtitle}>Laboratorio de Histología - Dr. Rafael Perdomo Vaquero</p>
              <div className="atlas-header-separator" style={styles.separator} />
              <p className="atlas-header-subtitle2" style={styles.subtitle2}>Facultad de Ciencias Médicas - UNAH</p>
            </div>

            <div className="atlas-header-right-area" style={styles.rightArea}>
              <button
                type="button"
                onClick={() => navigateFromHeader('/')}
                className="atlas-header-logo-action-button"
                style={styles.logoActionButton}
                onMouseEnter={() => setIsRightLogoHover(true)}
                onMouseLeave={() => setIsRightLogoHover(false)}
                aria-label="Ir a inicio"
              >
                <div className="atlas-header-right-logo-aura" style={{ ...styles.rightLogoAura, ...(isRightLogoHover ? styles.rightLogoAuraHover : {}) }}>
                  <img className="atlas-header-university-logo" src={logoFacultad} alt="Logo Facultad" style={styles.universityLogo} />
                </div>
              </button>

              <button
                type="button"
                className="atlas-header-search-button"
                style={styles.searchButton}
                onClick={(event) => event.preventDefault()}
                aria-label="Buscar"
              >
                <Search size={24} color="#e6f5ff" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </section>

        <nav className="atlas-header-bottom-nav" style={styles.bottomNav} aria-label="Menú principal">
          <ul className="atlas-header-nav-list" style={styles.navList}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li className="atlas-header-nav-item" key={item.key} style={styles.navItem}>
                  <button
                    type="button"
                    className="atlas-header-nav-button"
                    style={styles.navButton}
                    onClick={() => {
                      if ('path' in item && item.path) navigateFromHeader(item.path);
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <div
        className="atlas-compact-bar"
        style={{
          ...styles.compactBar,
          ...(showCompactBar ? styles.compactBarVisible : styles.compactBarHidden),
        }}
      >
        <button
          type="button"
          className="atlas-compact-brand-button"
          style={styles.compactBrandButton}
          onClick={() => navigateFromHeader('/')}
          aria-label="Ir a inicio"
        >
          <div className="atlas-compact-logo-aura" style={styles.compactLogoAura}>
            <img className="atlas-compact-logo" src={microscopioHeader} alt="Logo Laboratorio" style={styles.compactLogo} />
          </div>
          <span className="atlas-compact-brand-text" style={styles.compactBrandText}>Atlas</span>
        </button>

        <div className="atlas-compact-divider" style={styles.compactDivider} />

        <div className="atlas-compact-nav-scroller" style={styles.compactNavScroller}>
          <ul className="atlas-compact-nav-list" style={styles.compactNavList}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
              <li className="atlas-compact-nav-item" key={`compact-${item.key}`} style={styles.compactNavItem}>
                <button
                  type="button"
                  className="atlas-compact-nav-button"
                  style={styles.compactNavButton}
                  onClick={() => {
                    if ('path' in item && item.path) navigateFromHeader(item.path);
                  }}
                >
                  <Icon className="atlas-compact-nav-icon" size={15} />
                  {item.label}
                </button>
              </li>
            );})}
          </ul>
        </div>
      </div>
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    width: '100%',
    maxWidth: '1600px',
    margin: '0 auto',
    boxShadow: '0 12px 38px rgba(8, 33, 75, 0.26)',
    borderRadius: '18px 18px 0 0',
    overflow: 'hidden',
    border: '1px solid rgba(206, 234, 255, 0.9)',
    backgroundColor: '#f4f7fb',
  },
  hero: {
    position: 'relative',
    minHeight: '228px',
    display: 'flex',
    alignItems: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderBottom: '2px solid rgba(174, 216, 255, 0.8)',
  },
  heroGlass: {
    position: 'absolute',
    inset: '10px',
    borderRadius: '16px',
    border: '1px solid rgba(210, 239, 255, 0.85)',
    boxShadow: 'inset 0 0 45px rgba(255,255,255,0.22)',
    pointerEvents: 'none',
  },
  heroReadableOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 48%, rgba(241, 250, 255, 0.52) 0%, rgba(219, 237, 252, 0.16) 36%, rgba(11, 36, 86, 0.01) 64%), linear-gradient(90deg, rgba(7, 28, 78, 0.2) 0%, rgba(7, 28, 78, 0) 18%, rgba(7, 28, 78, 0) 82%, rgba(7, 28, 78, 0.2) 100%)',
    backdropFilter: 'blur(0.9px)',
    pointerEvents: 'none',
  },
  heroMainRow: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    minHeight: '212px',
    display: 'grid',
    gridTemplateColumns: '216px 1fr 184px',
    alignItems: 'center',
    gap: '12px',
    padding: '0 0 0 16px',
  },
  rightSidePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '184px',
    background:
      'linear-gradient(180deg, rgba(209, 231, 255, 0.38) 0%, rgba(177, 209, 246, 0.34) 100%)',
    backdropFilter: 'blur(7px)',
    borderLeft: '1px solid rgba(193, 226, 255, 0.64)',
    boxShadow: 'inset 0 0 18px rgba(236, 246, 255, 0.26)',
    pointerEvents: 'none',
  },
  leftArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoActionButton: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftLogoAura: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 32% 30%, rgba(233, 246, 255, 0.72) 0%, rgba(131, 183, 233, 0.48) 48%, rgba(31, 83, 151, 0.4) 100%)',
    boxShadow: '0 10px 24px rgba(5, 30, 80, 0.34), inset 0 0 18px rgba(226, 243, 255, 0.4)',
    border: '1px solid rgba(201, 228, 252, 0.78)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease',
  },
  leftLogoAuraHover: {
    transform: 'scale(1.035)',
    filter: 'brightness(1.045)',
    boxShadow: '0 14px 28px rgba(5, 30, 80, 0.4), inset 0 0 20px rgba(236, 247, 255, 0.52)',
  },
  microscopeImage: {
    width: '166px',
    height: '166px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 12px 20px rgba(7, 38, 83, 0.42))',
  },
  centerArea: {
    width: '100%',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '4px 10px 5px 10px',
    textAlign: 'center',
    color: '#081a42',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(48px, 4.8vw, 72px)',
    lineHeight: 1,
    letterSpacing: '0.5px',
    fontWeight: 700,
    color: '#081d4a',
    fontFamily: '"Playfair Display", "Times New Roman", serif',
    textShadow:
      '0 0 1px rgba(245, 247, 250, 0.95), 0 0 4px rgba(232, 236, 243, 0.9), 0 0 10px rgba(216, 223, 234, 0.68), 0 0 18px rgba(196, 205, 220, 0.44), 0 0 30px rgba(184, 194, 211, 0.28), 0 0 44px rgba(176, 187, 205, 0.16)',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    margin: '8px 0 0 0',
    fontSize: 'clamp(20px, 1.55vw, 28px)',
    lineHeight: 1.15,
    fontWeight: 500,
    color: '#0b214c',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    textShadow:
      '0 0 1px rgba(242, 246, 252, 0.9), 0 0 4px rgba(228, 234, 244, 0.78), 0 0 10px rgba(210, 219, 232, 0.52), 0 0 18px rgba(194, 205, 222, 0.3), 0 0 30px rgba(184, 196, 214, 0.18)',
    whiteSpace: 'nowrap',
  },
  separator: {
    width: '100%',
    maxWidth: '760px',
    height: '1px',
    margin: '8px auto 7px auto',
    background: 'linear-gradient(90deg, transparent, rgba(31, 72, 134, 0.45), transparent)',
  },
  subtitle2: {
    margin: 0,
    fontSize: 'clamp(18px, 1.35vw, 24px)',
    lineHeight: 1.25,
    fontWeight: 500,
    color: '#0e2a57',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    textShadow:
      '0 0 1px rgba(242, 246, 252, 0.88), 0 0 4px rgba(227, 233, 243, 0.74), 0 0 9px rgba(209, 218, 231, 0.48), 0 0 16px rgba(193, 204, 221, 0.28), 0 0 26px rgba(183, 195, 213, 0.16)',
    whiteSpace: 'nowrap',
  },
  rightArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: '12px',
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    paddingRight: 0,
    paddingLeft: 0,
    paddingTop: '8px',
    paddingBottom: '8px',
  },
  universityLogo: {
    width: '104px',
    height: '104px',
    objectFit: 'contain',
    borderRadius: '50%',
    boxShadow: '0 7px 16px rgba(8, 24, 58, 0.35)',
  },
  rightLogoAura: {
    width: '122px',
    height: '122px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 32% 30%, rgba(231, 245, 255, 0.64) 0%, rgba(137, 185, 233, 0.4) 52%, rgba(34, 88, 156, 0.34) 100%)',
    boxShadow: '0 8px 18px rgba(8, 36, 86, 0.34), inset 0 0 14px rgba(229, 244, 255, 0.3)',
    border: '1px solid rgba(201, 228, 252, 0.74)',
    transition: 'transform 180ms ease, box-shadow 220ms ease, filter 220ms ease',
  },
  rightLogoAuraHover: {
    transform: 'scale(1.04)',
    filter: 'brightness(1.05)',
    boxShadow: '0 12px 24px rgba(8, 36, 86, 0.4), inset 0 0 16px rgba(236, 247, 255, 0.48)',
  },
  searchButton: {
    width: '54px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(220, 239, 255, 0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(220,236,255,0.12) 100%)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(2px)',
  },
  bottomNav: {
    background: 'linear-gradient(180deg, rgba(247, 252, 255, 0.96) 0%, rgba(240, 247, 255, 0.98) 100%)',
    borderTop: '1px solid rgba(211, 232, 250, 0.85)',
    borderBottom: '3px solid #8ec8ff',
    padding: '12px 20px',
  },
  navList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
    flexWrap: 'nowrap',
  },
  navItem: {
    margin: 0,
    padding: 0,
    flex: '1 1 0',
    minWidth: 0,
  },
  navButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#1a315e',
    textTransform: 'uppercase',
    fontSize: '16px',
    letterSpacing: '0.3px',
    fontWeight: 500,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    padding: '4px 1px',
    width: '100%',
    whiteSpace: 'nowrap',
  },
  compactBar: {
    position: 'fixed',
    top: 0,
    left: '50%',
    width: 'min(1600px, calc(100% - 16px))',
    zIndex: 1300,
    minHeight: '52px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background:
      'linear-gradient(180deg, rgba(252, 254, 255, 0.94) 0%, rgba(239, 248, 255, 0.88) 100%)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(162, 203, 235, 0.58)',
    borderLeft: '1px solid rgba(184, 216, 241, 0.42)',
    borderRight: '1px solid rgba(184, 216, 241, 0.42)',
    borderRadius: '0 0 12px 12px',
    boxShadow: '0 7px 16px rgba(29, 84, 135, 0.14)',
    transition: 'opacity 220ms ease, transform 220ms ease, visibility 220ms ease',
  },
  compactBarVisible: {
    opacity: 1,
    transform: 'translate(-50%, 0)',
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  compactBarHidden: {
    opacity: 0,
    transform: 'translate(-50%, -14px)',
    visibility: 'hidden',
    pointerEvents: 'none',
  },
  compactBrandButton: {
    border: 'none',
    background: 'transparent',
    color: '#173564',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    cursor: 'pointer',
    padding: 0,
    margin: 0,
    flexShrink: 0,
    transition: 'transform 180ms ease, filter 180ms ease',
  },
  compactLogoAura: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at 35% 30%, rgba(235, 248, 255, 0.84) 0%, rgba(114, 166, 218, 0.54) 52%, rgba(32, 79, 145, 0.44) 100%)',
    border: '1px solid rgba(214, 235, 254, 0.72)',
    boxShadow: '0 6px 12px rgba(4, 23, 64, 0.35)',
  },
  compactLogo: {
    width: '31px',
    height: '31px',
    objectFit: 'contain',
  },
  compactBrandText: {
    color: '#143768',
    fontWeight: 700,
    fontSize: '19px',
    letterSpacing: '0.2px',
    fontFamily: '"Playfair Display", "Times New Roman", serif',
    textShadow: '0 1px 5px rgba(152, 198, 232, 0.45)',
  },
  compactDivider: {
    width: '1px',
    height: '26px',
    background: 'linear-gradient(180deg, rgba(141, 186, 220, 0.15) 0%, rgba(121, 171, 210, 0.7) 50%, rgba(141, 186, 220, 0.15) 100%)',
    flexShrink: 0,
  },
  compactNavScroller: {
    flex: 1,
    minWidth: 0,
    overflowX: 'hidden',
    overflowY: 'hidden',
  },
  compactNavList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: '8px',
    width: '100%',
    minWidth: 0,
    whiteSpace: 'nowrap',
  },
  compactNavItem: {
    margin: 0,
    padding: 0,
    flex: 1,
    minWidth: 0,
  },
  compactNavButton: {
    border: 'none',
    background: 'transparent',
    color: '#1a315e',
    borderRadius: 0,
    padding: '4px 1px',
    fontSize: '15px',
    fontWeight: 400,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    transition: 'color 160ms ease, transform 160ms ease, text-shadow 180ms ease',
  },
};

export default Header;