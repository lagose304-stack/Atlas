import { lazy, Suspense, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Images, Target, Trash2, Upload } from 'lucide-react';
import type { InstructorReferenceImage } from '../types/instructorQuestions';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import InstructorReferenceImageView from './InstructorReferenceImageView';

const PlatePickerModal = lazy(async () => {
  const [picker] = await Promise.all([import('./comparador/PlatePickerModal'), import('../styles/comparador.css')]);
  return picker;
});
const PlateAnnotationViewerEditor = lazy(() => import('./PlateAnnotationViewerEditor'));
type Props = {
  image?: InstructorReferenceImage; onChange: (image?: InstructorReferenceImage) => void;
  onSelectFile?: (file: File) => void;
  allowAnnotations?: boolean;
  title?: string;
  optional?: boolean;
  description?: string;
  ariaLabel?: string;
  targetLetter?: 'A' | 'B';
};

export default function InstructorShortAnswerImage({
  image, onChange, onSelectFile, allowAnnotations = true,
  title = 'Imagen de referencia', optional = true, description, ariaLabel = 'Imagen de respuesta breve', targetLetter = 'A',
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [picker, setPicker] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [error, setError] = useState('');
  const helperText = description ?? `${allowAnnotations ? 'Se mostrará junto al campo de respuesta.' : 'El instructor colocará un señalado sobre esta imagen.'} Puedes elegir una placa o subir una imagen.`;
  return <section className="instructor-image-editor" aria-label={ariaLabel}>
    <div className="instructor-row instructor-between">
      <div><h4><ImagePlus size={18} aria-hidden="true" />{title}{optional && <span>Opcional</span>}</h4>
        <p>{helperText}</p></div>
    </div>
    {image && <div className="instructor-image-preview">{image.annotations?.length
      ? <InstructorReferenceImageView key={image.url} url={image.url} annotations={image.annotations} />
      : <img src={image.url} alt={`Vista previa de ${title.toLowerCase()}`} />}
      <span>{image.source === 'catalog' ? 'Imagen del catálogo' : image.url.startsWith('blob:') ? 'Imagen lista para subir al guardar' : 'Imagen subida'}</span>
    </div>}
    <div className="instructor-row">
      {image && allowAnnotations && <button type="button" className="instructor-btn" onClick={() => setAnnotating(true)}><Target size={16} aria-hidden="true" />{image.annotations?.length ? `Editar señalados (${image.annotations.length})` : 'Añadir señalado'}</button>}
      <button type="button" className="instructor-btn" onClick={() => { setError(''); setPicker(true); }}><Images size={16} aria-hidden="true" />Elegir del sitio</button>
      <button type="button" className="instructor-btn" disabled={!onSelectFile} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />Subir imagen</button>
      {image && <button type="button" className="instructor-btn instructor-btn-danger" onClick={() => { setError(''); onChange(undefined); }}><Trash2 size={16} aria-hidden="true" />Quitar imagen</button>}
    </div>
    {image && allowAnnotations && <p className="instructor-muted instructor-image-scope-note">Los señalados se guardan solo en este inciso. La imagen del catálogo conserva sus señalados originales.</p>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label={`Archivo de ${ariaLabel.toLowerCase()}`} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Elige una imagen PNG, JPEG o WebP.'); return; }
      if (file.size > 20 * 1024 * 1024) { setError('La imagen no puede superar 20 MB.'); return; }
      setError(''); onSelectFile?.(file);
    }} />
    {error && <p role="alert" className="instructor-error">{error}</p>}
    {annotating && image && <Suspense fallback={<p role="status">Abriendo editor de señalados…</p>}>
      <PlateAnnotationViewerEditor imageSrc={image.url} imageAlt={title} showMarkerNumbers initialSenalados={(image.annotations ?? []).map(marker => marker.label)}
        initialSenaladosPos={image.annotations ?? []} onCancel={() => setAnnotating(false)} onSaveAll={(labels, positions) => {
          const annotations = labels.flatMap((label, index) => { const position = positions[index]; return position ? [{ ...position, label }] : []; });
          onChange({ ...image, annotations }); setAnnotating(false);
        }} />
    </Suspense>}
    {picker && createPortal(<Suspense fallback={<div role="status">Abriendo catálogo de imágenes…</div>}>
      <PlatePickerModal isOpen title={`Elegir ${title.toLowerCase()} del sitio`} targetLetter={targetLetter} onClose={() => setPicker(false)} onSelectPlate={plate => {
        onChange({ url: getCloudinaryImageUrl(plate.photo_url, 'view'), source: 'catalog', plate_id: plate.id }); setPicker(false);
      }} />
    </Suspense>, document.body)}
  </section>;
}
