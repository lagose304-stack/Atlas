import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HoldToRevealCodeInput from '../components/HoldToRevealCodeInput';
import InstructorExamNavigator from '../components/InstructorExamNavigator';
import { ArrowLeft, ArrowRight, CalendarClock, CheckCheck, ClipboardCheck, CloudCheck, KeyRound, Layers3, LoaderCircle, RotateCcw, Send, ShieldCheck, UserRound } from 'lucide-react';
import useInstructorProgress from '../hooks/useInstructorProgress';
import InstructorSectionScores from '../components/InstructorSectionScores';
import InstructorParticipantResults from '../components/InstructorParticipantResults';
import useInstructorAvailability, { formatInstructorSchedule } from '../hooks/useInstructorAvailability';
import { formatInstructorPoints, groupPublicInstructorQuestions, isInstructorAnswerComplete, type InstructorAnswers } from '../types/instructorQuestions';
import {
  gradeInstructorTest, isSixDigitCode, publicInstructorTests, startInstructorTest, resumeInstructorTest, isInstructorAccount, unlockInstructorTest,
  type InstructorProgress, type InstructorResult, type PublicInstructorContent, type PublicInstructorSummary,
} from '../services/instructorTests';
import '../styles/instructorTests.css';
import '../styles/instructorPublic.css';

