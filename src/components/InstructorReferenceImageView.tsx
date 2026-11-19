import { lazy, Suspense, useState } from 'react';
import { Expand, ImageOff } from 'lucide-react';
import InstructorAnnotationOverlay from './InstructorAnnotationOverlay';
import type { InstructorImageAnnotation } from '../types/instructorQuestions';

const ImageViewerModal = lazy(() => import('./ImageViewerModal'));

export default function InstructorReferenceImageView({ url, annotations = [], alwaysShowNumbers = false }: { url: string; annotations?: InstructorImageAnnotation[]; alwaysShowNumbers?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Un nombre neutro común permite mostrar todo el grupo sin revelar las etiquetas privadas.
  const publicMarkers = annotations.map(marker => ({ ...marker, label: 'Señalado' }));
  const showNumbers = alwaysShowNumbers ? publicMarkers.length > 0 : publicMarkers.length > 1;
  return <div className="instructor-reference-figure">
    {!url ? <div className="instructor-reference-failed"><ImageOff size={24} aria-hidden="true" /><p>Todavía no se ha seleccionado una imagen para este espacio.</p></div>
      : failed ? <div className="instructor-reference-failed"><ImageOff size={24} aria-hidden="true" /><p>No se pudo cargar la imagen.</p><button type="button" className="instructor-btn" onClick={() => setFailed(false)}>Reintentar imagen</button></div>
      : <button type="button" className="instructor-reference-open" aria-label="Ampliar imagen de referencia" onClick={() => setExpanded(true)}>
        <div className="instructor-reference-photo"><img src={url} alt="Imagen de referencia del inciso" onError={() => setFailed(true)} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
          {size.width > 0 && publicMarkers.map((marker, index) => <InstructorAnnotationOverlay key={index} marker={marker} width={size.width} height={size.height} orderNumber={showNumbers ? index + 1 : undefined} />)}
        </div>
        <span><Expand size={15} aria-hidden="true" />Ampliar imagen</span>
      </button>}
    {expanded && <Suspense fallback={<p role="status">Abriendo imagen…</p>}><ImageViewerModal src={url} hideSidebar showMarkerNumbers={showNumbers} senalados={publicMarkers.map(marker => marker.label)} senaladosMeta={publicMarkers} onClose={() => setExpanded(false)} /></Suspense>}
  </div>;
}
