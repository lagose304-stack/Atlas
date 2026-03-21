import React from 'react';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageContentEditor from '../components/PageContentEditor';
import LoadingToast from '../components/LoadingToast';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

const EditarInicio: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <BackButton onClick={handleGoBack} />

        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>✏️</span>
          <div>
            <strong>Modo edición — Página Inicio</strong>
            <p style={s.editBannerHint}>
              Edita bloques de contenido editorial (textos, imágenes, títulos) que se mostrarán en la página principal del atlas.
            </p>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Contenido de la página</h2>
            <p style={s.cardSubtitle}>Bloques de contenido que se muestran en la página de inicio</p>
            <div style={s.divider} />
          </div>
          <PageContentEditor entityType="home_page" entityId={0} />
        </div>
      </main>
      <Footer />
      <LoadingToast visible={false} type="saving" message="Guardando..." />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) 120px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  editBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    background: 'linear-gradient(135deg, #fef9c3, #fef3c7)',
    border: '1.5px solid #fde68a',
    borderRadius: '14px',
    padding: '16px 20px',
    fontSize: '0.95em',
    color: '#78350f',
    boxShadow: '0 2px 12px rgba(234,179,8,0.12)',
  },
  editBannerIcon: { fontSize: '1.6em', lineHeight: 1, marginTop: '2px', flexShrink: 0 },
  editBannerHint: { margin: '4px 0 0', fontSize: '0.88em', color: '#92400e', fontWeight: 400 },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(10px, 1.2vw, 14px) 0',
    boxShadow: 'none',
    border: 'none',
  },
  cardHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' },
  cardTitle: { fontSize: 'clamp(1.4em, 3vw, 2.2em)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 6px' },
  cardSubtitle: { fontSize: '0.9em', color: '#64748b', margin: '0 0 14px', textAlign: 'center' },
  divider: { width: '56px', height: '4px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px' },
};

export default EditarInicio;
