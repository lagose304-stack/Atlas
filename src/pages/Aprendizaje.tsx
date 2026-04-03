import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import InteractiveMapViewerModal, { type InteractiveMapViewerSection } from '../components/InteractiveMapViewerModal.tsx';

interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
}

interface SubtemaRow {
  id: number;
  nombre: string;
}

interface PlacaRow {
  id: number;
  photo_url: string;
  sort_order: number;
}

interface InteractiveMapRawSection {
  title?: string | null;
  color?: string | null;
  description?: string | null;
  points?: unknown;
  sort_order?: number | null;
  coordinate_space?: string | null;
}

interface InteractiveMapRow {
  id: number;
  map_number: number;
  tema_id: number;
  subtema_id: number | null;
  placa_id: number;
  sections: InteractiveMapRawSection[] | null;
}

interface MapCard {
  id: number;
  mapNumber: number;
  subtemaNombre: string;
  placaThumbUrl: string;
  placaViewUrl: string;
  placaSortOrder: number | null;
  sections: InteractiveMapViewerSection[];
}

const PARCIALES: { key: 'primer' | 'segundo' | 'tercer'; label: string; num: string }[] = [
  { key: 'primer', label: 'PRIMER PARCIAL', num: '1' },
  { key: 'segundo', label: 'SEGUNDO PARCIAL', num: '2' },
  { key: 'tercer', label: 'TERCER PARCIAL', num: '3' },
];

const INTERACTIVE_MAP_COORDINATE_SPACE = 'image_uv_v1';
const NORMALIZED_COORD_EPSILON = 0.0005;

const sanitizeHexColor = (value: string | null | undefined): string => {
  if (typeof value !== 'string') return '#0ea5e9';
  const color = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
  return '#0ea5e9';
};

const normalizeSectionPoints = (rawPoints: unknown): number[] => {
  if (!Array.isArray(rawPoints)) return [];
  const clean = rawPoints.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (clean.length < 6 || clean.length % 2 !== 0) return [];
  return clean;
};

const isNormalizedCoordinateValue = (value: number): boolean => {
  return value >= -NORMALIZED_COORD_EPSILON && value <= 1 + NORMALIZED_COORD_EPSILON;
};

const areLikelyNormalizedFlatPoints = (points: number[]): boolean => {
  if (points.length < 6 || points.length % 2 !== 0) return false;
  return points.every((point) => isNormalizedCoordinateValue(point));
};

const normalizeSectionsForViewer = (sectionsRaw: InteractiveMapRawSection[] | null | undefined): InteractiveMapViewerSection[] => {
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) return [];

  const sections: InteractiveMapViewerSection[] = [];

  sectionsRaw.forEach((section, index) => {
    const points = normalizeSectionPoints(section?.points);
    if (points.length < 6) return;

    const title = typeof section?.title === 'string' && section.title.trim().length > 0
      ? section.title.trim()
      : `Zona ${index + 1}`;
    const description = typeof section?.description === 'string' ? section.description.trim() : '';
    const color = sanitizeHexColor(section?.color);
    const sortOrder = typeof section?.sort_order === 'number' ? section.sort_order : index;
    const declaredCoordinateSpace = typeof section?.coordinate_space === 'string'
      ? section.coordinate_space
      : undefined;
    const coordinateSpace =
      declaredCoordinateSpace ?? (areLikelyNormalizedFlatPoints(points) ? INTERACTIVE_MAP_COORDINATE_SPACE : undefined);

    const normalizedSection: InteractiveMapViewerSection = {
      title,
      description,
      color,
      points,
      sortOrder,
      ...(coordinateSpace ? { coordinateSpace } : {}),
    };

    sections.push(normalizedSection);
  });

  sections.sort((a, b) => a.sortOrder - b.sortOrder);
  return sections;
};

