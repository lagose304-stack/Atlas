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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    background: 'transparent',
    padding: 'clamp(8px, 2vw, 24px)',
    boxSizing: 'border-box',
  },
  main: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: 0,
    flex: 1,
    boxSizing: 'border-box',
  },
};

export default Home;



