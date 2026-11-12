import { useId } from 'react';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { WEEKLY_FACTS_CONTENT } from '../blocks/weeklyHistologyFactsData';

export default function WeeklyHistologyFactsEditor({ content, onChange, onPickImage }: {
  content: Record<string, string>;
  onChange: (updates: Record<string, string>) => void;
  onPickImage: (field: string) => void;
}) {
  const id = useId();
  const swapFacts = () => {
    const updates: Record<string, string> = {};
    Object.keys(WEEKLY_FACTS_CONTENT).filter(key => key.startsWith('fact_1_')).forEach(key => {
      const other = key.replace('fact_1_', 'fact_2_');
      updates[key] = content[other] ?? WEEKLY_FACTS_CONTENT[other];
      updates[other] = content[key] ?? WEEKLY_FACTS_CONTENT[key];
    });
    onChange(updates);
  };
  return <div className="weekly-facts-editor">
    <label className="visual-properties-field"><span>Título del componente</span><input value={content.title ?? ''} onChange={event => onChange({ title: event.target.value })} /></label>
    <label className="visual-properties-field"><span>Datos visibles</span><select value={content.facts_count || '2'} onChange={event => onChange({ facts_count: event.target.value })}><option value="2">Dos datos</option><option value="1">Un dato</option></select></label>
    <label><input type="checkbox" checked={content.facts_visible !== 'false'} onChange={event => onChange({ facts_visible: String(event.target.checked) })} /> Mostrar componente en la página pública</label>
    {content.facts_count !== '1' && <button type="button" onClick={swapFacts}>Intercambiar datos</button>}
    {[1, 2].slice(0, content.facts_count === '1' ? 1 : 2).map(index => {
      const prefix = 'fact_' + index + '_';
      const image = content[prefix + 'image_url'];
      return <fieldset key={index}>
        <legend>Dato {index}</legend>
        {[
          ['topic', 'Tema o etiqueta'], ['title', 'Título'], ['description', 'Descripción'], ['clue', 'Pista de observación'],
        ].map(([field, label]) => <label key={field} className="visual-properties-field" htmlFor={id + prefix + field}>
          <span>{label}</span>
          <textarea id={id + prefix + field} rows={field === 'description' ? 5 : 2} value={content[prefix + field] || ''} onChange={event => onChange({ [prefix + field]: event.target.value })} />
        </label>)}
        {image && <img className="weekly-facts-editor__preview" src={getCloudinaryImageUrl(image, 'view')} alt={'Imagen del dato ' + index} />}
        <button type="button" onClick={() => onPickImage(prefix + 'image_url')}>{image ? 'Cambiar imagen de referencia' : 'Elegir imagen o GIF de referencia'}</button>
        <button type="button" onClick={() => onChange({ [prefix + 'image_url']: '', [prefix + 'illustration']: index === 1 ? 'liver' : 'henle' })}>Restaurar ilustración original</button>
        <button type="button" onClick={() => onChange({ [prefix + 'image_url']: '', [prefix + 'illustration']: 'none' })}>Ocultar imagen</button>
        <label className="visual-properties-field"><span>Ilustración de respaldo</span><select value={content[prefix + 'illustration'] || 'none'} onChange={event => onChange({ [prefix + 'illustration']: event.target.value })}><option value="liver">Tres vistas del hígado</option><option value="henle">Asa de Henle del dromedario</option><option value="none">Sin ilustración</option></select></label>
        <label className="visual-properties-field"><span>Descripción accesible de la imagen</span><input value={content[prefix + 'image_alt'] || ''} onChange={event => onChange({ [prefix + 'image_alt']: event.target.value })} /></label>
        <label className="visual-properties-field"><span>Ajuste de imagen</span><select value={content[prefix + 'image_fit'] || 'contain'} onChange={event => onChange({ [prefix + 'image_fit']: event.target.value })}><option value="contain">Mostrar completa</option><option value="cover">Llenar el marco</option></select></label>
      </fieldset>;
    })}
  </div>;
}
