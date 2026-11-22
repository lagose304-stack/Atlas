import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowRightLeft, BookOpen, Check, ClipboardCheck, FilePenLine, FileText,
  FolderOpen, LoaderCircle, Plus, RefreshCw, Search, Settings2, Trash2, Upload, X,
} from 'lucide-react';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { getCachedTemas, type CatalogTema } from '../services/catalogService';
import {
  deleteInstructorDraft, getInstructorBankTopic, getInstructorTest, listInstructorBank, listInstructorTests,
  publishInstructorTest, type InstructorBankSummary, type InstructorBankTopic,
  type InstructorEditor, type InstructorSummary,
} from '../services/instructorTests';
import { groupTemasByParcial } from '../utils/instructorTopics';
import { instructorGroups, instructorStoredIncisoCount, isInstructorContentIncomplete } from '../types/instructorQuestions';
import InstructorBankTopicEditor from '../components/InstructorBankTopicEditor';
import InstructorBankTestConfig from '../components/InstructorBankTestConfig';
import InstructorDeleteConfirmation from '../components/InstructorDeleteConfirmation';
import InstructorLegacyMigrator from '../components/InstructorLegacyMigrator';
import InstructorSubmissionReview from '../components/InstructorSubmissionReview';
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import '../styles/instructorTests.css';

type ActiveTab = 'bank' | 'tests';

