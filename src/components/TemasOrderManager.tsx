import React, { useCallback, useEffect, useState } from 'react';
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

type ParcialKey = 'primer' | 'segundo' | 'tercer';

const PARCIALES: { key: ParcialKey; label: string; color: string; accent: string }[] = [
  { key: 'primer', label: 'Primer parcial', color: '#e0f2fe', accent: 'linear-gradient(90deg, #38bdf8, #818cf8)' },
  { key: 'segundo', label: 'Segundo parcial', color: '#ede9fe', accent: 'linear-gradient(90deg, #818cf8, #c084fc)' },
  { key: 'tercer', label: 'Tercer parcial', color: '#dcfce7', accent: 'linear-gradient(90deg, #34d399, #38bdf8)' },
];

interface TemasOrderManagerProps {
  title: string;
  subtitle: string;
}

const TemasOrderManager: React.FC<TemasOrderManagerProps> = ({ title, subtitle }) => {
  const drag = useDraggableList();
  const [temasMap, setTemasMap] = useState<Record<ParcialKey, Tema[]>>({
    primer: [],
    segundo: [],
    tercer: [],
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const fetchTemas = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, logo_url, parcial, sort_order')
        .order('sort_order', { ascending: true });

      if (data) {
        const nextMap: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
        data.forEach((tema: Tema) => {
          if (nextMap[tema.parcial as ParcialKey]) nextMap[tema.parcial as ParcialKey].push(tema);
        });
        setTemasMap(nextMap);
      }

      setLoading(false);
    };

    void fetchTemas();
  }, []);

  const handleDrop = (e: React.DragEvent, parcial: ParcialKey) => {
    const next = drag.applyDrop(e, parcial, temasMap[parcial]);
    if (next) {
      setTemasMap(prev => ({ ...prev, [parcial]: next }));
      setHasChanges(true);
    }
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const promises: Array<PromiseLike<unknown>> = [];
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
    <div style={s.card}>
      <div style={s.cardHeader}>
        <h2 style={s.cardTitle}>{title}</h2>
        <p style={s.cardSubtitle}>{subtitle}</p>
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
            const isActiveParcial = drag.dragKey === key;
            const renderItems = drag.getRenderItems(key, items);

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
                  {isActiveParcial && <span style={s.draggingHint}>Arrastrando...</span>}
                </div>

                <div
                  className="temas-grid-home"
                  onDragOver={e => drag.onDragOverContainer(e, key)}
                  onDrop={e => handleDrop(e, key)}
                >
                  {items.length === 0 && <div style={s.emptyParcial}>Sin temas en este parcial</div>}

                  {renderItems.map(item => {
                    if (item.type === 'placeholder') {
                      return (
                        <div key={item.key} style={s.placeholder}>
                          <span style={s.placeholderIcon}>+</span>
                        </div>
                      );
                    }

                    const { item: tema, realIndex } = item;
                    const isBeingDragged = drag.dragId === tema.id;
                    const isHovered = hoveredCard === tema.id && !drag.dragId;

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
                        onDragStart={e => drag.onDragStart(e, tema.id, key)}
                        onDragOver={e => drag.onDragOverCard(e, key, realIndex)}
                        onDragEnd={drag.resetDrag}
                      >
                        <div style={{ ...s.cardAccent, background: accent }} />
                        <span style={s.positionBadge}>{realIndex + 1}</span>
                        <div style={s.imgWrap} className="tema-card-img-wrap">
                          {tema.logo_url ? (
                            <img
                              src={getCloudinaryImageUrl(tema.logo_url, 'thumb')}
                              alt={tema.nombre}
                              style={s.img}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span style={s.imgFallback}>+</span>
                          )}
                        </div>
                        <h4 className="tema-card-label" style={s.cardName}>
                          {tema.nombre}
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
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div style={s.fab}>
          {saveSuccess && <div style={s.fabToast}>Guardado correctamente</div>}
          <button
            style={hasChanges && !isSaving ? s.fabBtn : s.fabBtnDisabled}
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            title="Guardar orden"
          >
            {isSaving ? 'Guardando...' : hasChanges ? 'Guardar orden' : 'Sin cambios'}
          </button>
        </div>
      )}

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
  cardHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' },
  cardTitle: { fontSize: 'clamp(1.4em, 3vw, 2.2em)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 6px' },
  cardSubtitle: { fontSize: '0.9em', color: '#64748b', margin: '0 0 14px', textAlign: 'center' as const },
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
  },
  emptyParcial: {
    gridColumn: '1 / -1',
    padding: '28px 16px',
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    color: '#64748b',
    textAlign: 'center' as const,
    background: '#fff',
  },
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

export default TemasOrderManager;
