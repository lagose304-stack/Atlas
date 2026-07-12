import React, { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Copy, ImagePlus, Italic, Link2, List, ListOrdered, Palette, RemoveFormatting, RotateCcw, SlidersHorizontal, Strikethrough, Trash2, Type, Underline, X } from 'lucide-react';
import { getBlockMeta } from '../blocks/blockRegistry';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import type { ContentBlock } from '../../types/contentBlocks';

interface VisualBlockPropertiesProps {
  block: ContentBlock;
  onChange: (updates: Record<string, string>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPickImage: (fieldKey: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

const TextAreaField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <label className="visual-properties-field">
    <span>{label}</span>
    <textarea value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} rows={4} />
  </label>
);

const ImageField: React.FC<{
  url: string;
  onPick: () => void;
  onClear: () => void;
}> = ({ url, onPick, onClear }) => (
  <div className="visual-properties-image-field">
    {url ? <img src={getCloudinaryImageUrl(url, 'thumbSmall')} alt="Imagen del bloque" /> : <div>Sin imagen</div>}
    <button type="button" onClick={onPick}><ImagePlus size={16} /> {url ? 'Cambiar imagen' : 'Elegir imagen'}</button>
    {url && <button type="button" className="link-danger" onClick={onClear}>Quitar imagen</button>}
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => {
  const activeOption = options.find(option => option.value === value);
  return <label className="visual-properties-field">
      <span>{label}</span>
      <select className={value ? 'has-active-value' : ''} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {value && activeOption && <small className="visual-properties-active-value">Activo: {activeOption.label}</small>}
    </label>;
};

const NumberField: React.FC<{
  label: string;
  value: string;
  min: number;
  max: number;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ label, value, min, max, placeholder, onChange }) => (
  <label className="visual-properties-field">
    <span>{label}</span>
    <input type="number" min={min} max={max} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
  </label>
);

const COLOR_PRESETS = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#0f172a', '#000000',
  '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a',
  '#dcfce7', '#86efac', '#22c55e', '#15803d',
  '#fef9c3', '#fde047', '#eab308', '#a16207',
  '#ffedd5', '#fb923c', '#ea580c',
  '#fee2e2', '#f87171', '#dc2626', '#991b1b',
  '#f3e8ff', '#c084fc', '#9333ea', '#6b21a8',
  '#fce7f3', '#f472b6', '#db2777',
];

const ColorField: React.FC<{
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}> = ({ label, value, fallback, onChange }) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const current = value || fallback;
  return (
    <div className="visual-color-field">
      <button
        type="button"
        className="visual-color-field-heading"
        onClick={() => setShowPalette(open => !open)}
        aria-expanded={showPalette}
      >
        <span>{label}</span>
        <span className="visual-color-current"><code>{current.toUpperCase()}</code><i style={{ background: current }} aria-hidden="true" /><b>{showPalette ? '−' : '+'}</b></span>
      </button>
      {showPalette && <div className="visual-color-picker-body">
       <div className="visual-color-palette" role="group" aria-label={`Colores para ${label}`}>
        {COLOR_PRESETS.map(color => (
          <button
            key={color}
            type="button"
            className={current.toLowerCase() === color ? 'is-selected' : ''}
            style={{ background: color }}
            onClick={() => onChange(color)}
            title={color}
            aria-label={`Usar color ${color}`}
          />
        ))}
      </div>
      <button type="button" className="visual-color-custom-toggle" onClick={() => setShowCustom(open => !open)} aria-expanded={showCustom}>
        <Palette size={15} /> {showCustom ? 'Ocultar color personalizado' : 'Color personalizado'}
      </button>
       {showCustom && <div className="visual-color-custom"><input type="color" value={current} onChange={event => onChange(event.target.value)} /><code>{current.toUpperCase()}</code></div>}
      </div>}
    </div>
  );
};

const GalleryImages: React.FC<{
  content: Record<string, string>;
  fields: Array<{ url: string; caption: string; label: string }>;
  progressive?: boolean;
  onChange: (updates: Record<string, string>) => void;
  onPickImage: (fieldKey: string) => void;
}> = ({ content, fields, progressive = false, onChange, onPickImage }) => {
  const lastUsedIndex = fields.reduce((last, field, index) => content[field.url] ? index : last, -1);
  const visibleFields = progressive ? fields.slice(0, Math.min(fields.length, Math.max(1, lastUsedIndex + 2))) : fields;
  return (
  <div className="visual-properties-gallery-fields">
    {visibleFields.map(field => (
      <div key={field.url} className="visual-properties-gallery-item">
        <strong>{field.label}</strong>
        <ImageField
          url={content[field.url] ?? ''}
          onPick={() => onPickImage(field.url)}
          onClear={() => onChange({ [field.url]: '' })}
        />
        <TextAreaField
          label="Pie de imagen"
          value={content[field.caption] ?? ''}
          onChange={value => onChange({ [field.caption]: value })}
        />
      </div>
    ))}
  </div>
  );
};

