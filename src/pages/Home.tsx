import React, { useEffect, useState } from 'react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../components/PageContentEditor';
import { getRenderableBlocks } from '../services/contentPublication';

const Home: React.FC = () => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching home content blocks:', error);
      }
    };

    void fetchBlocks();
  }, []);

  return (
    <div style={styles.container}>
      <Header />

      <main style={styles.main}>
        {contentBlocks.length > 0 && (
          <section style={styles.contentCard}>
            <ContentBlockRenderer blocks={contentBlocks} />
          </section>
        )}
      </main>

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
  contentCard: {
    width: '100%',
    maxWidth: '1280px',
    background: 'transparent',
    borderRadius: 0,
    boxShadow: 'none',
    border: 'none',
    padding: 0,
    boxSizing: 'border-box',
  },
};

export default Home;