const TemaCard: React.FC<{ tema: Tema; onClick: () => void }> = ({ tema, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoSrc, setLogoSrc] = useState(() =>
    tema.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'cardWide') : ''
  );
  const [logoSrcSet, setLogoSrcSet] = useState(() =>
    tema.logo_url
      ? `${getCloudinaryImageUrl(tema.logo_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(tema.logo_url, 'cardWide')} 960w`
      : undefined
  );

  useEffect(() => {
    setLogoFailed(false);
    setLogoSrc(tema.logo_url ? getCloudinaryImageUrl(tema.logo_url, 'cardWide') : '');
    setLogoSrcSet(
      tema.logo_url
        ? `${getCloudinaryImageUrl(tema.logo_url, 'cardWideSmall')} 640w, ${getCloudinaryImageUrl(tema.logo_url, 'cardWide')} 960w`
        : undefined
    );
  }, [tema.logo_url]);

  return (
    <div
      style={{
        borderRadius: '12px',
        background: '#ffffff',
        boxShadow: hovered
          ? '0 12px 22px rgba(23, 50, 82, 0.18)'
          : '0 6px 14px rgba(23, 50, 82, 0.1)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, filter 0.2s ease',
        border: hovered ? '1px solid rgba(97, 143, 202, 0.56)' : '1px solid rgba(199, 215, 232, 0.92)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'center',
        width: '100%',
        minHeight: '134px',
        maxHeight: '134px',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        filter: hovered ? 'saturate(1.02)' : 'none',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: '94px',
          width: '100%',
          overflow: 'hidden',
          borderBottom: '1px solid rgba(201, 217, 233, 0.92)',
          background: '#e8f1fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {tema.logo_url && !logoFailed ? (
          <img
            src={logoSrc}
            srcSet={logoSrcSet}
            sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 420px"
            alt={tema.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (logoSrc !== tema.logo_url) {
                setLogoSrc(tema.logo_url);
                setLogoSrcSet(undefined);
                return;
              }
              setLogoFailed(true);
            }}
          />
        ) : (
          <span style={{ fontSize: '1.1em', color: '#1e3a5f' }}>Microscopio</span>
        )}
      </div>

      <h4
        className="temario-card-title atlas-typo-card"
        style={{
          margin: '0',
          minHeight: '32px',
          maxHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 10px',
          background: 'linear-gradient(180deg, #f7fbff 0%, #f1f6fb 100%)',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.1,
          }}
        >
          {tema.nombre}
        </span>
      </h4>
    </div>
  );
};

