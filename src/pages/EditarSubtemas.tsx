import React, { useState, useEffect, useCallback } from 'react';
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
  logo_url: string;
  parcial: string;
  sort_order: number;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
  logo_url?: string;
  sort_order: number;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const LIST_KEY = 'subtemas';

const EditarSubtemas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const drag = useDraggableList();

  const [temas, setTemas] = useState<Tema[]>([]);
  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [temasLoadError, setTemasLoadError] = useState<string | null>(null);
  const [subtemasLoadError, setSubtemasLoadError] = useState<string | null>(null);
  const [temasReloadTick, setTemasReloadTick] = useState(0);
  const [subtemasReloadTick, setSubtemasReloadTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Cargar todos los temas al montar
  useEffect(() => {
    const fetchTemas = async () => {
      setLoadingTemas(true);
      setTemasLoadError(null);
      const { data: fetchedData, error } = await supabase
        .from('temas')
        .select('id, nombre, logo_url, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Error al cargar temas en editar subtemas:', error);
        setTemas([]);
        setTemasLoadError('No se pudo cargar la lista de temas. Revisa tu conexion e intenta de nuevo.');
      } else {
        setTemas(fetchedData ?? []);
      }
      setLoadingTemas(false);
    };
    fetchTemas();
  }, [temasReloadTick]);

  // Cargar subtemas del tema seleccionado
  useEffect(() => {
    if (!selectedTemaId) {
      setSubtemas([]);
      setSubtemasLoadError(null);
      return;
    }
    const fetchSubtemas = async () => {
      setLoadingSubtemas(true);
      setSubtemasLoadError(null);
      setHasChanges(false);
      drag.resetDrag();
      const { data, error } = await supabase
        .from('subtemas')
        .select('*')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Error al cargar subtemas en editar subtemas:', error);
        setSubtemas([]);
        setSubtemasLoadError('No se pudo cargar la lista de subtemas. Intenta de nuevo.');
      } else {
        setSubtemas(data ?? []);
      }
      setLoadingSubtemas(false);
    };
    fetchSubtemas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemaId, subtemasReloadTick]);

  const handleDrop = (e: React.DragEvent) => {
    const next = drag.applyDrop(e, LIST_KEY, subtemas);
    if (next) {
      setSubtemas(next);
      setHasChanges(true);
    }
  };

  const handleSave = useCallback(async () => {
    if (!selectedTemaId) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await Promise.all(
        subtemas.map((sub, index) =>
          supabase.from('subtemas').update({ sort_order: index }).eq('id', sub.id)
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
  }, [selectedTemaId, subtemas]);

  const selectedTema = temas.find(t => t.id === selectedTemaId) ?? null;

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const renderItems = drag.getRenderItems(LIST_KEY, subtemas);
  const accent = 'linear-gradient(90deg, #38bdf8, #818cf8)';
  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
                <BackButton onClick={handleGoBack} />

        {/* Banner modo edición */}
        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>✏️</span>
          <div>
            <strong>Modo edición — Página de subtemas</strong>
            <p style={s.editBannerHint}>
              Selecciona un tema y arrastra las tarjetas desde el handle{' '}
              <strong>⠿ Arrastra</strong> para cambiar el orden. Los cambios no se
              aplican hasta que pulses <strong>Guardar orden</strong>. Después
              del reordenador encontrarás el editor de contenido de página.
            </p>
          </div>
        </div>

        {/* Selector de tema */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Selecciona un tema</h2>
            <p style={s.cardSubtitle}>
              Escoge el tema cuyos subtemas deseas reordenar
            </p>
            <div style={s.divider} />
          </div>

          {temasLoadError && (
            <div style={s.errorState}>
              <p style={s.errorText}>⚠️ {temasLoadError}</p>
              <button
                type="button"
                style={s.retryButton}
                onClick={() => setTemasReloadTick(prev => prev + 1)}
              >
                Reintentar carga de temas
              </button>
            </div>
          )}

          {loadingTemas ? (
            <div style={s.loadingWrap}>
              <div style={s.spinner} />
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

        {/* Grid de subtemas */}
        {selectedTema && (
          <>
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>{selectedTema.nombre}</h2>
              <p style={s.cardSubtitle}>
                {subtemas.length}{' '}
                {subtemas.length === 1 ? 'subtema' : 'subtemas'} — arrastra
                para reordenar
              </p>
              <div style={s.divider} />
            </div>

            {subtemasLoadError && (
              <div style={s.errorState}>
                <p style={s.errorText}>⚠️ {subtemasLoadError}</p>
                <button
                  type="button"
                  style={s.retryButton}
                  onClick={() => setSubtemasReloadTick(prev => prev + 1)}
                >
                  Reintentar carga de subtemas
                </button>
              </div>
            )}

            {loadingSubtemas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p style={s.loadingText}>Cargando subtemas...</p>
              </div>
            ) : subtemasLoadError ? (
              <div style={s.emptyState}>
                No se pudieron cargar los subtemas para este tema.
              </div>
            ) : subtemas.length === 0 ? (
              <div style={s.emptyState}>
                Este tema no tiene subtemas aún.
              </div>
            ) : (
              <div
                className="temas-grid-home"
                style={{ minHeight: '80px' }}
                onDragOver={e => drag.onDragOverContainer(e, LIST_KEY)}
                onDrop={handleDrop}
              >
                {renderItems.map(ri => {
                  if (ri.type === 'placeholder') {
                    return (
                      <div key={ri.key} style={s.placeholder}>
                        <span style={s.placeholderIcon}>⬇</span>
                      </div>
                    );
                  }

                  const { item: sub, realIndex } = ri;
                  const isBeingDragged = drag.dragId === sub.id;
                  const isHovered = hoveredCard === sub.id && !drag.dragId;return (
                    <div
                      key={sub.id}
                      draggable
                      style={{
                        ...s.temaCard,
                        opacity: isBeingDragged ? 0.25 : 1,
                        transform: isBeingDragged
                          ? 'scale(0.93) rotate(-1deg)'
                          : isHovered
                          ? 'translateY(-5px)'
                          : 'translateY(0)',
                        boxShadow: isBeingDragged
                          ? 'none'
                          : isHovered
                          ? '0 12px 30px rgba(14,165,233,0.22)'
                          : '0 2px 10px rgba(15,23,42,0.08)',
                        border: isHovered
                          ? '1.5px solid #7dd3fc'
                          : '1px solid #e0f2fe',
                        cursor: isBeingDragged ? 'grabbing' : 'grab',
                      }}
                      onMouseEnter={() => setHoveredCard(sub.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      onDragStart={e => drag.onDragStart(e, sub.id, LIST_KEY)}
                      onDragOver={e => drag.onDragOverCard(e, LIST_KEY, realIndex)}
                      onDragEnd={drag.resetDrag}
                    >
                      <div style={{ ...s.cardAccent, background: accent }} />
                      <span style={s.positionBadge}>{realIndex + 1}</span>
                      <div style={s.imgWrap} className="tema-card-img-wrap">
                        {sub.logo_url ? (
                          <img
                            src={getCloudinaryImageUrl(sub.logo_url, 'thumb')}
                            alt={sub.nombre}
                            style={s.img}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span style={s.imgFallback}>📄</span>
                        )}
                      </div>
                      <h4 className="tema-card-label" style={s.cardName}>
                        {sub.nombre}
                      </h4>
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
                })}
              </div>
            )}
          </div>

          {/* Editor de contenido de la página */}
          <PageContentEditor
            entityType="subtemas_page"
            entityId={selectedTemaId!}
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
          disabled={!hasChanges || isSaving || !selectedTema}
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
  editBannerHint: {
    margin: '4px 0 0',
    fontSize: '0.88em',
    color: '#92400e',
    fontWeight: 400,
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
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
    fontSize: 'clamp(1.4em, 3vw, 2.2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
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
  placeholder: {
    borderRadius: '14px',
    border: '2.5px dashed #38bdf8',
    background: 'linear-gradient(135deg, rgba(224,242,254,0.6), rgba(237,233,254,0.4))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '140px',
    boxShadow: '0 0 0 3px rgba(56,189,248,0.15)',
  },
  placeholderIcon: { fontSize: '1.5em', color: '#38bdf8' },
  temaCard: {
    borderRadius: '14px',
    padding: 'clamp(8px, 1.5vw, 14px)',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    userSelect: 'none',
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '3px',
    borderRadius: '14px 14px 0 0',
  },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(15,23,42,0.08)',
    color: '#475569',
    fontSize: '0.7em',
    fontWeight: 800,
    borderRadius: '6px',
    padding: '2px 6px',
    lineHeight: 1.4,
  },
  imgWrap: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    flexShrink: 0,
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' },
  imgFallback: { fontSize: 'clamp(1.4em, 3vw, 2em)' },
  cardName: {
    margin: 0,
    color: '#0f172a',
    fontWeight: 700,
    lineHeight: 1.3,
    textAlign: 'center',
  },
  dragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    width: 'calc(100% + clamp(16px, 3vw, 28px))',
    marginLeft: 'calc(-1 * clamp(8px, 1.5vw, 14px))',
    marginRight: 'calc(-1 * clamp(8px, 1.5vw, 14px))',
    marginBottom: 'calc(-1 * clamp(8px, 1.5vw, 14px))',
    padding: '7px 0',
    borderTop: '1px solid #e2e8f0',
    borderRadius: '0 0 14px 14px',
    transition: 'background 0.15s, border-color 0.15s',
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
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #fdba74',
    background: '#fff7ed',
    textAlign: 'center',
  },
  errorText: {
    margin: 0,
    color: '#9a3412',
    fontWeight: 600,
    fontSize: '0.9em',
  },
  retryButton: {
    border: '1px solid #fdba74',
    background: '#ffffff',
    color: '#9a3412',
    borderRadius: '8px',
    padding: '6px 10px',
    fontWeight: 700,
    fontSize: '0.82em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default EditarSubtemas;






