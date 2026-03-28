import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import LoadingToast from '../components/LoadingToast';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { supabase } from '../services/supabase';

interface TincionItem {
  id: number;
  nombre: string;
  sort_order: number;
  activo: boolean;
}

type Modo = 'crear' | 'editar' | 'eliminar' | null;

const GestionTinciones: React.FC = () => {
  const location = useLocation();
  const goBack = useSmartBackNavigation('/placas');

  const initialModo = useMemo<Modo>(() => {
    const q = new URLSearchParams(location.search).get('modo');
    if (q === 'crear' || q === 'editar' || q === 'eliminar') return q;
    return null;
  }, [location.search]);

  const [tinciones, setTinciones] = useState<TincionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [activeModo, setActiveModo] = useState<Modo>(initialModo);

  const [nuevoNombre, setNuevoNombre] = useState('');

  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({});

  const [selectedToDelete, setSelectedToDelete] = useState<number[]>([]);

  const loadTinciones = async () => {
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase
      .from('tinciones')
      .select('id, nombre, sort_order, activo')
      .order('id', { ascending: true });

    if (error) {
      setErrorMsg('No se pudieron cargar las tinciones.');
      setTinciones([]);
      setLoading(false);
      return;
    }

    const items = (data ?? []) as TincionItem[];
    setTinciones(items);
    setEditDrafts(Object.fromEntries(items.map(item => [item.id, item.nombre])));
    setLoading(false);
  };

  useEffect(() => {
    void loadTinciones();
  }, []);

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCrear = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setErrorMsg('Escribe el nombre de la tincion.');
      return;
    }

    resetMessages();
    setSaving(true);

    const nextSort = (tinciones[tinciones.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase
      .from('tinciones')
      .insert({ nombre, sort_order: nextSort, activo: true });

    if (error) {
      setErrorMsg('No se pudo crear la tincion. Verifica si ya existe.');
      setSaving(false);
      return;
    }

    setNuevoNombre('');
    setActiveModo(null);
    setSuccessMsg('Tincion creada correctamente.');
    await loadTinciones();
    setSaving(false);
  };

  const handleGuardarEdicion = async (id: number) => {
    const nombre = (editDrafts[id] ?? '').trim();
    if (!nombre) {
      setErrorMsg('El nombre no puede quedar vacio.');
      return;
    }

    resetMessages();
    setSaving(true);

    const { error } = await supabase
      .from('tinciones')
      .update({ nombre })
      .eq('id', id);

    if (error) {
      setErrorMsg('No se pudo editar la tincion. Verifica si ya existe el nombre.');
      setSaving(false);
      return;
    }

    setSuccessMsg('Tincion actualizada.');
    await loadTinciones();
    setSaving(false);
  };

  const handleCancelarEditar = () => {
    setActiveModo(null);
    setEditDrafts(Object.fromEntries(tinciones.map(item => [item.id, item.nombre])));
    resetMessages();
  };

  const toggleSelectDelete = (id: number) => {
    setSelectedToDelete(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleBorrarSeleccionadas = async () => {
    if (selectedToDelete.length === 0) {
      setErrorMsg('Selecciona al menos una tincion para eliminar.');
      return;
    }

    resetMessages();
    setSaving(true);

    const { error } = await supabase
      .from('tinciones')
      .delete()
      .in('id', selectedToDelete);

    if (error) {
      setErrorMsg('No se pudieron eliminar las tinciones seleccionadas.');
      setSaving(false);
      return;
    }

    setSelectedToDelete([]);
    setActiveModo(null);
    setSuccessMsg('Tinciones eliminadas correctamente.');
    await loadTinciones();
    setSaving(false);
  };

  const handleCancelarEliminar = () => {
    setSelectedToDelete([]);
    setActiveModo(null);
    resetMessages();
  };

  const showCrearCard = activeModo === null || activeModo === 'crear';
  const showEditarCard = activeModo === null || activeModo === 'editar';
  const showEliminarCard = activeModo === null || activeModo === 'eliminar';

  return (
    <div style={s.page}>
      <Header />

      <style>
        {`
          .tinciones-btn,
          .tinciones-input {
            transition: all 0.18s ease;
          }

          .tinciones-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(1.03);
          }

          .tinciones-btn:active:not(:disabled) {
            transform: translateY(0);
            filter: brightness(0.98);
          }

          .tinciones-btn:focus-visible {
            outline: 3px solid rgba(56, 189, 248, 0.65);
            outline-offset: 2px;
          }

          .tinciones-input:focus {
            border-color: #f59e0b !important;
            box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
          }

          .tinciones-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            filter: none;
          }
        `}
      </style>

      <main style={s.main}>
        <BackButton onClick={goBack} />

        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Gestion de tinciones</h1>
          <p style={s.pageSubtitle}>Crea, edita o elimina tinciones del catalogo disponible en placas.</p>
          <div style={s.accentLine} />
        </div>

        {loading ? (
          <div style={s.loadingBox}>Cargando tinciones...</div>
        ) : (
          <div style={s.grid}>
            {showCrearCard && <section style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitleWrap}>
                  <h2 style={s.cardTitle}>➕ Crear tincion</h2>
                  <span style={s.cardHint}>Agregar una nueva al catalogo</span>
                </div>
                {activeModo === null ? (
                  <button className="tinciones-btn" type="button" style={s.openBtn} onClick={() => { resetMessages(); setActiveModo('crear'); }}>
                    Abrir
                  </button>
                ) : (
                  <button className="tinciones-btn" type="button" style={s.cancelBtn} onClick={() => { setNuevoNombre(''); setActiveModo(null); resetMessages(); }}>
                    Cancelar
                  </button>
                )}
              </div>

              {activeModo === 'crear' && (
                <div style={s.block}>
                  <input
                    className="tinciones-input"
                    type="text"
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    placeholder="Nombre de la tincion"
                    style={s.input}
                  />
                  <div style={s.row}>
                    <button className="tinciones-btn" type="button" style={s.confirmBtn} onClick={handleCrear} disabled={saving}>
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </section>}

            {showEditarCard && <section style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitleWrap}>
                  <h2 style={s.cardTitle}>✏️ Editar tinciones</h2>
                  <span style={s.cardHint}>Total: {tinciones.length}</span>
                </div>
                {activeModo === null ? (
                  <button className="tinciones-btn" type="button" style={s.openBtn} onClick={() => { resetMessages(); setActiveModo('editar'); }}>
                    Abrir
                  </button>
                ) : (
                  <button className="tinciones-btn" type="button" style={s.cancelBtn} onClick={handleCancelarEditar}>
                    Cancelar
                  </button>
                )}
              </div>

              {activeModo === 'editar' && (
                <div style={s.block}>
                  <div style={s.list}>
                    {tinciones.map(item => (
                      <div key={item.id} style={s.listRow}>
                        <input
                          className="tinciones-input"
                          type="text"
                          value={editDrafts[item.id] ?? ''}
                          onChange={e => setEditDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          style={s.inputInline}
                        />
                        <button
                          className="tinciones-btn"
                          type="button"
                          style={s.inlineSaveBtn}
                          onClick={() => void handleGuardarEdicion(item.id)}
                          disabled={saving}
                        >
                          Guardar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>}

            {showEliminarCard && <section style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitleWrap}>
                  <h2 style={s.cardTitle}>🗑️ Eliminar tinciones</h2>
                  <span style={s.cardHint}>Seleccionadas: {selectedToDelete.length}</span>
                </div>
                {activeModo === null ? (
                  <button className="tinciones-btn" type="button" style={s.openBtn} onClick={() => { resetMessages(); setActiveModo('eliminar'); }}>
                    Abrir
                  </button>
                ) : (
                  <button className="tinciones-btn" type="button" style={s.cancelBtn} onClick={handleCancelarEliminar}>
                    Cancelar
                  </button>
                )}
              </div>

              {activeModo === 'eliminar' && (
                <div style={s.block}>
                  <div style={s.list}>
                    {tinciones.map(item => {
                      const selected = selectedToDelete.includes(item.id);
                      return (
                        <div key={item.id} style={s.listRow}>
                          <span style={s.nameText}>{item.nombre}</span>
                          <button
                            className="tinciones-btn"
                            type="button"
                            style={selected ? s.selectedBtn : s.selectBtn}
                            onClick={() => toggleSelectDelete(item.id)}
                          >
                            {selected ? 'Seleccionada' : 'Seleccionar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div style={s.row}>
                    <button
                      className="tinciones-btn"
                      type="button"
                      style={s.deleteBtn}
                      onClick={handleBorrarSeleccionadas}
                      disabled={saving || selectedToDelete.length === 0}
                    >
                      Borrar seleccionadas ({selectedToDelete.length})
                    </button>
                  </div>
                </div>
              )}
            </section>}
          </div>
        )}

        {errorMsg && <div style={s.errorMsg}>⚠️ {errorMsg}</div>}
        {successMsg && <div style={s.successMsg}>✅ {successMsg}</div>}
      </main>

      <Footer />
      <LoadingToast visible={saving} type="saving" message="Guardando cambios" />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    color: '#0f172a',
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 36px) clamp(12px, 3vw, 28px) clamp(26px, 4vw, 48px)',
    boxSizing: 'border-box',
  },
  pageHeader: {
    marginBottom: '20px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,251,235,0.88))',
    border: '1px solid rgba(253,230,138,0.68)',
    borderRadius: '16px',
    padding: '16px 18px',
    boxShadow: '0 8px 24px rgba(217,119,6,0.08)',
  },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(1.5em, 4vw, 2.2em)',
    fontWeight: 900,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '0.95em',
    lineHeight: 1.55,
  },
  accentLine: {
    marginTop: '12px',
    width: '62px',
    height: '4px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
  },
  loadingBox: {
    marginTop: '12px',
    border: '1px solid #e2e8f0',
    background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
    borderRadius: '12px',
    padding: '15px 16px',
    color: '#64748b',
    fontWeight: 700,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
    marginTop: '12px',
  },
  card: {
    background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)',
    border: '1px solid #f5d78b',
    borderRadius: '16px',
    padding: '15px',
    boxShadow: '0 14px 28px rgba(15,23,42,0.09)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  cardTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.05em',
    fontWeight: 800,
    color: '#1f2937',
    letterSpacing: '-0.01em',
  },
  cardHint: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#a16207',
    letterSpacing: '0.01em',
  },
  openBtn: {
    border: '1px solid #f5d78b',
    background: 'linear-gradient(135deg, #ffffff, #fffbeb)',
    color: '#92400e',
    borderRadius: '8px',
    padding: '6px 11px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8em',
    boxShadow: '0 3px 10px rgba(180,83,9,0.08)',
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '11px',
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1.5px solid #f5d78b',
    borderRadius: '10px',
    fontSize: '0.92em',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fffef8',
    color: '#1f2937',
  },
  inputInline: {
    flex: 1,
    minWidth: '100px',
    padding: '8px 10px',
    border: '1.5px solid #f5d78b',
    borderRadius: '8px',
    fontSize: '0.88em',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fffef8',
    color: '#1f2937',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  confirmBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: '#fff',
    borderRadius: '9px',
    padding: '8px 13px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 16px rgba(22,163,74,0.22)',
  },
  cancelBtn: {
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    borderRadius: '9px',
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    maxHeight: '330px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #fde68a',
    background: 'linear-gradient(135deg, #ffffff, #fffbeb)',
    borderRadius: '11px',
    padding: '8px 9px',
  },
  inlineSaveBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff',
    borderRadius: '9px',
    padding: '7px 10px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8em',
    whiteSpace: 'nowrap',
    boxShadow: '0 7px 14px rgba(37,99,235,0.2)',
  },
  nameText: {
    flex: 1,
    color: '#1f2937',
    fontWeight: 700,
    fontSize: '0.9em',
  },
  selectBtn: {
    border: '1px solid #f5d78b',
    background: '#ffffff',
    color: '#92400e',
    borderRadius: '9px',
    padding: '7px 10px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8em',
    whiteSpace: 'nowrap',
  },
  selectedBtn: {
    border: '1px solid #f59e0b',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#fff',
    borderRadius: '9px',
    padding: '7px 10px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8em',
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 14px rgba(217,119,6,0.25)',
  },
  deleteBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff',
    borderRadius: '9px',
    padding: '8px 12px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 16px rgba(220,38,38,0.22)',
  },
  errorMsg: {
    marginTop: '14px',
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    borderRadius: '12px',
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: '0.9em',
    boxShadow: '0 6px 16px rgba(220,38,38,0.12)',
  },
  successMsg: {
    marginTop: '14px',
    background: '#dcfce7',
    border: '1px solid #86efac',
    color: '#166534',
    borderRadius: '12px',
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: '0.9em',
    boxShadow: '0 6px 16px rgba(22,163,74,0.12)',
  },
};

export default GestionTinciones;
