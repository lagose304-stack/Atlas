import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { useDraggableList } from '../hooks/useDraggableList';
import LoadingToast from './LoadingToast';
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
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

interface SubtemasOrderManagerProps {
  title: string;
  subtitle: string;
}

const LIST_KEY = 'subtemas';

const SubtemasOrderManager: React.FC<SubtemasOrderManagerProps> = ({ title, subtitle }) => {
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
        console.error('Error al cargar temas en ordenar subtemas:', error);
        setTemas([]);
        setTemasLoadError('No se pudo cargar la lista de temas. Revisa tu conexion e intenta de nuevo.');
      } else {
        setTemas(fetchedData ?? []);
      }

      setLoadingTemas(false);
    };

    void fetchTemas();
  }, [temasReloadTick]);

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
        .select('id, nombre, tema_id, logo_url, sort_order')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error al cargar subtemas en ordenar subtemas:', error);
        setSubtemas([]);
        setSubtemasLoadError('No se pudo cargar la lista de subtemas. Intenta de nuevo.');
      } else {
        setSubtemas(data ?? []);
      }

      setLoadingSubtemas(false);
    };

    void fetchSubtemas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemaId, subtemasReloadTick]);

  const selectedTema = useMemo(() => temas.find(t => t.id === selectedTemaId) ?? null, [selectedTemaId, temas]);

  const temasByParcial = useMemo<Record<ParcialKey, Tema[]>>(() => {
    const grouped: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
    temas.forEach(tema => {
      if (grouped[tema.parcial as ParcialKey]) grouped[tema.parcial as ParcialKey].push(tema);
    });
    return grouped;
  }, [temas]);

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
        subtemas.map((subtema, index) =>
          supabase.from('subtemas').update({ sort_order: index }).eq('id', subtema.id)
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

  const renderItems = drag.getRenderItems(LIST_KEY, subtemas);
  const accent = 'linear-gradient(90deg, #38bdf8, #818cf8)';

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <h2 style={s.cardTitle}>{title}</h2>
        <p style={s.cardSubtitle}>{subtitle}</p>
        <div style={s.divider} />
      </div>

      <div style={s.innerCard}>
        <div style={s.cardHeader}>
          <h3 style={{ ...s.cardTitle, fontSize: '1.35em' }}>Selecciona un tema</h3>
          <p style={s.cardSubtitle}>Escoge el tema cuyos subtemas deseas reordenar</p>
        </div>

        {temasLoadError && (
          <div style={s.errorState}>
            <p style={s.errorText}>⚠️ {temasLoadError}</p>
            <button type="button" style={s.retryButton} onClick={() => setTemasReloadTick(prev => prev + 1)}>
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
            <option value="">Elige un tema</option>
            {PARCIALES.map(({ key, label }) =>
              temasByParcial[key].length > 0 ? (
                <optgroup key={key} label={label}>
                  {temasByParcial[key].map(tema => (
                    <option key={tema.id} value={tema.id}>
                      {tema.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null
            )}
          </select>
        )}
      </div>

      {selectedTema && (
        <div style={s.innerCard}>
          <div style={s.cardHeader}>
            <h3 style={{ ...s.cardTitle, fontSize: '1.35em' }}>{selectedTema.nombre}</h3>
            <p style={s.cardSubtitle}>
              {subtemas.length} {subtemas.length === 1 ? 'subtema' : 'subtemas'} - arrastra para reordenar
            </p>
            <div style={s.divider} />
          </div>

          {subtemasLoadError && (
            <div style={s.errorState}>
              <p style={s.errorText}>⚠️ {subtemasLoadError}</p>
              <button type="button" style={s.retryButton} onClick={() => setSubtemasReloadTick(prev => prev + 1)}>
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
            <div style={s.emptyState}>No se pudieron cargar los subtemas para este tema.</div>
          ) : subtemas.length === 0 ? (
            <div style={s.emptyState}>Este tema no tiene subtemas aun.</div>
          ) : (
            <div
              className="temas-grid-home"
              style={{ minHeight: '80px' }}
              onDragOver={e => drag.onDragOverContainer(e, LIST_KEY)}
              onDrop={handleDrop}
            >
              {renderItems.map(item => {
                if (item.type === 'placeholder') {
                  return (
                    <div key={item.key} style={s.placeholder}>
                      <span style={s.placeholderIcon}>+</span>
                    </div>
                  );
                }

                const { item: subtema, realIndex } = item;
                const isBeingDragged = drag.dragId === subtema.id;
                const isHovered = hoveredCard === subtema.id && !drag.dragId;

                return (
                  <div
                    key={subtema.id}
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
                      border: isHovered ? '1.5px solid #7dd3fc' : '1px solid #e0f2fe',
                      cursor: isBeingDragged ? 'grabbing' : 'grab',
                    }}
                    onMouseEnter={() => setHoveredCard(subtema.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onDragStart={e => drag.onDragStart(e, subtema.id, LIST_KEY)}
                    onDragOver={e => drag.onDragOverCard(e, LIST_KEY, realIndex)}
                    onDragEnd={drag.resetDrag}
                  >
                    <div style={{ ...s.cardAccent, background: accent }} />
                    <span style={s.positionBadge}>{realIndex + 1}</span>
                    <div style={s.imgWrap} className="tema-card-img-wrap">
                      {subtema.logo_url ? (
                        <img
                          src={getCloudinaryImageUrl(subtema.logo_url, 'thumb')}
                          alt={subtema.nombre}
                          style={s.img}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span style={s.imgFallback}>+</span>
                      )}
                    </div>
                    <h4 className="tema-card-label" style={s.cardName}>
                      {subtema.nombre}
                    </h4>
                    <div
                      style={{
                        ...s.dragHandle,
                        background: isHovered ? 'linear-gradient(135deg, #e0f2fe, #ede9fe)' : '#f8fafc',
                        borderColor: isHovered ? '#7dd3fc' : '#e2e8f0',
                      }}
                    >
                      <span style={s.dragHandleDots}>+</span>
                      <span style={s.dragHandleText}>Arrastra</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={s.fab}>
        {saveSuccess && <div style={s.fabToast}>Guardado correctamente</div>}
        <button
          style={hasChanges && !isSaving ? s.fabBtn : s.fabBtnDisabled}
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !selectedTema}
          title="Guardar orden"
        >
          {isSaving ? 'Guardando...' : hasChanges ? 'Guardar orden' : 'Sin cambios'}
        </button>
      </div>

      <LoadingToast visible={isSaving} type="saving" message="Guardando orden" />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: 'none',
    border: 'none',
  },
  innerCard: {
    background: 'transparent',
    borderRadius: '20px',
    padding: '0',
    boxShadow: 'none',
    border: 'none',
    marginTop: '18px',
  },
  cardHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' },
  cardTitle: { fontSize: 'clamp(1.4em, 3vw, 2.2em)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 6px' },
  cardSubtitle: { fontSize: '0.9em', color: '#64748b', margin: '0 0 14px', textAlign: 'center' as const },
  divider: { width: '56px', height: '4px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px' },
  loadingWrap: {
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
  },
  spinner: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '4px solid #dbeafe',
    borderTopColor: '#38bdf8',
    animation: 'spin 1s linear infinite',
  },
  loadingText: { margin: 0, color: '#64748b' },
  errorState: {
    marginBottom: '16px',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#9f1239',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-start',
  },
  errorText: { margin: 0, fontWeight: 700 },
  retryButton: {
    border: 'none',
    borderRadius: '999px',
    padding: '10px 14px',
    background: '#e11d48',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  emptyState: {
    padding: '28px 16px',
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    color: '#64748b',
    textAlign: 'center' as const,
    background: '#fff',
  },
  select: {
    width: '100%',
    maxWidth: '640px',
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    padding: '12px 14px',
    fontSize: '1em',
    background: '#fff',
    color: '#0f172a',
  },
  placeholder: {
    minHeight: '220px',
    border: '1px dashed #cbd5e1',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  placeholderIcon: { fontSize: '1.5em', color: '#94a3b8' },
  temaCard: {
    position: 'relative',
    background: '#fff',
    borderRadius: '18px',
    padding: '16px',
    minHeight: '220px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: '4px', borderRadius: '18px 18px 0 0' },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 800,
    fontSize: '0.8em',
  },
  imgWrap: {
    width: 'clamp(68px, 10vw, 88px)',
    height: 'clamp(68px, 10vw, 88px)',
    borderRadius: '18px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  imgFallback: { fontSize: '1.4em' },
  cardName: { margin: 0, fontSize: '0.96em', fontWeight: 800, color: '#0f172a', textAlign: 'center' as const },
  dragHandle: {
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '8px 10px',
    color: '#475569',
    fontSize: '0.82em',
    fontWeight: 700,
  },
  dragHandleDots: { fontSize: '1.1em', lineHeight: 1 },
  dragHandleText: { whiteSpace: 'nowrap' },
  fab: {
    marginTop: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  fabToast: {
    padding: '10px 14px',
    borderRadius: '12px',
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    fontWeight: 700,
  },
  fabBtn: {
    border: 'none',
    borderRadius: '999px',
    padding: '12px 18px',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  fabBtnDisabled: {
    border: '1px solid #cbd5e1',
    borderRadius: '999px',
    padding: '12px 18px',
    background: '#f8fafc',
    color: '#94a3b8',
    fontWeight: 800,
    cursor: 'not-allowed',
  },
};

export default SubtemasOrderManager;