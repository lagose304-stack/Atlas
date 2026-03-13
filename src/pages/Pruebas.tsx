import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TestBuilder, { type QuestionBlock } from '../components/TestBuilder.tsx';
import { supabase } from '../services/supabase';

type PruebaAction = 'crear' | 'editar' | 'eliminar';

interface TestSummary {
  id: string;
  titulo: string;
  descripcion: string;
  tema_id: number;
  subtema_id: number | null;
  estado: 'draft' | 'published';
  dificultad: 'baja' | 'media' | 'alta';
  duracion_min: number;
  created_at: string;
}

const ACTION_INFO: Record<PruebaAction, { title: string; description: string; hint: string }> = {
  crear: {
    title: 'Crear pruebas',
    description: 'Define una nueva prueba con sus criterios y su estructura de evaluacion.',
    hint: 'Siguiente paso sugerido: formulario de alta de prueba.',
  },
  editar: {
    title: 'Editar pruebas',
    description: 'Actualiza pruebas existentes para mantener el contenido al dia.',
    hint: 'Siguiente paso sugerido: selector de prueba + editor.',
  },
  eliminar: {
    title: 'Eliminar pruebas',
    description: 'Retira pruebas obsoletas para mantener el sistema limpio y ordenado.',
    hint: 'Siguiente paso sugerido: listado con confirmacion segura.',
  },
};

