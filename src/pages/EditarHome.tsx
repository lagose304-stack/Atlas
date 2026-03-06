import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface Tema {
  id: number;
  nombre: string;
  logo_url: string;
  parcial: string;
  sort_order: number;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string; color: string; accent: string }[] = [
  { key: 'primer',  label: 'Primer parcial',  color: '#e0f2fe', accent: 'linear-gradient(90deg, #38bdf8, #818cf8)' },
  { key: 'segundo', label: 'Segundo parcial', color: '#ede9fe', accent: 'linear-gradient(90deg, #818cf8, #c084fc)' },
  { key: 'tercer',  label: 'Tercer parcial',  color: '#dcfce7', accent: 'linear-gradient(90deg, #34d399, #38bdf8)' },
];

const EditarHome: React.FC = () => {
  const navigate = useNavigate();

  const [temasMap, setTemasMap] = useState<Record<ParcialKey, Tema[]>>({
    primer: [], segundo: [], tercer: [],
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [dragId, setDragId] = useState<number | null>(null);
  const [dragParcial, setDragParcial] = useState<ParcialKey | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dropParcial, setDropParcial] = useState<ParcialKey | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const fetchTemas = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('temas')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) {
        const map: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
        data.forEach((t: Tema) => {
          if (map[t.parcial as ParcialKey]) map[t.parcial as ParcialKey].push(t);
        });
        setTemasMap(map);
      }
      setLoading(false);
    };
    fetchTemas();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: number, parcial: ParcialKey) => {
    setDragId(id);
    setDragParcial(parcial);
    setDropIndex(null);
    setDropParcial(null);
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCard = (e: React.DragEvent, parcial: ParcialKey, cardIndex: number) => {
    if (dragParcial !== parcial) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2;
    const idx = half ? cardIndex : cardIndex + 1;
    if (idx !== dropIndex || parcial !== dropParcial) {
      setDropIndex(idx);
      setDropParcial(parcial);
    }
  };

  const handleDragOverContainer = (e: React.DragEvent, parcial: ParcialKey) => {
    if (dragParcial !== parcial) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, parcial: ParcialKey) => {
    e.preventDefault();
    if (dragId === null || dragParcial !== parcial || dropIndex === null) {
      resetDrag(); return;
    }
    const items = [...temasMap[parcial]];
    const fromIndex = items.findIndex(t => t.id === dragId);
    if (fromIndex === -1) { resetDrag(); return; }

    let insertAt = dropIndex;
    if (fromIndex < insertAt) insertAt--;
    if (insertAt === fromIndex) { resetDrag(); return; }

    const [moved] = items.splice(fromIndex, 1);
    items.splice(insertAt, 0, moved);
    setTemasMap(prev => ({ ...prev, [parcial]: items }));
    setHasChanges(true);
    resetDrag();
  };

  const resetDrag = () => {
    setDragId(null);
    setDragParcial(null);
    setDropIndex(null);
    setDropParcial(null);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promises: any[] = [];
      for (const parcial of Object.keys(temasMap) as ParcialKey[]) {
        temasMap[parcial].forEach((tema, index) => {
          promises.push(supabase.from('temas').update({ sort_order: index }).eq('id', tema.id));
        });
      }
      await Promise.all(promises);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar orden:', err);
    } finally {
      setIsSaving(false);
    }
  }, [temasMap]);

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>✏️</span>
          <div>
            <strong>Modo edición — Página principal</strong>
            <p style={s.editBannerHint}>
              Arrastra las tarjetas desde el handle <strong>⠿ Arrastra</strong> para cambiar el orden dentro de cada parcial. Los cambios no se aplican hasta que pulses <strong>Guardar orden</strong>.
            </p>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Temario</h2>
            <p style={s.cardSubtitle}>Orden actual de los temas en la página principal</p>
            <div style={s.divider} />
          </div>

          {loading ? (
            <div style={s.loadingWrap}>
              <div style={s.spinner} />
              <p style={s.loadingText}>Cargando temas...</p>
            </div>
          ) : (
            <div style={s.sectionsContainer}>
              {PARCIALES.map(({ key, label, color, accent }) => {
                const items = temasMap[key];
                const isActiveParcial = dragParcial === key;

                type RenderItem =
                  | { type: 'placeholder'; key: string }
                  | { type: 'tema'; tema: Tema; realIndex: number };

                const renderItems: RenderItem[] = [];
                items.forEach((tema, idx) => {
                  if (isActiveParcial && dropIndex === idx && dropParcial === key) {
                    renderItems.push({ type: 'placeholder', key: `ph-${idx}` });
                  }
                  renderItems.push({ type: 'tema', tema, realIndex: idx });
                });
                if (isActiveParcial && dropIndex === items.length && dropParcial === key) {
                  renderItems.push({ type: 'placeholder', key: 'ph-end' });
                }

                return (
                  <div
                    key={key}
                    style={{
                      ...s.parcialSection,
                      ...(isActiveParcial ? s.parcialSectionActive : {}),
                    }}
                  >
                    <div style={s.parcialBadgeRow}>
                      <div style={{ ...s.accentBar, background: accent }} />
                      <span style={{ ...s.parcialBadge, background: color }}>{label}</span>
                      <span style={s.parcialCount}>
                        {items.length} {items.length === 1 ? 'tema' : 'temas'}
                      </span>
                      {isActiveParcial && (
                        <span style={s.draggingHint}>↕ Arrastrando...</span>
                      )}
                    </div>

                    <div
                      className="temas-grid-home"
                      onDragOver={(e) => handleDragOverContainer(e, key)}
                      onDrop={(e) => handleDrop(e, key)}
                    >
                      {items.length === 0 && (
                        <div style={s.emptyParcial}>Sin temas en este parcial</div>
                      )}

                      {renderItems.map((item) => {
                        if (item.type === 'placeholder') {
                          return (
                            <div key={item.key} style={s.placeholder}>
                              <span style={s.placeholderIcon}>⬇</span>
                            </div>
                          );
                        }

                        const { tema, realIndex } = item;
                        const isBeingDragged = dragId === tema.id;
                        const isHovered = hoveredCard === tema.id && !dragId;

                        return (
                          <div
                            key={tema.id}
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
                            onMouseEnter={() => setHoveredCard(tema.id)}
                            onMouseLeave={() => setHoveredCard(null)}
                            onDragStart={(e) => handleDragStart(e, tema.id, key)}
                            onDragOver={(e) => handleDragOverCard(e, key, realIndex)}
                            onDragEnd={resetDrag}
                          >
                            <div style={{ ...s.cardAccent, background: accent }} />
                            <span style={s.positionBadge}>{realIndex + 1}</span>
                            <div style={s.imgWrap} className="tema-card-img-wrap">
                              {tema.logo_url
                                ? <img src={tema.logo_url} alt={tema.nombre} style={s.img} />
                                : <span style={s.imgFallback}>🔬</span>
                              }
                            </div>
                            <h4 className="tema-card-label" style={s.cardName}>{tema.nombre}</h4>
                            <div style={{
                              ...s.dragHandle,
                              background: isHovered
                                ? 'linear-gradient(135deg, #e0f2fe, #ede9fe)'
                                : '#f8fafc',
                              borderColor: isHovered ? '#7dd3fc' : '#e2e8f0',
                            }}>
                              <span style={s.dragHandleDots}>⠿</span>
                              <span style={s.dragHandleText}>Arrastra</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && (
          <div style={s.actionBar}>
            <button
              style={s.cancelBtn}
              onClick={() => navigate('/edicion')}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
            >
              ← Volver
            </button>
            <div style={s.actionRight}>
              {saveSuccess && <span style={s.successMsg}>✅ Orden guardado correctamente</span>}
              <button
                style={hasChanges && !isSaving ? s.saveBtn : s.saveBtnDisabled}
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? 'Guardando...' : hasChanges ? '💾 Guardar orden' : '✓ Sin cambios'}
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
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
  editBannerHint: { margin: '4px 0 0', fontSize: '0.88em', color: '#92400e', fontWeight: 400 },
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.05)',
    border: '1px solid rgba(15,23,42,0.05)',
  },
  cardHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' },
  cardTitle: { fontSize: 'clamp(1.4em, 3vw, 2.2em)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 6px' },
  cardSubtitle: { fontSize: '0.9em', color: '#64748b', margin: '0 0 14px', textAlign: 'center' },
  divider: { width: '56px', height: '4px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px' },
  sectionsContainer: { display: 'flex', flexDirection: 'column', gap: '28px' },
  parcialSection: {
    background: 'linear-gradient(135deg, #ffffff, #f1f5f9)',
    borderRadius: '14px',
    padding: 'clamp(12px, 2vw, 22px)',
    border: '1px solid rgba(15,23,42,0.05)',
    boxShadow: '0 2px 10px rgba(15,23,42,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  },
  parcialSectionActive: {
    border: '2px dashed #38bdf8',
    boxShadow: '0 0 0 4px rgba(56,189,248,0.10)',
    background: 'linear-gradient(135deg, #f0f9ff, rgba(237,233,254,0.2))',
  },
  parcialBadgeRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  accentBar: { width: '4px', height: '22px', borderRadius: '4px', flexShrink: 0 },
  parcialBadge: { padding: '5px 16px', borderRadius: '50px', fontSize: '0.88em', fontWeight: 700, color: '#1e293b' },
  parcialCount: { fontSize: '0.82em', color: '#94a3b8', fontWeight: 500 },
  draggingHint: {
    fontSize: '0.78em',
    color: '#0ea5e9',
    fontWeight: 700,
    background: '#e0f2fe',
    padding: '3px 10px',
    borderRadius: '99px',
    border: '1px solid #7dd3fc',
  },
  emptyParcial: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '24px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #e2e8f0',
    fontSize: '0.9em',
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
  placeholderIcon: {
    fontSize: '1.5em',
    color: '#38bdf8',
  },
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
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  imgFallback: { fontSize: 'clamp(1.4em, 3vw, 2em)' },
  cardName: { margin: 0, color: '#0f172a', fontWeight: 700, lineHeight: 1.3, textAlign: 'center' },
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
  actionBar: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #e2e8f0',
    padding: '14px clamp(16px, 4vw, 48px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
    boxShadow: '0 -4px 24px rgba(15,23,42,0.08)',
  },
  actionRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  successMsg: { fontSize: '0.92em', color: '#15803d', fontWeight: 600 },
  cancelBtn: {
    padding: '10px 22px',
    border: '1.5px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.95em',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  saveBtn: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: 'white',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
  },
  saveBtnDisabled: {
    padding: '11px 28px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 700,
    fontSize: '1em',
    fontFamily: 'inherit',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '60px',
    padding: '60px 0',
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

export default EditarHome;