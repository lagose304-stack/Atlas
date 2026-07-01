import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { supabase } from '../services/supabase';

type TestScope = 'parcial' | 'tema' | 'subtema';

type ParcialKey = 'primer' | 'segundo' | 'tercer';

interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number | null;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order: number | null;
}

const PARCIALES: Array<{ key: ParcialKey; label: string }> = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

const scopeOptions: Array<{
  value: TestScope;
  title: string;
  description: string;
}> = [
  {
    value: 'parcial',
    title: 'Prueba parcial',
    description: 'Abarca todos los temas de un parcial.',
  },
  {
    value: 'tema',
    title: 'Prueba de tema',
    description: 'Abarca todos los subtemas de un tema.',
  },
  {
    value: 'subtema',
    title: 'Prueba de subtema',
    description: 'Abarca solo ese subtema.',
  },
];

const Pruebas: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [scope, setScope] = useState<TestScope>('parcial');
  const [selectedParcial, setSelectedParcial] = useState<ParcialKey | null>(null);
  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [temasLoadError, setTemasLoadError] = useState('');
  const [subtemasLoadError, setSubtemasLoadError] = useState('');
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setSelectedParcial('primer');
    setSelectedTemaId(null);
    setSelectedSubtemaId(null);
    setSubtemas([]);
    setSubtemasLoadError('');
    setLoadingSubtemas(false);
  }, [scope]);

  useEffect(() => {
    const fetchTemas = async () => {
      setLoadingTemas(true);
      setTemasLoadError('');

      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        setTemas([]);
        setTemasLoadError('No se pudieron cargar los temas.');
      } else {
        setTemas((data ?? []) as Tema[]);
      }

      setLoadingTemas(false);
    };

    void fetchTemas();
  }, []);

  useEffect(() => {
    setSelectedSubtemaId(null);
    setSubtemas([]);
    setSubtemasLoadError('');
    setLoadingSubtemas(false);

    if (scope !== 'subtema' || !selectedTemaId) {
      return;
    }

    const fetchSubtemas = async () => {
      setLoadingSubtemas(true);
      setSubtemasLoadError('');

      const { data, error } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id, sort_order')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });

      if (error) {
        setSubtemas([]);
        setSubtemasLoadError('No se pudieron cargar los subtemas.');
      } else {
        setSubtemas((data ?? []) as Subtema[]);
      }

      setLoadingSubtemas(false);
    };

    void fetchSubtemas();
  }, [scope, selectedTemaId]);

  const temasByParcial = useMemo(() => {
    return PARCIALES.reduce<Record<ParcialKey, Tema[]>>((acc, parcial) => {
      acc[parcial.key] = temas.filter(tema => tema.parcial === parcial.key);
      return acc;
    }, { primer: [], segundo: [], tercer: [] });
  }, [temas]);

  const selectedTema = useMemo(
    () => temas.find(tema => tema.id === selectedTemaId) ?? null,
    [selectedTemaId, temas],
  );

  const selectedSubtema = useMemo(
    () => subtemas.find(subtema => subtema.id === selectedSubtemaId) ?? null,
    [selectedSubtemaId, subtemas],
  );

  const visibleThemeSelection = scope === 'tema' || scope === 'subtema';
  const visibleSubtemaSelection = scope === 'subtema';
  const selectedThemeParcial = selectedTema ? selectedTema.parcial as ParcialKey : selectedParcial;
  const visibleParciales = selectedTema
    ? PARCIALES.filter(parcial => parcial.key === selectedThemeParcial)
    : PARCIALES;

  const nombreValido = nombre.trim().length > 0;
  const parcialValido = scope !== 'parcial' || selectedParcial !== null;
  const temaValido = scope !== 'tema' || selectedTemaId !== null;
  const subtemaValido = scope !== 'subtema' || (selectedTemaId !== null && selectedSubtemaId !== null);
  const canCreateTest = nombreValido && parcialValido && temaValido && subtemaValido;
  const createHelpText = !nombreValido
    ? 'Escribe un nombre para la prueba.'
    : scope === 'parcial' && !parcialValido
      ? 'Selecciona un parcial antes de crear la prueba.'
      : scope === 'tema' && !temaValido
        ? 'Selecciona un tema antes de crear la prueba.'
        : scope === 'subtema' && !subtemaValido
          ? 'Selecciona un subtema antes de crear la prueba.'
          : 'La prueba está lista para crearse.';

  const handleCreateTest = async () => {
    if (!canCreateTest || isCreatingTest) {
      return;
    }

    setIsCreatingTest(true);
    setCreateError('');

    const payload = {
      nombre: nombre.trim(),
      instrucciones: instrucciones.trim(),
      scope,
      parcial_key: selectedParcial,
      tema_id: scope === 'tema' || scope === 'subtema' ? selectedTemaId : null,
      subtema_id: scope === 'subtema' ? selectedSubtemaId : null,
    };

    const { data, error } = await supabase
      .from('pruebas')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data?.id) {
      setCreateError('No se pudo guardar la prueba. Intenta de nuevo.');
      setIsCreatingTest(false);
      return;
    }

    navigate(`/pruebas/editor/${data.id}`, { state: { from: '/pruebas/crear' } });
  };

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main} className="edicion-main">
        <BackButton onClick={handleGoBack} />

        <section style={s.hero} className="edicion-card">
          <div style={s.heroText}>
            <p style={s.kicker}>Pruebas</p>
            <h1 style={s.title}>Crear prueba</h1>
            <p style={s.subtitle}>
              Antes de construir preguntas, define el nombre, las instrucciones y el alcance de la prueba.
            </p>
          </div>
        </section>

        <section style={s.layout} className="edicion-grid">
          <div style={s.formCard} className="edicion-card">
            <div style={s.sectionHeader}>
              <span style={s.sectionDot} />
              <h2 style={s.sectionTitle}>Datos iniciales</h2>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Nombre de la prueba</label>
              <input
                type="text"
                value={nombre}
                onChange={event => setNombre(event.target.value)}
                placeholder="Ej. Prueba de epitelios - Parcial 1"
                style={s.input}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Instrucciones</label>
              <textarea
                value={instrucciones}
                onChange={event => setInstrucciones(event.target.value)}
                placeholder="Escribe aquí las instrucciones que verá el estudiante antes de iniciar..."
                rows={6}
                style={s.textarea}
              />
            </div>

            <div style={s.sectionHeader}>
              <span style={s.sectionDot} />
              <h2 style={s.sectionTitle}>Tipo de prueba</h2>
            </div>

            <div style={s.scopeGrid} className="edicion-pages-btn-group">
              {scopeOptions.map(option => {
                const active = scope === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    style={s.scopeCard}
                    className="edicion-pages-btn"
                  >
                    <span style={{ ...s.scopeBadge, background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f8fafc', color: active ? '#fff' : '#475569' }}>
                      {active ? 'Seleccionado' : 'Elegir'}
                    </span>
                    <strong style={s.scopeTitle}>{option.title}</strong>
                    <span style={s.scopeDesc}>{option.description}</span>
                  </button>
                );
              })}
            </div>

            <div style={s.sectionHeader}>
              <span style={s.sectionDot} />
              <h2 style={s.sectionTitle}>
                {scope === 'parcial' ? 'Parcial' : scope === 'tema' ? 'Temas por parcial' : 'Temas y subtemas'}
              </h2>
            </div>

            {scope === 'parcial' && (
              <details style={s.accordion}>
                <summary style={s.accordionSummary}>
                  <span style={s.accordionTitle}>Selecciona el parcial</span>
                  <span style={s.accordionHint}>1, 2 o 3</span>
                </summary>
                <div style={s.accordionBody}>
                  <div style={s.partialSelectorGrid}>
                    {PARCIALES.map(parcial => {
                      const active = selectedParcial === parcial.key;
                      return (
                        <button
                          key={parcial.key}
                          type="button"
                          onClick={() => setSelectedParcial(parcial.key)}
                          style={{
                            ...s.partialSelectorButton,
                            borderColor: active ? '#6366f1' : '#e2e8f0',
                            background: active ? 'linear-gradient(135deg, #eef2ff, #ffffff)' : '#fff',
                            boxShadow: active ? '0 12px 28px rgba(99,102,241,0.12)' : 'none',
                          }}
                        >
                          <span style={{ ...s.partialSelectorNumber, background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f8fafc', color: active ? '#fff' : '#475569' }}>
                            {parcial.key === 'primer' ? '1' : parcial.key === 'segundo' ? '2' : '3'}
                          </span>
                          <span style={s.partialSelectorContent}>
                            <strong style={s.partialSelectorLabel}>{parcial.label}</strong>
                            {active && <span style={s.selectedTag}>Seleccionado</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </details>
            )}

            {visibleThemeSelection && selectedTema && (
              <div style={s.selectionBlock}>
                <div style={s.selectionBlockHeader}>
                  <div>
                    <strong style={s.selectionBlockTitle}>Tema seleccionado</strong>
                    <p style={s.selectionBlockText}>{selectedTema.nombre}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemaId(null);
                      setSelectedSubtemaId(null);
                      setSubtemas([]);
                      setSubtemasLoadError('');
                      setLoadingSubtemas(false);
                    }}
                    style={s.clearSelectionButton}
                  >
                    Cambiar tema
                  </button>
                </div>
              </div>
            )}

            {visibleThemeSelection && (
              <div style={s.accordionStack}>
                {visibleParciales.map(parcial => {
                  const parcialTemas = temasByParcial[parcial.key];

                  return (
                    <details key={parcial.key} style={s.accordion}>
                      <summary
                        style={s.accordionSummary}
                        onClick={() => {
                          setSelectedParcial(parcial.key);
                          setSelectedTemaId(null);
                          setSelectedSubtemaId(null);
                          setSubtemas([]);
                          setSubtemasLoadError('');
                          setLoadingSubtemas(false);
                        }}
                      >
                        <span style={s.accordionTitle}>{parcial.label}</span>
                        <span style={s.accordionHint}>{parcialTemas.length} temas</span>
                      </summary>
                      <div style={s.accordionBody}>
                        {loadingTemas ? (
                          <div style={s.inlineState}>Cargando temas...</div>
                        ) : temasLoadError ? (
                          <div style={{ ...s.inlineState, color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' }}>
                            {temasLoadError}
                          </div>
                        ) : parcialTemas.length === 0 ? (
                          <div style={s.inlineState}>No hay temas en este parcial.</div>
                        ) : (
                          <div style={s.themeGrid}>
                            {parcialTemas.map(tema => {
                              const active = selectedTemaId === tema.id;

                              return (
                                <button
                                  key={tema.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedParcial(parcial.key);
                                      setSelectedTemaId(tema.id);
                                      setSelectedSubtemaId(null);
                                      setSubtemas([]);
                                      setSubtemasLoadError('');
                                      setLoadingSubtemas(false);
                                  }}
                                  style={{
                                    ...s.themeButton,
                                    borderColor: active ? '#0ea5e9' : '#e2e8f0',
                                    background: active ? 'linear-gradient(135deg, #ecfeff, #ffffff)' : '#fff',
                                    boxShadow: active ? '0 12px 26px rgba(14,165,233,0.12)' : 'none',
                                  }}
                                >
                                  <strong style={s.themeButtonTitle}>{tema.nombre}</strong>
                                  {active && <span style={s.selectedTag}>Seleccionado</span>}
                                  <span style={s.themeButtonMeta}>{parcial.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {visibleSubtemaSelection && selectedTema && (
              <details style={s.accordion}>
                <summary style={s.accordionSummary}>
                  <span style={s.accordionTitle}>Subtemas de {selectedTema.nombre}</span>
                  <span style={s.accordionHint}>{subtemas.length} subtemas</span>
                </summary>
                <div style={s.accordionBody}>
                  {loadingSubtemas ? (
                    <div style={s.inlineState}>Cargando subtemas...</div>
                  ) : subtemasLoadError ? (
                    <div style={{ ...s.inlineState, color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' }}>
                      {subtemasLoadError}
                    </div>
                  ) : subtemas.length === 0 ? (
                    <div style={s.inlineState}>No hay subtemas para este tema.</div>
                  ) : (
                    <div style={s.subtemaGrid}>
                      {subtemas.map(subtema => {
                        const active = selectedSubtemaId === subtema.id;
                        return (
                          <button
                            key={subtema.id}
                            type="button"
                            onClick={() => setSelectedSubtemaId(subtema.id)}
                            style={{
                              ...s.subtemaButton,
                              borderColor: active ? '#8b5cf6' : '#e2e8f0',
                              background: active ? 'linear-gradient(135deg, #f5f3ff, #ffffff)' : '#fff',
                              boxShadow: active ? '0 12px 26px rgba(139,92,246,0.12)' : 'none',
                            }}
                          >
                            <strong style={s.subtemaButtonTitle}>{subtema.nombre}</strong>
                            {active && <span style={s.selectedTag}>Seleccionado</span>}
                            <span style={s.subtemaButtonMeta}>Subtema</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div style={s.footerActions}>
              <div style={s.noteBox}>
                {scope === 'parcial'
                  ? 'La prueba quedará asociada al parcial seleccionado.'
                  : scope === 'tema'
                    ? 'La prueba quedará asociada al tema seleccionado.'
                    : 'La prueba quedará asociada al subtema seleccionado.'}
              </div>
              <div style={s.buttonRow}>
                <Link to="/edicion" style={s.secondaryButton}>
                  Volver
                </Link>
                <button
                  type="button"
                  style={canCreateTest && !isCreatingTest ? s.primaryButton : s.primaryButtonDisabled}
                  disabled={!canCreateTest || isCreatingTest}
                  onClick={() => { void handleCreateTest(); }}
                >
                  {isCreatingTest ? 'Creando...' : 'Crear prueba'}
                </button>
              </div>
              {createError && (
                <div style={{ ...s.noteBox, background: 'linear-gradient(135deg, #fef2f2, #fff1f2)', borderColor: '#fecaca', color: '#b91c1c' }}>
                  {createError}
                </div>
              )}
              <div style={canCreateTest ? s.noteBoxReady : s.noteBox}>
                {createHelpText}
              </div>
            </div>
          </div>

        </section>
      </main>

      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#0f172a',
    background: 'radial-gradient(circle at top left, rgba(224,231,255,0.85), transparent 28%), radial-gradient(circle at top right, rgba(224,242,254,0.8), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #ffffff 100%)',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
    boxSizing: 'border-box',
    padding: '0 20px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  hero: {
    display: 'block',
    padding: '0',
  },
  heroText: {
    borderRadius: '28px',
    padding: '28px 30px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.96) 45%, rgba(255,255,255,0.98) 100%)',
    border: '1px solid rgba(191,219,254,0.9)',
    boxShadow: '0 20px 50px rgba(15,23,42,0.10)',
    position: 'relative',
    overflow: 'hidden',
  },
  kicker: {
    margin: 0,
    color: '#7c3aed',
    fontWeight: 900,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontSize: '0.74em',
  },
  title: {
    margin: '10px 0 8px',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: 0,
    maxWidth: '62ch',
    color: '#475569',
    lineHeight: 1.65,
    fontSize: '0.98rem',
  },
  layout: {
    display: 'flex',
    justifyContent: 'center',
  },
  formCard: {
    borderRadius: '28px',
    border: '1px solid rgba(226,232,240,0.95)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)',
    boxShadow: '0 22px 60px rgba(15,23,42,0.10)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    width: '100%',
    borderTop: '4px solid #7c3aed',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(255,255,255,0.95))',
    border: '1px solid rgba(226,232,240,0.8)',
  },
  sectionDot: {
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#0f172a',
    fontWeight: 900,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 800,
    color: '#334155',
  },
  input: {
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    padding: '15px 16px',
    fontFamily: 'inherit',
    fontSize: '0.98rem',
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  textarea: {
    width: '100%',
    borderRadius: '16px',
    border: '1.5px solid #cbd5e1',
    padding: '15px 16px',
    fontFamily: 'inherit',
    fontSize: '0.98rem',
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    resize: 'vertical',
    minHeight: '140px',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)',
  },
  scopeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  scopeCard: {
    borderRadius: '20px',
    border: '1.5px solid #dbeafe',
    padding: '16px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
    fontFamily: 'inherit',
  },
  scopeBadge: {
    alignSelf: 'flex-start',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '0.75rem',
    fontWeight: 800,
  },
  scopeTitle: {
    fontSize: '1rem',
    color: '#0f172a',
  },
  scopeDesc: {
    color: '#64748b',
    lineHeight: 1.5,
    fontSize: '0.9rem',
  },
  accordionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  selectionBlock: {
    borderRadius: '20px',
    border: '1px solid #c7d2fe',
    background: 'linear-gradient(135deg, #eef2ff, #ffffff)',
    padding: '16px 18px',
    boxShadow: '0 14px 30px rgba(99,102,241,0.10)',
  },
  selectionBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  selectionBlockTitle: {
    display: 'block',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#1d4ed8',
    fontWeight: 900,
    marginBottom: '4px',
  },
  selectionBlockText: {
    margin: 0,
    color: '#0f172a',
    fontWeight: 800,
    fontSize: '1rem',
  },
  clearSelectionButton: {
    border: '1px solid #93c5fd',
    background: '#fff',
    color: '#1d4ed8',
    borderRadius: '12px',
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  accordion: {
    borderRadius: '20px',
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    overflow: 'hidden',
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
  },
  accordionSummary: {
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    cursor: 'pointer',
    padding: '16px 18px',
    background: 'linear-gradient(135deg, rgba(239,246,255,0.8), #fff)',
    fontFamily: 'inherit',
    borderBottom: '1px solid rgba(219,234,254,0.9)',
  },
  accordionTitle: {
    fontSize: '0.98rem',
    fontWeight: 900,
    color: '#0f172a',
  },
  accordionHint: {
    fontSize: '0.82rem',
    color: '#64748b',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  accordionBody: {
    padding: '16px 18px 18px',
    borderTop: '1px solid #e2e8f0',
    background: '#fff',
  },
  partialSelectorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  partialSelectorButton: {
    borderRadius: '18px',
    border: '1.5px solid #dbeafe',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  },
  partialSelectorNumber: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    flexShrink: 0,
  },
  partialSelectorLabel: {
    color: '#0f172a',
    fontSize: '0.95rem',
  },
  partialSelectorContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
  },
  inlineState: {
    borderRadius: '14px',
    border: '1px solid #dbeafe',
    background: '#f8fafc',
    padding: '14px 16px',
    color: '#475569',
    fontSize: '0.92rem',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  themeButton: {
    borderRadius: '18px',
    border: '1.5px solid #dbeafe',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  },
  themeButtonTitle: {
    color: '#0f172a',
    fontSize: '0.95rem',
  },
  themeButtonMeta: {
    color: '#64748b',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  subtemaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  subtemaButton: {
    borderRadius: '18px',
    border: '1.5px solid #dbeafe',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  },
  subtemaButtonTitle: {
    color: '#0f172a',
    fontSize: '0.95rem',
  },
  subtemaButtonMeta: {
    color: '#64748b',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  selectedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '4px 9px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.72rem',
    fontWeight: 800,
    border: '1px solid #86efac',
  },
  footerActions: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noteBox: {
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: '14px 16px',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
  noteBoxReady: {
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
    border: '1px solid #a7f3d0',
    color: '#047857',
    padding: '14px 16px',
    lineHeight: 1.6,
    fontSize: '0.92rem',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #cbd5e1',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    color: '#334155',
    textDecoration: 'none',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 30px rgba(109,40,217,0.18)',
  },
  primaryButtonDisabled: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
    color: '#64748b',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'not-allowed',
  },
  previewBlock: {
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  previewLabel: {
    fontSize: '0.76rem',
    fontWeight: 900,
    color: '#64748b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  previewValue: {
    margin: 0,
    color: '#0f172a',
    lineHeight: 1.6,
    fontSize: '0.95rem',
    whiteSpace: 'pre-wrap',
  },
};

export default Pruebas;