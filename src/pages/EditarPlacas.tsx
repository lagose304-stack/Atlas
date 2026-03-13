import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useDraggableList } from '../hooks/useDraggableList';
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
  sort_order: number;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer',  label: 'Primer parcial'  },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer',  label: 'Tercer parcial'  },
];

const LIST_KEY = 'placas';

const EditarPlacas: React.FC = () => {
  const navigate = useNavigate();
  const drag = useDraggableList();

  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);

  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);

  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas, setLoadingPlacas] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Cargar temas al montar
  useEffect(() => {
    const fetchTemas = async () => {
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });
      if (data) setTemas(data);
      setLoadingTemas(false);
    };
    fetchTemas();
  }, []);

  // Cargar subtemas cuando cambia el tema
  useEffect(() => {
    setSubtemas([]);
    setPlacas([]);
    setSelectedSubtemaId(null);
    setHasChanges(false);
    if (!selectedTemaId) return;
    const fetchSubtemas = async () => {
      setLoadingSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });
      if (data) setSubtemas(data);
      setLoadingSubtemas(false);
    };
    fetchSubtemas();
  }, [selectedTemaId]);

  // Cargar placas cuando cambia el subtema
  useEffect(() => {
    setPlacas([]);
    setHasChanges(false);
    drag.resetDrag();
    if (!selectedSubtemaId) return;
    const fetchPlacas = async () => {
      setLoadingPlacas(true);
      const { data } = await supabase
        .from('placas')
        .select('id, photo_url, sort_order')
        .eq('subtema_id', selectedSubtemaId)
        .order('sort_order', { ascending: true });
      if (data) setPlacas(data);
      setLoadingPlacas(false);
    };
    fetchPlacas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubtemaId]);

  const handleDrop = (e: React.DragEvent) => {
    const next = drag.applyDrop(e, LIST_KEY, placas);
    if (next) {
      setPlacas(next);
      setHasChanges(true);
    }
  };

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
  const renderItems = drag.getRenderItems(LIST_KEY, placas);

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        {/* Breadcrumb */}
        <nav style={s.breadcrumb}>
          <button
            onClick={() => navigate('/')}
            style={s.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            🏠 Inicio
          </button>
          <span style={s.breadcrumbSep}>❯</span>
          <button
            onClick={() => navigate('/edicion')}
            style={s.breadcrumbLink}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Edición
          </button>
          <span style={s.breadcrumbSep}>❯</span>
          <span style={s.breadcrumbCurrent}>Placas</span>
        </nav>

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

            {loadingPlacas ? (
              <div style={s.loadingWrap}>
                <div style={s.spinner} />
                <p style={s.loadingText}>Cargando placas...</p>
              </div>
            ) : placas.length === 0 ? (
              <div style={s.emptyState}>
                Este subtema no tiene placas aún.
              </div>
            ) : (
              <div
                className="placas-gallery-grid"
                style={{ minHeight: '100px' }}
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

                  const { item: placa, realIndex } = ri;
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
                      onDragStart={e => drag.onDragStart(e, placa.id, LIST_KEY)}
                      onDragOver={e => drag.onDragOverCard(e, LIST_KEY, realIndex)}
                      onDragEnd={drag.resetDrag}
                    >
                      {/* Acento superior */}
                      <div style={s.cardAccent} />

                      {/* Badge de posición */}
                      <span style={s.positionBadge}>{realIndex + 1}</span>

                      {/* Imagen */}
                      <div style={s.imgWrap}>
                        <img
                          src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                          alt={`Placa ${realIndex + 1}`}
                          style={s.img}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>

                      {/* Handle de arrastre */}
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
    background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
    color: '#0f172a',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
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
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.05)',
    border: '1px solid rgba(15,23,42,0.05)',
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
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
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
