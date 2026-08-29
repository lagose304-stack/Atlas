import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  ArrowLeft,
  Images,
  MousePointerClick,
} from 'lucide-react';
import Header from '../Header';
import Footer from '../Footer';
import BackButton from '../BackButton';
import ContentBlockRenderer from '../ContentBlockRenderer';
import ImageViewerModal from '../ImageViewerModal';
import type { ContentBlock } from '../../types/contentBlocks';
import type { PageSelection } from './PageNavigator';
import { supabase } from '../../services/supabase';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';

interface RealPageDraftViewerProps {
  selection: PageSelection;
  blocks: ContentBlock[];
  versionName?: string;
  isPublished?: boolean;
  onBackToEditor: () => void;
}

interface Placa {
  id: number;
  photo_url: string;
  aumento?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<{
    label: string;
    x: number | null;
    y: number | null;
    startX?: number | null;
    startY?: number | null;
    regionPoints?: number[] | null;
    regionColor?: string | null;
    regionOpacity?: number | null;
  }> | null;
  comentario?: string | null;
  tincion?: string | null;
}

interface InteractiveMapRow {
  placa_id: number;
  sections: unknown[] | null;
}

interface PlacaGroupByAumento {
  key: string;
  title: string;
  sortValue: number;
  items: Placa[];
}

interface SubtemaCardItem {
  id: number;
  nombre: string;
  descripcion?: string;
  logo_url?: string;
}

interface TemaCardItem {
  id: number;
  nombre: string;
  parcial?: string;
}

