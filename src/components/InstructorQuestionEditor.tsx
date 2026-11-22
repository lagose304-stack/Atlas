import { useId } from 'react';
import { CheckSquare, CircleDot, Link2, Minus, Plus, Trash2 } from 'lucide-react';
import InstructorFormatIcon from './InstructorFormatIcon';
import InstructorShortAnswerImage from './InstructorShortAnswerImage';
import {
  INSTRUCTOR_QUESTION_TYPES, INSTRUCTOR_VERSUS_PLATES, MAX_INSTRUCTOR_MATCHING_DISTRACTORS, hasInstructorQuestionResponses,
  changeInstructorQuestionFormat, incisoLetter, newInstructorVersusPrompts,
  type ChoiceQuestion, type InstructorQuestion, type InstructorQuestionType,
} from '../types/instructorQuestions';

type Props = { question: InstructorQuestion; index: number; label?: string; contextLabel?: string; onChange: (question: InstructorQuestion) => void; onRemove: () => void; onSelectImageFile?: (file: File, slot?: 'image' | 'image_a' | 'image_b') => void };
const answersHint = 'Una respuesta aceptada por línea. Se ignoran mayúsculas, tildes y espacios de más.';

export default function InstructorQuestionEditor({ question: q, index, label, contextLabel, onChange, onRemove, onSelectImageFile }: Props) {
  const number = index + 1;
  const subject = contextLabel ?? `pregunta ${number}`;
  const title = label ?? `Pregunta ${number}`;
  const promptLabel = contextLabel ? `Enunciado del ${contextLabel}` : `Enunciado de la pregunta ${number}`;
  const formatId = useId();
  const correctIds = (!q.type || q.type === 'single_choice') ? q.correct_option_ids : undefined;
  return <fieldset className="instructor-question">
    <legend><span className="instructor-item-caption"><InstructorFormatIcon type={q.type} multiple={!!correctIds} />{title}</span></legend>
    <div className="instructor-label"><label htmlFor={formatId}>Formato de {subject}</label>
      <select id={formatId} className="instructor-input"
        value={(!q.type || q.type === 'single_choice') ? (correctIds ? 'multiple_choice' : 'single_choice') : q.type}
        onChange={e => {
          const selectedFormat = e.target.value;
          const currentIsChoice = !q.type || q.type === 'single_choice';
          if (selectedFormat === 'multiple_choice') {
            if (currentIsChoice) {
              onChange({ ...q, correct_option_ids: q.correct_option_id ? [q.correct_option_id] : [] });
              return;
            }
          } else if (selectedFormat === 'single_choice') {
            if (currentIsChoice) {
              if (correctIds && correctIds.length > 1
                && !window.confirm('Al volver a selección única se conservará solo la primera opción correcta. ¿Continuar?')) return;
              const { correct_option_ids: selected, ...single } = q;
              onChange({ ...single, correct_option_id: q.options.find(option => selected?.includes(option.id))?.id ?? '' });
              return;
            }
          }
          if (hasInstructorQuestionResponses(q) && !window.confirm('Cambiar el formato reemplazará las respuestas configuradas de esta pregunta. ¿Continuar?')) return;
          const targetType = (selectedFormat === 'multiple_choice' ? 'single_choice' : selectedFormat) as InstructorQuestionType;
          const next = changeInstructorQuestionFormat(q, targetType);
          if (selectedFormat === 'multiple_choice') {
            onChange({ ...(next as ChoiceQuestion), correct_option_ids: [] });
          } else {
            onChange(next);
          }
        }}
      >
        <option value="single_choice">Selección única</option>
        <option value="multiple_choice">Selección múltiple</option>
        {INSTRUCTOR_QUESTION_TYPES.filter(type => type.value !== 'single_choice').map(type => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
    </div>
    {q.type !== 'image_versus' && q.alternate_image && <p className="instructor-muted">La segunda placa y sus señalados se conservan para cuando vuelvas a Versus.</p>}
    <label className="instructor-label">{promptLabel}
      <textarea className="instructor-input" aria-label={promptLabel} maxLength={5000} value={q.titulo} onChange={e => onChange({ ...q, titulo: e.target.value })} />
    </label>

    {q.type === 'image_versus' ? <>
      <label className="instructor-option">
        <input type="checkbox" checked={!!q.prompts} onChange={event => {
          if (event.target.checked) {
            onChange({ ...q, prompts: newInstructorVersusPrompts() });
          } else {
            if (q.prompts && Object.values(q.prompts).some(prompt => prompt.titulo.trim())
              && !window.confirm('Quitar las respuestas breves eliminará las consignas de este borrador. ¿Continuar?')) return;
            const { prompts: _prompts, ...versus } = q;
            onChange(versus);
          }
        }} />
        Pedir una respuesta breve por placa
      </label>
      <div className="instructor-versus-editor">
        {INSTRUCTOR_VERSUS_PLATES.map(plate => {
          const slot = `image_${plate}` as const;
          const letter = plate === 'a' ? 'A' : 'B';
          const prompts = q.prompts;
          const prompt = prompts?.[plate];
          return <div className="instructor-versus-column" key={plate}>
            <InstructorShortAnswerImage
              image={q[slot]}
              title={`Imagen ${letter}`}
              optional={false}
              ariaLabel={`Imagen ${letter} del versus`}
              targetLetter={letter}
              description="Puedes elegir una placa o subir una imagen."
              onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, slot) : undefined}
              onChange={image => {
                const next = { ...q };
                if (image) next[slot] = image; else delete next[slot];
                onChange(next);
              }}
            />
            {prompts && prompt && <label className="instructor-label">
              Consigna de la placa {letter}
              <textarea className="instructor-input instructor-versus-prompt" rows={2} maxLength={1000} value={prompt.titulo}
                onChange={event => onChange({ ...q, prompts: { ...prompts, [plate]: { ...prompt, titulo: event.target.value } } })} />
            </label>}
          </div>;
        })}
      </div>
      <p className="instructor-muted">{q.prompts
        ? 'Escribe las dos consignas antes de publicar. Cada respuesta se califica por separado en la revisión manual.'
        : 'Las dos placas se muestran como referencia comparativa, sin puntaje.'}</p>
    </> : q.type === 'image_point' ? <>
      <InstructorShortAnswerImage image={q.image} allowAnnotations={false} onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined} onChange={image => {
        const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next);
      }} />
      {!!q.image?.annotations?.length && <p className="instructor-muted">Los señalados guardados se conservan en el editor. El participante verá la imagen limpia.</p>}
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
      <p className="instructor-muted">Añade los espacios o huecos que desees. Puedes indicar los espacios visualmente en el enunciado (por ejemplo con guiones bajos _____) o usar {'{{1}}'}, {'{{2}}'} para incrustar el campo dentro del texto si lo prefieres. {answersHint}</p>
      {q.blanks.map((blank, i) => <label className="instructor-label" key={blank.id}>Respuestas correctas del hueco {i + 1} de {subject}
        <textarea className="instructor-input" value={blank.accepted_answers.join('\n')} onChange={e => onChange({ ...q, blanks: q.blanks.map(b => b.id === blank.id ? { ...b, accepted_answers: e.target.value.split('\n') } : b) })} />
      </label>)}
      <div className="instructor-row">
        <button type="button" className="instructor-btn" disabled={q.blanks.length >= 12} onClick={() => onChange({ ...q,
          titulo: q.titulo.includes('{{') ? `${q.titulo} {{${q.blanks.length + 1}}}` : q.titulo,
          blanks: [...q.blanks, { id: crypto.randomUUID(), accepted_answers: [''] }],
        })}><Plus size={16} aria-hidden="true" />Añadir hueco</button>
        <button type="button" className="instructor-btn" disabled={q.blanks.length <= 1} onClick={() => onChange({ ...q,
          titulo: q.titulo.split(`{{${q.blanks.length}}}`).join(''), blanks: q.blanks.slice(0, -1),
        })}><Minus size={16} aria-hidden="true" />Quitar último hueco</button>
      </div>
      <p className="instructor-muted">{label ? 'El inciso' : 'La pregunta'} es {label ? 'correcto' : 'correcta'} si todos los huecos coinciden con una respuesta aceptada.</p>
      <label className="instructor-label">Referencias para revisión de {subject} (opcional)
        <textarea className="instructor-input" maxLength={5000} value={q.review_reference ?? ''} onChange={event => onChange({ ...q, review_reference: event.target.value })} />
      </label>
      <p className="instructor-muted">Al revisar una entrega verás las respuestas correctas de cada hueco y esta referencia privada.</p>
      <InstructorShortAnswerImage
        image={q.image}
        ariaLabel="Imagen de referencia del inciso"
        description="Se mostrará debajo del enunciado. Puedes elegir una placa o subir una imagen."
        onSelectFile={onSelectImageFile ? file => onSelectImageFile(file, 'image') : undefined}
        onChange={image => { const next = { ...q }; if (image) next.image = image; else delete next.image; onChange(next); }}
      />
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
      <div className="instructor-matching-distractors" role="group" aria-labelledby={`${formatId}-distractors`}>
        <strong id={`${formatId}-distractors`}>Opciones incorrectas adicionales</strong>
        <p className="instructor-muted">Se mezclan con las parejas correctas en la lista de cada término.</p>
        {q.distractors?.map((option, index) => <div className="instructor-option" key={option.id}>
          <label className="instructor-label">Opción incorrecta {index + 1}
            <input className="instructor-input" maxLength={1000} value={option.texto} onChange={event => onChange({
              ...q, distractors: q.distractors?.map(item => item.id === option.id ? { ...item, texto: event.target.value } : item),
            })} />
          </label>
          <button type="button" className="instructor-btn instructor-btn-icon" aria-label={`Quitar opción incorrecta ${index + 1}`}
            onClick={() => onChange({ ...q, distractors: q.distractors?.filter(item => item.id !== option.id) })}><Trash2 size={16} aria-hidden="true" /></button>
        </div>)}
        <button type="button" className="instructor-btn" disabled={(q.distractors?.length ?? 0) >= MAX_INSTRUCTOR_MATCHING_DISTRACTORS}
          onClick={() => onChange({ ...q, distractors: [...(q.distractors ?? []), { id: crypto.randomUUID(), texto: '' }] })}>
          <Plus size={16} aria-hidden="true" />Añadir opción incorrecta
        </button>
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
      <div className="instructor-answer-heading"><h4>Opciones de respuesta</h4>
        <p>{correctIds ? 'Marca el cuadradito de todas las opciones correctas.' : 'Marca el círculo de la única respuesta correcta.'}</p>
      </div>
      <div className="instructor-choice-mode-bar">
        <div className="instructor-choice-mode-info">
          <span className="instructor-choice-mode-title">
            Modalidad: <strong>{correctIds ? 'Selección múltiple (cuadradito)' : 'Selección única (círculo)'}</strong>
          </span>
          <p className="instructor-muted">
            {correctIds
              ? 'Varias respuestas correctas. Los estudiantes podrán marcar varias opciones con check en un cuadradito.'
              : 'Una sola respuesta correcta. Los estudiantes solo podrán marcar una opción en un círculo.'}
          </p>
        </div>
        <button
          type="button"
          className="instructor-btn instructor-choice-toggle-btn"
          aria-label={correctIds ? 'Convertir a selección única' : 'Convertir a selección múltiple'}
          onClick={() => {
            if (correctIds) {
              if (correctIds.length > 1
                && !window.confirm('Al volver a selección única se conservará solo la primera opción correcta. ¿Continuar?')) return;
              const { correct_option_ids: selected, ...single } = q;
              onChange({ ...single, correct_option_id: q.options.find(option => selected?.includes(option.id))?.id ?? '' });
            } else {
              onChange({ ...q, correct_option_ids: q.correct_option_id ? [q.correct_option_id] : [] });
            }
          }}
        >
          {correctIds ? (
            <>
              <CircleDot size={16} aria-hidden="true" />
              <span>Convertir a selección única</span>
            </>
          ) : (
            <>
              <CheckSquare size={16} aria-hidden="true" />
              <span>Convertir a selección múltiple</span>
            </>
          )}
        </button>
      </div>
      {q.options.map((option, i) => {
        const checked = correctIds ? correctIds.includes(option.id) : q.correct_option_id === option.id;
        const letter = incisoLetter(i).toUpperCase();
        return <div className={`instructor-option instructor-choice-edit${checked ? ' is-correct' : ''}`} key={option.id}>
        <input type={correctIds ? 'checkbox' : 'radio'} name={`correct-${q.id}`} aria-label={`Opción correcta ${i + 1} de ${subject}`}
          checked={checked} onChange={event => {
            if (correctIds) {
              onChange({ ...q, correct_option_ids: event.target.checked ? [...correctIds, option.id] : correctIds.filter(id => id !== option.id) });
            } else {
              onChange({ ...q, correct_option_id: option.id });
            }
          }} />
        <span className="instructor-choice-prefix" aria-hidden="true">{letter}.</span>
        <input className="instructor-input" aria-label={`Opción ${i + 1} de ${subject}`} maxLength={3000} value={option.texto}
          placeholder={`Escribe la opción ${letter}`}
          onChange={e => onChange({ ...q, options: q.options.map(o => o.id === option.id ? { ...o, texto: e.target.value } : o) })} />
      </div>;
      })}
      <div className="instructor-row">
        <button type="button" className="instructor-btn" disabled={q.options.length >= 8} onClick={() => onChange({ ...q, options: [...q.options, { id: crypto.randomUUID(), texto: '' }] })}><Plus size={16} aria-hidden="true" />Añadir opción</button>
        <button type="button" className="instructor-btn" disabled={q.options.length <= 2} onClick={() => {
          const options = q.options.slice(0, -1);
          const removed = q.options[q.options.length - 1]?.id;
          onChange({ ...q, options, correct_option_id: q.correct_option_id === removed ? '' : q.correct_option_id,
            correct_option_ids: correctIds?.filter(id => id !== removed) });
        }}><Minus size={16} aria-hidden="true" />Quitar última opción</button>
      </div>
    </>}
    <button type="button" className="instructor-btn instructor-btn-danger" style={{ marginTop: 16 }} onClick={() => {
      if (window.confirm(`¿Eliminar ${title.toLowerCase()}?`)) onRemove();
    }}><Trash2 size={16} aria-hidden="true" />Eliminar {title.toLowerCase()}</button>
  </fieldset>;
}