const Pruebas: React.FC = () => {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState<PruebaAction>('crear');
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [temas, setTemas] = useState<Array<{ id: number; nombre: string }>>([]);
  const [subtemas, setSubtemas] = useState<Array<{ id: number; nombre: string; tema_id: number }>>([]);
  const [temaId, setTemaId] = useState<string>('');
  const [subtemaId, setSubtemaId] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [dificultad, setDificultad] = useState<'baja' | 'media' | 'alta'>('media');
  const [duracionMin, setDuracionMin] = useState('15');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);

  const actions: Array<{ key: PruebaAction; icon: string; color: string }> = [
    { key: 'crear', icon: '➕', color: 'linear-gradient(135deg, #10b981, #34d399)' },
    { key: 'editar', icon: '✏️', color: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    { key: 'eliminar', icon: '🗑️', color: 'linear-gradient(135deg, #ef4444, #f87171)' },
  ];

  useEffect(() => {
    const load = async () => {
      const [{ data: temasData }, { data: subtemasData }] = await Promise.all([
        supabase.from('temas').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('subtemas').select('id, nombre, tema_id').order('nombre', { ascending: true }),
      ]);
      setTemas(temasData ?? []);
      setSubtemas(subtemasData ?? []);
    };
    load();
  }, []);

  const loadTests = async () => {
    setIsLoadingTests(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, titulo, descripcion, tema_id, subtema_id, estado, dificultad, duracion_min, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTests((data ?? []) as TestSummary[]);
    } catch (error) {
      console.error('Error cargando pruebas:', error);
      setSaveMsg('No se pudo cargar el listado de pruebas.');
    } finally {
      setIsLoadingTests(false);
    }
  };

  useEffect(() => {
    if (selectedAction === 'editar' || selectedAction === 'eliminar') {
      loadTests();
    }
  }, [selectedAction]);

  const subtemasDelTema = useMemo(() => {
    if (!temaId) return [];
    return subtemas.filter(s => String(s.tema_id) === temaId);
  }, [subtemas, temaId]);

  const canBuildTest = Boolean(temaId && titulo.trim() && Number(duracionMin) > 0);

  const groupedTests = useMemo(() => {
    const grouped = new Map<number, { temaNombre: string; items: TestSummary[] }>();
    tests.forEach(test => {
      const temaNombre = temas.find(t => t.id === test.tema_id)?.nombre ?? `Tema ${test.tema_id}`;
      const current = grouped.get(test.tema_id);
      if (!current) {
        grouped.set(test.tema_id, { temaNombre, items: [test] });
        return;
      }
      current.items.push(test);
    });

    return [...grouped.entries()]
      .sort((a, b) => a[1].temaNombre.localeCompare(b[1].temaNombre))
      .map(([temaIdValue, value]) => ({ temaId: temaIdValue, ...value }));
  }, [tests, temas]);

  const handleSaveTest = async (blocks: QuestionBlock[]) => {
    if (!canBuildTest) {
      setSaveMsg('Completa el acordeon (tema, titulo y duracion valida) antes de guardar.');
      return;
    }

    const parsedDur = Number(duracionMin);
    const { data: testRow, error: testError } = await supabase
      .from('tests')
      .insert({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tema_id: Number(temaId),
        subtema_id: subtemaId ? Number(subtemaId) : null,
        estado: 'draft',
        dificultad,
        duracion_min: parsedDur,
      })
      .select('id')
      .single();

    if (testError || !testRow?.id) {
      console.error('Error al crear test:', testError);
      setSaveMsg('No se pudo crear la prueba en la base de datos.');
      throw testError ?? new Error('No test id');
    }

    type TestQuestionRow = {
      test_id: string;
      block_type: string;
      sort_order: number;
      title: string;
      prompt: string;
      config: Record<string, unknown>;
      answer_key: Record<string, unknown>;
      points: number;
    };

    let sortOrder = 0;
    const rows: TestQuestionRow[] = [];

    blocks.forEach((block, blockIndex) => {
      if (block.type === 'single_choice') {
        block.questions.forEach((question, questionIndex) => {
          rows.push({
            test_id: testRow.id,
            block_type: block.type,
            sort_order: sortOrder++,
            title: block.title,
            prompt: question.prompt,
            config: {
              blockIndex,
              questionIndex,
              options: question.options.map(o => ({ id: o.id, text: o.text })),
            },
            answer_key: { correctOptionId: question.correctOptionId },
            points: 1,
          });
        });
        return;
      }

      if (block.type === 'multiple_choice') {
        block.questions.forEach((question, questionIndex) => {
          rows.push({
            test_id: testRow.id,
            block_type: block.type,
            sort_order: sortOrder++,
            title: block.title,
            prompt: question.prompt,
            config: {
              blockIndex,
              questionIndex,
              options: question.options.map(o => ({ id: o.id, text: o.text })),
            },
            answer_key: { correctOptionIds: question.correctOptionIds },
            points: 1,
          });
        });
        return;
      }

      if (block.type === 'true_false') {
        block.questions.forEach((question, questionIndex) => {
          rows.push({
            test_id: testRow.id,
            block_type: block.type,
            sort_order: sortOrder++,
            title: block.title,
            prompt: question.prompt,
            config: { blockIndex, questionIndex, choices: ['true', 'false'] },
            answer_key: { correctAnswer: question.correctAnswer },
            points: 1,
          });
        });
        return;
      }

      if (block.type === 'matching') {
        block.questions.forEach((question, questionIndex) => {
          rows.push({
            test_id: testRow.id,
            block_type: block.type,
            sort_order: sortOrder++,
            title: block.title,
            prompt: question.prompt,
            config: {
              blockIndex,
              questionIndex,
              pairs: question.pairs.map(p => ({ id: p.id, left: p.left, right: p.right })),
            },
            answer_key: { pairs: question.pairs.map(p => ({ left: p.left, right: p.right })) },
            points: 1,
          });
        });
        return;
      }

      if (block.type === 'ordering') {
        block.questions.forEach((question, questionIndex) => {
          rows.push({
            test_id: testRow.id,
            block_type: block.type,
            sort_order: sortOrder++,
            title: block.title,
            prompt: question.prompt,
            config: {
              blockIndex,
              questionIndex,
              items: question.items.map(i => ({ id: i.id, text: i.text })),
            },
            answer_key: { orderedItemIds: question.items.map(i => i.id) },
            points: 1,
          });
        });
        return;
      }

      block.questions.forEach((question, questionIndex) => {
        rows.push({
          test_id: testRow.id,
          block_type: block.type,
          sort_order: sortOrder++,
          title: block.title,
          prompt: question.prompt,
          config: {
            blockIndex,
            questionIndex,
            options: question.options.map(o => ({ id: o.id, text: o.text })),
          },
          answer_key: { correctOptionId: question.correctOptionId },
          points: 1,
        });
      });
    });

    const { error: blocksError } = await supabase.from('test_question_blocks').insert(rows);
    if (blocksError) {
      console.error('Error al crear bloques de test:', blocksError);
      setSaveMsg('La prueba se creo, pero hubo un error guardando sus preguntas.');
      throw blocksError;
    }

    setSaveMsg('Prueba guardada correctamente en estado borrador.');
    await loadTests();
  };

  const handleDeleteTest = async (testId: string, tituloTest: string) => {
    if (!window.confirm(`Eliminar la prueba "${tituloTest}"? Esta accion no se puede deshacer.`)) return;

    const { error } = await supabase.from('tests').delete().eq('id', testId);
    if (error) {
      console.error('Error al eliminar prueba:', error);
      setSaveMsg('No se pudo eliminar la prueba.');
      return;
    }

    setSaveMsg('Prueba eliminada correctamente.');
    await loadTests();
  };

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main}>
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
            Edicion
          </button>
          <span style={s.breadcrumbSep}>❯</span>
          <span style={s.breadcrumbCurrent}>Pruebas</span>
        </nav>

        <section style={s.card}>
          <div style={s.headerWrap}>
            <h1 style={s.title}>Gestion de pruebas</h1>
            <p style={s.subtitle}>Selecciona una opcion para crear, editar o eliminar pruebas.</p>
            <div style={s.accentLine} />
          </div>

          <div style={s.grid}>
            {actions.map(action => {
              const info = ACTION_INFO[action.key];
              const active = selectedAction === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  style={{
                    ...s.optionCard,
                    ...(active ? s.optionCardActive : {}),
                  }}
                  onClick={() => setSelectedAction(action.key)}
                >
                  <div style={{ ...s.optionAccent, background: action.color }} />
                  <span style={s.optionIcon}>{action.icon}</span>
                  <span style={s.optionTitle}>{info.title}</span>
                  <span style={s.optionDesc}>{info.description}</span>
                </button>
              );
            })}
          </div>

          <div style={s.detailPanel}>
            <h2 style={s.detailTitle}>{ACTION_INFO[selectedAction].title}</h2>
            <p style={s.detailDesc}>{ACTION_INFO[selectedAction].description}</p>
            <p style={s.detailHint}>{ACTION_INFO[selectedAction].hint}</p>
            {selectedAction === 'crear' && (
              <>
                <div style={s.accordionWrap}>
                  <button
                    type="button"
                    style={s.accordionHeader}
                    onClick={() => setAccordionOpen(v => !v)}
                  >
                    <span>Configuracion inicial de la prueba</span>
                    <span>{accordionOpen ? '▾' : '▸'}</span>
                  </button>

                  {accordionOpen && (
                    <div style={s.accordionBody}>
                      <div style={s.formGrid}>
                        <label style={s.formLabel}>
                          Tema
                          <select
                            value={temaId}
                            onChange={e => {
                              setTemaId(e.target.value);
                              setSubtemaId('');
                            }}
                            style={s.formSelect}
                          >
                            <option value="">Selecciona un tema...</option>
                            {temas.map(tema => (
                              <option key={tema.id} value={String(tema.id)}>{tema.nombre}</option>
                            ))}
                          </select>
                        </label>

                        <label style={s.formLabel}>
                          Subtema (opcional)
                          <select
                            value={subtemaId}
                            onChange={e => setSubtemaId(e.target.value)}
                            style={s.formSelect}
                            disabled={!temaId}
                          >
                            <option value="">Sin subtema</option>
                            {subtemasDelTema.map(subtema => (
                              <option key={subtema.id} value={String(subtema.id)}>{subtema.nombre}</option>
                            ))}
                          </select>
                        </label>

                        <label style={s.formLabel}>
                          Titulo de la prueba
                          <input
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            placeholder="Ej. Evaluacion de tejido epitelial"
                            style={s.formInput}
                          />
                        </label>

                        <label style={s.formLabel}>
                          Dificultad
                          <select
                            value={dificultad}
                            onChange={e => setDificultad(e.target.value as 'baja' | 'media' | 'alta')}
                            style={s.formSelect}
                          >
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        </label>

                        <label style={s.formLabel}>
                          Duracion (min)
                          <input
                            type="number"
                            min={1}
                            value={duracionMin}
                            onChange={e => setDuracionMin(e.target.value)}
                            style={s.formInput}
                          />
                        </label>
                      </div>

                      <label style={s.formLabel}>
                        Descripcion
                        <textarea
                          value={descripcion}
                          onChange={e => setDescripcion(e.target.value)}
                          placeholder="Describe brevemente el objetivo de la prueba"
                          style={s.formTextarea}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {saveMsg && <p style={s.saveMsg}>{saveMsg}</p>}

                <TestBuilder
                  onSave={handleSaveTest}
                  saveDisabled={!canBuildTest}
                  saveLabel="Guardar prueba"
                />
              </>
            )}

            {selectedAction === 'editar' && (
              <div style={s.listWrap}>
                <h3 style={s.listTitle}>Listado de pruebas por tema</h3>
                {isLoadingTests && <p style={s.listMsg}>Cargando pruebas...</p>}
                {!isLoadingTests && groupedTests.length === 0 && (
                  <p style={s.listMsg}>No hay pruebas registradas todavia.</p>
                )}
                {!isLoadingTests && groupedTests.map(group => (
                  <div key={group.temaId} style={s.temaGroupCard}>
                    <div style={s.temaGroupHeader}>
                      <span style={s.temaGroupTitle}>{group.temaNombre}</span>
                      <span style={s.temaGroupCount}>{group.items.length} prueba(s)</span>
                    </div>
                    <div style={s.testsGrid}>
                      {group.items.map(test => {
                        const subtemaNombre = test.subtema_id
                          ? (subtemas.find(s => s.id === test.subtema_id)?.nombre ?? `Subtema ${test.subtema_id}`)
                          : 'Sin subtema';
                        return (
                          <div key={test.id} style={s.testItemCard}>
                            <div style={s.testItemTop}>
                              <strong style={s.testItemTitle}>{test.titulo}</strong>
                              <span style={s.testItemState}>{test.estado}</span>
                            </div>
                            <span style={s.testMeta}>Subtema: {subtemaNombre}</span>
                            <span style={s.testMeta}>Dificultad: {test.dificultad} • Duracion: {test.duracion_min} min</span>
                            {test.descripcion && <p style={s.testDesc}>{test.descripcion}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedAction === 'eliminar' && (
              <div style={s.listWrap}>
                <h3 style={s.listTitle}>Eliminar pruebas por tema</h3>
                {isLoadingTests && <p style={s.listMsg}>Cargando pruebas...</p>}
                {!isLoadingTests && groupedTests.length === 0 && (
                  <p style={s.listMsg}>No hay pruebas registradas para eliminar.</p>
                )}
                {!isLoadingTests && groupedTests.map(group => (
                  <div key={group.temaId} style={s.temaGroupCard}>
                    <div style={s.temaGroupHeader}>
                      <span style={s.temaGroupTitle}>{group.temaNombre}</span>
                      <span style={s.temaGroupCount}>{group.items.length} prueba(s)</span>
                    </div>
                    <div style={s.testsGrid}>
                      {group.items.map(test => {
                        const subtemaNombre = test.subtema_id
                          ? (subtemas.find(s => s.id === test.subtema_id)?.nombre ?? `Subtema ${test.subtema_id}`)
                          : 'Sin subtema';
                        return (
                          <div key={test.id} style={s.testItemCard}>
                            <div style={s.testItemTop}>
                              <strong style={s.testItemTitle}>{test.titulo}</strong>
                              <span style={s.testItemState}>{test.estado}</span>
                            </div>
                            <span style={s.testMeta}>Subtema: {subtemaNombre}</span>
                            <span style={s.testMeta}>Dificultad: {test.dificultad} • Duracion: {test.duracion_min} min</span>
                            {test.descripcion && <p style={s.testDesc}>{test.descripcion}</p>}
                            <button
                              type="button"
                              style={s.deleteTestBtn}
                              onClick={() => handleDeleteTest(test.id, test.titulo)}
                            >
                              Eliminar prueba
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 12% -8%, #bfdbfe 0%, transparent 38%), radial-gradient(circle at 88% 10%, #ddd6fe 0%, transparent 30%), linear-gradient(160deg, #f8fbff 0%, #eef4ff 48%, #f3f7ff 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#0f172a',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(14px, 3vw, 24px)',
    padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px) clamp(24px, 5vw, 56px)',
    width: '100%',
    maxWidth: '1050px',
    boxSizing: 'border-box',
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
  card: {
    width: '100%',
    background: 'linear-gradient(155deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.88) 100%)',
    backdropFilter: 'blur(8px)',
    borderRadius: '20px',
    padding: 'clamp(18px, 3vw, 32px)',
    boxShadow: '0 24px 46px rgba(15,23,42,0.1), 0 8px 20px rgba(30,64,175,0.08)',
    border: '1px solid rgba(186,230,253,0.75)',
    boxSizing: 'border-box',
  },
  headerWrap: {
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(1.4em, 3vw, 2em)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    margin: '6px 0 0 0',
    color: '#64748b',
    fontSize: '0.92em',
  },
  accentLine: {
    marginTop: '12px',
    width: '56px',
    height: '4px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
  },
  grid: {
    display: 'grid',
    width: '100%',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    marginTop: '6px',
  },
  optionCard: {
    border: '1px solid #dbeafe',
    borderRadius: '14px',
    background: 'linear-gradient(155deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 20px rgba(15,23,42,0.07)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  optionCardActive: {
    border: '1px solid #38bdf8',
    transform: 'translateY(-2px)',
    boxShadow: '0 14px 24px rgba(14,165,233,0.18)',
  },
  optionAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
  },
  optionIcon: {
    fontSize: '1.5em',
    lineHeight: 1,
    marginTop: '6px',
  },
  optionTitle: {
    fontSize: '1em',
    fontWeight: 800,
    color: '#0f172a',
  },
  optionDesc: {
    fontSize: '0.85em',
    color: '#64748b',
    lineHeight: 1.55,
  },
  detailPanel: {
    marginTop: '16px',
    borderRadius: '14px',
    border: '1px solid #dbeafe',
    background: '#f8fbff',
    padding: '14px',
  },
  detailTitle: {
    margin: 0,
    fontSize: '1.02em',
    fontWeight: 800,
    color: '#0f172a',
  },
  detailDesc: {
    margin: '6px 0 0 0',
    color: '#475569',
    fontSize: '0.9em',
    lineHeight: 1.6,
  },
  detailHint: {
    margin: '8px 0 0 0',
    color: '#0ea5e9',
    fontSize: '0.82em',
    fontWeight: 700,
  },
  accordionWrap: {
    marginTop: '10px',
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#ffffff',
    overflow: 'hidden',
  },
  accordionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    border: 'none',
    background: 'linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%)',
    color: '#1e293b',
    fontWeight: 800,
    fontSize: '0.88em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  accordionBody: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: '10px 12px',
  },
  formLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '0.8em',
    color: '#475569',
    fontWeight: 700,
  },
  formInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #dbeafe',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  formSelect: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #dbeafe',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.9em',
    fontFamily: 'inherit',
  },
  formTextarea: {
    width: '100%',
    minHeight: '76px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #dbeafe',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  saveMsg: {
    margin: '10px 0 0 0',
    fontSize: '0.84em',
    fontWeight: 700,
    color: '#0ea5e9',
  },
  listWrap: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listTitle: {
    margin: 0,
    fontSize: '0.96em',
    fontWeight: 800,
    color: '#0f172a',
  },
  listMsg: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.86em',
    fontWeight: 600,
  },
  temaGroupCard: {
    border: '1px solid #dbeafe',
    borderRadius: '12px',
    background: '#ffffff',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  temaGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  temaGroupTitle: {
    fontSize: '0.86em',
    fontWeight: 800,
    color: '#0f172a',
  },
  temaGroupCount: {
    fontSize: '0.74em',
    color: '#475569',
    fontWeight: 700,
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '999px',
    padding: '4px 9px',
  },
  testsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '8px',
  },
  testItemCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fbff',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  testItemTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  testItemTitle: {
    color: '#0f172a',
    fontSize: '0.85em',
  },
  testItemState: {
    fontSize: '0.72em',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    borderRadius: '999px',
    padding: '3px 8px',
    background: '#ecfeff',
    fontWeight: 800,
  },
  testMeta: {
    color: '#475569',
    fontSize: '0.78em',
    fontWeight: 600,
  },
  testDesc: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.78em',
    lineHeight: 1.5,
  },
  deleteTestBtn: {
    marginTop: '4px',
    alignSelf: 'flex-start',
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.76em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default Pruebas;
