import React from 'react';
import Footer from '../components/Footer';
import Header from '../components/Header';

const Home: React.FC = () => {
  return (
    <div style={styles.container}>
      <Header />

      <main style={styles.main} />

      <Footer />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 15% -5%, #bfdbfe 0%, transparent 40%), radial-gradient(circle at 90% 10%, #ddd6fe 0%, transparent 32%), linear-gradient(160deg, #f8fbff 0%, #eef4ff 48%, #f3f7ff 100%)',
    color: '#0f172a',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 'clamp(8px, 2vw, 24px)',
    boxSizing: 'border-box',
  },
  main: {
    width: '100%',
    maxWidth: '1200px',
    minHeight: '320px',
    boxSizing: 'border-box',
    padding: 'clamp(20px, 5vw, 48px) clamp(8px, 3vw, 32px) clamp(32px, 8vw, 80px)',
  },
};

export default Home;
