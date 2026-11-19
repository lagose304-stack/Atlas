import { isInstructorPointAnswer, type InstructorAnswers, type PublicInstructorQuestion } from '../types/instructorQuestions';
import InstructorReferenceImageView from './InstructorReferenceImageView';
import InstructorPointResponse from './InstructorPointResponse';

type Props = { disabled?: boolean; question: PublicInstructorQuestion; index: number; label?: string; contextLabel?: string; answer: InstructorAnswers[string] | undefined; onChange: (value: InstructorAnswers[string]) => void };

export default function InstructorQuestionResponse({ question: q, index, label, contextLabel, answer, onChange, disabled }: Props) {
  const number = index + 1;
  const subject = contextLabel ?? `pregunta ${number}`;
  const objectAnswer = typeof answer === 'object' && answer && !isInstructorPointAnswer(answer) ? answer as Record<string, string> : {};
  return <fieldset className="instructor-question">
    <legend>{label ?? number}. {q.type === 'completion' ? 'Completa el enunciado' : q.type === 'image_versus' ? (q.titulo.trim() || 'Comparación de imágenes') : q.titulo}</legend>
    {q.type === 'image_versus' ? <div className="instructor-versus-grid" aria-label="Comparación de dos imágenes">
      <div className="instructor-versus-card">
        <span className="instructor-versus-label">Imagen A</span>
        <InstructorReferenceImageView key={`a-${q.image_a.url}`} url={q.image_a.url} annotations={q.image_a.annotations} />
      </div>
      <div className="instructor-versus-card">
        <span className="instructor-versus-label">Imagen B</span>
        <InstructorReferenceImageView key={`b-${q.image_b.url}`} url={q.image_b.url} annotations={q.image_b.annotations} />
      </div>
    </div> : q.type === 'image_point' ? <InstructorPointResponse url={q.image.url} instructions={q.titulo} disabled={disabled} answer={answer} onChange={onChange} /> : q.type === 'short_answer' ? <div className={q.image ? 'instructor-short-with-image' : undefined}>
      {q.image && <InstructorReferenceImageView key={q.image.url} url={q.image.url} annotations={q.image.annotations} />}
      <label className="instructor-label">Respuesta de {subject}
      <input className="instructor-input" maxLength={1000} autoComplete="off" value={typeof answer === 'string' ? answer : ''} onChange={e => onChange(e.target.value)} />
    </label></div> : q.type === 'completion' ? <>
      {q.image && <div className="instructor-question-image"><InstructorReferenceImageView key={q.image.url} url={q.image.url} annotations={q.image.annotations} /></div>}
      <div className="instructor-completion">
        {q.titulo.split(/(\{\{[0-9]+\}\})/).map((part, i) => {
          const match = /^\{\{([0-9]+)\}\}$/.exec(part);
          if (!match) return <span key={i}>{part}</span>;
          const blankNumber = Number(match[1]);
          const blank = q.blanks[blankNumber - 1];
          return blank ? <input key={i} className="instructor-input instructor-blank" aria-label={`Hueco ${blankNumber} de ${subject}`}
            maxLength={1000} autoComplete="off" value={objectAnswer[blank.id] ?? ''} onChange={e => onChange({ ...objectAnswer, [blank.id]: e.target.value })} /> : <span key={i}>{part}</span>;
        })}
      </div>
    </> : q.type === 'matching' ? <>
      {q.image && <div className="instructor-question-image"><InstructorReferenceImageView key={q.image.url} url={q.image.url} annotations={q.image.annotations} /></div>}
      <p className="instructor-muted">Relaciona cada término con una opción distinta.</p>
      {q.terms.map((term, i) => <label className="instructor-label" key={term.id}>
        <span>{term.texto}</span>
        <select className="instructor-input" aria-label={`Pareja del término ${i + 1} de ${subject}`} value={objectAnswer[term.id] ?? ''}
          onChange={e => onChange({ ...objectAnswer, [term.id]: e.target.value })}>
          <option value="">Selecciona su pareja</option>
          {q.choices.map(choice => <option key={choice.id} value={choice.id} disabled={q.terms.some(t => t.id !== term.id && objectAnswer[t.id] === choice.id)}>{choice.texto}</option>)}
        </select>
      </label>)}
    </> : <>
      {q.image && <div className="instructor-question-image"><InstructorReferenceImageView key={q.image.url} url={q.image.url} annotations={q.image.annotations} /></div>}
      {q.options.map(option => <label className="instructor-option" key={option.id}>
        <input type="radio" name={q.id} checked={answer === option.id} onChange={() => onChange(option.id)} />
        <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{option.texto}</span>
      </label>)}
    </>}
  </fieldset>;
}
