import { useId } from 'react';
import { Link2, Minus, Plus, Trash2 } from 'lucide-react';
import InstructorFormatIcon from './InstructorFormatIcon';
import InstructorShortAnswerImage from './InstructorShortAnswerImage';
import {
  INSTRUCTOR_QUESTION_TYPES, hasInstructorQuestionResponses, newInstructorQuestion,
  type InstructorQuestion, type InstructorQuestionType,
} from '../types/instructorQuestions';

type Props = { question: InstructorQuestion; index: number; label?: string; contextLabel?: string; onChange: (question: InstructorQuestion) => void; onRemove: () => void; onSelectImageFile?: (file: File, slot?: 'image' | 'image_a' | 'image_b') => void };
const answersHint = 'Una respuesta aceptada por línea. Se ignoran mayúsculas, tildes y espacios de más.';

export default function InstructorQuestionEditor({ question: q, index, label, contextLabel, onChange, onRemove, onSelectImageFile }: Props) {
  const number = index + 1;
  const subject = contextLabel ?? `pregunta ${number}`;
  const title = label ?? `Pregunta ${number}`;
  const promptLabel = contextLabel ? `Enunciado del ${contextLabel}` : `Enunciado de la pregunta ${number}`;
  const formatId = useId();
  return <fieldset className="instructor-question">
    <legend><span className="instructor-item-caption"><InstructorFormatIcon type={q.type} />{title}</span></legend>
    <div className="instructor-label"><label htmlFor={formatId}>Formato de {subject}</label>
      <select id={formatId} className="instructor-input" value={q.type ?? 'single_choice'} onChange={e => {
        if (hasInstructorQuestionResponses(q) && !window.confirm('Cambiar el formato reemplazará las respuestas configuradas de esta pregunta. ¿Continuar?')) return;
        const next = newInstructorQuestion(e.target.value as InstructorQuestionType);
        onChange({ ...next, id: q.id, titulo: next.type === 'completion' && !q.titulo ? next.titulo : q.titulo });
      }}>
        {INSTRUCTOR_QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
      </select>
    </div>
    <label className="instructor-label">{promptLabel}
      <textarea className="instructor-input" aria-label={promptLabel} maxLength={5000} value={q.titulo} onChange={e => onChange({ ...q, titulo: e.target.value })} />
    </label>

    {q.type === 'image_versus' ? <>
      <div className="instructor-versus-editor">
        <InstructorShortAnswerImage
          image={q.image_a}
          title="Imagen A"
          optional={false}
          ariaLabel="Imagen A del versus"
          targetLetter="A"
          description="Se mostrará a la izquierda. Puedes elegir una placa o subir una imagen."
          onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image_a') : undefined}
          onChange={image => {
            const next = { ...q }; if (image) next.image_a = image; else delete next.image_a; onChange(next);
          }}
        />
        <InstructorShortAnswerImage
          image={q.image_b}
          title="Imagen B"
          optional={false}
          ariaLabel="Imagen B del versus"
          targetLetter="B"
          description="Se mostrará a la derecha. Puedes elegir una placa o subir una imagen."
          onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image_b') : undefined}
          onChange={image => {
            const next = { ...q }; if (image) next.image_b = image; else delete next.image_b; onChange(next);
          }}
        />
      </div>
      <p className="instructor-muted">Este inciso muestra ambas imágenes lado a lado como referencia comparativa. No pide respuesta ni consume puntaje: el punto de la pregunta se divide entre los demás incisos evaluables.</p>
    </> : q.type === 'image_point' ? <>
      <InstructorShortAnswerImage image={q.image} allowAnnotations={false} onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined} onChange={image => {
        const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next);
      }} />
      <p className="instructor-muted">El participante podrá colocar uno o varios señalados sobre la imagen (numerados en orden) y deberá escribir una respuesta breve ligada a cada número. Se guardarán para revisión manual después de entregar.</p>
    </> : q.type === 'short_answer' ? <>
      <InstructorShortAnswerImage image={q.image} onChange={image => {
        const next = { ...q }; if (image) next.image = image; else delete next.image;
        onChange(next);
      }} onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined} />
      <p className="instructor-muted">Esta respuesta se revisa manualmente después de entregar. Puedes conservar referencias opcionales para preparar la revisión.</p>
      <label className="instructor-label">Referencias para revisión de {subject} (opcional)
        <textarea className="instructor-input" aria-label={`Respuestas aceptadas de ${subject}`} value={q.accepted_answers.join('\n')} onChange={e => onChange({ ...q, accepted_answers: e.target.value.split('\n') })} />
      </label>
    </> : q.type === 'completion' ? <>
      <InstructorShortAnswerImage
        image={q.image}
        ariaLabel="Imagen de referencia del inciso"
        description="Se mostrará debajo del enunciado. Puedes elegir una placa o subir una imagen."
        onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined}
        onChange={image => { const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next); }}
      />
      <p className="instructor-muted">Escribe {'{{1}}'}, {'{{2}}'}, etc. en el enunciado donde deba ir cada hueco, una vez por hueco. {answersHint}</p>
      {q.blanks.map((blank, i) => <label className="instructor-label" key={blank.id}>Respuestas del hueco {i + 1} de {subject}
        <textarea className="instructor-input" aria-label={`Respuestas del hueco ${i + 1} de ${subject}`} value={blank.accepted_answers.join('\n')} onChange={e => onChange({ ...q, blanks: q.blanks.map(b => b.id === blank.id ? { ...b, accepted_answers: e.target.value.split('\n') } : b) })} />
      </label>)}
      <div className="instructor-row">
        <button type="button" className="instructor-btn" disabled={q.blanks.length >= 12} onClick={() => onChange({ ...q,
          titulo: `${q.titulo} {{${q.blanks.length + 1}}}`, blanks: [...q.blanks, { id: crypto.randomUUID(), accepted_answers: [''] }],
        })}><Plus size={16} aria-hidden="true" />Añadir hueco</button>
        <button type="button" className="instructor-btn" disabled={q.blanks.length <= 1} onClick={() => onChange({ ...q,
          titulo: q.titulo.split(`{{${q.blanks.length}}}`).join(''), blanks: q.blanks.slice(0, -1),
        })}><Minus size={16} aria-hidden="true" />Quitar último hueco</button>
      </div>
      <p className="instructor-muted">{label ? 'El inciso' : 'La pregunta'} es {label ? 'correcto' : 'correcta'} si todos los huecos coinciden con una respuesta aceptada.</p>
    </> : q.type === 'matching' ? <>
      <InstructorShortAnswerImage
        image={q.image}
        ariaLabel="Imagen de referencia del inciso"
        description="Se mostrará debajo del enunciado. Puedes elegir una placa o subir una imagen."
        onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined}
        onChange={image => { const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next); }}
      />
      <p className="instructor-muted">Escribe cada término junto a su pareja correcta. Al responder, las opciones se mostrarán mezcladas.</p>
      {q.pairs.map((pair, i) => <div className="instructor-pair-editor" key={pair.id}>
        <label className="instructor-label">Término {i + 1} de {subject}
          <input className="instructor-input" maxLength={1000} value={pair.term} onChange={e => onChange({ ...q, pairs: q.pairs.map(p => p.id === pair.id ? { ...p, term: e.target.value } : p) })} />
        </label>
        <label className="instructor-label">Pareja {i + 1} de {subject}
          <input className="instructor-input" maxLength={1000} value={pair.definition} onChange={e => onChange({ ...q, pairs: q.pairs.map(p => p.id === pair.id ? { ...p, definition: e.target.value } : p) })} />
        </label>
      </div>)}
      <div className="instructor-row">
        <button type="button" className="instructor-btn" disabled={q.pairs.length >= 12} onClick={() => onChange({ ...q, pairs: [...q.pairs, { id: crypto.randomUUID(), option_id: crypto.randomUUID(), term: '', definition: '' }] })}><Link2 size={16} aria-hidden="true" />Añadir pareja</button>
        <button type="button" className="instructor-btn" disabled={q.pairs.length <= 2} onClick={() => onChange({ ...q, pairs: q.pairs.slice(0, -1) })}><Minus size={16} aria-hidden="true" />Quitar última pareja</button>
      </div>
      <p className="instructor-muted">{label ? 'El inciso' : 'La pregunta'} es {label ? 'correcto' : 'correcta'} si todas las parejas están bien relacionadas.</p>
    </> : <>
      <InstructorShortAnswerImage
        image={q.image}
        ariaLabel="Imagen de referencia del inciso"
        description="Se mostrará debajo del enunciado. Puedes elegir una placa o subir una imagen."
        onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined}
        onChange={image => { const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next); }}
      />
      <div className="instructor-answer-heading"><h4>Opciones de respuesta</h4><p>Marca el círculo de la respuesta correcta.</p></div>
      {q.options.map((option, i) => <div className={`instructor-option instructor-choice-edit${q.correct_option_id === option.id ? ' is-correct' : ''}`} key={option.id}>
        <input type="radio" name={`correct-${q.id}`} aria-label={`Opción correcta ${i + 1} de ${subject}`}
          checked={q.correct_option_id === option.id} onChange={() => onChange({ ...q, correct_option_id: option.id })} />
        <input className="instructor-input" aria-label={`Opción ${i + 1} de ${subject}`} maxLength={3000} value={option.texto}
          placeholder={`Escribe la opción ${i + 1}`}
          onChange={e => onChange({ ...q, options: q.options.map(o => o.id === option.id ? { ...o, texto: e.target.value } : o) })} />
      </div>)}
      <div className="instructor-row">
        <button type="button" className="instructor-btn" disabled={q.options.length >= 8} onClick={() => onChange({ ...q, options: [...q.options, { id: crypto.randomUUID(), texto: '' }] })}><Plus size={16} aria-hidden="true" />Añadir opción</button>
        <button type="button" className="instructor-btn" disabled={q.options.length <= 2} onClick={() => {
          const options = q.options.slice(0, -1);
          onChange({ ...q, options, correct_option_id: options.some(o => o.id === q.correct_option_id) ? q.correct_option_id : '' });
        }}><Minus size={16} aria-hidden="true" />Quitar última opción</button>
      </div>
    </>}
    <button type="button" className="instructor-btn instructor-btn-danger" style={{ marginTop: 16 }} onClick={() => {
      if (window.confirm(`¿Eliminar ${title.toLowerCase()}?`)) onRemove();
    }}><Trash2 size={16} aria-hidden="true" />Eliminar {title.toLowerCase()}</button>
  </fieldset>;
}