const parseAumentoSortValue = (aumento: string): number => {
  const normalized = aumento.trim().replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const normalizeAumentoLabel = (aumento: string): string => aumento.trim().replace(/\s+/g, '').toUpperCase();

const RealPageDraftViewer: React.FC<RealPageDraftViewerProps> = ({
  selection,
  blocks,
  versionName = 'Borrador actual',
  isPublished = false,
  onBackToEditor,
}) => {
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [subtemas, setSubtemas] = useState<SubtemaCardItem[]>([]);
  const [temas, setTemas] = useState<TemaCardItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);

  // Cargar datos auténticos de la base de datos
  useEffect(() => {
    let isCancelled = false;
    const fetchPageData = async () => {
      setLoadingData(true);
      try {
        if (selection.kind === 'subtema') {
          const { data: placasData } = await supabase
            .from('placas')
            .select('id, photo_url, aumento, senalados, senalados_meta, comentario, tincion')
            .eq('subtema_id', selection.id)
            .order('sort_order', { ascending: true });

          if (!isCancelled && placasData) {
            setPlacas(placasData as Placa[]);
            const placaIds = placasData
              .map((p: Placa) => p.id)
              .filter((id): id is number => typeof id === 'number');

            if (placaIds.length > 0) {
              const { data: interactiveMapsData } = await supabase
                .from('interactive_maps')
                .select('placa_id, sections')
                .in('placa_id', placaIds);

              const conMapa = (interactiveMapsData ?? [])
                .filter((row: InteractiveMapRow) => Array.isArray(row.sections) && row.sections.length > 0)
                .map((row: InteractiveMapRow) => row.placa_id)
                .filter((id): id is number => typeof id === 'number');

              if (!isCancelled) setPlacasConMapa(new Set(conMapa));
            }
          }
        } else if (selection.kind === 'tema') {
          const { data } = await supabase
            .from('subtemas')
            .select('id, nombre, logo_url')
            .eq('tema_id', selection.id)
            .order('sort_order', { ascending: true });
          if (!isCancelled) setSubtemas((data ?? []) as SubtemaCardItem[]);
        } else if (selection.kind === 'temario') {
          const { data } = await supabase
            .from('temas')
            .select('id, nombre, parcial')
            .order('parcial', { ascending: true })
            .order('sort_order', { ascending: true });
          if (!isCancelled) setTemas((data ?? []) as TemaCardItem[]);
        }
      } catch (err) {
        console.warn('Error al cargar datos auxiliares para vista previa:', err);
      } finally {
        if (!isCancelled) setLoadingData(false);
      }
    };

    void fetchPageData();
    return () => {
      isCancelled = true;
    };
  }, [selection]);

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

  const selectedPlacaIndex = selectedPlaca
    ? placas.findIndex((placa) => placa.id === selectedPlaca.id)
    : -1;

  const navigateToPlate = (index: number) => {
    const targetPlate = placas[index];
    if (!targetPlate) return;
    setSelectedPlaca(targetPlate);
  };

  const renderPlacaCard = (placa: Placa, keySuffix: string) => {
    const hasInteractiveMap = placasConMapa.has(placa.id);
    const isHovered = hoveredId === placa.id;

    return (
      <button
        type="button"
        key={`${placa.id}-${keySuffix}`}
        className="placa-thumb-wrap placa-gallery-card"
        style={{
          ...styles.thumbWrap,
          boxShadow: isHovered
            ? '0 16px 28px rgba(14,165,233,0.24)'
            : '0 6px 14px rgba(56,189,248,0.16)',
          borderColor: isHovered ? '#38bdf8' : '#dbeafe',
        }}
        onClick={() => setSelectedPlaca(placa)}
        onMouseEnter={() => setHoveredId(placa.id)}
        onMouseLeave={() => setHoveredId(null)}
        title="Ver en grande"
        aria-label={`Abrir placa${placa.aumento ? ` con aumento ${placa.aumento}` : ''}`}
      >
        <div style={styles.thumbSquare}>
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
            <span style={styles.thumbOverlayContent}><Eye size={21} /><span>Abrir</span></span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={styles.page}>
      {/* ─── BANNER FLOTANTE SUPERIOR DE VISTA PREVIA ─── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: isPublished ? 'linear-gradient(90deg, #065f46 0%, #047857 100%)' : 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        padding: '10px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '2px solid rgba(255,255,255,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: isPublished ? '#10b981' : '#38bdf8',
            color: isPublished ? '#ffffff' : '#0f172a',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            <Eye size={13} />
            <span>{isPublished ? 'Versión Publicada' : 'Vista Previa en Vivo'}</span>
          </div>

          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>
            Editando: <em>{versionName}</em>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBackToEditor}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 850,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <ArrowLeft size={15} strokeWidth={2.5} />
            <span>Volver a Editar Versión</span>
          </button>
        </div>
      </div>

      <Header />

      <main style={styles.main}>
        <BackButton onClick={onBackToEditor} />

        {selection.kind === 'subtema' ? (
          /* ─── DISEÑO 100% IDÉNTICO AL OFICIAL DE PLACAS_SUBTEMA ─── */
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.galleryIcon}><Images size={25} /></div>
              <div style={styles.sectionTitleWrap}>
                <span style={styles.breadcrumb}>{selection.parentLabel} · Galería histológica</span>
                <h1 style={styles.title}>
                  {selection.label}
                </h1>
                {!loadingData && placas.length > 0 && (
                  <span style={styles.countBadge}>
                    {placas.length} {placas.length === 1 ? 'placa' : 'placas'}
                  </span>
                )}
              </div>
            </div>

            {/* Bloques de contenido editorial del borrador */}
            {blocks.length > 0 && (
              <div className="public-editor-content public-editor-content-before-system" style={{ marginBottom: '28px' }}>
                <ContentBlockRenderer blocks={blocks} />
              </div>
            )}

            {/* Galería Oficial por Aumento */}
            {loadingData ? (
              <div style={styles.spinnerWrap}>
                <div style={styles.spinner} />
              </div>
            ) : placas.length > 0 ? (
              <div style={styles.gridSectionsWrap}>
                {interactivePlacas.length > 0 && (
                  <section style={styles.gridSection}>
                    <div style={styles.gridSectionHeader}>
                      <h2 style={styles.gridSectionTitle}>Placas interactivas</h2>
                      <span style={styles.gridSectionCount}>{interactivePlacas.length}</span>
                    </div>
                    <div className="placas-gallery-grid placas-gallery-grid--subtema">
                      {interactivePlacas.map((placa, index) => renderPlacaCard(placa, `interactive-${index}`))}
                    </div>
                  </section>
                )}

                {placasByAumento.map((group) => (
                  <section key={group.key} style={styles.gridSection}>
                    <div style={styles.gridSectionHeader}>
                      <h2 style={styles.gridSectionTitle}>{group.title}</h2>
                      <span style={styles.gridSectionCount}>{group.items.length}</span>
                    </div>
                    <div className="placas-gallery-grid placas-gallery-grid--subtema">
                      {group.items.map((placa, index) => renderPlacaCard(placa, `${group.key}-${index}`))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No hay placas registradas para este subtema.
              </div>
            )}
          </section>
        ) : (
          /* ─── DISEÑO PARA TEMAS O TEMARIO ─── */
          <div>
            <div style={{ margin: '16px 0 28px' }}>
              <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {selection.label}
              </h1>
            </div>

            {blocks.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <ContentBlockRenderer blocks={blocks} />
              </div>
            )}

            {selection.kind === 'tema' && (
              <section style={{ marginTop: '30px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 850, color: '#0f172a', marginBottom: '16px' }}>
                  Subtemas incluidos en {selection.label}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {subtemas.map(st => (
                    <div key={st.id} style={{
                      padding: '20px',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{st.nombre}</h3>
                      {st.descripcion && <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>{st.descripcion}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selection.kind === 'temario' && (
              <section style={{ marginTop: '30px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 850, color: '#0f172a', marginBottom: '16px' }}>
                  Temas del Programa Académico
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {temas.map(t => (
                    <div key={t.id} style={{
                      padding: '18px',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                    }}>
                      <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 800 }}>{t.parcial || 'General'}</span>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>{t.nombre}</h3>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* Modal oficial interactivo para ver la placa con navegación completa */}
      {selectedPlaca && (
        <ImageViewerModal
          src={selectedPlaca.photo_url}
          onClose={() => setSelectedPlaca(null)}
          placaId={selectedPlaca.id}
          temaNombre={selection.kind === 'subtema' ? selection.parentLabel : selection.label}
          subtemaNombre={selection.label}
          aumento={selectedPlaca.aumento}
          tincion={selectedPlaca.tincion}
          comentario={selectedPlaca.comentario}
          senalados={selectedPlaca.senalados}
          senaladosMeta={selectedPlaca.senalados_meta}
          onPreviousPlate={selectedPlacaIndex > 0 ? () => navigateToPlate(selectedPlacaIndex - 1) : undefined}
          onNextPlate={selectedPlacaIndex < placas.length - 1 ? () => navigateToPlate(selectedPlacaIndex + 1) : undefined}
          platePosition={selectedPlacaIndex >= 0 ? selectedPlacaIndex + 1 : undefined}
          plateCount={placas.length > 0 ? placas.length : undefined}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #f0f7fc 0%, #e2eef7 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    flex: 1,
    padding: 'clamp(16px, 3vw, 40px) clamp(14px, 3.5vw, 48px)',
    maxWidth: '1440px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    background: 'rgba(255,255,255,.74)',
    padding: 'clamp(18px, 3vw, 30px)',
    boxShadow: '0 18px 46px rgba(23,65,101,.08)',
    border: '1px solid rgba(195,216,232,.88)',
    borderRadius: '26px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
    paddingBottom: '16px',
    borderBottom: '1px solid #dce7ef',
  },
  galleryIcon: {
    width: '50px', height: '50px', borderRadius: '16px', display: 'grid', placeItems: 'center', flexShrink: 0,
    color: '#fff', background: 'linear-gradient(145deg, #2386bb, #225d8f)', boxShadow: '0 10px 22px rgba(34,93,143,.22)',
  },
  sectionTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  breadcrumb: { width: '100%', color: '#64829b', fontSize: '.72rem', fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' },
  title: {
    margin: 0,
    fontSize: 'clamp(1.3em, 3vw, 2em)',
    fontWeight: 800,
    color: '#123b66',
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
  gridSectionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  gridSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: 'clamp(12px, 2vw, 18px)',
    borderRadius: '19px',
    border: '1px solid #dce7ef',
    background: 'rgba(248,252,255,.82)',
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
    color: '#315b82',
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
    display: 'block',
    borderRadius: '14px',
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#f1f5f9',
    border: '1.5px solid #dbeafe',
    boxShadow: '0 6px 14px rgba(56,189,248,0.16)',
    outline: 'none',
    padding: 0,
    transition: 'box-shadow 0.28s ease, border-color 0.28s ease',
  },
  thumbSquare: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    overflow: 'hidden',
  },
  thumbImg: {
    position: 'absolute',
    inset: 0,
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
    transition: 'opacity 0.2s ease',
    backdropFilter: 'blur(2.5px)',
  },
  thumbOverlayContent: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '999px',
    background: 'rgba(15,59,97,.84)', color: '#fff', fontSize: '.72rem', fontWeight: 850,
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

export default RealPageDraftViewer;
