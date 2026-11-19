import { lazy, Suspense, useEffect, useState } from 'react';
import { Target, Trash2 } from 'lucide-react';
import InstructorAnnotationOverlay from './InstructorAnnotationOverlay';
import { getInstructorPointCoordinates, type InstructorAnswers, type InstructorPointCoordinate } from '../types/instructorQuestions';

const PointEditor = lazy(() => import('./PlateAnnotationViewerEditor'));

function serializePoints(points: InstructorPointCoordinate[]): InstructorAnswers[string] {
  if (points.length === 0) return '';
  if (points.length === 1) return points[0];
  return points;
}

export default function InstructorPointResponse({ url, instructions, answer, onChange, disabled = false }: {
  url: string; instructions: string; answer: InstructorAnswers[string] | undefined; onChange: (answer: InstructorAnswers[string]) => void; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (disabled) setEditing(false); }, [disabled]);
  const points = getInstructorPointCoordinates(answer);
  const hasPoints = points.length > 0;
  const missingTexts = points.filter(point => !(point.text ?? '').trim()).length;

  const updatePointText = (index: number, text: string) => {
    const next = points.map((pt, i) => (i === index ? { ...pt, text } : pt));
    onChange(serializePoints(next));
  };

  const removePoint = (index: number) => {
    const next = points.filter((_, i) => i !== index);
    onChange(serializePoints(next));
  };

  if (!url) {
    return <div className="instructor-point-response"><div className="instructor-reference-failed"><p>Todavía no se ha seleccionado una imagen para este inciso.</p></div></div>;
  }
  return <div className="instructor-point-response">
    <p className="instructor-muted">Abre la imagen y coloca uno o varios señalados en orden. Por cada señalado deberás escribir una respuesta breve ligada a su número. Puedes moverlos o eliminarlos antes de entregar.</p>
    <button type="button" disabled={disabled} className="instructor-reference-open" aria-label={hasPoints ? 'Editar señalado de respuesta' : 'Señalar en la imagen'} onClick={() => setEditing(true)}>
      <div className="instructor-reference-photo"><img src={url} alt="Imagen para señalar" onError={() => setFailed(true)} onLoad={event => { setFailed(false); setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }} />
        {size.width > 0 && points.map((pt, index) => <InstructorAnnotationOverlay key={index} marker={{ ...pt, label: `Tu señalado ${index + 1}` }} width={size.width} height={size.height} orderNumber={index + 1} />)}
      </div>
      <span><Target size={16} />{hasPoints ? (points.length > 1 ? `Editar mis señalados (${points.length})` : 'Editar mis señalados') : 'Colocar señalados'}</span>
    </button>
    {failed && <p role="alert" className="instructor-error">No se pudo cargar la imagen. Ábrela para reintentar.</p>}
    {hasPoints && (
      <div className="instructor-point-answers" aria-label="Respuestas de los señalados">
        {points.map((pt, index) => (
          <div className="instructor-point-answer-row" key={index}>
            <span className="instructor-point-answer-badge" aria-hidden="true">{index + 1}</span>
            <label className="instructor-label">
              Respuesta del señalado {index + 1}
              <input
                className="instructor-input"
                type="text"
                maxLength={1000}
                autoComplete="off"
                required
                disabled={disabled}
                placeholder={`Escribe el nombre o respuesta del señalado ${index + 1}`}
                value={pt.text ?? ''}
                onChange={event => updatePointText(index, event.target.value)}
              />
            </label>
            <button
              type="button"
              className="instructor-btn instructor-btn-danger instructor-btn-icon"
              disabled={disabled}
              aria-label={`Eliminar señalado ${index + 1}`}
              title={`Eliminar señalado ${index + 1}`}
              onClick={() => removePoint(index)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    )}
    <p className={hasPoints && missingTexts === 0 ? 'instructor-success' : 'instructor-muted'} role="status">
      {!hasPoints
        ? 'Todavía no has señalado una ubicación.'
        : missingTexts > 0
          ? `${points.length} ${points.length === 1 ? 'señalado colocado' : 'señalados colocados'}. Completa la respuesta breve de cada señalado para terminar este inciso.`
          : `${points.length} ${points.length === 1 ? 'señalado completado' : 'señalados completados'} en tu respuesta. Puedes editarlos antes de entregar.`}
    </p>
    {editing && <Suspense fallback={<p role="status">Abriendo imagen…</p>}><PointEditor
      imageSrc={url}
      imageAlt="Imagen para responder"
      answerPointMode
      showMarkerNumbers
      pointInstructions={instructions}
      initialSenalados={points.map(pt => pt.text ?? '')}
      initialSenaladosPos={points.map(pt => ({ x: pt.x, y: pt.y }))}
      onCancel={() => setEditing(false)}
      onSaveAll={(labels, positions) => {
        const clean: InstructorPointCoordinate[] = [];
        positions.forEach((pos, idx) => {
          if (!pos || clean.length >= 20) return;
          clean.push({ x: pos.x, y: pos.y, text: labels[idx] ?? '' });
        });
        onChange(serializePoints(clean));
        setEditing(false);
      }}
    /></Suspense>}
  </div>;
}
