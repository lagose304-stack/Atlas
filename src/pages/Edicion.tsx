import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import Header from '../components/Header';

const Edicion: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main}>

        {/* Breadcrumb */}
        <nav style={s.breadcrumb}>
          <button
            onClick={() => navigate('/')}
            style={s.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            🏠 Inicio
          </button>
          <span style={s.breadcrumbSep}>❯</span>
          <span style={s.breadcrumbCurrent}>Edición</span>
        </nav>

        {/* Encabezado de la sección */}
        <div style={s.pageHeader}>
          <div style={s.pageTitleRow}>
            <h1 style={s.pageTitle}>Panel de Edición</h1>
            <button
              style={s.logoutBtn}
              onClick={handleLogout}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff1f2';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
            >
              ⏻ Cerrar sesión
            </button>
          </div>
          <p style={s.pageSubtitle}>
            Gestiona el contenido del Atlas de Histología desde este panel.
          </p>
          <div style={s.accentLine} />
        </div>

        {/* Grid de tarjetas */}
        <div style={s.grid} className="edicion-grid">

          {/* Tarjeta: Temario */}
          <div style={s.card}>
            <div style={{ ...s.cardAccent, background: 'linear-gradient(135deg, #6366f1, #818cf8)' }} />
            <div style={s.cardIcon}>📚</div>
            <div style={s.cardBody}>
              <h2 style={s.cardTitle}>Temario</h2>
              <p style={s.cardDesc}>
                Administra los temas y subtemas del atlas. Crea, edita o elimina entradas del temario.
              </p>
            </div>
            <Link
              to="/temario"
              style={s.cardBtn}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #6366f1, #818cf8)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#f5f3ff';
                (e.currentTarget as HTMLAnchorElement).style.color = '#6366f1';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#c7d2fe';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              Gestionar temario →
            </Link>
          </div>

          {/* Tarjeta: Placas */}
          <div style={s.card}>
            <div style={{ ...s.cardAccent, background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
            <div style={s.cardIcon}>🔬</div>
            <div style={s.cardBody}>
              <h2 style={s.cardTitle}>Placas</h2>
              <p style={s.cardDesc}>
                Sube, clasifica y reorganiza las placas histológicas. Asígnalas a sus temas y subtemas.
              </p>
            </div>
            <Link
              to="/placas"
              style={{ ...s.cardBtn, color: '#10b981', background: '#ecfdf5', borderColor: '#a7f3d0' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #10b981, #34d399)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#ecfdf5';
                (e.currentTarget as HTMLAnchorElement).style.color = '#10b981';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#a7f3d0';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              Gestionar placas →
            </Link>
          </div>

          {/* Tarjeta: Editar páginas */}
          <div style={s.card}>
            <div style={{ ...s.cardAccent, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }} />
            <div style={s.cardIcon}>✏️</div>
            <div style={s.cardBody}>
              <h2 style={s.cardTitle}>Editar páginas</h2>
              <p style={s.cardDesc}>
                Añade y edita bloques de contenido editorial (textos, imágenes, títulos) en cada sección del atlas.
              </p>
            </div>
            <div style={s.pagesBtnGroup}>
              <button
                style={s.pagesBtn}
                onClick={() => navigate('/editar-home')}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fffbeb';
                  e.currentTarget.style.color = '#b45309';
                  e.currentTarget.style.borderColor = '#fde68a';
                }}
              >
                🏠 Página principal
              </button>
              <button
                style={s.pagesBtn}
                onClick={() => navigate('/editar-subtemas')}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fffbeb';
                  e.currentTarget.style.color = '#b45309';
                  e.currentTarget.style.borderColor = '#fde68a';
                }}
              >
                📂 Página de subtemas
              </button>
              <button
                style={s.pagesBtn}
                onClick={() => navigate('/editar-placas')}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fffbeb';
                  e.currentTarget.style.color = '#b45309';
                  e.currentTarget.style.borderColor = '#fde68a';
                }}
              >
                🔬 Página de placas
              </button>
            </div>
          </div>

          {/* Tarjeta: Realizar pruebas */}
          <div style={s.card}>
            <div style={{ ...s.cardAccent, background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }} />
            <div style={s.cardIcon}>🧪</div>
            <div style={s.cardBody}>
              <h2 style={s.cardTitle}>Realizar pruebas</h2>
              <p style={s.cardDesc}>
                Ejecuta pruebas y verificaciones sobre el contenido del atlas.
              </p>
            </div>
            <button
              style={s.testBtn}
              disabled
            >
              Iniciar prueba
            </button>
          </div>

          {/* Tarjeta: Gestión de usuarios */}
          <div style={{ ...s.card, gridColumn: 'span 2' }}>
            <div style={{ ...s.cardAccent, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }} />
            <div style={s.cardIcon}>👥</div>
            <div style={s.cardBody}>
              <h2 style={s.cardTitle}>Gestión de usuarios</h2>
              <p style={s.cardDesc}>
                Crea, edita o elimina cuentas de usuario del sistema. Asigna roles y administra el acceso al panel de edición.
              </p>
            </div>
            <Link
              to="/gestion-usuarios"
              style={{ ...s.cardBtn, color: '#0ea5e9', background: '#f0f9ff', borderColor: '#bae6fd' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #0ea5e9, #38bdf8)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#f0f9ff';
                (e.currentTarget as HTMLAnchorElement).style.color = '#0ea5e9';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#bae6fd';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              Gestionar usuarios →
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#0f172a',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(16px, 3vw, 28px)',
    padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px) clamp(24px, 5vw, 56px)',
    width: '100%',
    maxWidth: '960px',
    boxSizing: 'border-box',
  },

  // Breadcrumb
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)',
    borderRadius: '12px',
    padding: '8px 16px',
    boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
  },
  breadcrumbLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#0ea5e9',
    fontWeight: 600,
    fontSize: '0.88em',
    padding: '4px 8px',
    borderRadius: '8px',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },
  breadcrumbSep: {
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '0.75em',
    userSelect: 'none',
  },
  breadcrumbCurrent: {
    color: '#0f172a',
    fontWeight: 800,
    fontSize: '0.88em',
    padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)',
    borderRadius: '8px',
    border: '1px solid #bae6fd',
    letterSpacing: '0.01em',
  },

  // Encabezado
  pageHeader: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pageTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)',
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: 0,
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '9px 18px',
    borderRadius: '50px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  pageSubtitle: {
    fontSize: 'clamp(0.88em, 2vw, 1em)',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  accentLine: {
    marginTop: '10px',
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },

  // Grid de tarjetas
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'clamp(12px, 2.5vw, 20px)',
  },

  // Tarjeta individual
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '18px',
    padding: 'clamp(18px, 3vw, 32px)',
    boxShadow: '0 6px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    borderRadius: '18px 18px 0 0',
  } as React.CSSProperties,
  cardIcon: {
    fontSize: 'clamp(1.8em, 3vw, 2.4em)',
    lineHeight: 1,
    marginTop: '4px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  cardTitle: {
    fontSize: 'clamp(1.1em, 2.5vw, 1.4em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  cardDesc: {
    fontSize: 'clamp(0.82em, 1.6vw, 0.92em)',
    color: '#64748b',
    lineHeight: 1.65,
    margin: 0,
  },
  cardBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1.5px solid #c7d2fe',
    background: '#f5f3ff',
    color: '#6366f1',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    alignSelf: 'flex-start',
    letterSpacing: '0.01em',
  } as React.CSSProperties,

  // Botón deshabilitado de "Realizar pruebas"
  testBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1.5px solid #ddd6fe',
    background: '#f5f3ff',
    color: '#a78bfa',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    opacity: 0.6,
    alignSelf: 'flex-start',
    letterSpacing: '0.01em',
  } as React.CSSProperties,

  // Grupo de botones de "Editar páginas"
  pagesBtnGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  pagesBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1.5px solid #fde68a',
    background: '#fffbeb',
    color: '#b45309',
    fontSize: '0.88em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
};

export default Edicion;

