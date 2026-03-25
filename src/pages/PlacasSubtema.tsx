import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ImageViewerModal from '../components/ImageViewerModal';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import type { ContentBlock } from '../components/PageContentEditor';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getRenderableBlocks } from '../services/contentPublication';
import { logPlacaView, logSubtemaView } from '../services/analytics';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

interface Placa {
  id: number;
  photo_url: string;
  aumento?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<{ label: string; x: number | null; y: number | null }> | null;
  comentario?: string | null;
  tincion?: string | null;
}

interface SubtemaInfo {
  id: number;
  nombre: string;
  tema_id: number;
  temas?: { nombre: string } | { nombre: string }[];
}

const PlacasSubtema: React.FC = () => {
  const { subtemaId } = useParams<{ subtemaId: string }>();
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [subtema, setSubtema] = useState<SubtemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  useEffect(() => {
    if (!subtemaId) return;

    const fetchData = async () => {
      setLoading(true);
      void logSubtemaView(Number(subtemaId));

      // Cargar info del subtema (con nombre del tema padre)
      const { data: subtemaData, error: subtemaError } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id, temas(nombre)')
        .eq('id', subtemaId)
        .single();

      if (subtemaError) console.error('Error fetching subtema:', subtemaError);
      if (subtemaData) setSubtema(subtemaData as unknown as SubtemaInfo);

      // Cargar placas de este subtema
      const { data: placasData, error: placasError } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, senalados, senalados_meta, comentario, tincion')
        .eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true });

      if (placasError) console.error('Error fetching placas:', placasError);
      if (placasData) setPlacas(placasData);

      // Cargar bloques de contenido editorial
      try {
        const blocks = await getRenderableBlocks('placas_page', Number(subtemaId));
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching content blocks:', error);
      }

      setLoading(false);
    };

    fetchData();
  }, [subtemaId]);

  const handleGoBack = useSmartBackNavigation('/');

  const temaNombre = Array.isArray(subtema?.temas)
    ? (subtema?.temas[0]?.nombre ?? '')
    : (subtema?.temas?.nombre ?? '');

  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        <BackButton onClick={handleGoBack} />

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

          {/* Bloques de contenido editorial */}
          {!loading && contentBlocks.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <ContentBlockRenderer blocks={contentBlocks} />
            </div>
          )}

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
                  onClick={() => {
                    void logPlacaView(placa.id, Number(subtemaId));
                    setSelectedPlaca(placa);
                  }}
                  onMouseEnter={() => setHoveredId(placa.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  title="Ver en grande"
                >
                  <img
                    src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                    alt="Placa histológica"
                    style={styles.thumbImg}
                    loading="lazy"
                  />
                  {placa.aumento && (
                    <div style={styles.aumentoBadge}>
                      {placa.aumento}
                    </div>
                  )}
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

      {selectedPlaca && (
        <ImageViewerModal
          src={getCloudinaryImageUrl(selectedPlaca.photo_url, 'view')}
          srcZoom={getCloudinaryImageUrl(selectedPlaca.photo_url, 'zoom')}
          onClose={() => setSelectedPlaca(null)}
          temaNombre={temaNombre}
          subtemaNombre={subtema?.nombre}
          aumento={selectedPlaca.aumento}
          senalados={selectedPlaca.senalados}
          senaladosMeta={selectedPlaca.senalados_meta}
          comentario={selectedPlaca.comentario}
          tincion={selectedPlaca.tincion}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column',
  },
  backButton: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    color: '#4b5563',
    borderRadius: '999px',
    padding: '8px 16px',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  section: {
    background: 'transparent',
    padding: '0',
    boxShadow: 'none',
    border: 'none',
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
    borderRadius: '14px',
    overflow: 'hidden',
    cursor: 'pointer',
    aspectRatio: '1 / 1',
    background: '#f1f5f9',
    border: '1.5px solid #dbeafe',
    boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease',
  },
  thumbWrapHover: {
    transform: 'translateY(-4px) scale(1.03)',
    boxShadow: '0 16px 28px rgba(14,165,233,0.24)',
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
    background: 'linear-gradient(180deg, rgba(14,165,233,0.16), rgba(37,99,235,0.42))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2em',
    transition: 'opacity 0.2s ease',
    backdropFilter: 'blur(2.5px)',
  },
  aumentoBadge: {
    position: 'absolute',
    top: '7px',
    left: '7px',
    minWidth: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.92)',
    color: '#0369a1',
    fontWeight: 800,
    fontSize: '0.72em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
    boxShadow: '0 2px 8px rgba(14,165,233,0.18)',
    border: '1.5px solid #7dd3fc',
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    zIndex: 2,
    lineHeight: 1,
    textAlign: 'center',
    backdropFilter: 'blur(4px)',
  },
};

export default PlacasSubtema;




