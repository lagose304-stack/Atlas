import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface AccessDeniedState {
  from?: string;
}

const AccesoDenegado: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as AccessDeniedState | null;

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <section style={s.card}>
          <div style={s.badge}>⛔ Acceso denegado</div>
          <h1 style={s.title}>No tienes permisos para esta seccion</h1>
          <p style={s.text}>
            Tu cuenta inicio sesion correctamente, pero no tiene autorizacion para abrir esta ruta.
          </p>
          {state?.from && (
            <p style={s.pathText}>
              Ruta solicitada: {state.from}
            </p>
          )}
          <div style={s.buttons}>
            <button style={s.primaryBtn} onClick={() => navigate('/edicion')}>
              Volver al panel
            </button>
            <button style={s.secondaryBtn} onClick={() => navigate('/')}>
              Ir al inicio
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
  },
  main: {
    width: '100%',
    maxWidth: '980px',
    margin: '0 auto',
    padding: '32px 16px 52px',
    boxSizing: 'border-box',
  },
  card: {
    background: 'linear-gradient(180deg, #ffffff, #fff7f7)',
    border: '1px solid #fecaca',
    borderRadius: '16px',
    boxShadow: '0 16px 30px rgba(127,29,29,0.08)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  badge: {
    width: 'fit-content',
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    borderRadius: '999px',
    padding: '6px 12px',
    fontWeight: 700,
    fontSize: '0.88rem',
  },
  title: {
    margin: 0,
    color: '#7f1d1d',
    fontSize: '1.9rem',
    fontWeight: 800,
  },
  text: {
    margin: 0,
    color: '#334155',
    lineHeight: 1.5,
    fontSize: '1rem',
  },
  pathText: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.9rem',
  },
  buttons: {
    marginTop: '8px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: '#f8fafc',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default AccesoDenegado;