export default function PruebaInstructores() {
  const handleGoBack = useSmartBackNavigation('/edicion');
  const [tab, setTab] = useState<ActiveTab>('bank');
  const [temas, setTemas] = useState<CatalogTema[]>([]);
  const [bankSummary, setBankSummary] = useState<InstructorBankSummary[]>([]);
  const [tests, setTests] = useState<InstructorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bankWarning, setBankWarning] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  const [activeBankTopic, setActiveBankTopic] = useState<{ tema: CatalogTema; topic: InstructorBankTopic } | null>(null);
  const [configuringTest, setConfiguringTest] = useState<{ editor: InstructorEditor | null } | null>(null);
  const [deletingDraft, setDeletingDraft] = useState<{ id: string; revision: number; name: string; dirty: boolean } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [migratingTest, setMigratingTest] = useState<InstructorEditor | null>(null);
  const [reviewTest, setReviewTest] = useState<InstructorSummary | null>(null);
  const [topicQuery, setTopicQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [failedLogos, setFailedLogos] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setBankWarning('');
    void Promise.allSettled([getCachedTemas(), listInstructorBank(), listInstructorTests()]).then(([temasRes, bankRes, testsRes]) => {
      if (cancelled) return;
      if (temasRes.status === 'fulfilled') setTemas(temasRes.value);
      else setError('No se pudieron cargar los temas del Atlas.');
      if (bankRes.status === 'fulfilled') setBankSummary(bankRes.value);
      else setBankWarning(bankRes.reason instanceof Error ? bankRes.reason.message : 'El banco de preguntas todavía no está habilitado en la base de datos.');
      if (testsRes.status === 'fulfilled') setTests(testsRes.value);
      else setError(testsRes.reason instanceof Error ? testsRes.reason.message : 'No se pudieron cargar las pruebas.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const bankByTema = new Map(bankSummary.map(item => [item.tema_id, item]));
  const normalizedQuery = topicQuery.trim().toLowerCase();
  const filteredTemas = temas.filter(tema => {
    if (normalizedQuery && !tema.nombre.toLowerCase().includes(normalizedQuery)) return false;
    const count = bankByTema.get(tema.id)?.question_count ?? 0;
    if (topicFilter === 'filled') return count > 0;
    if (topicFilter === 'empty') return count === 0;
    return true;
  });
  const groupedTemas = groupTemasByParcial(filteredTemas);
  const totalBankQuestions = bankSummary.reduce((sum, item) => sum + item.question_count, 0);
  const legacyPendingTests = tests.filter(t => t.mode !== 'bank' && (t.legacy_question_count ?? 0) > 0);
  const bankTests = tests.filter(t => t.mode === 'bank');
  const legacyArchiveTests = tests.filter(t => t.mode !== 'bank' && (t.legacy_question_count ?? 0) === 0);

  const updateSummary = (saved: InstructorEditor) => {
    const isBank = saved.content.mode === 'bank';
    const summary: InstructorSummary = {
      id: saved.id,
      nombre: saved.content.nombre,
      estado: saved.estado,
      revision: saved.revision,
      published_revision: saved.published_revision,
      can_delete_draft: saved.can_delete_draft,
      mode: isBank ? 'bank' : 'legacy',
      legacy_question_count: isBank ? 0 : instructorGroups(saved.content).length,
    };
    setTests(previous => previous.some(t => t.id === saved.id)
      ? previous.map(t => t.id === saved.id ? summary : t)
      : [summary, ...previous]);
  };

  const updateBankSummary = (saved: InstructorBankTopic) => {
    const groups = saved.content.groups ?? [];
    const item: InstructorBankSummary = {
      tema_id: saved.tema_id,
      question_count: groups.length,
      inciso_count: instructorStoredIncisoCount(saved.content.questions),
      has_incomplete: isInstructorContentIncomplete(saved.content),
      revision: saved.revision,
    };
    setBankSummary(previous => previous.some(b => b.tema_id === saved.tema_id)
      ? previous.map(b => b.tema_id === saved.tema_id ? item : b)
      : [...previous, item]);
  };

  const openBankTopic = async (tema: CatalogTema) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const topic = await getInstructorBankTopic(tema.id);
      setActiveBankTopic({ tema, topic });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el banco de este tema.');
    } finally {
      setBusy(false);
    }
  };

  const openTestConfig = async (id: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const detail = await getInstructorTest(id);
      setConfiguringTest({ editor: detail });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la configuración de la prueba.');
    } finally {
      setBusy(false);
    }
  };

  const openLegacyMigrator = async (id: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const detail = await getInstructorTest(id);
      setMigratingTest(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la prueba antigua para migrar.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (test: InstructorSummary, value: boolean) => {
    if (busy) return;
    if (!window.confirm(value ? `¿Publicar «${test.nombre}» en las evaluaciones públicas?` : `¿Pasar «${test.nombre}» a borrador y retirarla de las evaluaciones públicas?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      updateSummary(await publishInstructorTest(test, value));
      setMessage(value ? 'Prueba publicada. Aparecerá al final de las evaluaciones públicas.' : 'Prueba en borrador. Ya no aparece en las evaluaciones públicas.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la publicación.');
    } finally {
      setBusy(false);
    }
  };

  const requestDraftDeletion = (test: Pick<InstructorSummary, 'id' | 'revision'>, name: string, dirty = false) => {
    setDeleteError('');
    setDeletingDraft({ id: test.id, revision: test.revision, name, dirty });
  };
  const removeDraft = async () => {
    if (busy || !deletingDraft) return;
    setBusy(true); setDeleteError('');
    try {
      await deleteInstructorDraft(deletingDraft);
      setTests(previous => previous.filter(test => test.id !== deletingDraft.id));
      setConfiguringTest(null);
      setDeletingDraft(null);
      setError('');
      setMessage('Borrador eliminado.');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar el borrador.');
    } finally {
      setBusy(false);
    }
  };
  const deleteDialog = deletingDraft && <InstructorDeleteConfirmation kind="draft" name={deletingDraft.name}
    dirty={deletingDraft.dirty} busy={busy} error={deleteError}
    onCancel={() => setDeletingDraft(null)} onConfirm={() => void removeDraft()} />;

  if (activeBankTopic) {
    return (
      <InstructorBankTopicEditor
        tema={activeBankTopic.tema}
        initialTopic={activeBankTopic.topic}
        onSaved={saved => {
          updateBankSummary(saved);
          setMessage(`Banco del tema «${activeBankTopic.tema.nombre}» guardado correctamente.`);
        }}
        onClose={() => setActiveBankTopic(null)}
      />
    );
  }

  if (configuringTest) {
    const { editor } = configuringTest;
    return <>
      <InstructorBankTestConfig
        editor={editor}
        temas={temas}
        bankSummary={bankSummary}
        onSaved={(saved, msg) => {
          updateSummary(saved);
          setConfiguringTest(null);
          setTab('tests');
          setMessage(msg);
        }}
        onClose={() => setConfiguringTest(null)}
        onDeleteDraft={editor?.estado === 'borrador' && editor.can_delete_draft
          ? dirty => requestDraftDeletion(editor, editor.content.nombre, dirty) : undefined}
      />
      {deleteDialog}
    </>;
  }

  return (
    <div className="instructor-page instructor-editor-scope">
      <Header onBeforeNavigate={proceed => { if (!busy) proceed(); }} />
      <main className="instructor-main">
        <button type="button" className="instructor-btn instructor-btn-ghost instructor-panel-back" disabled={busy} onClick={handleGoBack}>
          <ArrowLeft size={16} aria-hidden="true" />Panel de edición
        </button>
        <section className="instructor-module-hero" aria-labelledby="prueba-instructores-title">
          <span className="instructor-module-icon"><ClipboardCheck size={26} aria-hidden="true" /></span>
          <div>
            <p className="instructor-eyebrow">Evaluaciones · Panel de edición</p>
            <h1 id="prueba-instructores-title">Prueba de instructores</h1>
            <p className="instructor-muted">Crea preguntas en el banco por tema y configura pruebas con selección aleatoria para cada participante.</p>
          </div>
        </section>

        <div className="instructor-overview" aria-label="Resumen de banco y pruebas">
          <div><span>Preguntas en banco</span><strong>{loading ? '—' : totalBankQuestions}</strong></div>
          <div><span>Pruebas configuradas</span><strong>{loading ? '—' : bankTests.length}</strong></div>
          <div><span>Publicadas</span><strong>{loading ? '—' : tests.filter(t => t.estado === 'publicada').length}</strong></div>
        </div>

        {error && <p role="alert" className="instructor-error">{error}</p>}
        {bankWarning && <p role="alert" className="instructor-error">{bankWarning}</p>}
        {message && <p role="status" className="instructor-success">{message}</p>}

        {reviewTest && (
          <InstructorSubmissionReview key={reviewTest.id} testId={reviewTest.id} name={reviewTest.nombre} onClose={() => setReviewTest(null)} />
        )}

        {migratingTest && !reviewTest && (
          <InstructorLegacyMigrator
            initialEditor={migratingTest}
            temas={temas}
            onMigrated={(updatedTest, updatedBank) => {
              updateSummary(updatedTest);
              updateBankSummary(updatedBank);
            }}
            onClose={() => setMigratingTest(null)}
          />
        )}

        {!reviewTest && !migratingTest && <>
          <div className="instructor-mode-tabs" role="tablist" aria-label="Secciones de Prueba de instructores">
            <button type="button" role="tab" aria-selected={tab === 'bank'} className="instructor-btn" onClick={() => setTab('bank')}>
              <BookOpen size={16} aria-hidden="true" />Banco de preguntas
            </button>
            <button type="button" role="tab" aria-selected={tab === 'tests'} className="instructor-btn" onClick={() => setTab('tests')}>
              <Settings2 size={16} aria-hidden="true" />Pruebas ({bankTests.length})
            </button>
          </div>

          {tab === 'bank' && (
            <section className="instructor-panel" aria-label="Banco de preguntas por tema">
              <div className="instructor-row instructor-between instructor-list-heading">
                <div>
                  <h2>Banco de preguntas por tema</h2>
                  <p className="instructor-muted">Temas ordenados por parcial y orden del programa. Entra en un tema para crear o editar sus preguntas.</p>
                </div>
                <button type="button" className="instructor-btn instructor-btn-ghost" disabled={busy || loading} onClick={() => setReload(n => n + 1)}>
                  <RefreshCw size={16} aria-hidden="true" />Actualizar
                </button>
              </div>
              {!loading && temas.length > 0 && (
                <div className="instructor-bank-toolbar" role="search" aria-label="Filtrar temas del banco">
                  <div className="instructor-bank-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      className="instructor-input"
                      aria-label="Buscar tema en el banco"
                      placeholder="Buscar tema por nombre…"
                      value={topicQuery}
                      onChange={event => setTopicQuery(event.target.value)}
                    />
                    {topicQuery && (
                      <button type="button" className="instructor-bank-clear" aria-label="Limpiar búsqueda" onClick={() => setTopicQuery('')}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="instructor-bank-filters" role="group" aria-label="Filtrar por estado">
                    <button type="button" className="instructor-filter-chip" aria-pressed={topicFilter === 'all'} onClick={() => setTopicFilter('all')}>Todos ({temas.length})</button>
                    <button type="button" className="instructor-filter-chip" aria-pressed={topicFilter === 'filled'} onClick={() => setTopicFilter('filled')}>Con preguntas ({temas.filter(t => (bankByTema.get(t.id)?.question_count ?? 0) > 0).length})</button>
                    <button type="button" className="instructor-filter-chip" aria-pressed={topicFilter === 'empty'} onClick={() => setTopicFilter('empty')}>Sin preguntas ({temas.filter(t => (bankByTema.get(t.id)?.question_count ?? 0) === 0).length})</button>
                  </div>
                </div>
              )}
              {loading ? (
                <p role="status" className="instructor-list-loading"><LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />Cargando temas y banco…</p>
              ) : temas.length === 0 ? (
                <div className="instructor-list-empty">
                  <span className="instructor-empty-icon"><FolderOpen size={26} aria-hidden="true" /></span>
                  <h3>No se encontraron temas del Atlas.</h3>
                  <p>Verifica tu conexión o vuelve a cargar la lista.</p>
                </div>
              ) : groupedTemas.length === 0 ? (
                <div className="instructor-list-empty">
                  <span className="instructor-empty-icon"><Search size={24} aria-hidden="true" /></span>
                  <h3>Ningún tema coincide con el filtro actual.</h3>
                  <p>Prueba con otro nombre o restablece el filtro para ver todos los temas.</p>
                  <button type="button" className="instructor-btn" style={{ marginTop: 14 }} onClick={() => { setTopicQuery(''); setTopicFilter('all'); }}>Mostrar todos los temas</button>
                </div>
              ) : (
                <div className="instructor-bank-parciales">
                  {groupedTemas.map((group, groupIndex) => {
                    const groupFilled = group.temas.filter(t => (bankByTema.get(t.id)?.question_count ?? 0) > 0).length;
                    const groupQuestions = group.temas.reduce((sum, t) => sum + (bankByTema.get(t.id)?.question_count ?? 0), 0);
                    return (
                      <section key={group.parcial} className="instructor-bank-parcial-group" aria-label={group.label}>
                        <header className="instructor-bank-parcial-header">
                          <div className="instructor-bank-parcial-title">
                            <span className="instructor-bank-parcial-num" aria-hidden="true">{String(groupIndex + 1).padStart(2, '0')}</span>
                            <h3>{group.label}</h3>
                          </div>
                          <span className="instructor-bank-parcial-meta">
                            {groupFilled} de {group.temas.length} {group.temas.length === 1 ? 'tema' : 'temas'} con preguntas · <strong>{groupQuestions}</strong> {groupQuestions === 1 ? 'pregunta' : 'preguntas'}
                          </span>
                        </header>
                        <ul className="instructor-bank-topic-list">
                          {group.temas.map((tema, idx) => {
                            const stats = bankByTema.get(tema.id);
                            const qCount = stats?.question_count ?? 0;
                            const iCount = stats?.inciso_count ?? 0;
                            const hasLogo = !!tema.logo_url && !failedLogos[tema.id];
                            const orderNum = String(idx + 1).padStart(2, '0');
                            return (
                              <li key={tema.id} className="instructor-bank-topic-card" data-filled={qCount > 0 ? 'true' : 'false'}>
                                <div className="instructor-bank-topic-head">
                                  <div className="instructor-bank-topic-thumb" aria-hidden="true">
                                    {hasLogo ? (
                                      <img
                                        src={getCloudinaryImageUrl(tema.logo_url!, 'thumb')}
                                        alt=""
                                        loading="lazy"
                                        onError={() => setFailedLogos(prev => ({ ...prev, [tema.id]: true }))}
                                      />
                                    ) : (
                                      <span>{orderNum}</span>
                                    )}
                                  </div>
                                  <div className="instructor-bank-topic-info">
                                    <div className="instructor-bank-topic-order-row">
                                      <span className="instructor-bank-topic-order">Tema {orderNum}</span>
                                      {stats?.has_incomplete && (
                                        <span
                                          className="instructor-topic-warning-dot"
                                          title="Este tema tiene preguntas con incisos incompletos"
                                          aria-label="Tiene preguntas con incisos incompletos"
                                        />
                                      )}
                                    </div>
                                    <h4>{tema.nombre}</h4>
                                  </div>
                                </div>
                                <div className="instructor-bank-topic-foot">
                                  <div className="instructor-bank-topic-counts">
                                    <span className={`instructor-bank-count${qCount > 0 ? ' is-filled' : ''}`}>
                                      {qCount === 0
                                        ? 'Sin preguntas'
                                        : `${qCount} ${qCount === 1 ? 'pregunta' : 'preguntas'} · ${iCount} ${iCount === 1 ? 'inciso' : 'incisos'}`}
                                    </span>
                                    {stats?.has_incomplete && (
                                      <span className="instructor-topic-incomplete-badge" title="Hay incisos incompletos en este tema">
                                        Incisos incompletos
                                      </span>
                                    )}
                                  </div>
                                  <button type="button" className="instructor-btn instructor-bank-open-btn" disabled={busy} aria-label={`Abrir banco de ${tema.nombre}`} onClick={() => void openBankTopic(tema)}>
                                    {qCount > 0 ? 'Editar' : 'Agregar'}<ArrowRight size={15} aria-hidden="true" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {tab === 'bank' && legacyPendingTests.length > 0 && (
            <section className="instructor-panel" aria-label="Pruebas antiguas pendientes de migrar">
              <div className="instructor-list-heading">
                <h2>Pruebas antiguas pendientes de migrar</h2>
                <p className="instructor-muted">Migra sus preguntas al banco por tema. Cuando todas queden sin preguntas, esta sección desaparecerá automáticamente.</p>
              </div>
              <ul className="instructor-test-list">
                {legacyPendingTests.map(test => (
                  <li className="instructor-test-item" key={test.id}>
                    <span className="instructor-test-icon"><FileText size={20} aria-hidden="true" /></span>
                    <div className="instructor-test-info">
                      <h3 className="instructor-summary-name">{test.nombre}</h3>
                      <span className="instructor-badge">{test.legacy_question_count} {test.legacy_question_count === 1 ? 'pregunta por migrar' : 'preguntas por migrar'}</span>
                    </div>
                    <div className="instructor-test-actions">
                      <button type="button" className="instructor-btn" disabled={busy} onClick={() => setReviewTest(test)}>
                        <ClipboardCheck size={16} aria-hidden="true" />Revisar respuestas
                      </button>
                      <button type="button" className="instructor-btn instructor-btn-primary" disabled={busy} aria-label={`Migrar preguntas de ${test.nombre}`} onClick={() => void openLegacyMigrator(test.id)}>
                        <ArrowRightLeft size={16} aria-hidden="true" />Migrar al banco
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'tests' && (
            <section className="instructor-panel" aria-label="Pruebas configuradas desde el banco">
              <div className="instructor-row instructor-between instructor-list-heading">
                <div>
                  <h2>Pruebas configuradas</h2>
                  <p className="instructor-muted">Define cuántas preguntas aleatorias salen por tema y el código de acceso para cada prueba.</p>
                </div>
                <button type="button" className="instructor-btn instructor-btn-primary" disabled={busy || loading} onClick={() => setConfiguringTest({ editor: null })}>
                  <Plus size={18} aria-hidden="true" />Nueva prueba
                </button>
              </div>
              {loading ? (
                <p role="status" className="instructor-list-loading"><LoaderCircle size={20} className="instructor-spin" aria-hidden="true" />Cargando pruebas…</p>
              ) : <>
                {bankTests.length === 0 && !error && (
                  <div className="instructor-list-empty">
                    <span className="instructor-empty-icon"><FileText size={26} aria-hidden="true" /></span>
                    <h3>Todavía no hay pruebas configuradas desde el banco.</h3>
                    <p>Crea una prueba para definir la cantidad de preguntas aleatorias por tema y el código de acceso.</p>
                  </div>
                )}
                <ul className="instructor-test-list" aria-label="Listado de pruebas guardadas">
                  {bankTests.map(test => (
                    <li className="instructor-test-item" key={test.id}>
                      <span className="instructor-test-icon"><FileText size={20} aria-hidden="true" /></span>
                      <div className="instructor-test-info">
                        <h3 className="instructor-summary-name">{test.nombre}</h3>
                        <span className={`instructor-badge${test.estado === 'publicada' ? ' instructor-badge-published' : ''}`}>
                          {test.estado === 'publicada' ? <Check size={13} aria-hidden="true" /> : <FilePenLine size={13} aria-hidden="true" />}
                          {test.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                        </span>
                        {test.estado === 'publicada' && test.published_revision !== test.revision && <p className="instructor-muted">Cambios guardados pendientes de publicar.</p>}
                      </div>
                      <div className="instructor-test-actions">
                        <button type="button" className="instructor-btn" disabled={busy} aria-label={`Revisar respuestas de ${test.nombre}`} onClick={() => setReviewTest(test)}>
                          <ClipboardCheck size={16} aria-hidden="true" />Revisar respuestas
                        </button>
                        {(test.estado === 'borrador' || test.published_revision !== test.revision) && (
                          <button type="button" className="instructor-btn instructor-btn-publish" disabled={busy}
                            aria-label={`${test.estado === 'publicada' ? 'Publicar cambios de' : 'Publicar'} ${test.nombre}`} onClick={() => void publish(test, true)}>
                            <Upload size={16} aria-hidden="true" />{test.estado === 'publicada' ? 'Publicar cambios' : 'Publicar'}
                          </button>
                        )}
                        {test.estado === 'publicada' && (
                          <button type="button" className="instructor-btn" disabled={busy}
                            aria-label={`Pasar a borrador ${test.nombre}`} onClick={() => void publish(test, false)}>
                            <FilePenLine size={16} aria-hidden="true" />Pasar a borrador
                          </button>
                        )}
                        <button type="button" className="instructor-btn" disabled={busy} aria-label={`Configurar ${test.nombre}`} onClick={() => void openTestConfig(test.id)}>
                          <Settings2 size={16} aria-hidden="true" />Configurar
                        </button>
                        {test.estado === 'borrador' && test.can_delete_draft && <button type="button" className="instructor-btn instructor-btn-danger" disabled={busy}
                          aria-label={`Eliminar borrador ${test.nombre}`} onClick={() => requestDraftDeletion(test, test.nombre)}>
                          <Trash2 size={16} aria-hidden="true" />Eliminar borrador
                        </button>}
                      </div>
                    </li>
                  ))}
                </ul>

                {legacyArchiveTests.length > 0 && (
                  <details style={{ marginTop: 18 }}>
                    <summary className="instructor-muted" style={{ cursor: 'pointer', fontWeight: 600 }}>Historial de entregas de pruebas anteriores ({legacyArchiveTests.length})</summary>
                    <ul className="instructor-test-list">
                      {legacyArchiveTests.map(test => (
                        <li className="instructor-test-item" key={test.id}>
                          <div className="instructor-test-info"><h3 className="instructor-summary-name">{test.nombre}</h3></div>
                          <div className="instructor-test-actions">
                            <button type="button" className="instructor-btn" disabled={busy} onClick={() => setReviewTest(test)}>
                              <ClipboardCheck size={16} aria-hidden="true" />Revisar respuestas
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <button type="button" className="instructor-btn instructor-btn-ghost" disabled={busy} onClick={() => setReload(n => n + 1)}>
                  <RefreshCw size={16} aria-hidden="true" />Actualizar lista
                </button>
              </>}
            </section>
          )}
        </>}
      </main>
      <Footer />
      {deleteDialog}
    </div>
  );
}
