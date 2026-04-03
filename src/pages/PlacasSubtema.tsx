import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MousePointerClick } from 'lucide-react';
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
  senalados_meta?: Array<{ label: string; x: number | null; y: number | null; startX?: number | null; startY?: number | null }> | null;
  comentario?: string | null;
  tincion?: string | null;
}

interface SubtemaInfo {
  id: number;
  nombre: string;
  tema_id: number;
  temas?: { nombre: string } | { nombre: string }[];
}

interface InteractiveMapRow {
  placa_id: number;
}

interface PlacaGroupByAumento {
  key: string;
  title: string;
  sortValue: number;
  items: Placa[];
}

const parseAumentoSortValue = (aumento: string): number => {
  const normalized = aumento.trim().replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const normalizeAumentoLabel = (aumento: string): string => aumento.trim().replace(/\s+/g, '').toUpperCase();

const PlacasSubtema: React.FC = () => {
  const { subtemaId } = useParams<{ subtemaId: string }>();
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [subtema, setSubtema] = useState<SubtemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(new Set());

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
      if (placasData) {
        setPlacas(placasData);
        const placaIds = placasData
          .map((placa: Placa) => placa.id)
          .filter((id): id is number => typeof id === 'number');

        if (placaIds.length > 0) {
          const { data: interactiveMapsData, error: interactiveMapsError } = await supabase
            .from('interactive_maps')
            .select('placa_id')
            .in('placa_id', placaIds);

          if (interactiveMapsError) {
            console.error('Error fetching interactive maps by placa:', interactiveMapsError);
            setPlacasConMapa(new Set());
          } else {
            const placaIdsConMapa = (interactiveMapsData ?? [])
              .map((row: InteractiveMapRow) => row.placa_id)
              .filter((id): id is number => typeof id === 'number');
            setPlacasConMapa(new Set(placaIdsConMapa));
          }
        } else {
          setPlacasConMapa(new Set());
        }
      } else {
        setPlacasConMapa(new Set());
      }

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

  const interactivePlacas = useMemo(() => {
    return placas.filter((placa) => placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const nonInteractivePlacas = useMemo(() => {
    return placas.filter((placa) => !placasConMapa.has(placa.id));
  }, [placas, placasConMapa]);

  const placasByAumento = useMemo<PlacaGroupByAumento[]>(() => {
    const groups = new Map<string, PlacaGroupByAumento>();

    nonInteractivePlacas.forEach((placa) => {
      const aumentoRaw = (placa.aumento ?? '').trim();
      const hasAumento = aumentoRaw.length > 0;
      const aumentoLabel = hasAumento ? normalizeAumentoLabel(aumentoRaw) : 'SIN_AUMENTO';
      const key = hasAumento ? `AUMENTO_${aumentoLabel}` : 'AUMENTO_SIN_AUMENTO';
      const title = hasAumento ? `Aumento ${aumentoLabel}` : 'Sin aumento';
      const sortValue = hasAumento ? parseAumentoSortValue(aumentoRaw) : Number.POSITIVE_INFINITY;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          sortValue,
          items: [],
        });
      }

      const target = groups.get(key);
      if (target) {
        target.items.push(placa);
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
  }, [nonInteractivePlacas]);

  const handlePlacaOpen = (placa: Placa) => {
    void logPlacaView(placa.id, Number(subtemaId));
    setSelectedPlaca(placa);
  };

  const renderPlacaCard = (placa: Placa) => {
    const hasInteractiveMap = placasConMapa.has(placa.id);
    const isHovered = hoveredId === placa.id;

    return (
      <div
        key={placa.id}
        className="placa-thumb-wrap"
        style={{
          ...styles.thumbWrap,
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
          boxShadow: isHovered
            ? '0 16px 28px rgba(14,165,233,0.24)'
            : '0 6px 14px rgba(56,189,248,0.16)',
          borderColor: isHovered ? '#38bdf8' : '#dbeafe',
        }}
        onClick={() => handlePlacaOpen(placa)}
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
        {(placa.aumento || hasInteractiveMap) && (
          <div style={styles.thumbBadgesRow}>
            {placa.aumento && (
              <div style={styles.aumentoBadge} title={`Aumento ${placa.aumento}`} aria-label={`Aumento ${placa.aumento}`}>
                <span style={styles.aumentoBadgeText}>{placa.aumento.toUpperCase()}</span>
              </div>
            )}
            {hasInteractiveMap && (
              <div style={styles.interactiveMapBadge} title="Mapa interactivo disponible" aria-label="Mapa interactivo disponible">
                <MousePointerClick size={16} strokeWidth={2.35} />
              </div>
            )}
          </div>
        )}
        <div style={{
          ...styles.thumbOverlay,
          opacity: hoveredId === placa.id ? 1 : 0,
        }}>
          🔍
        </div>
      </div>
    );
  };

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
            <div style={styles.gridSectionsWrap}>
              {interactivePlacas.length > 0 && (
                <section style={styles.gridSection}>
                  <div style={styles.gridSectionHeader}>
                    <h2 style={styles.gridSectionTitle}>Placas interactivas</h2>
                    <span style={styles.gridSectionCount}>{interactivePlacas.length}</span>
                  </div>
                  <div className="placas-gallery-grid">
                    {interactivePlacas.map(renderPlacaCard)}
                  </div>
                </section>
              )}

              {placasByAumento.map((group) => (
                <section key={group.key} style={styles.gridSection}>
                  <div style={styles.gridSectionHeader}>
                    <h2 style={styles.gridSectionTitle}>{group.title}</h2>
                    <span style={styles.gridSectionCount}>{group.items.length}</span>
                  </div>
                  <div className="placas-gallery-grid">
                    {group.items.map(renderPlacaCard)}
                  </div>
                </section>
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
          placaId={selectedPlaca.id}
          hasInteractiveMapHint={placasConMapa.has(selectedPlaca.id)}
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
  gridSectionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
  },
  gridSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  gridSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
  },
  gridSectionTitle: {
    margin: 0,
    color: '#334155',
    fontSize: '0.95em',
    fontWeight: 700,
    letterSpacing: '0.01em',
    textTransform: 'none',
  },
  gridSectionCount: {
    color: '#64748b',
    fontSize: '0.78em',
    fontWeight: 700,
    border: '1px solid rgba(148,163,184,0.32)',
    borderRadius: '999px',
    padding: '2px 9px',
    background: 'rgba(255,255,255,0.58)',
  },
  thumbWrap: {
    position: 'relative',
    borderRadius: '14px',
    overflow: 'hidden',
    cursor: 'pointer',
    aspectRatio: '1 / 1',
    background: '#f1f5f9',
    border: '1.5px solid #dbeafe',
    boxShadow: '0 6px 14px rgba(56,189,248,0.16)',
    outline: 'none',
    backfaceVisibility: 'hidden',
    willChange: 'transform, box-shadow, border-color',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
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
  thumbBadgesRow: {
    position: 'absolute',
    top: '7px',
    left: '7px',
    right: '7px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    zIndex: 2,
  },
  aumentoBadge: {
    minWidth: '52px',
    height: '32px',
    borderRadius: '10px',
    color: '#f8fbff',
    background: '#1d345f',
    border: '1px solid rgba(120,143,186,0.78)',
    fontWeight: 800,
    fontSize: '0.66em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    boxShadow: '0 3px 10px rgba(29,52,95,0.38)',
    letterSpacing: '0.02em',
    flexShrink: 0,
    lineHeight: 1,
    textAlign: 'center',
    backdropFilter: 'blur(4px)',
  },
  aumentoBadgeText: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    lineHeight: 1,
  },
  interactiveMapBadge: {
    width: '32px',
    height: '32px',
    color: '#f8fbff',
    background: '#1d345f',
    border: '1px solid rgba(120,143,186,0.78)',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(29,52,95,0.38)',
    backdropFilter: 'blur(4px)',
    flexShrink: 0,
  },
};

export default PlacasSubtema;




