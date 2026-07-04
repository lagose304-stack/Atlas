import React from 'react';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import TemasOrderManager from '../components/TemasOrderManager';

const EditarTemario: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <BackButton onClick={handleGoBack} />

        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>📚</span>
          <div>
            <strong>Orden de temas - Temario</strong>
            <p style={s.editBannerHint}>
              Ajusta el orden en que se mostrarán los temas del atlas.
            </p>
          </div>
        </div>

        <TemasOrderManager
          title="Temario"
          subtitle="Orden actual de los temas en el atlas"
        />
      </main>
      <Footer />
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
};

export default EditarTemario;