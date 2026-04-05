import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MousePointerClick } from 'lucide-react';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useDraggableList } from '../hooks/useDraggableList';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import PageContentEditor from '../components/PageContentEditor';
import LoadingToast from '../components/LoadingToast';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';

interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

interface Placa {
  id: number;
  photo_url: string;
  aumento?: string | null;
  sort_order: number;
}

interface InteractiveMapPlacaRow {
  placa_id: number;
  sections: unknown[] | null;
}

interface PlacaGroupByAumento {
  key: string;
  title: string;
  sortValue: number;
  items: Placa[];
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const INTERACTIVE_LIST_KEY = 'placas_interactivas';

const parseAumentoSortValue = (aumento: string): number => {
  const normalized = aumento.trim().replace(',', '.');
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(match[0]);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
};

const normalizeAumentoLabel = (aumento: string): string => aumento.trim().replace(/\s+/g, '').toUpperCase();

const EditarPlacas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const drag = useDraggableList();

  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [placasConMapa, setPlacasConMapa] = useState<Set<number>>(new Set());

  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);

  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas, setLoadingPlacas] = useState(false);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [subtemasLoadError, setSubtemasLoadError] = useState<string | null>(null);
  const [placasLoadError, setPlacasLoadError] = useState<string | null>(null);
  const [temasReloadTick, setTemasReloadTick] = useState(0);
  const [subtemasReloadTick, setSubtemasReloadTick] = useState(0);
  const [placasReloadTick, setPlacasReloadTick] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const fetchTemas = useCallback(async (): Promise<boolean> => {
    setLoadingTemas(true);
    setTemasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      setTemas(data ?? []);
      return true;
    } catch (err) {
      console.error('Error al cargar temas en edición de placas:', err);
      setTemas([]);
      setTemasLoadError('No se pudieron cargar los temas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingTemas(false);
    }
  }, []);

  const fetchSubtemas = useCallback(async (temaId: number): Promise<boolean> => {
    setLoadingSubtemas(true);
    setSubtemasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', temaId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      setSubtemas(data ?? []);
      return true;
    } catch (err) {
      console.error('Error al cargar subtemas en edición de placas:', err);
      setSubtemas([]);
      setSubtemasLoadError('No se pudieron cargar los subtemas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingSubtemas(false);
    }
  }, []);

  const fetchPlacas = useCallback(async (subtemaId: number): Promise<boolean> => {
    setLoadingPlacas(true);
    setPlacasLoadError(null);
    try {
      const { data, error } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, sort_order')
        .eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const nextPlacas = data ?? [];
      setPlacas(nextPlacas);

      const placaIds = nextPlacas
        .map((placa) => placa.id)
        .filter((id): id is number => typeof id === 'number');

      if (placaIds.length > 0) {
        const { data: interactiveMapsData, error: interactiveMapsError } = await supabase
          .from('interactive_maps')
          .select('placa_id, sections')
          .in('placa_id', placaIds);

        if (interactiveMapsError) {
          console.error('Error al consultar mapas interactivos por placa:', interactiveMapsError);
          setPlacasConMapa(new Set());
        } else {
          const placaIdsConMapa = (interactiveMapsData ?? [])
            .filter((row: InteractiveMapPlacaRow) => Array.isArray(row.sections) && row.sections.length > 0)
            .map((row: InteractiveMapPlacaRow) => row.placa_id)
            .filter((id): id is number => typeof id === 'number');
          setPlacasConMapa(new Set(placaIdsConMapa));
        }
      } else {
        setPlacasConMapa(new Set());
      }
      return true;
    } catch (err) {
      console.error('Error al cargar placas para edición:', err);
      setPlacas([]);
      setPlacasConMapa(new Set());
      setPlacasLoadError('No se pudieron cargar las placas. Revisa tu conexión e inténtalo de nuevo.');
      return false;
    } finally {
      setLoadingPlacas(false);
    }
  }, []);

  // Cargar temas al montar
  useEffect(() => {
    void fetchTemas();
  }, [fetchTemas, temasReloadTick]);

  // Cargar subtemas cuando cambia el tema
  useEffect(() => {
    setSubtemas([]);
    setPlacas([]);
    setPlacasConMapa(new Set());
    setSelectedSubtemaId(null);
    setHasChanges(false);
    setSubtemasLoadError(null);
    setPlacasLoadError(null);
    setPlacasReloadTick(0);
    if (!selectedTemaId) return;
    void fetchSubtemas(selectedTemaId);
  }, [selectedTemaId, subtemasReloadTick, fetchSubtemas]);

  // Cargar placas cuando cambia el subtema
  useEffect(() => {
    setPlacas([]);
    setPlacasConMapa(new Set());
    setHasChanges(false);
    drag.resetDrag();
    setPlacasLoadError(null);
    if (!selectedSubtemaId) return;
    void fetchPlacas(selectedSubtemaId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubtemaId, placasReloadTick, fetchPlacas]);

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

  const handleDropForList = useCallback((e: React.DragEvent, listKey: string, items: Placa[]) => {
    const next = drag.applyDrop(e, listKey, items);
    if (!next) return;

    if (listKey === INTERACTIVE_LIST_KEY) {
      const merged = [...next, ...placasByAumento.flatMap((group) => group.items)];
      setPlacas(merged);
      setHasChanges(true);
      return;
    }

    const merged = [
      ...interactivePlacas,
      ...placasByAumento.flatMap((group) => (group.key === listKey ? next : group.items)),
    ];

    setPlacas(merged);
    setHasChanges(true);
  }, [drag, interactivePlacas, placasByAumento]);

  const handleSave = useCallback(async () => {
    if (!selectedSubtemaId) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await Promise.all(
        placas.map((placa, index) =>
          supabase.from('placas').update({ sort_order: index }).eq('id', placa.id)
        )
      );
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar orden:', err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedSubtemaId, placas]);

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const selectedTema = temas.find(t => t.id === selectedTemaId) ?? null;
  const selectedSubtema = subtemas.find(s => s.id === selectedSubtemaId) ?? null;
  const placaPositionById = useMemo(() => {
    return new Map<number, number>(placas.map((placa, index) => [placa.id, index + 1]));
  }, [placas]);

  const renderPlacaCard = (placa: Placa, listKey: string, realIndex: number) => {
    const globalPosition = placaPositionById.get(placa.id) ?? realIndex + 1;
    const hasInteractiveMap = placasConMapa.has(placa.id);
    const isBeingDragged = drag.dragId === placa.id;
    const isHovered = hoveredCard === placa.id && !drag.dragId;

    return (
      <div
        key={placa.id}
        draggable
        className="placa-thumb-wrap"
        style={{
          ...s.placaCard,
          opacity: isBeingDragged ? 0.25 : 1,
          transform: isBeingDragged
            ? 'scale(0.93) rotate(-1deg)'
            : isHovered
            ? 'translateY(-4px)'
            : 'translateY(0)',
          boxShadow: isBeingDragged
            ? 'none'
            : isHovered
            ? '0 12px 28px rgba(14,165,233,0.25)'
            : '0 2px 10px rgba(15,23,42,0.10)',
          border: isHovered
            ? '2px solid #38bdf8'
            : '1.5px solid #e0f2fe',
          cursor: isBeingDragged ? 'grabbing' : 'grab',
        }}
        onMouseEnter={() => setHoveredCard(placa.id)}
        onMouseLeave={() => setHoveredCard(null)}
        onDragStart={e => drag.onDragStart(e, placa.id, listKey)}
        onDragOver={e => drag.onDragOverCard(e, listKey, realIndex)}
        onDragEnd={drag.resetDrag}
      >
        <div style={s.cardAccent} />
        <span style={s.positionBadge}>{globalPosition}</span>

        {hasInteractiveMap && (
          <span
            style={s.interactiveMapBadge}
            title="Esta placa ya tiene mapa interactivo"
            aria-label="Esta placa ya tiene mapa interactivo"
          >
            <MousePointerClick size={14} strokeWidth={2.3} />
          </span>
        )}

        <div style={s.imgWrap}>
          <img
            src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
            alt={`Placa ${globalPosition}`}
            style={s.img}
            loading="lazy"
            draggable={false}
          />
        </div>

        <div
          style={{
            ...s.dragHandle,
            background: isHovered
              ? 'linear-gradient(135deg, #e0f2fe, #ede9fe)'
              : '#f8fafc',
            borderColor: isHovered ? '#7dd3fc' : '#e2e8f0',
          }}
        >
          <span style={s.dragHandleDots}>⠿</span>
          <span style={s.dragHandleText}>Arrastra</span>
        </div>
      </div>
    );
  };

  const renderDraggableSectionGrid = (listKey: string, items: Placa[]) => {
    const renderItems = drag.getRenderItems(listKey, items);

    return (
      <div
        className="placas-gallery-grid"
        style={{ minHeight: '100px' }}
        onDragOver={e => drag.onDragOverContainer(e, listKey)}
        onDrop={e => handleDropForList(e, listKey, items)}
      >
        {renderItems.map((ri) => {
          if (ri.type === 'placeholder') {
            return (
              <div key={ri.key} style={s.placeholder}>
                <span style={s.placeholderIcon}>⬇</span>
              </div>
            );
          }

          const { item: placa, realIndex } = ri;
          return renderPlacaCard(placa, listKey, realIndex);
        })}
      </div>
    );
  };
  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
                <BackButton onClick={handleGoBack} />

        {/* Banner modo edición */}
        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>✏️</span>
          <div>
            <strong>Modo edición — Página de placas</strong>
            <p style={s.editBannerHint}>
              Selecciona un tema y subtema, luego arrastra las placas desde el handle{' '}
              <strong>⠿ Arrastra</strong> para reordenarlas. Los cambios no se aplican hasta
              que pulses <strong>Guardar orden</strong>. Debajo encontrarás el editor de
              contenido de página.
            </p>
          </div>
        </div>

        {/* Selección de tema y subtema */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Selecciona tema y subtema</h2>
            <p style={s.cardSubtitle}>Elige el subtema cuyas placas deseas reordenar</p>
            <div style={s.divider} />
          </div>

          <div style={s.selectsRow}>
            {/* Selector de Tema */}
            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Tema</label>
              {loadingTemas ? (
                <div style={s.inlineLoading}>
                  <div style={s.spinnerSm} /> Cargando...
                </div>
              ) : (
                <select
                  style={s.select}
                  value={selectedTemaId ?? ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedTemaId(val ? Number(val) : null);
                  }}
                >
                  <option value="">— Elige un tema —</option>
                  {PARCIALES.map(({ key, label }) =>
                    temasByParcial[key].length > 0 ? (
                      <optgroup key={key} label={label}>
                        {temasByParcial[key].map(t => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </select>
              )}
            </div>

            {/* Selector de Subtema */}
            <div style={s.selectGroup}>
              <label style={s.selectLabel}>Subtema</label>
              {loadingSubtemas ? (
                <div style={s.inlineLoading}>
                  <div style={s.spinnerSm} /> Cargando...
                </div>
              ) : (
                <select
                  style={{
                    ...s.select,
                    ...(!selectedTemaId ? s.selectDisabled : {}),
                  }}
                  value={selectedSubtemaId ?? ''}
                  disabled={!selectedTemaId || subtemas.length === 0}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedSubtemaId(val ? Number(val) : null);
                  }}
                >
                  <option value="">
                    {!selectedTemaId
                      ? '— Primero elige un tema —'
                      : subtemas.length === 0
                      ? '— Sin subtemas —'
                      : '— Elige un subtema —'}
                  </option>
                  {subtemas.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {(temasLoadError || subtemasLoadError) && (
            <div style={s.loadErrorBox}>
              {temasLoadError && (
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{temasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setTemasReloadTick(tick => tick + 1)}
                    disabled={loadingTemas}
                  >
                    {loadingTemas ? 'Reintentando...' : 'Reintentar temas'}
                  </button>
                </div>
              )}

              {subtemasLoadError && selectedTemaId && (
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{subtemasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setSubtemasReloadTick(tick => tick + 1)}
                    disabled={loadingSubtemas}
                  >
                    {loadingSubtemas ? 'Reintentando...' : 'Reintentar subtemas'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid de placas */}
        {selectedSubtema && (
          <>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>
                {selectedTema?.nombre} › {selectedSubtema.nombre}
              </h2>
              <p style={s.cardSubtitle}>
                {placas.length} {placas.length === 1 ? 'placa' : 'placas'} — arrastra para reordenar
              </p>
              <div style={s.divider} />
            </div>

            {placasLoadError ? (
              <div style={s.loadErrorBox}>
                <div style={s.loadErrorRow}>
                  <span style={s.loadErrorText}>{placasLoadError}</span>
                  <button
                    type="button"
                    style={s.retryButton}
                    onClick={() => setPlacasReloadTick(tick => tick + 1)}
                    disabled={loadingPlacas}
                  >
                    {loadingPlacas ? 'Reintentando...' : 'Reintentar placas'}
                  </button>
                </div>
              </div>
            ) : loadingPlacas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p style={s.loadingText}>Cargando placas...</p>
              </div>
            ) : placas.length === 0 ? (
              <div style={s.emptyState}>
                Este subtema no tiene placas aún.
              </div>
            ) : (
              <div style={s.gallerySectionsWrap}>
                {interactivePlacas.length > 0 && (
                  <section style={s.gallerySection}>
                    <div style={s.gallerySectionHeader}>
                      <h3 style={s.gallerySectionTitle}>Placas interactivas</h3>
                      <span style={s.gallerySectionCount}>{interactivePlacas.length}</span>
                    </div>
                    {renderDraggableSectionGrid(INTERACTIVE_LIST_KEY, interactivePlacas)}
                  </section>
                )}

                {placasByAumento.map((group) => (
                  <section key={group.key} style={s.gallerySection}>
                    <div style={s.gallerySectionHeader}>
                      <h3 style={s.gallerySectionTitle}>{group.title}</h3>
                      <span style={s.gallerySectionCount}>{group.items.length}</span>
                    </div>
                    {renderDraggableSectionGrid(group.key, group.items)}
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Editor de contenido de la página */}
          <PageContentEditor
            entityType="placas_page"
            entityId={selectedSubtemaId!}
          />
          </>
        )}
      </main>

      {/* Botón flotante guardar */}
      <div style={s.fab}>
        {saveSuccess && (
          <div style={s.fabToast}>✅ Guardado correctamente</div>
        )}
        <button
          style={hasChanges && !isSaving ? s.fabBtn : s.fabBtnDisabled}
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !selectedSubtema}
          title="Guardar orden"
        >
          {isSaving
            ? '⏳ Guardando...'
            : hasChanges
            ? '💾 Guardar orden'
            : '✓ Sin cambios'}
        </button>
      </div>

      <Footer />
      <LoadingToast visible={isSaving} type="saving" message="Guardando orden" />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
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
  editBannerHint: {
    margin: '4px 0 0',
    fontSize: '0.88em',
    color: '#92400e',
    fontWeight: 400,
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: '0',
    boxShadow: 'none',
    border: 'none',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: 'clamp(1.2em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: '0.9em',
    color: '#64748b',
    margin: '0 0 14px',
    textAlign: 'center',
  },
  divider: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },
  selectsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectLabel: {
    fontSize: '0.875em',
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.03em',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '1em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  inlineLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    fontSize: '0.9em',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
  },
  spinnerSm: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '3px solid #e0f2fe',
    borderTop: '3px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  loadErrorBox: {
    marginTop: '14px',
    borderRadius: '12px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  loadErrorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  loadErrorText: {
    color: '#9f1239',
    fontSize: '0.9em',
    fontWeight: 600,
  },
  retryButton: {
    border: '1px solid #fb7185',
    background: '#ffffff',
    color: '#9f1239',
    borderRadius: '999px',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: '0.8em',
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '36px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #e2e8f0',
    fontSize: '0.95em',
  },
  gallerySectionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  gallerySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  gallerySectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    paddingBottom: '7px',
    borderBottom: '1px solid rgba(148,163,184,0.24)',
  },
  gallerySectionTitle: {
    margin: 0,
    color: '#334155',
    fontSize: '0.92em',
    fontWeight: 700,
    letterSpacing: '0.01em',
  },
  gallerySectionCount: {
    color: '#64748b',
    fontSize: '0.76em',
    fontWeight: 700,
    border: '1px solid rgba(148,163,184,0.32)',
    borderRadius: '999px',
    padding: '2px 9px',
    background: 'rgba(255,255,255,0.58)',
  },
  placeholder: {
    borderRadius: '12px',
    border: '2.5px dashed #38bdf8',
    background: 'linear-gradient(135deg, rgba(224,242,254,0.6), rgba(237,233,254,0.4))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '160px',
    boxShadow: '0 0 0 3px rgba(56,189,248,0.15)',
    aspectRatio: '1 / 1',
  },
  placeholderIcon: { fontSize: '1.5em', color: '#38bdf8' },
  placaCard: {
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1.5px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    userSelect: 'none',
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '12px 12px 0 0',
    zIndex: 1,
  },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(15,23,42,0.55)',
    color: '#ffffff',
    fontSize: '0.72em',
    fontWeight: 800,
    borderRadius: '6px',
    padding: '2px 7px',
    lineHeight: 1.5,
    zIndex: 2,
    backdropFilter: 'blur(4px)',
  },
  interactiveMapBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '28px',
    height: '28px',
    borderRadius: '10px',
    background: '#1d345f',
    color: '#f8fbff',
    border: '1px solid rgba(120,143,186,0.78)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(29,52,95,0.38)',
    backdropFilter: 'blur(4px)',
    zIndex: 2,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    background: '#e2e8f0',
    flexShrink: 0,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    pointerEvents: 'none',
  },
  dragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '7px 0',
    borderTop: '1px solid #e2e8f0',
    transition: 'background 0.15s, border-color 0.15s',
    flexShrink: 0,
  },
  dragHandleDots: { fontSize: '1.1em', color: '#94a3b8', lineHeight: 1 },
  dragHandleText: {
    fontSize: '0.7em',
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)',
    borderRadius: '12px',
    padding: '8px 16px',
    marginBottom: '24px',
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
    transition: 'background 0.15s',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },
  breadcrumbSep: {
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '0.75em',
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
  fab: {
    position: 'fixed',
    bottom: '32px',
    right: '32px',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
  },
  fabToast: {
    background: 'linear-gradient(135deg, #10b981, #34d399)',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.85em',
    padding: '8px 18px',
    borderRadius: '20px',
    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  fabBtn: {
    padding: '14px 28px',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: 'white',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: '0 6px 24px rgba(14,165,233,0.45)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  fabBtnDisabled: {
    padding: '14px 28px',
    border: 'none',
    borderRadius: '50px',
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: 'none',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#64748b', fontSize: '1em', fontWeight: 500 },
};

export default EditarPlacas;






