import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useDraggableList } from '../hooks/useDraggableList';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import LoadingToast from '../components/LoadingToast';
import PageContentEditor from '../components/PageContentEditor';
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
  { key: 'primer',  label: 'Primer parcial',  color: '#e0f2fe', accent: 'linear-gradient(90deg, #38bdf8, #818cf8)' },
  { key: 'segundo', label: 'Segundo parcial', color: '#ede9fe', accent: 'linear-gradient(90deg, #818cf8, #c084fc)' },
  { key: 'tercer',  label: 'Tercer parcial',  color: '#dcfce7', accent: 'linear-gradient(90deg, #34d399, #38bdf8)' },
];

const EditarTemario: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const drag = useDraggableList();

  const [temasMap, setTemasMap] = useState<Record<ParcialKey, Tema[]>>({
    primer: [], segundo: [], tercer: [],
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
        <BackButton onClick={handleGoBack} />

        <div style={s.editBanner}>
          <span style={s.editBannerIcon}>📚</span>
          <div>
            <strong>Modo edición — Página Temario</strong>
            <p style={s.editBannerHint}>
              Aquí puedes editar el contenido (bloques) de la página y reorganizar el orden de los temas.
            </p>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Contenido de la página</h2>
            <p style={s.cardSubtitle}>Bloques de contenido que se muestran en la página de temario</p>
            <div style={s.divider} />
          </div>
          <PageContentEditor entityType="subtemas_page" entityId={0} />
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Temario</h2>
            <p style={s.cardSubtitle}>Orden actual de los temas en el atlas. Arrastra desde <strong>⋮ Arrastra</strong> para reordenar.</p>
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
                      {isActiveParcial && (
                        <span style={s.draggingHint}>⋮ Arrastrando...</span>
                      )}
                    </div>

                    <div
                      className="temas-grid-home"
                      onDragOver={(e) => drag.onDragOverContainer(e, key)}
                      onDrop={(e) => handleDrop(e, key)}
                    >
                      {items.length === 0 && (
                        <div style={s.emptyParcial}>Sin temas en este parcial</div>
                      )}

                      {renderItems.map((item) => {
                        if (item.type === 'placeholder') {
                          return (
                            <div key={item.key} style={s.placeholder}>
                              <span style={s.placeholderIcon}>📌</span>
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
                            onDragStart={(e) => drag.onDragStart(e, tema.id, key)}
                            onDragOver={(e) => drag.onDragOverCard(e, key, realIndex)}
                            onDragEnd={drag.resetDrag}
                          >
                            <div style={{ ...s.cardAccent, background: accent }} />
                            <span style={s.positionBadge}>{realIndex + 1}</span>
                            <div style={s.imgWrap} className="tema-card-img-wrap">
                              {tema.logo_url
                                ? <img src={getCloudinaryImageUrl(tema.logo_url, 'thumb')} alt={tema.nombre} style={s.img} loading="lazy" decoding="async" />
                                : <span style={s.imgFallback}>📘</span>
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
                              <span style={s.dragHandleDots}>⋮</span>
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
          <div style={s.fab}>
            {saveSuccess && (
              <div style={s.fabToast}>✓ Guardado correctamente</div>
            )}
            <button
              style={hasChanges && !isSaving ? s.fabBtn : s.fabBtnDisabled}
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              title="Guardar orden"
            >
              {isSaving ? '⏳ Guardando...' : hasChanges ? '💾 Guardar orden' : '✓ Sin cambios'}
            </button>
          </div>
        )}
      </main>
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
  editBannerHint: { margin: '4px 0 0', fontSize: '0.88em', color: '#92400e', fontWeight: 400 },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: 'none',
    border: 'none',
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

export default EditarTemario;