const Aprendizaje: React.FC = () => {
  const [temas, setTemas] = useState<Tema[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [temasError, setTemasError] = useState<string | null>(null);

  const [selectedTema, setSelectedTema] = useState<Tema | null>(null);
  const [mapsForTema, setMapsForTema] = useState<MapCard[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [hoveredMapId, setHoveredMapId] = useState<number | null>(null);
  const [activeMap, setActiveMap] = useState<MapCard | null>(null);
  const [temaLogoFailed, setTemaLogoFailed] = useState(false);
  const [temaLogoSrc, setTemaLogoSrc] = useState('');

  const fetchTemas = async () => {
    setLoadingTemas(true);
    setTemasError(null);

    const { data, error } = await supabase
      .from('temas')
      .select('id, nombre, logo_url, parcial')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error cargando temas para aprendizaje:', error);
      setTemas([]);
      setTemasError('No se pudo cargar el listado de temas en este momento.');
      setLoadingTemas(false);
      return;
    }

    setTemas((data ?? []) as Tema[]);
    setLoadingTemas(false);
  };

  const fetchMapsByTema = async (tema: Tema) => {
    setLoadingMaps(true);
    setMapsError(null);

    try {
      const { data: mapsData, error: mapsErrorResult } = await supabase
        .from('interactive_maps')
        .select('id, map_number, tema_id, subtema_id, placa_id, sections')
        .eq('tema_id', tema.id)
        .order('map_number', { ascending: true });

      if (mapsErrorResult) throw mapsErrorResult;

      const maps = (mapsData ?? []) as InteractiveMapRow[];
      if (maps.length === 0) {
        setMapsForTema([]);
        setLoadingMaps(false);
        return;
      }

      const subtemaIds = Array.from(new Set(maps.map((map) => map.subtema_id).filter((id): id is number => typeof id === 'number')));
      const placaIds = Array.from(new Set(maps.map((map) => map.placa_id).filter((id) => typeof id === 'number')));

      const [subtemasResponse, placasResponse] = await Promise.all([
        subtemaIds.length > 0
          ? supabase.from('subtemas').select('id, nombre').in('id', subtemaIds)
          : Promise.resolve({ data: [], error: null }),
        placaIds.length > 0
          ? supabase.from('placas').select('id, photo_url, sort_order').in('id', placaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (subtemasResponse.error) throw subtemasResponse.error;
      if (placasResponse.error) throw placasResponse.error;

      const subtemasById = new Map<number, SubtemaRow>((subtemasResponse.data ?? []).map((subtema: any) => [subtema.id, subtema]));
      const placasById = new Map<number, PlacaRow>((placasResponse.data ?? []).map((placa: any) => [placa.id, placa]));

      const mapCards: MapCard[] = maps
        .map((map) => {
          const placa = placasById.get(map.placa_id);
          if (!placa?.photo_url) return null;

          return {
            id: map.id,
            mapNumber: map.map_number,
            subtemaNombre: map.subtema_id ? (subtemasById.get(map.subtema_id)?.nombre ?? 'Sin subtema') : 'Sin subtema',
            placaThumbUrl: getCloudinaryImageUrl(placa.photo_url, 'thumb'),
            placaViewUrl: getCloudinaryImageUrl(placa.photo_url, 'view'),
            placaSortOrder: typeof placa.sort_order === 'number' ? placa.sort_order : null,
            sections: normalizeSectionsForViewer(map.sections),
          };
        })
        .filter((map): map is MapCard => map !== null)
        .sort((a, b) => a.mapNumber - b.mapNumber);

      setMapsForTema(mapCards);
    } catch (error) {
      console.error('Error cargando mapas por tema:', error);
      setMapsForTema([]);
      setMapsError('No se pudieron cargar los mapas interactivos de este tema.');
    } finally {
      setLoadingMaps(false);
    }
  };

  useEffect(() => {
    void fetchTemas();
  }, []);

  useEffect(() => {
    if (!selectedTema) {
      setMapsForTema([]);
      setMapsError(null);
      setTemaLogoFailed(false);
      setTemaLogoSrc('');
      return;
    }

    setTemaLogoFailed(false);
    setTemaLogoSrc(selectedTema.logo_url ? getCloudinaryImageUrl(selectedTema.logo_url, 'thumb') : '');
    void fetchMapsByTema(selectedTema);
  }, [selectedTema]);

  const temasByParcial = useMemo(() => {
    const map: Record<'primer' | 'segundo' | 'tercer', Tema[]> = {
      primer: [],
      segundo: [],
      tercer: [],
    };

    temas.forEach((tema) => {
      if (tema.parcial === 'primer' || tema.parcial === 'segundo' || tema.parcial === 'tercer') {
        map[tema.parcial].push(tema);
      }
    });

    return map;
  }, [temas]);

  return (
    <div className="atlas-temario-typography" style={s.container}>
      <Header />

      <main style={s.main}>
        {selectedTema ? (
          <section style={s.card}>
            <BackButton onClick={() => setSelectedTema(null)} />

            <div style={s.temaHeader}>
              {selectedTema.logo_url && !temaLogoFailed && (
                <div style={s.temaLogoWrap}>
                  <img
                    src={temaLogoSrc}
                    alt={selectedTema.nombre}
                    style={s.temaLogo}
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      if (selectedTema.logo_url && temaLogoSrc !== selectedTema.logo_url) {
                        setTemaLogoSrc(selectedTema.logo_url);
                        return;
                      }
                      setTemaLogoFailed(true);
                    }}
                  />
                </div>
              )}
              <div style={s.temaInfo}>
                <span style={s.parcialBadge}>
                  {selectedTema.parcial ? `${selectedTema.parcial.charAt(0).toUpperCase() + selectedTema.parcial.slice(1)} parcial` : ''}
                </span>
                <h1 className="atlas-typo-title" style={s.temaTitle}>{selectedTema.nombre}</h1>
              </div>
            </div>

            <div style={s.divider} />

            <h2 className="atlas-typo-section-title" style={s.subtemasHeading}>Mapas interactivos</h2>

            {loadingMaps ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p className="atlas-typo-body" style={s.loadingText}>Cargando mapas...</p>
              </div>
            ) : mapsError ? (
              <div style={s.errorState}>
                <span style={s.errorIcon}>⚠️</span>
                <p className="atlas-typo-section-title" style={s.errorTitle}>No se pudo cargar el contenido</p>
                <p className="atlas-typo-body" style={s.errorText}>{mapsError}</p>
                <button
                  type="button"
                  style={s.retryButton}
                  onClick={() => {
                    if (!selectedTema) return;
                    void fetchMapsByTema(selectedTema);
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : mapsForTema.length === 0 ? (
              <div style={s.emptyState}>
                <p className="atlas-typo-body" style={s.emptyText}>Aun no hay mapas interactivos registrados para este tema.</p>
              </div>
            ) : (
              <div className="subtemas-grid-page">
                {mapsForTema.map((mapCard) => (
                  <div
                    key={mapCard.id}
                    style={{
                      ...s.subtemaCard,
                      ...(hoveredMapId === mapCard.id ? s.subtemaCardHover : {}),
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredMapId(mapCard.id)}
                    onMouseLeave={() => setHoveredMapId(null)}
                    onClick={() => setActiveMap(mapCard)}
                  >
                    <div style={s.subtemaAccent} />
                    <div className="subtema-card-img-wrap" style={s.subtemaLogoWrap}>
                      <img
                        src={mapCard.placaThumbUrl}
                        alt={`Mapa ${mapCard.mapNumber}`}
                        style={s.subtemaLogo}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <h3 className="subtema-card-label atlas-typo-card" style={s.subtemaTitle}>
                      Mapa {mapCard.mapNumber}
                    </h3>
                    <p className="atlas-typo-body" style={s.subtemaDesc}>{mapCard.subtemaNombre}</p>
                    <p className="atlas-typo-body" style={s.mapMetaLine}>
                      {mapCard.sections.length} {mapCard.sections.length === 1 ? 'seleccion' : 'selecciones'}
                      {mapCard.placaSortOrder && mapCard.placaSortOrder > 0 ? ` · Placa ${mapCard.placaSortOrder}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="temario-main-block" style={s.temarioCard}>
            <div style={s.panelTexture} />

            <div className="temario-main-header" style={s.sectionHeader}>
              <h2 className="temario-title-text atlas-typo-title" style={s.temarioHeading}>APRENDIZAJE</h2>
              <p className="temario-subtitle-text atlas-typo-subtitle" style={s.temarioSubtitle}>
                Selecciona un tema para explorar sus mapas interactivos.
              </p>
            </div>

            {loadingTemas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p className="atlas-typo-body" style={s.loadingText}>Cargando temas...</p>
              </div>
            ) : temasError ? (
              <div style={s.errorState}>
                <span style={s.errorIcon}>⚠️</span>
                <p className="atlas-typo-section-title" style={s.errorTitle}>No se pudo cargar el aprendizaje</p>
                <p className="atlas-typo-body" style={s.errorText}>{temasError}</p>
                <button
                  type="button"
                  style={s.retryButton}
                  onClick={() => {
                    void fetchTemas();
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div style={s.temarioSectionsContainer}>
                {PARCIALES.map(({ key, label, num }) => {
                  const temasParcial = temasByParcial[key];
                  return (
                    <div className="temario-main-section" key={key} style={s.temarioSection}>
                      <div style={s.parcialHeaderRow}>
                        <span style={s.parcialIconWrap}>
                          <span style={s.parcialIconEmoji}>🔬</span>
                        </span>
                        <h3 className="temario-partial-title atlas-typo-section-title" style={s.parcialTitle}>{label} {num}</h3>
                      </div>

                      {temasParcial.length > 0 ? (
                        <div className="temario-grid-public" style={s.temasGrid}>
                          {temasParcial.map((tema) => (
                            <TemaCard
                              key={tema.id}
                              tema={tema}
                              onClick={() => setSelectedTema(tema)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={s.emptyState}>
                          <span style={s.emptyIcon}>📋</span>
                          <p className="atlas-typo-body" style={s.noTemasMessage}>Aun no hay temas asignados a este parcial.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />

      {activeMap && selectedTema && (
        <InteractiveMapViewerModal
          mapLabel={`Mapa ${activeMap.mapNumber}`}
          imageUrl={activeMap.placaViewUrl}
          temaNombre={selectedTema.nombre}
          subtemaNombre={activeMap.subtemaNombre}
          sections={activeMap.sections}
          onClose={() => setActiveMap(null)}
        />
      )}
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    boxSizing: 'border-box',
  },
  main: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 0,
    padding: 0,
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '1280px',
    background: 'transparent',
    borderRadius: '18px',
    padding: 'clamp(8px, 1.2vw, 14px)',
    boxShadow: 'none',
    border: 'none',
    boxSizing: 'border-box',
  },
  temarioCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '1280px',
    background: 'transparent',
    borderRadius: 0,
    padding: 'clamp(8px, 1.2vw, 14px)',
    boxShadow: 'none',
    border: 'none',
    borderTop: 'none',
    marginTop: 0,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginBottom: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  panelTexture: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
    pointerEvents: 'none',
  },
  sectionHeader: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: 'clamp(14px, 2vw, 20px)',
  },
  temarioHeading: {
    margin: 0,
    textAlign: 'center',
  },
  temarioSubtitle: {
    margin: '2px 0 0',
    textAlign: 'center',
  },
  temarioSectionsContainer: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(18px, 2.4vw, 26px)',
  },
  temarioSection: {
    width: '100%',
    borderRadius: '18px',
    padding: 'clamp(8px, 1vw, 14px) clamp(4px, 1vw, 8px)',
    background: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
  },
  parcialHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingLeft: '2px',
  },
  parcialIconWrap: {
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcialIconEmoji: {
    fontSize: '18px',
    lineHeight: 1,
    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  },
  parcialTitle: {
    margin: 0,
  },
  temasGrid: {
    display: 'grid',
    width: '100%',
    gap: '14px 16px',
    alignItems: 'start',
  },
  temaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(12px, 3vw, 28px)',
    flexWrap: 'wrap',
  },
  temaLogoWrap: {
    flexShrink: 0,
    width: 'clamp(70px, 12vw, 120px)',
    height: 'clamp(70px, 12vw, 120px)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(15,23,42,0.12)',
    border: '2px solid #e0f2fe',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  temaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
  },
  temaInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  parcialBadge: {
    display: 'inline-block',
    padding: '5px 14px',
    borderRadius: '50px',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    color: '#075985',
    fontSize: '0.82em',
    fontWeight: 700,
    border: '1px solid #7dd3fc',
    letterSpacing: '0.4px',
    width: 'fit-content',
  },
  temaTitle: {
    margin: 0,
  },
  divider: {
    width: '100%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)',
    margin: 'clamp(16px, 3vw, 28px) 0',
  },
  subtemasHeading: {
    marginBottom: 'clamp(12px, 3vw, 24px)',
    marginTop: 0,
  },
  subtemaCard: {
    borderRadius: 'clamp(10px, 1.6vw, 16px)',
    padding: 'clamp(10px, 2vw, 18px)',
    background: 'linear-gradient(150deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.9) 100%)',
    boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
    border: '1px solid rgba(186,230,253,0.8)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  subtemaCardHover: {
    transform: 'translateY(-8px)',
    boxShadow: '0 18px 34px rgba(14,165,233,0.22)',
    border: '1px solid #38bdf8',
  },
  subtemaAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '14px 14px 0 0',
  },
  subtemaLogoWrap: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
  },
  subtemaLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
  },
  subtemaTitle: {
    lineHeight: 1.3,
    margin: 0,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    width: '100%',
  },
  subtemaDesc: {
    lineHeight: 1.5,
    margin: 0,
  },
  mapMetaLine: {
    margin: 0,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyState: {
    width: '100%',
    padding: 'clamp(20px, 5vw, 48px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    borderRadius: '12px',
    border: '1px dashed #cbd5e1',
  },
  emptyIcon: {
    fontSize: '1.6em',
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noTemasMessage: {
    fontStyle: 'italic',
    textAlign: 'center',
    margin: 0,
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '60px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #d8e8f7',
    borderTop: '4px solid #5a97d3',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontStyle: 'italic',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: 'clamp(24px, 4vw, 42px)',
    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
    borderRadius: '12px',
    border: '1px solid #fdba74',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '1.8em',
    lineHeight: 1,
  },
  errorTitle: {
    margin: 0,
    color: '#9a3412',
  },
  errorText: {
    margin: 0,
    color: '#7c2d12',
    maxWidth: '640px',
  },
  retryButton: {
    border: '1px solid #fdba74',
    background: '#fff',
    color: '#9a3412',
    borderRadius: '8px',
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default Aprendizaje;
