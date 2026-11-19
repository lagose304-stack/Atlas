import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, Circle, CircleDot, Layers3, ListChecks } from 'lucide-react';
import InstructorQuestionResponse from './InstructorQuestionResponse';
import { groupPublicInstructorQuestions, incisoLetter, isInstructorAnswerComplete, isInstructorGradedQuestion, isInstructorPointAnswer, type InstructorAnswers, type PublicInstructorQuestion } from '../types/instructorQuestions';

export default function InstructorExamNavigator({ questions, answers, currentId, onSelect, onAnswer, disabled, saveState }: {
  questions: PublicInstructorQuestion[]; answers: InstructorAnswers; currentId: string | null;
  onSelect: (id: string) => void; onAnswer: (id: string, answer: InstructorAnswers[string]) => void; disabled: boolean; saveState?: 'saved' | 'pending' | 'saving' | 'error';
}) {
  const groups = groupPublicInstructorQuestions(questions);
  const index = Math.max(0, groups.findIndex(group => group.id === currentId));
  const active = groups[index];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (currentId) heading.current?.scrollIntoView?.({ block: 'start' });
  }, []);
  const complete = (group: typeof groups[number]) => {
    const graded = group.items.filter(isInstructorGradedQuestion);
    return graded.length > 0 && graded.every(question => isInstructorAnswerComplete(question, answers[question.id]));
  };
  const state = (group: typeof groups[number]): 'complete' | 'partial' | 'empty' => {
    if (complete(group)) return 'complete';
    const started = group.items.filter(isInstructorGradedQuestion).some(question => {
      const answer = answers[question.id];
      return typeof answer === 'string' ? !!answer.trim() : isInstructorPointAnswer(answer) || (!!answer && Object.values(answer).some(value => typeof value === 'string' && !!value.trim()));
    });
    return started ? 'partial' : 'empty';
  };
  const done = groups.filter(complete).length;
  const select = (id: string) => {
    onSelect(id);
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  };
  const sections = [...new Map(groups.filter(group => group.section).map(group => [group.section!.id, group.section!])).values()];
  if (!active) return null;
  return <div className="instructor-exam-layout">
    <aside className="instructor-exam-map" aria-label="Navegación de la prueba">
      <div className="instructor-exam-map-title"><ListChecks size={20} /><strong>Tu recorrido</strong><span>{done}/{groups.length}</span></div>
      <div className="instructor-exam-progress" role="progressbar" aria-label="Preguntas respondidas" aria-valuemin={0} aria-valuemax={groups.length} aria-valuenow={done}><span style={{ width: `${100 * done / groups.length}%` }} /></div>
      <p>{done === groups.length ? 'Todo respondido. Puedes revisar y entregar.' : `${groups.length - done} preguntas por completar`}</p>
      {saveState && <p className="instructor-exam-save-indicator" data-state={saveState}>{saveState === 'saved' ? '✓ Progreso guardado' : saveState === 'saving' ? 'Guardando progreso…' : saveState === 'error' ? 'Error al guardar · Reintenta antes de salir' : 'Cambios sin guardar'}</p>}
      {sections.length > 0 && <label className="instructor-label">Ir a un tema<select className="instructor-input" value={active.section?.id ?? ''} disabled={disabled} onChange={event => {
        const target = groups.find(group => group.section?.id === event.target.value); if (target) select(target.id);
      }}>{!active.section && <option value="">Sin tema</option>}{sections.map(section => <option key={section.id} value={section.id}>{section.nombre}</option>)}</select></label>}
      <nav aria-label="Preguntas de la prueba"><ol className="instructor-exam-numbers">{groups.map((group, i) => <li key={group.id}>
        <button type="button" aria-label={`Ir a pregunta ${group.position}${state(group) === 'complete' ? ', respondida' : state(group) === 'partial' ? ', a medio responder' : ', pendiente'}`} aria-current={i === index ? 'step' : undefined} data-answer-state={state(group)} disabled={disabled} onClick={() => select(group.id)} title={`${group.section?.nombre ?? `Pregunta ${group.position}`} · ${state(group) === 'complete' ? 'Respondida' : state(group) === 'partial' ? 'A medio responder' : 'Sin responder'}`}>
          {i + 1}{complete(group) ? <Check size={10} aria-hidden="true" /> : state(group) === 'partial' ? <CircleDot size={10} aria-hidden="true" /> : null}
        </button>
      </li>)}</ol></nav>
      <div className="instructor-exam-map-key"><span data-answer-state="complete"><Check size={13} />Respondida</span><span data-answer-state="partial"><CircleDot size={13} />A medio responder</span><span data-answer-state="empty"><Circle size={12} />Sin responder</span></div>
      {done < groups.length && <button type="button" className="instructor-btn instructor-btn-ghost" disabled={disabled} onClick={() => { const missing = groups.find(group => !complete(group)); if (missing) select(missing.id); }}>Ir a la primera pendiente<ArrowRight size={15} /></button>}
    </aside>
    <section className="instructor-exam-workspace" id={`instructor-group-${active.id}`} data-instructor-group={active.id}>
      <div className="instructor-exam-question-heading"><div><p className="instructor-public-kicker"><Layers3 size={14} />{active.section?.nombre ?? 'Evaluación de instructores'}</p>
        <h2 ref={heading} tabIndex={-1}>Pregunta {active.position}</h2><p>{(() => {
          const graded = active.items.filter(isInstructorGradedQuestion).length;
          return graded !== active.items.length
            ? `${graded} ${graded === 1 ? 'inciso evaluable' : 'incisos evaluables'} · 1 punto en total`
            : `${active.items.length} ${active.items.length === 1 ? 'inciso' : 'incisos'} · 1 punto en total`;
        })()}</p></div><span className="instructor-state-pill" data-state={complete(active) ? 'open' : 'scheduled'}>{complete(active) ? <Check size={14} /> : <Circle size={13} />}{complete(active) ? 'Respondida' : 'Por completar'}</span></div>
      {active.titulo && <p className="instructor-exam-context">{active.titulo}</p>}
      {active.items.map((question, i) => <InstructorQuestionResponse key={question.id} question={question} index={active.grouped ? i : active.position - 1}
        label={active.grouped ? incisoLetter(i) : undefined} contextLabel={active.grouped ? `inciso ${incisoLetter(i)} de pregunta ${active.position}` : undefined}
        answer={answers[question.id]} disabled={disabled} onChange={answer => onAnswer(question.id, answer)} />)}
      <div className="instructor-exam-pagination"><button type="button" className="instructor-btn" disabled={disabled || index === 0} onClick={() => select(groups[index - 1].id)}><ArrowLeft size={16} />Anterior</button>
        <span>{index + 1} de {groups.length}</span>
        <button type="button" className="instructor-btn instructor-btn-primary" disabled={disabled || index === groups.length - 1} onClick={() => select(groups[index + 1].id)}>Siguiente<ArrowRight size={16} /></button></div>
    </section>
  </div>;
}
