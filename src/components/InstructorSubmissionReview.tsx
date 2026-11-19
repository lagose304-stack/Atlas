import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ClipboardCheck, LoaderCircle, Save, Trash2, X } from 'lucide-react';
import { deleteInstructorSubmission, getInstructorSubmission, listInstructorSubmissions, reviewInstructorSubmission, type InstructorSubmission, type InstructorSubmissionSummary } from '../services/instructorTests';
import { formatInstructorPoints, getInstructorPointCoordinates, incisoLetter, instructorIncisoWeight, instructorReviewPoints, instructorSectionResults, requiresInstructorReview, type PublicInstructorQuestion } from '../types/instructorQuestions';
import InstructorReferenceImageView from './InstructorReferenceImageView';
import InstructorSectionScores from './InstructorSectionScores';
import InstructorDeleteConfirmation from './InstructorDeleteConfirmation';

export default function InstructorSubmissionReview({ testId, name, onClose }: { testId: string; name: string; onClose: () => void }) {
  const [rows, setRows] = useState<InstructorSubmissionSummary[]>([]);
  const [selected, setSelected] = useState<InstructorSubmission | null>(null);
  const [deleting, setDeleting] = useState<InstructorSubmissionSummary | null>(null);
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(true), [dirty, setDirty] = useState(false), [more, setMore] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    void listInstructorSubmissions(testId).then(data => { if (!cancelled) { setRows(data); setMore(data.length === 50); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar las entregas.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [testId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const mayLeave = () => !dirty || window.confirm('Hay una revisión sin guardar. ¿Quieres descartarla?');
  const open = async (id: string) => {
    if (busy || !mayLeave()) return;
    setBusy(true); setError(''); setMessage('');
    try { const detail = await getInstructorSubmission(id); setSelected(detail); setReviews(detail.reviews); setDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la entrega.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const detail = await reviewInstructorSubmission(selected, reviews); setSelected(detail); setReviews(detail.reviews); setDirty(false);
      const pending = detail.snapshot.questions.filter(q => requiresInstructorReview(detail.snapshot, q) && !(q.id in detail.reviews)).length;
      const correct = detail.auto_correct + instructorReviewPoints(detail.snapshot, detail.reviews);
      setRows(old => old.map(row => row.id === detail.id ? { ...row, pending_review: pending, revision: detail.revision, correct, percentage: pending ? null : Math.round(10000 * correct / detail.total) / 100 } : row));
      setMessage('Revisión guardada correctamente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la revisión.'); }
    finally { setBusy(false); }
  };
  const remove = async (row: InstructorSubmissionSummary) => {
    if (busy) return;
    setDeleting(null);
    setBusy(true); setError(''); setMessage('');
    let deleted = false;
    try {
      await deleteInstructorSubmission(testId, row);
      deleted = true;
      // Reload the loaded window so pagination doesn't skip a row after deletion.
      if (selected?.id === row.id) { setSelected(null); setReviews({}); setDirty(false); }
      setRows(old => old.filter(item => item.id !== row.id));
      const size = Math.max(1, Math.ceil((rows.length - 1) / 50));
      const refreshed: InstructorSubmissionSummary[] = [];
      for (let page = 0; page < size; page++) {
        const batch = await listInstructorSubmissions(testId, page * 50); refreshed.push(...batch);
        if (batch.length < 50) { setMore(false); break; }
        if (page === size - 1) setMore(true);
      }
      setRows(refreshed); setMessage('Entrega eliminada correctamente. Sus respuestas ya no están disponibles para consulta.');
    } catch (e) { setError(deleted ? 'La entrega se eliminó, pero no se pudo actualizar el listado. Vuelve a abrir Respuestas recibidas.' : e instanceof Error ? e.message : 'No se pudo eliminar la entrega.'); }
    finally { setBusy(false); }
  };
  const manual = selected?.snapshot.questions.filter(q => requiresInstructorReview(selected.snapshot, q)) ?? [];
  const pending = manual.filter(q => !(q.id in reviews)).length;
  const correct = (selected?.auto_correct ?? 0) + (selected ? instructorReviewPoints(selected.snapshot, reviews) : 0);
  const questionTitle = (question: PublicInstructorQuestion) => {
    const siblings = selected?.snapshot.questions.filter(q => q.group?.id === question.group?.id) ?? [];
    return question.group ? `Pregunta ${question.group.position} · Inciso ${incisoLetter(siblings.findIndex(q => q.id === question.id))}`
      : `${(selected?.snapshot.questions.findIndex(q => q.id === question.id) ?? 0) + 1}.`;
  };
  return <section className="instructor-panel instructor-review-panel">
    <button type="button" className="instructor-btn" disabled={busy} onClick={() => { if (mayLeave()) onClose(); }}><ArrowLeft size={16} />Volver a pruebas</button>
    <h2><ClipboardCheck size={22} /> Respuestas enviadas · {name}</h2>
    <p className="instructor-muted">Consulta las entregas por nombre, estado y puntaje. Cada una conserva las respuestas de la versión que se realizó.</p>
    {error && <p role="alert" className="instructor-error">{error}</p>}{message && <p role="status" className="instructor-success">{message}</p>}
    {busy && <p role="status"><LoaderCircle size={16} className="instructor-spin" />Cargando…</p>}
    <div className="instructor-review-layout"><div>
      {!busy && !rows.length && !error && <p>Todavía no hay pruebas enviadas.</p>}
      <ul className="instructor-review-list" aria-label="Entregas para revisar">{rows.map(row => <li key={row.id}>
        <button type="button" className="instructor-btn" aria-current={selected?.id === row.id ? 'true' : undefined} disabled={busy} onClick={() => void open(row.id)}>
          <strong>{row.participant_name || 'Sin nombre registrado'}</strong><span>Entrega {row.id.slice(0, 8)}</span><span>{new Date(row.created_at).toLocaleString('es-HN')}</span>
          {row.account_number && <span>Cuenta: {row.account_number}</span>}
          <span className="instructor-badge">{row.pending_review ? 'Pendiente' : 'Revisada'}</span>
          <span>{row.pending_review ? `Puntaje provisional: ${formatInstructorPoints(row.correct ?? 0)}/${row.total} · ${row.pending_review} por revisar` : `Puntaje: ${formatInstructorPoints(row.correct ?? 0)}/${row.total} (${row.percentage ?? 0}%)`}</span>
        </button>
        <button type="button" className="instructor-btn instructor-btn-danger instructor-delete-submission" disabled={busy} aria-label={`Eliminar entrega de ${row.participant_name || 'Sin nombre registrado'} (${row.id.slice(0, 8)})`} title="Eliminar esta entrega" onClick={() => setDeleting(row)}><Trash2 size={15} />Eliminar entrega</button>
      </li>)}</ul>
      {more && <button type="button" className="instructor-btn" disabled={busy} onClick={async () => {
        setBusy(true); setError(''); try { const next = await listInstructorSubmissions(testId, rows.length); setRows(old => [...old, ...next]); setMore(next.length === 50); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar más entregas.'); } finally { setBusy(false); }
      }}>Cargar más entregas</button>}
    </div>
    {selected && <fieldset disabled={busy} className="instructor-review-detail"><legend>{selected.participant_name || 'Sin nombre registrado'} · Entrega {selected.id.slice(0, 8)} · Versión {selected.test_revision}</legend>
      <button type="button" className="instructor-btn instructor-btn-danger" onClick={() => { const row = rows.find(item => item.id === selected.id); if (row) setDeleting({ ...row, revision: selected.revision }); }}><Trash2 size={16} />Eliminar esta entrega</button>
      {selected.account_number && <p className="instructor-muted">Número de cuenta: <strong>{selected.account_number}</strong></p>}
      <InstructorSectionScores sections={instructorSectionResults(selected.snapshot, selected.auto_results ?? {}, reviews)} />
      {!manual.length && <p className="instructor-success">Esta entrega se calificó automáticamente. No tiene respuestas pendientes de revisión.</p>}
      {selected.snapshot.questions.filter(q => !requiresInstructorReview(selected.snapshot, q)).map(q => <section className="instructor-review-item" key={q.id}><h3>{questionTitle(q)} {q.type === 'image_versus' ? (q.titulo.trim() || 'Comparación de imágenes') : q.titulo}</h3>
        {q.type === 'image_versus' ? <>
          <p className="instructor-muted">Referencia comparativa · Sin puntaje</p>
          <div className="instructor-versus-grid">
            <div className="instructor-versus-card"><span className="instructor-versus-label">Imagen A</span><InstructorReferenceImageView key={`${selected.id}-${q.id}-a`} url={q.image_a.url} annotations={q.image_a.annotations} /></div>
            <div className="instructor-versus-card"><span className="instructor-versus-label">Imagen B</span><InstructorReferenceImageView key={`${selected.id}-${q.id}-b`} url={q.image_b.url} annotations={q.image_b.annotations} /></div>
          </div>
        </> : <>
          <p className="instructor-muted">Valor del inciso: {formatInstructorPoints(instructorIncisoWeight(selected.snapshot, q))} puntos · Calificación automática</p>
          {q.type !== 'image_point' && q.image && <div className="instructor-question-image"><InstructorReferenceImageView key={`${selected.id}-${q.id}`} url={q.image.url} annotations={q.image.annotations} /></div>}
          <p className="instructor-muted">Respuesta enviada:</p><div className="instructor-submitted-answer">{typeof selected.answers[q.id] === 'string'
            ? q.type === 'single_choice' || !q.type ? q.options.find(option => option.id === selected.answers[q.id])?.texto ?? String(selected.answers[q.id]) : String(selected.answers[q.id])
            : q.type === 'completion' ? q.blanks.map((blank, i) => <p key={blank.id}>Hueco {i + 1}: {String((selected.answers[q.id] as Record<string, string>)?.[blank.id] ?? '')}</p>)
            : q.type === 'matching' ? q.terms.map(term => <p key={term.id}>{term.texto}: {q.choices.find(choice => choice.id === (selected.answers[q.id] as Record<string, string>)?.[term.id])?.texto ?? ''}</p>) : ''}</div>
        </>}
      </section>)}
      {manual.map((q, index) => {
        if (q.type !== 'image_point' && q.type !== 'short_answer') return null;
        const point = selected.answers[q.id];
        return <section className="instructor-review-item" key={q.id}><h3>{questionTitle(q)} {q.titulo}</h3>
          <p className="instructor-muted">Valor del inciso: {formatInstructorPoints(instructorIncisoWeight(selected.snapshot, q))} puntos · {q.id in reviews ? 'Revisada' : 'Pendiente'}</p>
          {q.type === 'image_point' ? (() => {
            const coords = getInstructorPointCoordinates(point);
            const hasTexts = coords.some(c => typeof c.text === 'string' && c.text.trim().length > 0);
            return <>
              <InstructorReferenceImageView key={`${selected.id}-${q.id}`} url={q.image.url} alwaysShowNumbers={hasTexts} annotations={coords.map((coord, idx) => ({ ...coord, label: `Respuesta entregada ${idx + 1}` }))} />
              {hasTexts && <ol className="instructor-point-review-list">{coords.map((coord, idx) => <li key={idx}><strong>{idx + 1}.</strong> {coord.text || 'Sin texto'}</li>)}</ol>}
            </>;
          })()
            : <>{q.image && <InstructorReferenceImageView key={`${selected.id}-${q.id}`} url={q.image.url} annotations={q.image.annotations} />}<p className="instructor-submitted-answer">{typeof point === 'string' ? point : ''}</p></>}
          {q.type === 'short_answer' && selected.snapshot.review_guides?.[q.id]?.some(guide => guide.trim()) && <details><summary>Referencias del autor para revisar</summary><p>{selected.snapshot.review_guides[q.id].filter(guide => guide.trim()).join(' · ')}</p></details>}
          <div className="instructor-row" role="group" aria-label={`Calificar respuesta abierta ${index + 1}`}>
            <button type="button" className="instructor-btn instructor-review-correct" aria-pressed={reviews[q.id] === true} onClick={() => { setReviews(old => ({ ...old, [q.id]: true })); setDirty(true); setMessage(''); }}><Check size={16} />Correcto</button>
            <button type="button" className="instructor-btn instructor-btn-danger" aria-pressed={reviews[q.id] === false} onClick={() => { setReviews(old => ({ ...old, [q.id]: false })); setDirty(true); setMessage(''); }}><X size={16} />Incorrecto</button>
          </div>
        </section>;
      })}
      <p>{pending ? `${pending} ${pending === 1 ? 'respuesta' : 'respuestas'} por revisar. Puntaje provisional: ${formatInstructorPoints(correct)}/${selected.total}.` : `Calificación: ${(100 * correct / selected.total).toFixed(2)}% (${formatInstructorPoints(correct)}/${selected.total}).`}</p>
      <button type="button" className="instructor-btn instructor-btn-primary" disabled={!dirty} onClick={() => void save()}><Save size={16} />Guardar revisión</button>
    </fieldset>}
    </div>
    {deleting && <InstructorDeleteConfirmation name={deleting.participant_name || 'Sin nombre registrado'} account={deleting.account_number}
      reference={deleting.id.slice(0, 8)} dirty={selected?.id === deleting.id && dirty}
      onCancel={() => setDeleting(null)} onConfirm={() => void remove(deleting)} />}
  </section>;
}