const VisualBlockProperties: React.FC<VisualBlockPropertiesProps> = ({
  block,
  onChange,
  onDuplicate,
  onDelete,
  onPickImage,
  onClose,
  embedded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'appearance' | 'text' | 'layout' | 'buttons'>(embedded ? 'appearance' : 'content');
  const [textState, setTextState] = useState<Record<string, string | boolean>>({});
  const [activeTextEditorId, setActiveTextEditorId] = useState(block.id);
  const content = block.content;
  const meta = getBlockMeta(block.block_type);
  const sendTextCommand = (command: string, value?: string) => {
    window.dispatchEvent(new CustomEvent('atlas-rich-text-command', { detail: { editorId: activeTextEditorId, command, value } }));
  };
  React.useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      const editorId = String(detail?.editorId || '');
      if (!detail || (editorId !== block.id && !editorId.startsWith(`${block.id}:`))) return;
      setActiveTextEditorId(editorId);
      const attrs = (detail.attrs || {}) as Record<string, string>;
      setTextState({ ...attrs, ...detail } as Record<string, string | boolean>);
    };
    window.addEventListener('atlas-rich-text-state', handleState);
    return () => window.removeEventListener('atlas-rich-text-state', handleState);
  }, [block.id]);

  const renderContentFields = () => {
    if (['heading', 'subheading', 'paragraph', 'callout'].includes(block.block_type)) {
      return <TextAreaField label="Texto" value={content.text ?? ''} placeholder="Escribe aquí…" onChange={text => onChange({ text })} />;
    }
    if (block.block_type === 'section') {
      return (
        <>
          <TextAreaField label="Etiqueta superior (opcional)" value={content.eyebrow ?? ''} onChange={eyebrow => onChange({ eyebrow })} />
          <TextAreaField label="Título de la sección" value={content.title ?? ''} onChange={title => onChange({ title })} />
          <TextAreaField label="Descripción" value={content.subtitle ?? ''} onChange={subtitle => onChange({ subtitle })} />
        </>
      );
    }
    if (block.block_type === 'list') {
      return <TextAreaField label="Elementos de la lista" value={content.items ?? ''} placeholder="Un elemento por línea" onChange={items => onChange({ items })} />;
    }
    if (block.block_type === 'weekly_publication') {
      return <>
        <TextAreaField label="Etiqueta superior" value={content.eyebrow ?? ''} onChange={eyebrow => onChange({ eyebrow })} />
        <TextAreaField label="Título principal" value={content.title ?? ''} onChange={title => onChange({ title })} />
        <TextAreaField label="Primer tema de la semana" value={content.topic_1 ?? ''} onChange={topic_1 => onChange({ topic_1 })} />
        <TextAreaField label="Segundo tema (opcional)" value={content.topic_2 ?? ''} onChange={topic_2 => onChange({ topic_2 })} />
        <ImageField url={content.image_url ?? ''} onPick={() => onPickImage('image_url')} onClear={() => onChange({ image_url: '', weekly_image_source: '', weekly_placa_id: '' })} />
        <TextAreaField label="Nombre de la placa semanal" value={content.image_caption ?? ''} onChange={image_caption => onChange({ image_caption })} />
      </>;
    }
    if (block.block_type === 'image') {
      return (
        <>
          <ImageField url={content.url ?? ''} onPick={() => onPickImage('url')} onClear={() => onChange({ url: '' })} />
          <TextAreaField label="Pie de imagen" value={content.caption ?? ''} onChange={caption => onChange({ caption })} />
          <label className="visual-properties-field"><span>Texto alternativo para accesibilidad</span><input value={content.image_alt || ''} onChange={event => onChange({ image_alt: event.target.value })} placeholder="Describe brevemente lo que muestra la imagen" /></label>
        </>
      );
    }
    if (block.block_type === 'text_image') {
      return (
        <>
          <TextAreaField label="Texto" value={content.text ?? ''} onChange={text => onChange({ text })} />
          <ImageField url={content.image_url ?? ''} onPick={() => onPickImage('image_url')} onClear={() => onChange({ image_url: '' })} />
          <TextAreaField label="Pie de imagen" value={content.image_caption ?? ''} onChange={image_caption => onChange({ image_caption })} />
          <label className="visual-properties-field"><span>Texto alternativo para accesibilidad</span><input value={content.ti_image_alt || ''} onChange={event => onChange({ ti_image_alt: event.target.value })} placeholder="Describe la imagen" /></label>
          <SelectField label="Posición de la imagen" value={content.image_position || 'right'} options={[{ value: 'left', label: 'A la izquierda' }, { value: 'right', label: 'A la derecha' }]} onChange={image_position => onChange({ image_position })} />
          <SelectField label="Cómo encaja la imagen" value={content.ti_image_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio (puede recortar)' }, { value: 'contain', label: 'Mostrar completa' }]} onChange={ti_image_fit => onChange({ ti_image_fit })} />
        </>
      );
    }
    if (block.block_type === 'columns_2') {
      return (
        <>
          <TextAreaField label="Columna izquierda" value={content.col_1 || content.left || ''} onChange={col_1 => onChange({ col_1, left: col_1 })} />
          <TextAreaField label="Columna derecha" value={content.col_2 || content.right || ''} onChange={col_2 => onChange({ col_2, right: col_2 })} />
          {Number(content.columns || 2) >= 3 && <TextAreaField label="Columna 3" value={content.col_3 || ''} onChange={col_3 => onChange({ col_3 })} />}
          {Number(content.columns || 2) >= 4 && <TextAreaField label="Columna 4" value={content.col_4 || ''} onChange={col_4 => onChange({ col_4 })} />}
          <SelectField label="Número de columnas" value={content.columns || '2'} options={[{ value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }, { value: '4', label: 'Cuatro columnas' }]} onChange={columns => onChange({ columns })} />
        </>
      );
    }
    if (block.block_type === 'two_images') {
      return <><GalleryImages content={content} fields={[
        { url: 'image_url_left', caption: 'image_caption_left', label: 'Imagen izquierda' },
        { url: 'image_url_right', caption: 'image_caption_right', label: 'Imagen derecha' },
      ]} onChange={onChange} onPickImage={onPickImage} />
        <label className="visual-properties-field"><span>Texto alternativo izquierdo</span><input value={content.image_alt_left || ''} onChange={event => onChange({ image_alt_left: event.target.value })} placeholder="Describe la primera imagen" /></label>
        <label className="visual-properties-field"><span>Texto alternativo derecho</span><input value={content.image_alt_right || ''} onChange={event => onChange({ image_alt_right: event.target.value })} placeholder="Describe la segunda imagen" /></label>
      </>;
    }
    if (block.block_type === 'three_images') {
      return <><GalleryImages content={content} fields={[1, 2, 3].map(number => ({
        url: `image_url_${number}`, caption: `image_caption_${number}`, label: `Imagen ${number}`,
      }))} onChange={onChange} onPickImage={onPickImage} />
        {[1, 2, 3].map(number => <label key={number} className="visual-properties-field"><span>Texto alternativo {number}</span><input value={content[`image_alt_${number}`] || ''} onChange={event => onChange({ [`image_alt_${number}`]: event.target.value })} placeholder={`Describe la imagen ${number}`} /></label>)}
      </>;
    }
    if (block.block_type === 'callout') {
      return <>
        <TextAreaField label="Mensaje destacado" value={content.text ?? ''} onChange={text => onChange({ text })} />
        <SelectField label="Tipo de mensaje" value={content.variant || 'info'} options={[{ value: 'info', label: 'Información' }, { value: 'success', label: 'Éxito' }, { value: 'warning', label: 'Advertencia' }, { value: 'danger', label: 'Importante' }]} onChange={variant => onChange({ variant })} />
      </>;
    }
    if (block.block_type === 'divider') {
      return <><SelectField label="Diseño del separador" value={content.style || 'gradient'} options={[{ value: 'gradient', label: 'Línea con degradado' }, { value: 'solid', label: 'Línea continua' }, { value: 'dashed', label: 'Línea de guiones' }, { value: 'dots', label: 'Puntos' }, { value: 'labeled', label: 'Con texto central' }]} onChange={style => onChange({ style })} />{content.style === 'labeled' && <label className="visual-properties-field"><span>Texto central</span><input value={content.divider_label || ''} onChange={event => onChange({ divider_label: event.target.value })} placeholder="Ejemplo: Siguiente tema" /></label>}</>;
    }
    if (block.block_type === 'carousel' || block.block_type === 'text_carousel') {
      const imageFields = Array.from({ length: block.block_type === 'carousel' ? 10 : 6 }, (_, index) => ({
        url: `image_url_${index + 1}`, caption: `image_cap_${index + 1}`, label: `Imagen ${index + 1}`,
      }));
      return <>
        {block.block_type === 'text_carousel' && <TextAreaField label="Texto que acompaña la galería" value={content.text || ''} onChange={text => onChange({ text })} />}
        <GalleryImages content={content} fields={imageFields} progressive onChange={onChange} onPickImage={onPickImage} />
        {imageFields.map((field, index) => content[field.url] ? <label key={field.url} className="visual-properties-field"><span>Texto alternativo {index + 1}</span><input value={content[`image_alt_${index + 1}`] || ''} onChange={event => onChange({ [`image_alt_${index + 1}`]: event.target.value })} placeholder={`Describe la imagen ${index + 1}`} /></label> : null)}
        <SelectField label="Movimiento de la galería" value={content.auto || 'true'} options={[{ value: 'true', label: 'Automático' }, { value: 'false', label: 'Solo con flechas' }]} onChange={auto => onChange({ auto })} />
        <SelectField label="Tiempo entre imágenes" value={content.interval || '4'} options={[2, 3, 4, 5, 8].map(seconds => ({ value: String(seconds), label: `${seconds} segundos` }))} onChange={interval => onChange({ interval })} />
      </>;
    }
    if (block.block_type === 'double_carousel') {
      const galleryFields = (side: 'left' | 'right') => Array.from({ length: 5 }, (_, index) => ({
        url: `${side}_image_url_${index + 1}`,
        caption: `${side}_image_cap_${index + 1}`,
        label: `Imagen ${index + 1}`,
      }));
      return <>
        <strong className="visual-properties-group-title">Galería izquierda</strong>
        <GalleryImages content={content} fields={galleryFields('left')} progressive onChange={onChange} onPickImage={onPickImage} />
        {galleryFields('left').map((field, index) => content[field.url] ? <label key={`${field.url}-alt`} className="visual-properties-field"><span>Texto alternativo izquierdo {index + 1}</span><input value={content[`left_image_alt_${index + 1}`] || ''} onChange={event => onChange({ [`left_image_alt_${index + 1}`]: event.target.value })} /></label> : null)}
        <strong className="visual-properties-group-title">Galería derecha</strong>
        <GalleryImages content={content} fields={galleryFields('right')} progressive onChange={onChange} onPickImage={onPickImage} />
        {galleryFields('right').map((field, index) => content[field.url] ? <label key={`${field.url}-alt`} className="visual-properties-field"><span>Texto alternativo derecho {index + 1}</span><input value={content[`right_image_alt_${index + 1}`] || ''} onChange={event => onChange({ [`right_image_alt_${index + 1}`]: event.target.value })} /></label> : null)}
        <SelectField label="Movimiento de las galerías" value={content.auto || 'true'} options={[{ value: 'true', label: 'Automático' }, { value: 'false', label: 'Solo con flechas' }]} onChange={auto => onChange({ auto })} />
        <SelectField label="Tiempo entre imágenes" value={content.interval || '4'} options={[2, 3, 4, 5, 8].map(seconds => ({ value: String(seconds), label: `${seconds} segundos` }))} onChange={interval => onChange({ interval })} />
      </>;
    }
    return <p className="visual-properties-hint">Este bloque no contiene texto ni imágenes editables.</p>;
  };

  const hasLayoutOptions = ['section', 'columns_2', 'image', 'text_image', 'two_images', 'three_images', 'callout', 'weekly_publication', 'list', 'divider', 'carousel', 'text_carousel', 'double_carousel'].includes(block.block_type);
  const renderLayoutFields = () => {
    if (block.block_type === 'section') {
      return <>
        <p className="visual-properties-hint">La sección agrupa todos los componentes que estén debajo hasta encontrar otra sección.</p>
        <SelectField label="Diseño del grupo" value={content.section_layout || 'guided'} options={[{ value: 'guided', label: 'Guía lateral' }, { value: 'card', label: 'Tarjeta contenedora' }, { value: 'band', label: 'Banda destacada' }, { value: 'minimal', label: 'Agrupación invisible' }]} onChange={section_layout => onChange({ section_layout })} />
        <SelectField label="Encabezado" value={content.section_header_style || 'surface'} options={[{ value: 'surface', label: 'Superficie suave' }, { value: 'accent', label: 'Con franja de acento' }, { value: 'minimal', label: 'Solo texto' }]} onChange={section_header_style => onChange({ section_header_style })} />
        <SelectField label="Tono del encabezado" value={content.tone || 'neutral'} options={[{ value: 'neutral', label: 'Neutro' }, { value: 'info', label: 'Informativo' }, { value: 'accent', label: 'Con color de acento' }]} onChange={tone => onChange({ tone })} />
        <SelectField label="Guía lateral de contenidos" value={content.section_guide || 'true'} options={[{ value: 'true', label: 'Mostrar guía' }, { value: 'false', label: 'Sin guía' }]} onChange={section_guide => onChange({ section_guide })} />
        <label className="wide"><span>Separación entre componentes: {content.section_gap || 16}px</span><input type="range" min="4" max="48" value={Number(content.section_gap || 16)} onChange={event => onChange({ section_gap: event.target.value })} /></label>
      </>;
    }
    if (block.block_type === 'columns_2') {
      return <>
        <SelectField label="Número de columnas" value={content.columns || '2'} options={[{ value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }, { value: '4', label: 'Cuatro columnas' }]} onChange={columns => onChange({ columns })} />
        {(content.columns || '2') === '2' && <SelectField label="Proporción" value={content.ratio || '1:1'} options={[{ value: '1:1', label: 'Mismo ancho' }, { value: '2:1', label: 'Izquierda más ancha' }, { value: '1:2', label: 'Derecha más ancha' }]} onChange={ratio => onChange({ ratio })} />}
        <SelectField label="Presentación" value={content.column_style || 'cards'} options={[{ value: 'cards', label: 'Tarjetas comparativas' }, { value: 'soft', label: 'Bloques suaves' }, { value: 'plain', label: 'Columnas limpias' }]} onChange={column_style => onChange({ column_style })} />
        <SelectField label="Alineación vertical" value={content.column_vertical_align || 'start'} options={[{ value: 'start', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'end', label: 'Abajo' }, { value: 'stretch', label: 'Igualar alturas' }]} onChange={column_vertical_align => onChange({ column_vertical_align })} />
        <label className="wide"><span>Separación entre columnas: {content.column_gap || 20}px</span><input type="range" min="4" max="48" value={Number(content.column_gap || 20)} onChange={event => onChange({ column_gap: event.target.value })} /></label>
        {Array.from({ length: Number(content.columns || 2) }, (_, index) => <label key={index} className="visual-properties-field"><span>Título columna {index + 1} (opcional)</span><input value={content[`col_title_${index + 1}`] || ''} onChange={event => onChange({ [`col_title_${index + 1}`]: event.target.value })} /></label>)}
      </>;
    }
    if (block.block_type === 'image') {
      return <>
        <SelectField label="Tamaño predefinido" value={content.size || 'large'} options={[{ value: 'small', label: 'Pequeña' }, { value: 'medium', label: 'Mediana' }, { value: 'large', label: 'Grande' }]} onChange={size => onChange({ size })} />
        <SelectField label="Alineación" value={content.align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={align => onChange({ align })} />
        <NumberField label="Ancho de la imagen (%)" value={content.image_width || '100'} min={20} max={100} onChange={image_width => onChange({ image_width: image_width || '100' })} />
        <NumberField label="Alto de la imagen (px)" value={content.image_height || ''} min={0} max={1200} placeholder="Automático" onChange={image_height => onChange({ image_height })} />
        <SelectField label="Recorte" value={content.image_fit || 'contain'} options={[{ value: 'contain', label: 'Mostrar imagen completa' }, { value: 'cover', label: 'Llenar el espacio (puede recortar)' }]} onChange={image_fit => onChange({ image_fit })} />
        <SelectField label="Proporción" value={content.image_aspect || 'auto'} options={[{ value: 'auto', label: 'Proporción original' }, { value: 'square', label: 'Cuadrada (1:1)' }, { value: 'portrait', label: 'Vertical (4:5)' }, { value: 'landscape', label: 'Horizontal (4:3)' }, { value: 'wide', label: 'Panorámica (16:9)' }]} onChange={image_aspect => onChange({ image_aspect })} />
        <SelectField label="Punto de enfoque" value={content.image_position || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Parte superior' }, { value: 'center bottom', label: 'Parte inferior' }, { value: 'left center', label: 'Lado izquierdo' }, { value: 'right center', label: 'Lado derecho' }]} onChange={image_position => onChange({ image_position })} />
        <SelectField label="Prioridad de carga pública" value={content.image_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, para imagen principal' }]} onChange={image_loading => onChange({ image_loading })} />
      </>;
    }
    if (block.block_type === 'text_image') {
      return <>
        <SelectField label="Posición de la imagen" value={content.image_position || 'right'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }]} onChange={image_position => onChange({ image_position })} />
        <SelectField label="Posición vertical del texto" value={content.ti_vertical_align || 'start'} options={[{ value: 'start', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'end', label: 'Abajo' }]} onChange={ti_vertical_align => onChange({ ti_vertical_align })} />
        <NumberField label="Ancho de la imagen (%)" value={content.ti_image_width || '42'} min={20} max={70} onChange={ti_image_width => onChange({ ti_image_width: ti_image_width || '42' })} />
        <NumberField label="Alto de la imagen (px)" value={content.ti_image_height || ''} min={0} max={1000} placeholder="Automático" onChange={ti_image_height => onChange({ ti_image_height })} />
        <SelectField label="Recorte" value={content.ti_image_fit || 'cover'} options={[{ value: 'contain', label: 'Mostrar imagen completa' }, { value: 'cover', label: 'Llenar el espacio (puede recortar)' }]} onChange={ti_image_fit => onChange({ ti_image_fit })} />
        <SelectField label="Proporción de la imagen" value={content.ti_image_aspect || 'auto'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={ti_image_aspect => onChange({ ti_image_aspect })} />
        <SelectField label="Punto de enfoque" value={content.ti_object_position || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={ti_object_position => onChange({ ti_object_position })} />
        <SelectField label="Prioridad de carga pública" value={content.ti_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={ti_loading => onChange({ ti_loading })} />
      </>;
    }
    if (block.block_type === 'two_images') {
      return <>
        <SelectField label="Proporción de columnas" value={content.two_ratio || 'equal'} options={[{ value: 'equal', label: 'Mismo ancho' }, { value: 'left', label: 'Izquierda protagonista' }, { value: 'right', label: 'Derecha protagonista' }]} onChange={two_ratio => onChange({ two_ratio })} />
        <SelectField label="Proporción de imágenes" value={content.two_aspect || 'landscape'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada 1:1' }, { value: 'portrait', label: 'Vertical 4:5' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={two_aspect => onChange({ two_aspect })} />
        <SelectField label="Ajuste" value={content.two_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio' }, { value: 'contain', label: 'Mostrar completas' }]} onChange={two_fit => onChange({ two_fit })} />
        <SelectField label="Enfoque izquierdo" value={content.two_position_left || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={two_position_left => onChange({ two_position_left })} />
        <SelectField label="Enfoque derecho" value={content.two_position_right || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={two_position_right => onChange({ two_position_right })} />
        <SelectField label="Prioridad de carga pública" value={content.two_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={two_loading => onChange({ two_loading })} />
      </>;
    }
    if (block.block_type === 'three_images') {
      return <>
        <SelectField label="Distribución" value={content.three_layout || 'grid'} options={[{ value: 'grid', label: 'Tres columnas iguales' }, { value: 'featured', label: 'Primera imagen protagonista' }, { value: 'story', label: 'Composición editorial alternada' }]} onChange={three_layout => onChange({ three_layout })} />
        <SelectField label="Proporción" value={content.three_aspect || 'landscape'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada 1:1' }, { value: 'portrait', label: 'Vertical 4:5' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={three_aspect => onChange({ three_aspect })} />
        <SelectField label="Ajuste" value={content.three_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio' }, { value: 'contain', label: 'Mostrar completas' }]} onChange={three_fit => onChange({ three_fit })} />
        {[1, 2, 3].map(number => <SelectField key={number} label={`Enfoque imagen ${number}`} value={content[`three_position_${number}`] || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={value => onChange({ [`three_position_${number}`]: value })} />)}
        <SelectField label="Prioridad de carga pública" value={content.three_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={three_loading => onChange({ three_loading })} />
      </>;
    }
    if (block.block_type === 'callout') {
      return <SelectField label="Tipo de caja" value={content.variant || 'info'} options={[{ value: 'info', label: 'Información' }, { value: 'tip', label: 'Consejo' }, { value: 'warning', label: 'Importante' }, { value: 'clinical', label: 'Dato clínico' }]} onChange={variant => onChange({ variant })} />;
    }
    if (block.block_type === 'weekly_publication') {
      return <>
        <SelectField label="Posición de la placa" value={content.weekly_image_position || 'right'} options={[{ value: 'right', label: 'Imagen a la derecha' }, { value: 'left', label: 'Imagen a la izquierda' }]} onChange={weekly_image_position => onChange({ weekly_image_position })} />
        <SelectField label="Ajuste de la placa" value={content.weekly_image_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio (puede recortar)' }, { value: 'contain', label: 'Mostrar la placa completa' }]} onChange={weekly_image_fit => onChange({ weekly_image_fit })} />
        <SelectField label="Ancho del componente" value={content.weekly_width || 'full'} options={[{ value: 'full', label: 'Todo el ancho' }, { value: 'wide', label: 'Amplio (1050 px)' }, { value: 'medium', label: 'Medio (850 px)' }]} onChange={weekly_width => onChange({ weekly_width })} />
      </>;
    }
    if (block.block_type === 'list') {
      return <SelectField label="Estilo de la lista" value={content.style || 'bullet'} options={[{ value: 'bullet', label: 'Con viñetas' }, { value: 'numbered', label: 'Numerada' }]} onChange={style => onChange({ style })} />;
    }
    if (block.block_type === 'divider') {
      return <SelectField label="Estilo del separador" value={content.style || 'gradient'} options={[{ value: 'gradient', label: 'Degradado' }, { value: 'simple', label: 'Línea simple' }, { value: 'labeled', label: 'Con puntos centrales' }]} onChange={style => onChange({ style })} />;
    }
    if (['carousel', 'text_carousel', 'double_carousel'].includes(block.block_type)) {
      return <>
        {block.block_type === 'text_carousel' && <>
          <SelectField label="Posición de la galería" value={content.image_position || 'right'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }]} onChange={image_position => onChange({ image_position })} />
          <SelectField label="Alineación del texto" value={content.ti_text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={ti_text_align => onChange({ ti_text_align })} />
          <SelectField label="Alineación vertical" value={content.tc_vertical_align || 'center'} options={[{ value: 'start', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'end', label: 'Abajo' }]} onChange={tc_vertical_align => onChange({ tc_vertical_align })} />
          <NumberField label="Ancho de la galería (%)" value={content.tc_gallery_width || '44'} min={30} max={65} onChange={tc_gallery_width => onChange({ tc_gallery_width: tc_gallery_width || '44' })} />
          <SelectField label="Proporción" value={content.tc_aspect || 'landscape'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={tc_aspect => onChange({ tc_aspect })} />
          <SelectField label="Ajuste" value={content.tc_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio' }, { value: 'contain', label: 'Mostrar completa' }]} onChange={tc_fit => onChange({ tc_fit })} />
          <SelectField label="Punto de enfoque" value={content.tc_position || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={tc_position => onChange({ tc_position })} />
          <SelectField label="Prioridad de carga pública" value={content.tc_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={tc_loading => onChange({ tc_loading })} />
        </>}
        <SelectField label="Movimiento" value={content.auto || 'true'} options={[{ value: 'true', label: 'Automático' }, { value: 'false', label: 'Solo con flechas' }]} onChange={auto => onChange({ auto })} />
        {(content.auto || 'true') === 'true' && <SelectField label="Tiempo entre imágenes" value={content.interval || '4'} options={[2, 3, 4, 5, 8].map(seconds => ({ value: String(seconds), label: `${seconds} segundos` }))} onChange={interval => onChange({ interval })} />}
        {block.block_type === 'carousel' && <>
          <SelectField label="Ancho" value={content.carousel_width || 'wide'} options={[{ value: 'medium', label: 'Medio (700 px)' }, { value: 'wide', label: 'Amplio (950 px)' }, { value: 'full', label: 'Todo el ancho' }]} onChange={carousel_width => onChange({ carousel_width })} />
          <SelectField label="Proporción" value={content.carousel_aspect || 'landscape'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={carousel_aspect => onChange({ carousel_aspect })} />
          <SelectField label="Ajuste" value={content.carousel_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio' }, { value: 'contain', label: 'Mostrar imagen completa' }]} onChange={carousel_fit => onChange({ carousel_fit })} />
          <SelectField label="Punto de enfoque" value={content.carousel_position || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={carousel_position => onChange({ carousel_position })} />
          <SelectField label="Prioridad de carga pública" value={content.carousel_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={carousel_loading => onChange({ carousel_loading })} />
        </>}
        {block.block_type === 'double_carousel' && <>
          <SelectField label="Proporción entre galerías" value={content.dc_ratio || 'equal'} options={[{ value: 'equal', label: 'Mismo ancho' }, { value: 'left', label: 'Izquierda protagonista' }, { value: 'right', label: 'Derecha protagonista' }]} onChange={dc_ratio => onChange({ dc_ratio })} />
          <SelectField label="Proporción de imágenes" value={content.dc_aspect || 'landscape'} options={[{ value: 'auto', label: 'Original' }, { value: 'square', label: 'Cuadrada' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal 4:3' }, { value: 'wide', label: 'Panorámica 16:9' }]} onChange={dc_aspect => onChange({ dc_aspect })} />
          <SelectField label="Ajuste" value={content.dc_fit || 'cover'} options={[{ value: 'cover', label: 'Llenar el espacio' }, { value: 'contain', label: 'Mostrar completas' }]} onChange={dc_fit => onChange({ dc_fit })} />
          <SelectField label="Enfoque izquierdo" value={content.dc_position_left || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={dc_position_left => onChange({ dc_position_left })} />
          <SelectField label="Enfoque derecho" value={content.dc_position_right || 'center center'} options={[{ value: 'center center', label: 'Centro' }, { value: 'center top', label: 'Arriba' }, { value: 'center bottom', label: 'Abajo' }, { value: 'left center', label: 'Izquierda' }, { value: 'right center', label: 'Derecha' }]} onChange={dc_position_right => onChange({ dc_position_right })} />
          <SelectField label="Prioridad de carga pública" value={content.dc_loading || 'lazy'} options={[{ value: 'lazy', label: 'Normal, carga al acercarse' }, { value: 'eager', label: 'Prioritaria, visible al abrir' }]} onChange={dc_loading => onChange({ dc_loading })} />
        </>}
      </>;
    }
    return null;
  };

  const renderTextAppearanceFields = () => {
    if (block.block_type === 'double_carousel') return <div className="visual-properties-specific-style">
      <h4>Doble galería</h4>
      <SelectField label="Diseño base" value={content.dc_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'cards', label: 'Tarjetas' }, { value: 'cinema', label: 'Cinematográfico' }]} onChange={dc_style => onChange({ dc_style })} />
      <ColorField label="Color de acento" value={content.dc_accent || ''} fallback="#38bdf8" onChange={dc_accent => onChange({ dc_accent })} />
      {content.dc_style === 'cards' && <ColorField label="Fondo de tarjetas" value={content.dc_bg || ''} fallback="#f8fafc" onChange={dc_bg => onChange({ dc_bg })} />}
      {(content.dc_fit || 'cover') === 'contain' && <ColorField label="Fondo de imagen" value={content.dc_image_bg || ''} fallback="#f8fafc" onChange={dc_image_bg => onChange({ dc_image_bg })} />}
      <label className="wide"><span>Separación: {content.dc_gap || 22}px</span><input type="range" min="0" max="56" value={Number(content.dc_gap || 22)} onChange={event => onChange({ dc_gap: event.target.value })} /></label>
      <label className="wide"><span>Redondeo: {content.dc_radius ?? 18}px</span><input type="range" min="0" max="40" value={Number(content.dc_radius ?? 18)} onChange={event => onChange({ dc_radius: event.target.value })} /></label>
      <SelectField label="Sombra" value={content.dc_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Editorial' }, { value: 'deep', label: 'Profunda' }]} onChange={dc_shadow => onChange({ dc_shadow })} />
      <SelectField label="Ampliación" value={content.dc_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imágenes estáticas' }]} onChange={dc_zoom => onChange({ dc_zoom })} />
      <SelectField label="Flechas" value={content.dc_arrows || 'true'} options={[{ value: 'true', label: 'Mostrar' }, { value: 'false', label: 'Ocultar' }]} onChange={dc_arrows => onChange({ dc_arrows })} />
      <SelectField label="Indicadores" value={content.dc_dots || 'true'} options={[{ value: 'true', label: 'Mostrar' }, { value: 'false', label: 'Ocultar' }]} onChange={dc_dots => onChange({ dc_dots })} />
      <SelectField label="Tratamiento de color" value={content.dc_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={dc_filter => onChange({ dc_filter })} />
      <h4>Pies de imagen</h4>
      <SelectField label="Alineación" value={content.dc_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={dc_caption_align => onChange({ dc_caption_align })} />
      <SelectField label="Tamaño" value={content.dc_caption_size || '.8rem'} options={[{ value: '.7rem', label: 'Pequeño' }, { value: '.8rem', label: 'Normal' }, { value: '.95rem', label: 'Grande' }]} onChange={dc_caption_size => onChange({ dc_caption_size })} />
      <SelectField label="Grosor" value={content.dc_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar estilo' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={dc_caption_weight => onChange({ dc_caption_weight })} />
      <ColorField label="Color" value={content.dc_caption_color || ''} fallback="#57708f" onChange={dc_caption_color => onChange({ dc_caption_color })} />
    </div>;
    if (block.block_type === 'text_carousel') return <div className="visual-properties-specific-style">
      <h4>Composición texto + galería</h4>
      <SelectField label="Diseño base" value={content.tc_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'soft', label: 'Fondo suave' }, { value: 'accent', label: 'Franja de acento' }]} onChange={tc_style => onChange({ tc_style })} />
      <ColorField label="Color de acento" value={content.tc_accent || ''} fallback="#38bdf8" onChange={tc_accent => onChange({ tc_accent })} />
      {content.tc_style === 'soft' && <ColorField label="Fondo del componente" value={content.tc_bg || ''} fallback="#f1f7fb" onChange={tc_bg => onChange({ tc_bg })} />}
      {(content.tc_fit || 'cover') === 'contain' && <ColorField label="Fondo de imagen" value={content.tc_image_bg || ''} fallback="#f8fafc" onChange={tc_image_bg => onChange({ tc_image_bg })} />}
      <label className="wide"><span>Separación: {content.tc_gap || 28}px</span><input type="range" min="8" max="64" value={Number(content.tc_gap || 28)} onChange={event => onChange({ tc_gap: event.target.value })} /></label>
      <label className="wide"><span>Redondeo: {content.tc_radius ?? 20}px</span><input type="range" min="0" max="40" value={Number(content.tc_radius ?? 20)} onChange={event => onChange({ tc_radius: event.target.value })} /></label>
      <SelectField label="Sombra de galería" value={content.tc_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Editorial' }]} onChange={tc_shadow => onChange({ tc_shadow })} />
      <SelectField label="Ampliación" value={content.tc_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imágenes estáticas' }]} onChange={tc_zoom => onChange({ tc_zoom })} />
      <SelectField label="Flechas" value={content.tc_arrows || 'true'} options={[{ value: 'true', label: 'Mostrar' }, { value: 'false', label: 'Ocultar' }]} onChange={tc_arrows => onChange({ tc_arrows })} />
      <SelectField label="Indicadores" value={content.tc_dots || 'true'} options={[{ value: 'true', label: 'Mostrar' }, { value: 'false', label: 'Ocultar' }]} onChange={tc_dots => onChange({ tc_dots })} />
      <SelectField label="Tratamiento de color" value={content.tc_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={tc_filter => onChange({ tc_filter })} />
      <h4>Texto completo</h4>
      <ColorField label="Color" value={content.style_text || ''} fallback="#0f172a" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || ''} options={[{ value: '', label: 'Predeterminado' }, { value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <h4>Pie de imagen</h4>
      <SelectField label="Alineación" value={content.tc_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={tc_caption_align => onChange({ tc_caption_align })} />
      <SelectField label="Tamaño" value={content.tc_caption_size || '.8rem'} options={[{ value: '.7rem', label: 'Pequeño' }, { value: '.8rem', label: 'Normal' }, { value: '.95rem', label: 'Grande' }]} onChange={tc_caption_size => onChange({ tc_caption_size })} />
      <SelectField label="Grosor" value={content.tc_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar estilo' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={tc_caption_weight => onChange({ tc_caption_weight })} />
      <ColorField label="Color" value={content.tc_caption_color || ''} fallback="#57708f" onChange={tc_caption_color => onChange({ tc_caption_color })} />
    </div>;
    if (block.block_type === 'carousel') return <div className="visual-properties-specific-style">
      <h4>Galería deslizante</h4>
      <SelectField label="Diseño base" value={content.carousel_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'framed', label: 'Enmarcado' }, { value: 'cinema', label: 'Cinematográfico oscuro' }]} onChange={carousel_style => onChange({ carousel_style })} />
      <ColorField label="Color de acento" value={content.carousel_accent || ''} fallback="#38bdf8" onChange={carousel_accent => onChange({ carousel_accent })} />
      {(content.carousel_fit || 'cover') === 'contain' && <ColorField label="Fondo de imagen" value={content.carousel_image_bg || ''} fallback="#f8fafc" onChange={carousel_image_bg => onChange({ carousel_image_bg })} />}
      <label className="wide"><span>Redondeo: {content.carousel_radius ?? 20}px</span><input type="range" min="0" max="40" value={Number(content.carousel_radius ?? 20)} onChange={event => onChange({ carousel_radius: event.target.value })} /></label>
      <SelectField label="Sombra" value={content.carousel_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Editorial' }, { value: 'deep', label: 'Profunda' }]} onChange={carousel_shadow => onChange({ carousel_shadow })} />
      <SelectField label="Ampliación" value={content.carousel_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imágenes estáticas' }]} onChange={carousel_zoom => onChange({ carousel_zoom })} />
      <SelectField label="Flechas" value={content.carousel_arrows || 'true'} options={[{ value: 'true', label: 'Mostrar' }, { value: 'false', label: 'Ocultar' }]} onChange={carousel_arrows => onChange({ carousel_arrows })} />
      <SelectField label="Indicadores" value={content.carousel_dots || 'true'} options={[{ value: 'true', label: 'Mostrar puntos' }, { value: 'false', label: 'Ocultar' }]} onChange={carousel_dots => onChange({ carousel_dots })} />
      <SelectField label="Tratamiento de color" value={content.carousel_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={carousel_filter => onChange({ carousel_filter })} />
      <h4>Pie de imagen</h4>
      <SelectField label="Alineación" value={content.carousel_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={carousel_caption_align => onChange({ carousel_caption_align })} />
      <SelectField label="Estilo" value={content.carousel_caption_italic || 'true'} options={[{ value: 'true', label: 'Cursiva editorial' }, { value: 'false', label: 'Normal' }]} onChange={carousel_caption_italic => onChange({ carousel_caption_italic })} />
      <SelectField label="Tamaño" value={content.carousel_caption_size || '.84rem'} options={[{ value: '.72rem', label: 'Pequeño' }, { value: '.84rem', label: 'Normal' }, { value: '1rem', label: 'Grande' }]} onChange={carousel_caption_size => onChange({ carousel_caption_size })} />
      <SelectField label="Grosor" value={content.carousel_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar estilo' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={carousel_caption_weight => onChange({ carousel_caption_weight })} />
      <ColorField label="Color" value={content.carousel_caption_color || ''} fallback="#57708f" onChange={carousel_caption_color => onChange({ carousel_caption_color })} />
    </div>;
    if (block.block_type === 'three_images') return <div className="visual-properties-specific-style">
      <h4>Galería de tres imágenes</h4>
      <SelectField label="Diseño base" value={content.three_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'cards', label: 'Tarjetas' }, { value: 'accent', label: 'Marco de acento' }]} onChange={three_style => onChange({ three_style })} />
      <ColorField label="Color de acento" value={content.three_accent || ''} fallback="#38bdf8" onChange={three_accent => onChange({ three_accent })} />
      {content.three_style === 'cards' && <ColorField label="Fondo de tarjetas" value={content.three_bg || ''} fallback="#f8fafc" onChange={three_bg => onChange({ three_bg })} />}
      {(content.three_fit || 'cover') === 'contain' && <ColorField label="Fondo de imagen" value={content.three_image_bg || ''} fallback="#f8fafc" onChange={three_image_bg => onChange({ three_image_bg })} />}
      <label className="wide"><span>Separación: {content.three_gap || 18}px</span><input type="range" min="0" max="48" value={Number(content.three_gap || 18)} onChange={event => onChange({ three_gap: event.target.value })} /></label>
      <label className="wide"><span>Redondeo: {content.three_radius ?? 16}px</span><input type="range" min="0" max="40" value={Number(content.three_radius ?? 16)} onChange={event => onChange({ three_radius: event.target.value })} /></label>
      <SelectField label="Sombra" value={content.three_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Editorial' }]} onChange={three_shadow => onChange({ three_shadow })} />
      <SelectField label="Ampliación" value={content.three_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imágenes estáticas' }]} onChange={three_zoom => onChange({ three_zoom })} />
      <SelectField label="Efecto al pasar el cursor" value={content.three_hover || 'lift'} options={[{ value: 'lift', label: 'Elevar suavemente' }, { value: 'none', label: 'Sin movimiento' }]} onChange={three_hover => onChange({ three_hover })} />
      <SelectField label="Tratamiento de color" value={content.three_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={three_filter => onChange({ three_filter })} />
      <h4>Pies de imagen</h4>
      <SelectField label="Alineación" value={content.three_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={three_caption_align => onChange({ three_caption_align })} />
      <SelectField label="Estilo" value={content.three_caption_italic || 'true'} options={[{ value: 'true', label: 'Cursiva editorial' }, { value: 'false', label: 'Normal' }]} onChange={three_caption_italic => onChange({ three_caption_italic })} />
      <SelectField label="Tamaño" value={content.three_caption_size || '.8rem'} options={[{ value: '.7rem', label: 'Pequeño' }, { value: '.8rem', label: 'Normal' }, { value: '.92rem', label: 'Grande' }]} onChange={three_caption_size => onChange({ three_caption_size })} />
      <SelectField label="Grosor" value={content.three_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar estilo' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={three_caption_weight => onChange({ three_caption_weight })} />
      <ColorField label="Color" value={content.three_caption_color || ''} fallback="#57708f" onChange={three_caption_color => onChange({ three_caption_color })} />
    </div>;
    if (block.block_type === 'two_images') return <div className="visual-properties-specific-style">
      <h4>Galería de dos imágenes</h4>
      <SelectField label="Diseño base" value={content.two_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'cards', label: 'Tarjetas' }, { value: 'accent', label: 'Marco de acento' }]} onChange={two_style => onChange({ two_style })} />
      <ColorField label="Color de acento" value={content.two_accent || ''} fallback="#38bdf8" onChange={two_accent => onChange({ two_accent })} />
      {content.two_style === 'cards' && <ColorField label="Fondo de tarjetas" value={content.two_bg || ''} fallback="#f8fafc" onChange={two_bg => onChange({ two_bg })} />}
      {(content.two_fit || 'cover') === 'contain' && <ColorField label="Fondo de imagen" value={content.two_image_bg || ''} fallback="#f8fafc" onChange={two_image_bg => onChange({ two_image_bg })} />}
      <label className="wide"><span>Separación: {content.two_gap || 20}px</span><input type="range" min="0" max="56" value={Number(content.two_gap || 20)} onChange={event => onChange({ two_gap: event.target.value })} /></label>
      <label className="wide"><span>Redondeo: {content.two_radius ?? 18}px</span><input type="range" min="0" max="40" value={Number(content.two_radius ?? 18)} onChange={event => onChange({ two_radius: event.target.value })} /></label>
      <SelectField label="Sombra" value={content.two_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Editorial' }]} onChange={two_shadow => onChange({ two_shadow })} />
      <SelectField label="Ampliación" value={content.two_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imágenes estáticas' }]} onChange={two_zoom => onChange({ two_zoom })} />
      <SelectField label="Efecto al pasar el cursor" value={content.two_hover || 'lift'} options={[{ value: 'lift', label: 'Elevar suavemente' }, { value: 'none', label: 'Sin movimiento' }]} onChange={two_hover => onChange({ two_hover })} />
      <SelectField label="Tratamiento de color" value={content.two_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={two_filter => onChange({ two_filter })} />
      <h4>Pies de imagen</h4>
      <SelectField label="Alineación" value={content.two_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={two_caption_align => onChange({ two_caption_align })} />
      <SelectField label="Estilo" value={content.two_caption_italic || 'true'} options={[{ value: 'true', label: 'Cursiva editorial' }, { value: 'false', label: 'Normal' }]} onChange={two_caption_italic => onChange({ two_caption_italic })} />
      <SelectField label="Tamaño" value={content.two_caption_size || '.82rem'} options={[{ value: '.72rem', label: 'Pequeño' }, { value: '.82rem', label: 'Normal' }, { value: '.95rem', label: 'Grande' }]} onChange={two_caption_size => onChange({ two_caption_size })} />
      <SelectField label="Grosor" value={content.two_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar estilo' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={two_caption_weight => onChange({ two_caption_weight })} />
      <ColorField label="Color" value={content.two_caption_color || ''} fallback="#57708f" onChange={two_caption_color => onChange({ two_caption_color })} />
    </div>;
    if (block.block_type === 'text_image') return <div className="visual-properties-specific-style">
      <h4>Composición texto + imagen</h4>
      <SelectField label="Diseño base" value={content.ti_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio' }, { value: 'soft', label: 'Fondo suave' }, { value: 'accent', label: 'Franja de acento' }]} onChange={ti_style => onChange({ ti_style })} />
      <ColorField label="Color de acento" value={content.ti_accent || ''} fallback="#38bdf8" onChange={ti_accent => onChange({ ti_accent })} />
      {content.ti_style === 'soft' && <ColorField label="Fondo del componente" value={content.ti_bg || ''} fallback="#f1f7fb" onChange={ti_bg => onChange({ ti_bg })} />}
      <label className="wide"><span>Redondeo: {content.ti_radius ?? 20}px</span><input type="range" min="0" max="36" value={Number(content.ti_radius ?? 20)} onChange={event => onChange({ ti_radius: event.target.value })} /></label>
      <label className="wide"><span>Separación: {content.ti_gap || 28}px</span><input type="range" min="8" max="64" value={Number(content.ti_gap || 28)} onChange={event => onChange({ ti_gap: event.target.value })} /></label>
      <SelectField label="Ampliación" value={content.ti_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imagen estática' }]} onChange={ti_zoom => onChange({ ti_zoom })} />
      <SelectField label="Efecto al pasar el cursor" value={content.ti_hover || 'lift'} options={[{ value: 'lift', label: 'Elevar suavemente' }, { value: 'none', label: 'Sin movimiento' }]} onChange={ti_hover => onChange({ ti_hover })} />
      <SelectField label="Sombra de imagen" value={content.ti_image_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'medium', label: 'Sombra editorial' }]} onChange={ti_image_shadow => onChange({ ti_image_shadow })} />
      <SelectField label="Tratamiento de color" value={content.ti_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={ti_filter => onChange({ ti_filter })} />
      <h4>Texto completo</h4>
      <SelectField label="Alineación" value={content.ti_text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }, { value: 'justify', label: 'Justificado' }]} onChange={ti_text_align => onChange({ ti_text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Interlineado" value={content.style_line_height || ''} options={[{ value: '', label: 'Predeterminado' }, { value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <h4>Pie de imagen</h4>
      <SelectField label="Alineación" value={content.ti_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={ti_caption_align => onChange({ ti_caption_align })} />
      <SelectField label="Estilo" value={content.ti_caption_italic || 'true'} options={[{ value: 'true', label: 'Cursiva editorial' }, { value: 'false', label: 'Normal' }]} onChange={ti_caption_italic => onChange({ ti_caption_italic })} />
      <SelectField label="Tamaño" value={content.ti_caption_size || '.82rem'} options={[{ value: '.72rem', label: 'Pequeño' }, { value: '.82rem', label: 'Normal' }, { value: '.95rem', label: 'Grande' }]} onChange={ti_caption_size => onChange({ ti_caption_size })} />
      <SelectField label="Grosor" value={content.ti_caption_weight || 'default'} options={[{ value: 'default', label: 'Heredar del texto' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={ti_caption_weight => onChange({ ti_caption_weight })} />
      <ColorField label="Color" value={content.ti_caption_color || ''} fallback="#57708f" onChange={ti_caption_color => onChange({ ti_caption_color })} />
    </div>;
    if (block.block_type === 'image') return <div className="visual-properties-specific-style">
      <h4>Acabado de la imagen</h4>
      <SelectField label="Diseño base" value={content.image_style || 'editorial'} options={[{ value: 'editorial', label: 'Editorial del sitio' }, { value: 'clean', label: 'Limpio, sin marco' }, { value: 'framed', label: 'Marco destacado' }, { value: 'floating', label: 'Imagen flotante' }]} onChange={image_style => onChange({ image_style })} />
      <ColorField label="Color de acento" value={content.image_accent || ''} fallback="#38bdf8" onChange={image_accent => onChange({ image_accent })} />
      {content.image_style === 'framed' && <><ColorField label="Color del marco" value={content.image_border || ''} fallback="#ffffff" onChange={image_border => onChange({ image_border })} /><ColorField label="Fondo exterior" value={content.image_frame_bg || ''} fallback="#f8fafc" onChange={image_frame_bg => onChange({ image_frame_bg })} /></>}
      {content.image_fit === 'contain' && <ColorField label="Fondo al mostrar completa" value={content.image_contain_bg || ''} fallback="#f8fafc" onChange={image_contain_bg => onChange({ image_contain_bg })} />}
      <label className="wide"><span>Redondeo: {content.image_radius ?? 18}px</span><input type="range" min="0" max="40" value={Number(content.image_radius ?? 18)} onChange={event => onChange({ image_radius: event.target.value })} /></label>
      <SelectField label="Sombra" value={content.image_shadow || 'medium'} options={[{ value: 'none', label: 'Sin sombra' }, { value: 'soft', label: 'Suave' }, { value: 'medium', label: 'Media' }, { value: 'dramatic', label: 'Profunda' }]} onChange={image_shadow => onChange({ image_shadow })} />
      <SelectField label="Ampliación" value={content.image_zoom || 'true'} options={[{ value: 'true', label: 'Permitir ver en grande' }, { value: 'false', label: 'Imagen estática' }]} onChange={image_zoom => onChange({ image_zoom })} />
      <SelectField label="Efecto al pasar el cursor" value={content.image_hover || 'lift'} options={[{ value: 'lift', label: 'Elevar suavemente' }, { value: 'none', label: 'Sin movimiento' }]} onChange={image_hover => onChange({ image_hover })} />
      <SelectField label="Tratamiento de color" value={content.image_filter || 'none'} options={[{ value: 'none', label: 'Color original' }, { value: 'vivid', label: 'Color intenso' }, { value: 'soft', label: 'Suave editorial' }, { value: 'warm', label: 'Tono cálido' }, { value: 'cool', label: 'Tono frío' }, { value: 'grayscale', label: 'Blanco y negro' }]} onChange={image_filter => onChange({ image_filter })} />
      <h4>Pie de imagen</h4>
      <SelectField label="Presentación" value={content.image_caption_style || 'below'} options={[{ value: 'below', label: 'Texto debajo' }, { value: 'card', label: 'Etiqueta suave debajo' }, { value: 'overlay', label: 'Sobre la imagen' }]} onChange={image_caption_style => onChange({ image_caption_style })} />
      {content.image_caption_style === 'overlay' && <SelectField label="Posición sobre la imagen" value={content.image_caption_position || 'bottom'} options={[{ value: 'bottom', label: 'Parte inferior' }, { value: 'top', label: 'Parte superior' }]} onChange={image_caption_position => onChange({ image_caption_position })} />}
      <SelectField label="Alineación" value={content.image_caption_align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={image_caption_align => onChange({ image_caption_align })} />
      <SelectField label="Tamaño del pie" value={content.image_caption_size || ''} options={[{ value: '', label: 'Usar estilo de texto' }, { value: '.75rem', label: 'Pequeño' }, { value: '.86rem', label: 'Normal' }, { value: '1rem', label: 'Grande' }]} onChange={image_caption_size => onChange({ image_caption_size })} />
      <SelectField label="Estilo del texto" value={content.image_caption_italic || 'true'} options={[{ value: 'true', label: 'Cursiva editorial' }, { value: 'false', label: 'Texto normal' }]} onChange={image_caption_italic => onChange({ image_caption_italic })} />
      <ColorField label="Color del pie" value={content.image_caption_color || ''} fallback={content.image_caption_style === 'overlay' ? '#ffffff' : '#57708f'} onChange={image_caption_color => onChange({ image_caption_color })} />
      {['card', 'overlay'].includes(content.image_caption_style || '') && <ColorField label="Fondo del pie" value={content.image_caption_bg || ''} fallback={content.image_caption_style === 'overlay' ? '#0f172a' : '#f8fafc'} onChange={image_caption_bg => onChange({ image_caption_bg })} />}
      <h4>Estilos de texto del pie</h4>
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño general" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '600', label: 'Seminegrita' }, { value: '700', label: 'Negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || 'normal'} options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
    </div>;
    if (block.block_type === 'section') return <div className="visual-properties-specific-style"><h4>Identidad de la sección</h4><ColorField label="Color de acento y guía" value={content.section_accent || ''} fallback="#38bdf8" onChange={section_accent => onChange({ section_accent })} />{['card', 'band'].includes(content.section_layout || '') && <ColorField label="Fondo del grupo" value={content.section_bg || ''} fallback="#f8fbff" onChange={section_bg => onChange({ section_bg })} />}<SelectField label="Alineación del encabezado" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={text_align => onChange({ text_align })} /></div>;
    if (block.block_type === 'columns_2') return <div className="visual-properties-specific-style"><h4>Apariencia de las columnas</h4><ColorField label="Color de los títulos" value={content.column_accent || ''} fallback="#38bdf8" onChange={column_accent => onChange({ column_accent })} />{content.column_style !== 'plain' && <ColorField label="Fondo de las columnas" value={content.column_bg || ''} fallback={content.column_style === 'soft' ? '#f1f5f9' : '#ffffff'} onChange={column_bg => onChange({ column_bg })} />}{(content.column_style || 'cards') === 'cards' && <ColorField label="Borde de las columnas" value={content.column_border || ''} fallback="#e2e8f0" onChange={column_border => onChange({ column_border })} />}<SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }, { value: 'justify', label: 'Justificado' }]} onChange={text_align => onChange({ text_align })} /></div>;
    if (block.block_type === 'divider') return <div className="visual-properties-specific-style"><h4>Apariencia del separador</h4><ColorField label="Color de la línea" value={content.divider_color || ''} fallback="#38bdf8" onChange={divider_color => onChange({ divider_color })} />{content.style === 'labeled' && <ColorField label="Color del texto" value={content.divider_text_color || ''} fallback="#38bdf8" onChange={divider_text_color => onChange({ divider_text_color })} />}<label className="wide"><span>Grosor: {content.divider_thickness || 2}px</span><input type="range" min="1" max="12" value={Number(content.divider_thickness || 2)} onChange={event => onChange({ divider_thickness: event.target.value })} /></label><label className="wide"><span>Ancho: {content.divider_width || 100}%</span><input type="range" min="20" max="100" value={Number(content.divider_width || 100)} onChange={event => onChange({ divider_width: event.target.value })} /></label><label className="wide"><span>Espacio vertical: {content.divider_spacing || 20}px</span><input type="range" min="0" max="80" value={Number(content.divider_spacing || 20)} onChange={event => onChange({ divider_spacing: event.target.value })} /></label></div>;
    if (block.block_type === 'heading') return <div className="visual-properties-specific-style">
      <h4>Decoración del título</h4>
      <SelectField label="Estilo" value={content.title_decoration || 'none'} options={[{ value: 'none', label: 'Limpio, sin adorno' }, { value: 'underline', label: 'Línea inferior' }, { value: 'side-line', label: 'Línea lateral' }, { value: 'soft-box', label: 'Fondo suave' }, { value: 'outline', label: 'Contorno elegante' }]} onChange={title_decoration => onChange({ title_decoration })} />
      <ColorField label="Color de acento" value={content.title_accent || ''} fallback="#38bdf8" onChange={title_accent => onChange({ title_accent })} />
      <h4>Texto del título completo</h4>
      <SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={text_align => onChange({ text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }, { value: '800', label: 'Muy negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || 'normal'} options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    if (block.block_type === 'subheading') return <div className="visual-properties-specific-style">
      <h4>Decoración del subtítulo</h4>
      <SelectField label="Estilo" value={content.subtitle_decoration || 'side-line'} options={[{ value: 'none', label: 'Limpio, sin adorno' }, { value: 'side-line', label: 'Línea lateral' }, { value: 'underline', label: 'Línea inferior' }, { value: 'soft-box', label: 'Fondo suave' }, { value: 'outline', label: 'Contorno elegante' }]} onChange={subtitle_decoration => onChange({ subtitle_decoration })} />
      <ColorField label="Color de acento" value={content.subtitle_accent || ''} fallback="#38bdf8" onChange={subtitle_accent => onChange({ subtitle_accent })} />
      <h4>Texto del subtítulo completo</h4>
      <SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={text_align => onChange({ text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }, { value: '800', label: 'Muy negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || 'normal'} options={[{ value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    if (block.block_type === 'paragraph') return <div className="visual-properties-specific-style">
      <h4>Presentación del texto</h4>
      <SelectField label="Estilo del cuadro" value={content.text_box_style || 'plain'} options={[{ value: 'plain', label: 'Texto limpio' }, { value: 'card', label: 'Tarjeta elevada' }, { value: 'soft', label: 'Fondo suave' }, { value: 'quote', label: 'Cita destacada' }]} onChange={text_box_style => onChange({ text_box_style })} />
      <SelectField label="Columnas de lectura" value={content.text_columns || '1'} options={[{ value: '1', label: 'Una columna' }, { value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }]} onChange={text_columns => onChange({ text_columns })} />
      {content.text_box_style === 'quote' && <ColorField label="Color de la cita" value={content.text_box_accent || ''} fallback="#38bdf8" onChange={text_box_accent => onChange({ text_box_accent })} />}
      <h4>Texto del párrafo completo</h4>
      <SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }, { value: 'justify', label: 'Justificado' }]} onChange={text_align => onChange({ text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || ''} options={[{ value: '', label: 'Predeterminado del párrafo' }, { value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
      <label className="wide"><span>Sangría inicial: {content.style_text_indent || 0}px</span><input type="range" min="0" max="80" value={Number(content.style_text_indent || 0)} onChange={event => onChange({ style_text_indent: event.target.value })} /></label>
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    if (block.block_type === 'list') return <div className="visual-properties-specific-style">
      <h4>Presentación de la lista</h4>
      <SelectField label="Columnas" value={content.list_columns || '1'} options={[{ value: '1', label: 'Una columna' }, { value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }]} onChange={list_columns => onChange({ list_columns })} />
      <SelectField label="Marcadores" value={content.list_marker || (content.style === 'numbered' ? 'number' : 'bullet')} options={[{ value: 'bullet', label: 'Viñetas' }, { value: 'number', label: 'Números' }, { value: 'check', label: 'Marcas de verificación' }, { value: 'arrow', label: 'Flechas' }]} onChange={list_marker => onChange({ list_marker })} />
      <SelectField label="Estilo de cada elemento" value={content.list_item_style || 'plain'} options={[{ value: 'plain', label: 'Limpio' }, { value: 'soft', label: 'Fondos suaves' }, { value: 'cards', label: 'Tarjetas separadas' }]} onChange={list_item_style => onChange({ list_item_style })} />
      <ColorField label="Color de los marcadores" value={content.list_accent || ''} fallback="#2563eb" onChange={list_accent => onChange({ list_accent })} />
      {content.list_item_style && content.list_item_style !== 'plain' && <ColorField label="Fondo de los elementos" value={content.list_item_bg || ''} fallback={content.list_item_style === 'cards' ? '#ffffff' : '#f1f5f9'} onChange={list_item_bg => onChange({ list_item_bg })} />}
      {content.list_item_style === 'cards' && <ColorField label="Borde de las tarjetas" value={content.list_item_border || ''} fallback="#dbe5ef" onChange={list_item_border => onChange({ list_item_border })} />}
      <label className="wide"><span>Separación entre elementos: {content.list_gap || 10}px</span><input type="range" min="0" max="32" value={Number(content.list_gap || 10)} onChange={event => onChange({ list_gap: event.target.value })} /></label>
      <h4>Texto de la lista completa</h4>
      <SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={text_align => onChange({ text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || ''} options={[{ value: '', label: 'Predeterminado de la lista' }, { value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    if (block.block_type === 'callout') return <div className="visual-properties-specific-style">
      <h4>Acabado de la caja destacada</h4>
      <SelectField label="Diseño" value={content.callout_style || 'modern'} options={[{ value: 'modern', label: 'Moderna con degradado suave' }, { value: 'accent', label: 'Limpia con franja lateral' }, { value: 'tinted', label: 'Fondo de color suave' }, { value: 'outline', label: 'Solo contorno' }]} onChange={callout_style => onChange({ callout_style })} />
      <SelectField label="Ancho de la caja" value={content.callout_width || 'full'} options={[{ value: 'full', label: 'Todo el ancho disponible' }, { value: 'wide', label: 'Amplia (900 px)' }, { value: 'medium', label: 'Media (700 px)' }, { value: 'compact', label: 'Compacta (520 px)' }]} onChange={callout_width => onChange({ callout_width })} />
      <SelectField label="Icono" value={content.callout_show_icon || 'true'} options={[{ value: 'true', label: 'Mostrar icono' }, { value: 'false', label: 'Ocultar icono' }]} onChange={callout_show_icon => onChange({ callout_show_icon })} />
      <SelectField label="Etiqueta superior" value={content.callout_show_label || 'true'} options={[{ value: 'true', label: 'Mostrar etiqueta' }, { value: 'false', label: 'Ocultar etiqueta' }]} onChange={callout_show_label => onChange({ callout_show_label })} />
      {(content.callout_show_label || 'true') === 'true' && <>
        <label className="visual-properties-field"><span>Texto de la etiqueta (opcional)</span><input value={content.callout_label || ''} onChange={event => onChange({ callout_label: event.target.value })} placeholder="Usar nombre del tipo de mensaje" /></label>
        <ColorField label="Color de la etiqueta" value={content.callout_label_color || ''} fallback="#1d4ed8" onChange={callout_label_color => onChange({ callout_label_color })} />
      </>}
      <ColorField label="Color principal" value={content.callout_bg || ''} fallback="#dbeafe" onChange={callout_bg => onChange({ callout_bg })} />
      <ColorField label="Color del borde y acento" value={content.callout_border || ''} fallback="#60a5fa" onChange={callout_border => onChange({ callout_border })} />
      <h4>Texto del mensaje completo</h4>
      <SelectField label="Alineación del texto" value={content.text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }, { value: 'justify', label: 'Justificado' }]} onChange={text_align => onChange({ text_align })} />
      <ColorField label="Color del texto" value={content.style_text || ''} fallback="#000000" onChange={style_text => onChange({ style_text })} />
      <SelectField label="Tipo de letra" value={content.style_font_family || 'site'} options={[{ value: 'site', label: 'Fuente del sitio' }, { value: 'modern', label: 'Moderna' }, { value: 'clean', label: 'Limpia' }, { value: 'classic', label: 'Clásica' }, { value: 'friendly', label: 'Amigable' }]} onChange={style_font_family => onChange({ style_font_family })} />
      <SelectField label="Tamaño" value={content.style_font_size || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={style_font_size => onChange({ style_font_size })} />
      <SelectField label="Grosor" value={content.style_font_weight || 'default'} options={[{ value: 'default', label: 'Predeterminado' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }]} onChange={style_font_weight => onChange({ style_font_weight })} />
      <SelectField label="Interlineado" value={content.style_line_height || ''} options={[{ value: '', label: 'Predeterminado de la caja' }, { value: 'compact', label: 'Compacto' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }]} onChange={style_line_height => onChange({ style_line_height })} />
      <SelectField label="Espacio entre letras" value={content.style_letter_spacing || 'normal'} options={[{ value: 'tight', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Separado' }]} onChange={style_letter_spacing => onChange({ style_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.style_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }, { value: 'lowercase', label: 'todo en minúsculas' }]} onChange={style_text_transform => onChange({ style_text_transform })} />
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    if (block.block_type === 'weekly_publication') return <div className="visual-properties-specific-style">
      <h4>Diseño de la publicación semanal</h4>
      <SelectField label="Estilo visual" value={content.weekly_style || 'premium'} options={[{ value: 'premium', label: 'Editorial premium' }, { value: 'clean', label: 'Blanco y limpio' }, { value: 'outline', label: 'Contorno elegante' }]} onChange={weekly_style => onChange({ weekly_style })} />
      <SelectField label="Alineación del texto" value={content.weekly_text_align || 'left'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={weekly_text_align => onChange({ weekly_text_align })} />
      <SelectField label="Tipo de letra" value={content.weekly_font_family || ''} options={[{ value: '', label: 'Predeterminada' }, { value: 'Montserrat, Segoe UI, sans-serif', label: 'Moderna' }, { value: 'Arial, Helvetica, sans-serif', label: 'Limpia' }, { value: 'Georgia, Times New Roman, serif', label: 'Clásica' }, { value: 'Verdana, Geneva, sans-serif', label: 'Amigable' }]} onChange={weekly_font_family => onChange({ weekly_font_family })} />
      <SelectField label="Interlineado general" value={content.weekly_line_height || '1.2'} options={[{ value: '1.05', label: 'Compacto' }, { value: '1.2', label: 'Normal' }, { value: '1.45', label: 'Amplio' }]} onChange={weekly_line_height => onChange({ weekly_line_height })} />
      <SelectField label="Espacio entre letras" value={content.weekly_letter_spacing || 'normal'} options={[{ value: '-0.02em', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: '0.05em', label: 'Separado' }]} onChange={weekly_letter_spacing => onChange({ weekly_letter_spacing })} />
      <SelectField label="Mayúsculas y minúsculas" value={content.weekly_text_transform || 'none'} options={[{ value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }]} onChange={weekly_text_transform => onChange({ weekly_text_transform })} />
      <SelectField label="Grosor del título" value={content.weekly_title_weight || '760'} options={[{ value: '600', label: 'Medio' }, { value: '680', label: 'Seminegrita' }, { value: '760', label: 'Marcado' }, { value: '800', label: 'Muy marcado' }, { value: '900', label: 'Extra marcado' }]} onChange={weekly_title_weight => onChange({ weekly_title_weight })} />
      <SelectField label="Tamaño del título" value={content.weekly_title_size || ''} options={[{ value: '', label: 'Predeterminado' }, { value: 'clamp(1.3rem, 2.2vw, 1.9rem)', label: 'Mediano' }, { value: 'clamp(1.45rem, 2.5vw, 2.15rem)', label: 'Grande' }, { value: 'clamp(1.55rem, 2.7vw, 2.35rem)', label: 'Muy grande' }, { value: 'clamp(1.7rem, 3vw, 2.6rem)', label: 'Hero' }]} onChange={weekly_title_size => onChange({ weekly_title_size })} />
      <SelectField label="Tamaño de los temas" value={content.weekly_topic_size || '.95rem'} options={[{ value: '.82rem', label: 'Pequeño' }, { value: '.95rem', label: 'Normal' }, { value: '1.05rem', label: 'Grande' }]} onChange={weekly_topic_size => onChange({ weekly_topic_size })} />
      <SelectField label="Grosor de los temas" value={content.weekly_topic_weight || '680'} options={[{ value: '500', label: 'Normal' }, { value: '680', label: 'Seminegrita' }, { value: '800', label: 'Negrita' }]} onChange={weekly_topic_weight => onChange({ weekly_topic_weight })} />
      <ColorField label="Color del título" value={content.weekly_title_color || ''} fallback="#071b31" onChange={weekly_title_color => onChange({ weekly_title_color })} />
      <ColorField label="Color de los temas" value={content.weekly_topic_color || ''} fallback="#0b1f33" onChange={weekly_topic_color => onChange({ weekly_topic_color })} />
      <ColorField label="Color del texto de la placa" value={content.weekly_caption_color || ''} fallback="#ffffff" onChange={weekly_caption_color => onChange({ weekly_caption_color })} />
      <ColorField label="Fondo del texto de la placa" value={content.weekly_caption_bg || ''} fallback="#14537e" onChange={weekly_caption_bg => onChange({ weekly_caption_bg })} />
      <label className="wide"><span>Transparencia del fondo: {Number(content.weekly_caption_transparency ?? 45)}%</span><input type="range" min="0" max="100" value={Number(content.weekly_caption_transparency ?? 45)} onChange={event => onChange({ weekly_caption_transparency: event.target.value })} /></label>
      <ColorField label="Color de acento" value={content.weekly_accent || ''} fallback="#1677b8" onChange={weekly_accent => onChange({ weekly_accent })} />
      <ColorField label="Color de fondo" value={content.weekly_bg || ''} fallback="#eef8ff" onChange={weekly_bg => onChange({ weekly_bg })} />
      <label className="wide"><span>Separación superior: {content.style_text_space_top || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_top || 0)} onChange={event => onChange({ style_text_space_top: event.target.value })} /></label>
      <label className="wide"><span>Separación inferior: {content.style_text_space_bottom || 0}px</span><input type="range" min="0" max="64" value={Number(content.style_text_space_bottom || 0)} onChange={event => onChange({ style_text_space_bottom: event.target.value })} /></label>
    </div>;
    return null;
  };

  return (
    <aside className={`visual-properties-panel ${embedded ? 'is-embedded' : ''}`} aria-label={`Propiedades de ${meta.label}`}>
      <header>
        <div><small>Editando bloque</small><h3>{meta.label}</h3></div>
        <button type="button" className="icon" onClick={onClose} aria-label="Terminar edición" title="Terminar y volver a los componentes"><X size={18} /></button>
      </header>

      <nav className="visual-properties-tabs" aria-label="Opciones del bloque">
        {!embedded && <button type="button" className={activeTab === 'content' ? 'is-active' : ''} onClick={() => setActiveTab('content')}><Type size={15} /> Contenido</button>}
        <button type="button" className={activeTab === 'appearance' ? 'is-active' : ''} onClick={() => setActiveTab('appearance')}><SlidersHorizontal size={15} /> Apariencia</button>
        <button type="button" className={activeTab === 'text' ? 'is-active' : ''} onClick={() => setActiveTab('text')}><Type size={15} /> Estilo del texto</button>
        {hasLayoutOptions && <button type="button" className={activeTab === 'layout' ? 'is-active' : ''} onClick={() => setActiveTab('layout')}><SlidersHorizontal size={15} /> Diseño</button>}
        <button type="button" className={activeTab === 'buttons' ? 'is-active' : ''} onClick={() => setActiveTab('buttons')}><Link2 size={15} /> Botones</button>
      </nav>

      {activeTab === 'content' && <section>
          <h4>Texto, imágenes y contenido</h4>
          {renderContentFields()}
        </section>}

      {activeTab === 'appearance' && <section>
        <h4><SlidersHorizontal size={15} /> Apariencia</h4>
        {renderTextAppearanceFields()}
        <div className="visual-properties-grid">
          <div className="wide"><ColorField label="Fondo" value={content.style_bg || ''} fallback="#ffffff" onChange={style_bg => onChange({ style_bg })} /></div>
          <div className="wide"><ColorField label="Borde" value={content.style_border || ''} fallback="#e2e8f0" onChange={style_border => onChange({ style_border })} /></div>
          <label className="wide"><span>Ancho</span><select value={content.style_max_width || 'full'} onChange={event => onChange({ style_max_width: event.target.value })}><option value="full">Ancho completo</option><option value="900">Amplio</option><option value="700">Medio</option><option value="560">Estrecho</option></select></label>
          <label className="wide"><span>Espacio interior: {content.style_padding || 0}px</span><input type="range" min="0" max="48" value={Number(content.style_padding || 0)} onChange={event => onChange({ style_padding: event.target.value })} /></label>
          <label className="wide"><span>Esquinas: {content.style_radius || 0}px</span><input type="range" min="0" max="30" value={Number(content.style_radius || 0)} onChange={event => onChange({ style_radius: event.target.value })} /></label>
          <label className="wide"><span>Sombra</span><select value={content.style_shadow || 'none'} onChange={event => onChange({ style_shadow: event.target.value })}><option value="none">Sin sombra</option><option value="sm">Suave</option><option value="md">Media</option></select></label>
        </div>
      </section>}

      {activeTab === 'text' && <section>
        <>
        <h4>Formato del texto seleccionado</h4>
        <p className="visual-properties-hint">Primero selecciona una palabra o frase. El formato se aplica a esa selección; la posición vertical organiza el contenido completo dentro de su cuadro.</p>
        <div className="visual-properties-selection-format is-selection-only">
          <div className="visual-properties-word-toolbar" role="toolbar" aria-label="Formato del texto seleccionado">
            <div className="visual-properties-tool-group" aria-label="Formato básico">
              <button type="button" aria-pressed={Boolean(textState.bold)} className={textState.bold ? 'is-active' : ''} onClick={() => sendTextCommand('bold')} title="Negrita" aria-label="Negrita"><Bold size={17} /></button>
              <button type="button" aria-pressed={Boolean(textState.italic)} className={textState.italic ? 'is-active' : ''} onClick={() => sendTextCommand('italic')} title="Cursiva" aria-label="Cursiva"><Italic size={17} /></button>
              <button type="button" aria-pressed={Boolean(textState.underline)} className={textState.underline ? 'is-active' : ''} onClick={() => sendTextCommand('underline')} title="Subrayado" aria-label="Subrayado"><Underline size={17} /></button>
              <button type="button" aria-pressed={Boolean(textState.strike)} className={textState.strike ? 'is-active' : ''} onClick={() => sendTextCommand('strike')} title="Tachado" aria-label="Tachado"><Strikethrough size={17} /></button>
            </div>
            <div className="visual-properties-tool-group" aria-label="Listas y enlace">
              <button type="button" aria-pressed={Boolean(textState.bulletList)} className={textState.bulletList ? 'is-active' : ''} onClick={() => sendTextCommand('bulletList')} title="Lista con viñetas" aria-label="Lista con viñetas"><List size={17} /></button>
              <button type="button" aria-pressed={Boolean(textState.orderedList)} className={textState.orderedList ? 'is-active' : ''} onClick={() => sendTextCommand('orderedList')} title="Lista numerada" aria-label="Lista numerada"><ListOrdered size={17} /></button>
              <button type="button" aria-pressed={Boolean(textState.link)} className={textState.link ? 'is-active' : ''} onClick={() => sendTextCommand('link')} title="Añadir enlace" aria-label="Añadir enlace"><Link2 size={17} /></button>
            </div>
            <div className="visual-properties-tool-group" aria-label="Alineación">
              <button type="button" aria-pressed={(textState.align || 'left') === 'left'} className={(textState.align || 'left') === 'left' ? 'is-active' : ''} onClick={() => sendTextCommand('align', 'left')} title="Alinear a la izquierda" aria-label="Alinear a la izquierda"><AlignLeft size={17} /></button>
              <button type="button" aria-pressed={textState.align === 'center'} className={textState.align === 'center' ? 'is-active' : ''} onClick={() => sendTextCommand('align', 'center')} title="Centrar" aria-label="Centrar"><AlignCenter size={17} /></button>
              <button type="button" aria-pressed={textState.align === 'right'} className={textState.align === 'right' ? 'is-active' : ''} onClick={() => sendTextCommand('align', 'right')} title="Alinear a la derecha" aria-label="Alinear a la derecha"><AlignRight size={17} /></button>
            </div>
          </div>
          <SelectField label="Tipo de letra" value={String(textState.fontFamily || '')} options={[{ value: '', label: 'Sin fuente especial' }, { value: 'Montserrat, Segoe UI, sans-serif', label: 'Moderna' }, { value: 'Arial, Helvetica, sans-serif', label: 'Limpia' }, { value: 'Georgia, Times New Roman, serif', label: 'Clásica' }, { value: 'Verdana, Geneva, sans-serif', label: 'Amigable' }]} onChange={value => sendTextCommand('fontFamily', value)} />
          <SelectField label="Grosor" value={String(textState.fontWeight || '')} options={[{ value: '', label: 'Sin grosor especial' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medio' }, { value: '700', label: 'Negrita' }, { value: '800', label: 'Muy negrita' }]} onChange={value => sendTextCommand('fontWeight', value)} />
          <SelectField label="Tamaño de la selección" value={String(textState.fontSize || '').replace('px', '')} options={[{ value: '', label: 'Sin tamaño especial' }, { value: '12', label: '12 px' }, { value: '14', label: '14 px' }, { value: '16', label: '16 px' }, { value: '18', label: '18 px' }, { value: '22', label: '22 px' }, { value: '28', label: '28 px' }]} onChange={value => sendTextCommand('fontSize', value)} />
          <SelectField label="Interlineado" value={String(textState.lineHeight || '')} options={[{ value: '', label: 'Sin interlineado especial' }, { value: '1.25', label: 'Compacto' }, { value: '1.55', label: 'Normal' }, { value: '1.85', label: 'Amplio' }]} onChange={value => sendTextCommand('lineHeight', value)} />
          <SelectField label="Espacio entre letras" value={String(textState.letterSpacing || '')} options={[{ value: '', label: 'Sin espaciado especial' }, { value: '-0.02em', label: 'Cerrado' }, { value: 'normal', label: 'Normal' }, { value: '0.06em', label: 'Separado' }]} onChange={value => sendTextCommand('letterSpacing', value)} />
          <SelectField label="Mayúsculas y minúsculas" value={String(textState.textTransform || '')} options={[{ value: '', label: 'Como fue escrito' }, { value: 'none', label: 'Como fue escrito' }, { value: 'uppercase', label: 'TODO EN MAYÚSCULAS' }, { value: 'capitalize', label: 'Iniciales En Mayúscula' }]} onChange={value => sendTextCommand('textTransform', value)} />
          <ColorField label="Color solo de la selección" value={String(textState.color || '')} fallback="#000000" onChange={color => sendTextCommand('textColor', color)} />
          <ColorField label="Resaltado solo de la selección" value={String(textState.highlight || '')} fallback="#fde047" onChange={color => sendTextCommand('highlight', color)} />
          <div className={`visual-text-outline-card ${textState.textStrokeWidth && textState.textStrokeWidth !== '0px' ? 'is-enabled' : ''}`}>
            <div className="visual-text-outline-heading">
              <div><strong>Contorno</strong><small>Haz que las letras destaquen sobre cualquier fondo</small></div>
              <button type="button" className="visual-text-outline-switch" aria-label="Activar o desactivar contorno" aria-pressed={Boolean(textState.textStrokeWidth && textState.textStrokeWidth !== '0px')} onClick={() => sendTextCommand('textStrokeWidth', textState.textStrokeWidth && textState.textStrokeWidth !== '0px' ? '' : '1px')}><span /></button>
            </div>
            <div className="visual-text-outline-preview" aria-hidden="true" style={{ WebkitTextStrokeColor: String(textState.textStrokeColor || '#000000'), WebkitTextStrokeWidth: textState.textStrokeWidth && textState.textStrokeWidth !== '0px' ? String(textState.textStrokeWidth) : '0px' }}>Aa <small>{textState.textStrokeWidth && textState.textStrokeWidth !== '0px' ? 'Vista del contorno' : 'Contorno desactivado'}</small></div>
            <div className="visual-text-outline-controls">
              <ColorField label="Color del contorno" value={String(textState.textStrokeColor || '')} fallback="#000000" onChange={color => sendTextCommand('textStrokeColor', color)} />
              <label className="visual-text-outline-width">
                <span><b>Grosor</b><output>{parseFloat(String(textState.textStrokeWidth || '1')) || 1}px</output></span>
                <input type="range" min="0.5" max="4" step="0.5" value={parseFloat(String(textState.textStrokeWidth || '1')) || 1} onChange={event => sendTextCommand('textStrokeWidth', `${event.target.value}px`)} />
                <small><i>Fino</i><i>Grueso</i></small>
              </label>
            </div>
          </div>
          <div className="visual-properties-clear-tools">
            <button type="button" onClick={() => sendTextCommand('textColor')} title="Quitar color"><Palette size={15} /> Quitar color</button>
            <button type="button" onClick={() => sendTextCommand('fontSize')} title="Quitar tamaño personalizado"><Type size={15} /> Quitar tamaño</button>
            <button type="button" onClick={() => sendTextCommand('highlight')} title="Quitar resaltado"><RemoveFormatting size={15} /> Quitar resaltado</button>
          </div>
          <button type="button" className="visual-properties-reset-text" onClick={() => sendTextCommand('clearTextStyle')}><RotateCcw size={15} /> Quitar todo el formato de la selección</button>
        </div>
        </>
      </section>}

      {activeTab === 'layout' && <section>
        <h4>Diseño de {meta.label.toLowerCase()}</h4>
        {renderLayoutFields()}
      </section>}

      {activeTab === 'buttons' && <section>
        <h4>Enlaces y botones del bloque</h4>
        <SelectField label="Distribución" value={content.cta_layout || 'row'} options={[{ value: 'row', label: 'En una fila' }, { value: 'column', label: 'En una columna' }]} onChange={cta_layout => onChange({ cta_layout })} />
        <SelectField label="Estilo" value={content.cta_style || 'soft'} options={[{ value: 'solid', label: 'Color sólido' }, { value: 'outline', label: 'Solo borde' }, { value: 'soft', label: 'Color suave' }]} onChange={cta_style => onChange({ cta_style })} />
        <SelectField label="Tamaño" value={content.cta_size || 'md'} options={[{ value: 'sm', label: 'Pequeño' }, { value: 'md', label: 'Mediano' }, { value: 'lg', label: 'Grande' }]} onChange={cta_size => onChange({ cta_size })} />
        <ColorField label="Color del botón" value={content.cta_color || ''} fallback="#2563eb" onChange={cta_color => onChange({ cta_color })} />
        <ColorField label="Color del texto del botón" value={content.cta_text_color || ''} fallback="#ffffff" onChange={cta_text_color => onChange({ cta_text_color })} />
        <div className="visual-properties-button-list">
          {[1, 2, 3, 4].map(number => <div key={number}>
            <strong>Botón {number}</strong>
            <label className="visual-properties-field"><span>Texto visible</span><input value={content[`cta_${number}_text`] || ''} onChange={event => onChange({ [`cta_${number}_text`]: event.target.value })} placeholder="Ejemplo: Ver temario" /></label>
            <label className="visual-properties-field"><span>Página o enlace de destino</span><input value={content[`cta_${number}_url`] || ''} onChange={event => onChange({ [`cta_${number}_url`]: event.target.value })} placeholder="/temario o https://…" /></label>
          </div>)}
        </div>
      </section>}

      <footer>
        <button type="button" onClick={onDuplicate}><Copy size={15} /> Duplicar</button>
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={15} /> Eliminar</button>
      </footer>
    </aside>
  );
};

export default VisualBlockProperties;
