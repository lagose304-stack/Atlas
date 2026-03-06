import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ImageViewerModal from '../components/ImageViewerModal';

interface Placa {
  id: number;
  photo_url: string;
}

interface SubtemaInfo {
  id: number;
  nombre: string;
  tema_id: number;
  temas?: { nombre: string } | { nombre: string }[];
}

const PlacasSubtema: React.FC = () => {
  const { subtemaId } = useParams<{ subtemaId: string }>();
  const navigate = useNavigate();
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [subtema, setSubtema] = useState<SubtemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  useEffect(() => {
    if (!subtemaId) return;

    const fetchData = async () => {
      setLoading(true);

      // Cargar info del subtema (con nombre del tema padre)
      const { data: subtemaData } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id, temas(nombre)')
        .eq('id', subtemaId)
        .single();

      if (subtemaData) setSubtema(subtemaData as unknown as SubtemaInfo);

      // Cargar placas de este subtema
      const { data: placasData } = await supabase
        .from('placas')
        .select('id, photo_url')
        .eq('subtema_id', subtemaId)
        .order('created_at', { ascending: false });

      if (placasData) setPlacas(placasData);

      setLoading(false);
    };

    fetchData();
  }, [subtemaId]);

  const temaNombre = (() => {
    if (!subtema?.temas) return '';
    if (Array.isArray(subtema.temas)) return (subtema.temas as { nombre: string }[])[0]?.nombre ?? '';
    return (subtema.temas as { nombre: string }).nombre ?? '';
  })();

  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        {/* Breadcrumb / navegación */}
        <nav style={styles.breadcrumb}>
          <button
            onClick={() => navigate('/')}
            style={styles.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            🏠 Inicio
          </button>
          <span style={styles.breadcrumbSep}>❯</span>
          <button
            onClick={() => navigate(`/subtemas/${subtema?.tema_id}`)}
            style={styles.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {temaNombre || 'Subtemas'}
          </button>
          <span style={styles.breadcrumbSep}>❯</span>
          <span style={styles.breadcrumbCurrent}>{subtema?.nombre ?? '...'}</span>
        </nav>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.accentBar} />
            <div style={styles.sectionTitleWrap}>
              <h1 style={styles.title}>
                {loading ? 'Cargando...' : subtema?.nombre ?? 'Placas'}
              </h1>
              {!loading && (
                <span style={styles.countBadge}>
                  {placas.length} {placas.length === 1 ? 'placa' : 'placas'}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div style={styles.spinnerWrap}>
              <div style={styles.spinner} />
            </div>
          ) : placas.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🔬</span>
              <p style={styles.emptyText}>Aún no hay placas registradas para este subtema.</p>
            </div>
          ) : (
            <div className="placas-gallery-grid">
              {placas.map(placa => (
                <div
                  key={placa.id}
                  className="placa-thumb-wrap"
                  style={{
                    ...styles.thumbWrap,
                    ...(hoveredId === placa.id ? styles.thumbWrapHover : {}),
                  }}
                  onClick={() => setSelectedImage(placa.photo_url)}
                  onMouseEnter={() => setHoveredId(placa.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  title="Ver en grande"
                >
                  <img
                    src={placa.photo_url}
                    alt="Placa histológica"
                    style={styles.thumbImg}
                    loading="lazy"
                  />
                  <div style={{
                    ...styles.thumbOverlay,
                    opacity: hoveredId === placa.id ? 1 : 0,
                  }}>
                    🔍
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      {selectedImage && (
        <ImageViewerModal
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#0f172a',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px)',
    boxSizing: 'border-box',
  },
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '24px',
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
    transition: 'background 0.15s, color 0.15s',
    textDecoration: 'none',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },
  breadcrumbSep: {
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '0.75em',
    lineHeight: 1,
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
  section: {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(6px)',
    borderRadius: '18px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: '0 4px 24px rgba(14,165,233,0.07)',
    border: '1px solid rgba(186,230,253,0.5)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
    paddingBottom: '16px',
    borderBottom: '2px solid #e0f2fe',
  },
  accentBar: {
    width: '5px',
    height: '44px',
    borderRadius: '4px',
    background: 'linear-gradient(180deg, #38bdf8, #818cf8)',
    flexShrink: 0,
  },
  sectionTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.3em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  countBadge: {
    background: 'linear-gradient(135deg, #bfdbfe, #e0e7ff)',
    color: '#1e40af',
    borderRadius: '99px',
    padding: '4px 14px',
    fontSize: '0.82em',
    fontWeight: 700,
    border: '1px solid #93c5fd',
  },
  spinnerWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '5px solid #e0f2fe',
    borderTop: '5px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(32px, 8vw, 80px)',
    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '3em',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontWeight: 500,
    textAlign: 'center',
  },
  thumbWrap: {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    aspectRatio: '1 / 1',
    background: '#f1f5f9',
    border: '2px solid #e2e8f0',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  },
  thumbWrapHover: {
    transform: 'scale(1.04)',
    boxShadow: '0 8px 28px rgba(14,165,233,0.22)',
    borderColor: '#38bdf8',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(14,165,233,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2em',
    transition: 'opacity 0.2s ease',
    backdropFilter: 'blur(2px)',
  },
};

export default PlacasSubtema;
