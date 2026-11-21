import {
  INSTRUCTOR_VERSUS_PLATES,
  incisoLetter,
  instructorVersusPrompts,
  isInstructorMultipleChoiceAnswer,
  isInstructorPointAnswer,
  type InstructorAnswers,
  type PublicInstructorQuestion,
} from '../types/instructorQuestions';
import InstructorReferenceImageView from './InstructorReferenceImageView';
import InstructorPointResponse from './InstructorPointResponse';

type Props = { disabled?: boolean; question: PublicInstructorQuestion; index: number; label?: string; contextLabel?: string; answer: InstructorAnswers[string] | undefined; onChange: (value: InstructorAnswers[string]) => void;
  versusResponses?: {
    prompts: NonNullable<ReturnType<typeof instructorVersusPrompts<PublicInstructorQuestion>>>;
    answers: InstructorAnswers;
    onAnswer: (id: string, value: string) => void;
  };
};

export default function InstructorQuestionResponse({ question: q, index, label, contextLabel, answer, onChange, disabled, versusResponses }: Props) {
  const number = index + 1;
  const subject = contextLabel ?? `pregunta ${number}`;
  const objectAnswer = typeof answer === 'object' && answer && !Array.isArray(answer) && !isInstructorPointAnswer(answer) ? answer : {};
  const selectedIds = isInstructorMultipleChoiceAnswer(answer) ? answer : [];
  const promptText = q.titulo.trim();
  const defaultTitle = q.type === 'completion' ? 'Completa el enunciado'
    : q.type === 'image_versus' ? 'Comparación de imágenes'
    : '';
  const itemTitle = promptText || defaultTitle;
  const legendLabel = itemTitle
    ? `${label ?? number}. ${itemTitle}`
    : (label ? `Inciso ${label}` : `Pregunta ${number}`);
  return <fieldset className="instructor-question">
    <legend>{legendLabel}</legend>
    {q.type === 'image_versus' ? <div className="instructor-versus-grid" aria-label="Comparación de dos imágenes">
      {INSTRUCTOR_VERSUS_PLATES.map(plate => {
        const image = q[`image_${plate}`];
        const letter = plate === 'a' ? 'A' : 'B';
        return <div className="instructor-versus-card" key={plate}>
          <span className="instructor-versus-label">Imagen {letter}</span>
          <InstructorReferenceImageView key={image.url} url={image.url} annotations={image.annotations} />
          {versusResponses?.prompts[plate].map((prompt, i) => {
            const value = versusResponses.answers[prompt.id];
            const title = prompt.titulo.trim() || `Respuesta ${i + 1}`;
            return <label className="instructor-label instructor-versus-answer" key={prompt.id}>
              {title}
              <input className="instructor-input" aria-label={`Placa ${letter}: ${title}`}
                maxLength={1000} autoComplete="off" disabled={disabled}
                value={typeof value === 'string' ? value : ''} onChange={event => versusResponses.onAnswer(prompt.id, event.target.value)} />
            </label>;
          })}
        </div>;
      })}
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
      <p className="instructor-muted">Elige una opción para cada término. Puedes usar la misma opción más de una vez.</p>
      {q.terms.map((term, i) => <label className="instructor-label" key={term.id}>
        <span>{term.texto}</span>
        <select className="instructor-input" aria-label={`Pareja del término ${i + 1} de ${subject}`} value={objectAnswer[term.id] ?? ''}
          onChange={e => onChange({ ...objectAnswer, [term.id]: e.target.value })}>
          <option value="">Selecciona su pareja</option>
          {q.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.texto}</option>)}
        </select>
      </label>)}
    </> : <>
      {q.image && <div className="instructor-question-image"><InstructorReferenceImageView key={q.image.url} url={q.image.url} annotations={q.image.annotations} /></div>}
      {q.multiple && <p className="instructor-muted">Marca todas las opciones que consideres correctas.</p>}
      {q.options.map((option, i) => {
        const letter = incisoLetter(i).toUpperCase();
        const displayLabel = option.texto.replace(/^[A-Za-z][.)]\s*/, '');
        return <label className="instructor-option" key={option.id}>
          <input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} disabled={disabled}
            aria-label={option.texto}
            checked={q.multiple ? selectedIds.includes(option.id) : answer === option.id} onChange={event => {
              if (q.multiple) {
                onChange(event.target.checked ? [...selectedIds, option.id] : selectedIds.filter(id => id !== option.id));
              } else {
                onChange(option.id);
              }
            }} />
          <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <strong className="instructor-option-prefix">{letter}.</strong> {displayLabel}
          </span>
        </label>;
      })}
    </>}
  </fieldset>;
}
