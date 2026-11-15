import { lazy, Suspense, useState } from 'react';
import { Target } from 'lucide-react';
import IdentificationAnnotationOverlay from './IdentificationAnnotationOverlay';
import { isInstructorPointAnswer, type InstructorAnswers } from '../types/instructorQuestions';

const PointEditor = lazy(() => import('./PlateAnnotationViewerEditor'));

export default function InstructorPointResponse({ url, instructions, answer, onChange }: {
  url: string; instructions: string; answer: InstructorAnswers[string] | undefined; onChange: (answer: InstructorAnswers[string]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const point = isInstructorPointAnswer(answer) ? answer : null;
  return <div className="instructor-point-response">
    <p className="instructor-muted">Abre la imagen y coloca un único señalado sobre la estructura indicada. Puedes moverlo o eliminarlo antes de entregar.</p>
    <button type="button" className="instructor-reference-open" aria-label={point ? 'Editar señalado de respuesta' : 'Señalar en la imagen'} onClick={() => setEditing(true)}>
      <div className="instructor-reference-photo"><img src={url} alt="Imagen para señalar" onError={() => setFailed(true)} onLoad={event => { setFailed(false); setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }} />
        {point && size.width > 0 && <IdentificationAnnotationOverlay marker={{ ...point, label: 'Tu señalado' }} width={size.width} height={size.height} />}
      </div>
      <span><Target size={16} />{point ? 'Editar mi señalado' : 'Colocar mi señalado'}</span>
    </button>
    {failed && <p role="alert" className="instructor-error">No se pudo cargar la imagen. Ábrela para reintentar.</p>}
    <p className={point ? 'instructor-success' : 'instructor-muted'} role="status">{point ? 'Señalado añadido a tu respuesta. Puedes editarlo antes de entregar.' : 'Todavía no has señalado una ubicación.'}</p>
    {editing && <Suspense fallback={<p role="status">Abriendo imagen…</p>}><PointEditor imageSrc={url} imageAlt="Imagen para responder" singlePickerMode answerPointMode pointInstructions={instructions} targetLabel="Tu señalado"
      initialLocation={point} onCancel={() => setEditing(false)} onSaveSingle={location => {
        onChange(location ? { x: location.x, y: location.y } : ''); setEditing(false);
      }} /></Suspense>}
  </div>;
}