function InstructorRunner({ id }: { id: string }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<PublicInstructorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);
  const [account, setAccount] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [progressRevision, setProgressRevision] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [access, setAccess] = useState<{ token: string; test: PublicInstructorContent } | null>(null);
  const [answers, setAnswers] = useState<InstructorAnswers>({});
  const [result, setResult] = useState<InstructorResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const availability = useInstructorAvailability(meta);
  useEffect(() => {
    if (availability !== 'open' && access && !started && !result) { setAccess(null); setName(''); setAccount(''); setCode(''); }
  }, [availability, access, started, result]);

  const progress = useInstructorProgress(id, access?.token ?? '', started && !result && availability === 'open', progressRevision, answers, currentQuestion);
  const leave = (proceed: () => void) => {
    if (!started || result) { proceed(); return; }
    void progress.flush().then(proceed).catch(() => setError('No se pudo guardar el progreso antes de salir. Reintenta cuando vuelva la conexión.'));
  };
  const adopt = (response: InstructorProgress) => {
    setName(response.participant_name); setAccount(response.account_number); setAnswers(response.answers);
    setCurrentQuestion(response.current_question_id);
    setProgressRevision(response.progress_revision); setStarted(true); setError('');
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    void publicInstructorTests().then(tests => {
      if (!cancelled) {
        const test = tests.find(t => t.id === id) ?? null;
        setMeta(test);
        if (!test) setError('Esta prueba no está publicada o ya no está disponible.');
      }
    }).catch(() => { if (!cancelled) setError('No se pudo cargar la prueba. Comprueba tu conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, retry]);

  const unlock = async () => {
    if (!meta || availability !== 'open' || !isSixDigitCode(code) || busy) return;
    setBusy(true); setError('');
    try {
      const response = await unlockInstructorTest(id, code);
      setCode('');
      if (!response.ok) {
        setError(response.status === 'outside_schedule' ? 'La prueba está fuera de su horario habilitado.' : response.status === 'locked' ? 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.'
          : response.status === 'invalid_code' ? 'El código no es correcto. Inténtalo de nuevo.'
            : 'Esta prueba ya no está disponible.');
        return;
      }
      setAccess(response); setAnswers({}); setResult(null); setName(''); setAccount(''); setRecovering(false); setCurrentQuestion(null); setStarted(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo verificar el código.'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!access || !started || busy || result || availability !== 'open') return;
    if (access.test.questions.some(q => !isInstructorAnswerComplete(q, answers[q.id]))) { const missing = groupPublicInstructorQuestions(access.test.questions).find(group => group.items.some(q => !isInstructorAnswerComplete(q, answers[q.id]))); if (missing) setCurrentQuestion(missing.id); setError('Responde todas las preguntas y relaciona cada término con una opción distinta antes de finalizar.'); return; }
    if (!window.confirm('¿Finalizar y entregar tus respuestas? Después de enviarlas no podrás modificarlas.')) return;
    setBusy(true); setError('');
    try {
      await progress.flush();
      const response = await gradeInstructorTest(id, access.token, answers);
      if (response.ok) setResult(response);
      else {
        setAccess(null); setAnswers({});
        setError(response.status === 'expired'
          ? 'Tu acceso caducó o la prueba cambió. Introduce de nuevo el código para comenzar.'
          : 'La prueba ya no está publicada.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo calificar. Tus respuestas se conservan para reintentar.'); }
    finally { setBusy(false); }
  };

  return <div className="instructor-page instructor-public-scope">
    <Header onBeforeNavigate={leave} />
    <main className="instructor-main">
      <Link to="/evaluaciones" className="instructor-btn" onClick={event => { if (started && !result) { event.preventDefault(); leave(() => navigate('/evaluaciones')); } }}><ArrowLeft size={16} />Volver a evaluaciones</Link>
      <header className="instructor-public-hero"><div className="instructor-public-hero-icon"><ClipboardCheck size={30} /></div><div><p className="instructor-public-kicker">Atlas de Histología · Evaluaciones</p><h1>{access?.test.nombre ?? meta?.nombre ?? 'Prueba de instructores'}</h1><p>Un espacio para demostrar tus conocimientos y habilidades de microscopía.</p>
        <div className="instructor-public-meta"><span><Layers3 size={14} />{meta?.question_count ?? '—'} preguntas</span><span><ShieldCheck size={14} />Acceso con código</span>{meta?.closes_at && <span><CalendarClock size={14} />Cierre: {formatInstructorSchedule(meta.closes_at)}</span>}</div>
      </div></header>
      {loading && <p role="status">Cargando prueba…</p>}
      {error && <p role="alert" className="instructor-error">{error}</p>}
      {!loading && !meta && <button type="button" className="instructor-btn" onClick={() => setRetry(n => n + 1)}>Volver a comprobar</button>}
      {!access && <div className="instructor-public-tabs" role="group" aria-label="Opciones de la evaluación"><button className="instructor-btn" type="button" aria-pressed={!showResults} onClick={() => setShowResults(false)}><ClipboardCheck size={16} />Realizar prueba</button><button className="instructor-btn" type="button" aria-pressed={showResults} onClick={() => { setShowResults(true); setCode(''); setError(''); }}><CheckCheck size={16} />Consultar resultados</button></div>}
      {!access && showResults && <InstructorParticipantResults testId={id} />}
      {!loading && meta && !access && !showResults && availability !== 'open' && <section className="instructor-panel" aria-label="Prueba fuera de horario"><h2>{availability === 'scheduled' ? 'La prueba todavía no está habilitada' : 'El horario de la prueba finalizó'}</h2>
        {meta.opens_at && meta.closes_at && <p>Del {formatInstructorSchedule(meta.opens_at)} al {formatInstructorSchedule(meta.closes_at)} · Honduras</p>}
        <p>No se pueden iniciar ni recuperar intentos fuera del horario. Las entregas revisadas se consultan desde Consultar resultados.</p>
      </section>}
      {!loading && meta && !access && !showResults && availability === 'open' && <form className="instructor-panel instructor-access-panel" onSubmit={event => { event.preventDefault(); void unlock(); }}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{meta.instrucciones}</p>
        <span className="instructor-public-form-icon"><KeyRound size={24} /></span><p className="instructor-public-kicker">Paso 1 · Acceso seguro</p><h2>Introduce el código para comenzar</h2>
        <p className="instructor-muted">Solicita al responsable de la prueba el código de 6 dígitos.</p>
        <HoldToRevealCodeInput label="Código de acceso" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={code}
          disabled={busy} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ''))} />
        <button type="submit" className="instructor-btn instructor-btn-primary" disabled={busy || !isSixDigitCode(code)}>{busy ? <LoaderCircle size={17} className="instructor-spin" /> : <ArrowRight size={17} />}{busy ? 'Comprobando código…' : 'Comenzar prueba'}</button>
      </form>}
      {access && !started && !result && <form className="instructor-panel instructor-access-panel" onSubmit={async event => {
        event.preventDefault(); if (busy || !isInstructorAccount(account) || (!recovering && !name.trim())) return;
        setBusy(true); setError('');
        try {
          if (recovering) {
            const response = await resumeInstructorTest(id, access.token, account);
            if (response.ok) adopt(response);
            else setError(response.status === 'locked' ? 'Demasiados intentos. Espera 15 minutos antes de volver a recuperar una prueba.'
              : response.status === 'submitted' ? 'Esta cuenta ya entregó esta versión de la prueba.' : 'No encontramos una prueba iniciada para esta cuenta en la versión actual. Comprueba el número de cuenta.');
          } else adopt(await startInstructorTest(id, access.token, name.trim(), account));
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar la prueba.'); } finally { setBusy(false); }
      }}>
        <p className="instructor-public-kicker">Paso 2 · Tu identificación</p><div className="instructor-public-tabs" role="group" aria-label="Comenzar o recuperar prueba">
          <button type="button" className="instructor-btn" aria-pressed={!recovering} disabled={busy} onClick={() => { setRecovering(false); setError(''); }}><UserRound size={16} />Nueva prueba</button>
          <button type="button" className="instructor-btn" aria-pressed={recovering} disabled={busy} onClick={() => { setRecovering(true); setError(''); }}><RotateCcw size={16} />Continuar prueba</button>
        </div>
        <h2>{recovering ? 'Recuperar tu prueba' : 'Antes de comenzar'}</h2>
        <p>{recovering ? 'Escribe tu número de cuenta para recuperar el nombre y las respuestas guardadas de esta prueba.' : 'Escribe tu nombre y número de cuenta para identificar tu entrega.'}</p>
        {!recovering && <label className="instructor-label">Nombre completo<input className="instructor-input" autoComplete="name" maxLength={150} required disabled={busy} value={name} onChange={event => setName(event.target.value)} /></label>}
        <label className="instructor-label">Número de cuenta<input className="instructor-input" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{10,13}" minLength={10} maxLength={13} required disabled={busy} value={account} onChange={event => setAccount(event.target.value.replace(/[^0-9]/g, ''))} /></label>
        <p className="instructor-muted">Entre 10 y 13 dígitos, sin espacios. Conservamos los ceros iniciales.</p>
        <button type="submit" className="instructor-btn instructor-btn-primary" disabled={busy || !isInstructorAccount(account) || (!recovering && !name.trim())}><ArrowRight size={17} />{busy ? 'Preparando prueba…' : recovering ? 'Recuperar y continuar' : 'Continuar a las preguntas'}</button>
      </form>}
      {access && started && !result && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="instructor-participant-bar"><span><UserRound size={16} />Participante: <strong>{name}</strong></span><span><CloudCheck size={16} />Guardado automático</span></div>
        {availability !== 'open' ? <section className="instructor-error" role="alert"><h2>El horario de la prueba finalizó</h2><p>Ya no puedes modificar ni entregar respuestas. El último progreso guardado se conserva. Si el responsable amplía el horario de esta misma prueba, podrás recuperarlo con el código y tu cuenta.</p></section>
          : <p role="status" className={progress.status === 'error' ? 'instructor-error' : 'instructor-muted'}>{progress.status === 'saved' ? 'Progreso guardado' : progress.status === 'saving' ? 'Guardando progreso…' : progress.status === 'error' ? 'No se pudo guardar el progreso. Tus respuestas siguen en esta página.' : 'Cambios pendientes de guardar'}</p>}
        {availability === 'open' && progress.error && <p role="alert" className="instructor-error">{progress.error} <button type="button" className="instructor-btn" onClick={() => void progress.flush().catch(() => {})}>Reintentar guardado</button></p>}

        <p style={{ whiteSpace: 'pre-wrap' }}>{access.test.instrucciones}</p>
        <p className="instructor-muted">Responde cada pregunta según su formato. El progreso se guarda automáticamente. Para recuperarlo, entra con el código y elige Continuar prueba.</p>
        <fieldset disabled={busy || availability !== 'open'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <InstructorExamNavigator questions={access.test.questions} answers={answers} currentId={currentQuestion} saveState={availability === 'open' ? progress.status : undefined} disabled={busy || availability !== 'open'} onSelect={setCurrentQuestion}
            onAnswer={(questionId, value) => setAnswers(previous => ({ ...previous, [questionId]: value }))} />
          <div className="instructor-exam-delivery"><div><strong>Entrega de la prueba</strong><p>Revisa tus respuestas. Al enviarlas se cerrará el intento.</p></div><button type="submit" className="instructor-btn instructor-btn-primary" disabled={busy}><Send size={17} />{busy ? 'Enviando…' : 'Finalizar prueba'}</button></div>
        </fieldset>
      </form>}
      {result && <section className="instructor-panel instructor-result-panel" aria-labelledby="instructor-result-title">
        <span className="instructor-public-form-icon"><CheckCheck size={28} /></span>
        <h2 id="instructor-result-title">Resultado de la prueba</h2>
        <InstructorSectionScores sections={result.sections} />
        <p className="instructor-result">{result.pending_review ? 'Pendiente de revisión' : `${result.percentage}%`}</p>
        {result.pending_review ? <p>{result.pending_review} {result.pending_review === 1 ? 'respuesta requiere' : 'respuestas requieren'} revisión manual. La nota final estará disponible cuando se revisen.</p>
          : <p>{formatInstructorPoints(result.correct)} puntos obtenidos de {result.total}.</p>}
        <p className="instructor-success" role="status">{result.pending_review ? 'Prueba entregada. Tus respuestas y señalados quedaron guardados.' : 'Prueba finalizada. Tus respuestas fueron calificadas.'}</p>
        {result.submission_id && <p className="instructor-muted">Referencia de tu entrega: <strong>{result.submission_id.slice(0, 8)}</strong>. Consérvala para consultar el resultado con el responsable.</p>}
        {!!result.pending_review && access && <button type="button" className="instructor-btn" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { const updated = await gradeInstructorTest(id, access.token, answers);
            if (updated.ok) setResult(updated); else setError('Ya no se puede consultar esta entrega desde esta sesión. Solicita el resultado al responsable de la prueba.');
          } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar la revisión.'); } finally { setBusy(false); }
        }}>Consultar revisión</button>}
        <Link to="/evaluaciones" className="instructor-btn">Regresar a evaluaciones</Link>
        <button type="button" className="instructor-btn" onClick={() => { setAccess(null); setStarted(false); setResult(null); setShowResults(true); setError(''); }}>Consultar una entrega revisada</button>
      </section>}
    </main>
    <Footer />
  </div>;
}

export default function RealizarPruebaInstructores() {
  const { pruebaId } = useParams<{ pruebaId: string }>();
  return <InstructorRunner key={pruebaId} id={pruebaId ?? ''} />;
}
