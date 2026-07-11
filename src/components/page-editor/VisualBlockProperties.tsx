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
        </>
      );
    }
    if (block.block_type === 'text_image') {
      return (
        <>
          <TextAreaField label="Texto" value={content.text ?? ''} onChange={text => onChange({ text })} />
          <ImageField url={content.image_url ?? ''} onPick={() => onPickImage('image_url')} onClear={() => onChange({ image_url: '' })} />
          <TextAreaField label="Pie de imagen" value={content.image_caption ?? ''} onChange={image_caption => onChange({ image_caption })} />
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
          <TextAreaField label="Columna 3" value={content.col_3 || ''} onChange={col_3 => onChange({ col_3 })} />
          <TextAreaField label="Columna 4" value={content.col_4 || ''} onChange={col_4 => onChange({ col_4 })} />
          <SelectField label="Número de columnas" value={content.columns || '2'} options={[{ value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }, { value: '4', label: 'Cuatro columnas' }]} onChange={columns => onChange({ columns })} />
        </>
      );
    }
    if (block.block_type === 'two_images') {
      return <GalleryImages content={content} fields={[
        { url: 'image_url_left', caption: 'image_caption_left', label: 'Imagen izquierda' },
        { url: 'image_url_right', caption: 'image_caption_right', label: 'Imagen derecha' },
      ]} onChange={onChange} onPickImage={onPickImage} />;
    }
    if (block.block_type === 'three_images') {
      return <GalleryImages content={content} fields={[1, 2, 3].map(number => ({
        url: `image_url_${number}`, caption: `image_caption_${number}`, label: `Imagen ${number}`,
      }))} onChange={onChange} onPickImage={onPickImage} />;
    }
    if (block.block_type === 'callout') {
      return <>
        <TextAreaField label="Mensaje destacado" value={content.text ?? ''} onChange={text => onChange({ text })} />
        <SelectField label="Tipo de mensaje" value={content.variant || 'info'} options={[{ value: 'info', label: 'Información' }, { value: 'success', label: 'Éxito' }, { value: 'warning', label: 'Advertencia' }, { value: 'danger', label: 'Importante' }]} onChange={variant => onChange({ variant })} />
      </>;
    }
    if (block.block_type === 'divider') {
      return <SelectField label="Diseño del separador" value={content.style || 'gradient'} options={[{ value: 'gradient', label: 'Línea con degradado' }, { value: 'solid', label: 'Línea continua' }, { value: 'dashed', label: 'Línea de guiones' }, { value: 'dots', label: 'Puntos' }]} onChange={style => onChange({ style })} />;
    }
    if (block.block_type === 'carousel' || block.block_type === 'text_carousel') {
      const imageFields = Array.from({ length: block.block_type === 'carousel' ? 10 : 6 }, (_, index) => ({
        url: `image_url_${index + 1}`, caption: `image_cap_${index + 1}`, label: `Imagen ${index + 1}`,
      }));
      return <>
        {block.block_type === 'text_carousel' && <TextAreaField label="Texto que acompaña la galería" value={content.text || ''} onChange={text => onChange({ text })} />}
        <GalleryImages content={content} fields={imageFields} progressive onChange={onChange} onPickImage={onPickImage} />
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
        <strong className="visual-properties-group-title">Galería derecha</strong>
        <GalleryImages content={content} fields={galleryFields('right')} progressive onChange={onChange} onPickImage={onPickImage} />
        <SelectField label="Movimiento de las galerías" value={content.auto || 'true'} options={[{ value: 'true', label: 'Automático' }, { value: 'false', label: 'Solo con flechas' }]} onChange={auto => onChange({ auto })} />
        <SelectField label="Tiempo entre imágenes" value={content.interval || '4'} options={[2, 3, 4, 5, 8].map(seconds => ({ value: String(seconds), label: `${seconds} segundos` }))} onChange={interval => onChange({ interval })} />
      </>;
    }
    return <p className="visual-properties-hint">Este bloque no contiene texto ni imágenes editables.</p>;
  };

  const hasLayoutOptions = ['section', 'columns_2', 'image', 'text_image', 'callout', 'weekly_publication', 'list', 'divider', 'carousel', 'text_carousel', 'double_carousel'].includes(block.block_type);
  const renderLayoutFields = () => {
    if (block.block_type === 'section') {
      return <SelectField label="Tono de la sección" value={content.tone || 'neutral'} options={[{ value: 'neutral', label: 'Neutro' }, { value: 'info', label: 'Informativo' }, { value: 'accent', label: 'Con color de acento' }]} onChange={tone => onChange({ tone })} />;
    }
    if (block.block_type === 'columns_2') {
      return <>
        <SelectField label="Número de columnas" value={content.columns || '2'} options={[{ value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }, { value: '4', label: 'Cuatro columnas' }]} onChange={columns => onChange({ columns })} />
        {(content.columns || '2') === '2' && <SelectField label="Proporción" value={content.ratio || '1:1'} options={[{ value: '1:1', label: 'Mismo ancho' }, { value: '2:1', label: 'Izquierda más ancha' }, { value: '1:2', label: 'Derecha más ancha' }]} onChange={ratio => onChange({ ratio })} />}
      </>;
    }
    if (block.block_type === 'image') {
      return <>
        <SelectField label="Tamaño predefinido" value={content.size || 'large'} options={[{ value: 'small', label: 'Pequeña' }, { value: 'medium', label: 'Mediana' }, { value: 'large', label: 'Grande' }]} onChange={size => onChange({ size })} />
        <SelectField label="Alineación" value={content.align || 'center'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} onChange={align => onChange({ align })} />
        <NumberField label="Ancho de la imagen (%)" value={content.image_width || '100'} min={20} max={100} onChange={image_width => onChange({ image_width: image_width || '100' })} />
        <NumberField label="Alto de la imagen (px)" value={content.image_height || ''} min={0} max={1200} placeholder="Automático" onChange={image_height => onChange({ image_height })} />
        <SelectField label="Recorte" value={content.image_fit || 'contain'} options={[{ value: 'contain', label: 'Mostrar imagen completa' }, { value: 'cover', label: 'Llenar el espacio (puede recortar)' }]} onChange={image_fit => onChange({ image_fit })} />
      </>;
    }
    if (block.block_type === 'text_image') {
      return <>
        <SelectField label="Posición de la imagen" value={content.image_position || 'right'} options={[{ value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }]} onChange={image_position => onChange({ image_position })} />
        <SelectField label="Posición vertical del texto" value={content.ti_vertical_align || 'start'} options={[{ value: 'start', label: 'Arriba' }, { value: 'center', label: 'Centro' }, { value: 'end', label: 'Abajo' }]} onChange={ti_vertical_align => onChange({ ti_vertical_align })} />
        <NumberField label="Ancho de la imagen (%)" value={content.ti_image_width || '42'} min={20} max={70} onChange={ti_image_width => onChange({ ti_image_width: ti_image_width || '42' })} />
        <NumberField label="Alto de la imagen (px)" value={content.ti_image_height || ''} min={0} max={1000} placeholder="Automático" onChange={ti_image_height => onChange({ ti_image_height })} />
        <SelectField label="Recorte" value={content.ti_image_fit || 'cover'} options={[{ value: 'contain', label: 'Mostrar imagen completa' }, { value: 'cover', label: 'Llenar el espacio (puede recortar)' }]} onChange={ti_image_fit => onChange({ ti_image_fit })} />
      </>;
    }
    if (block.block_type === 'callout') {
      return <SelectField label="Tipo de caja" value={content.variant || 'info'} options={[{ value: 'info', label: 'Información' }, { value: 'tip', label: 'Consejo' }, { value: 'warning', label: 'Importante' }, { value: 'clinical', label: 'Dato clínico' }]} onChange={variant => onChange({ variant })} />;
    }
    if (block.block_type === 'weekly_publication') {
      return <>
        <SelectField label="Posición de la placa" value={content.weekly_image_position || 'right'} options={[{ value: 'right', label: 'Imagen a la derecha' }, { value: 'left', label: 'Imagen a la izquierda' }]} onChange={weekly_image_position => onChange({ weekly_image_position })} />
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
        </>}
        <SelectField label="Movimiento" value={content.auto || 'true'} options={[{ value: 'true', label: 'Automático' }, { value: 'false', label: 'Solo con flechas' }]} onChange={auto => onChange({ auto })} />
        {(content.auto || 'true') === 'true' && <SelectField label="Tiempo entre imágenes" value={content.interval || '4'} options={[2, 3, 4, 5, 8].map(seconds => ({ value: String(seconds), label: `${seconds} segundos` }))} onChange={interval => onChange({ interval })} />}
      </>;
    }
    return null;
  };

  const renderTextAppearanceFields = () => {
    if (block.block_type === 'heading') return <div className="visual-properties-specific-style"><h4>Decoración del título</h4><SelectField label="Estilo" value={content.title_decoration || 'none'} options={[{ value: 'none', label: 'Limpio, sin adorno' }, { value: 'underline', label: 'Línea inferior' }, { value: 'side-line', label: 'Línea lateral' }, { value: 'soft-box', label: 'Fondo suave' }, { value: 'outline', label: 'Contorno elegante' }]} onChange={title_decoration => onChange({ title_decoration })} /><ColorField label="Color de acento" value={content.title_accent || ''} fallback="#38bdf8" onChange={title_accent => onChange({ title_accent })} /></div>;
    if (block.block_type === 'subheading') return <div className="visual-properties-specific-style"><h4>Decoración del subtítulo</h4><SelectField label="Estilo" value={content.subtitle_decoration || 'side-line'} options={[{ value: 'none', label: 'Limpio, sin adorno' }, { value: 'side-line', label: 'Línea lateral' }, { value: 'underline', label: 'Línea inferior' }, { value: 'soft-box', label: 'Fondo suave' }]} onChange={subtitle_decoration => onChange({ subtitle_decoration })} /><ColorField label="Color de acento" value={content.subtitle_accent || ''} fallback="#38bdf8" onChange={subtitle_accent => onChange({ subtitle_accent })} /></div>;
    if (block.block_type === 'paragraph') return <div className="visual-properties-specific-style"><h4>Presentación del texto</h4><SelectField label="Estilo del cuadro" value={content.text_box_style || 'plain'} options={[{ value: 'plain', label: 'Texto limpio' }, { value: 'card', label: 'Tarjeta elevada' }, { value: 'soft', label: 'Fondo suave' }, { value: 'quote', label: 'Cita destacada' }]} onChange={text_box_style => onChange({ text_box_style })} /><SelectField label="Columnas de lectura" value={content.text_columns || '1'} options={[{ value: '1', label: 'Una columna' }, { value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }]} onChange={text_columns => onChange({ text_columns })} />{content.text_box_style === 'quote' && <ColorField label="Color de la cita" value={content.text_box_accent || ''} fallback="#38bdf8" onChange={text_box_accent => onChange({ text_box_accent })} />}</div>;
    if (block.block_type === 'list') return <div className="visual-properties-specific-style"><h4>Presentación de la lista</h4><SelectField label="Columnas" value={content.list_columns || '1'} options={[{ value: '1', label: 'Una columna' }, { value: '2', label: 'Dos columnas' }, { value: '3', label: 'Tres columnas' }]} onChange={list_columns => onChange({ list_columns })} /><SelectField label="Marcadores" value={content.list_marker || (content.style === 'numbered' ? 'number' : 'bullet')} options={[{ value: 'bullet', label: 'Viñetas' }, { value: 'number', label: 'Números' }, { value: 'check', label: 'Marcas de verificación' }, { value: 'arrow', label: 'Flechas' }]} onChange={list_marker => onChange({ list_marker })} /><SelectField label="Estilo de cada elemento" value={content.list_item_style || 'plain'} options={[{ value: 'plain', label: 'Limpio' }, { value: 'soft', label: 'Fondos suaves' }, { value: 'cards', label: 'Tarjetas separadas' }]} onChange={list_item_style => onChange({ list_item_style })} /><ColorField label="Color de los marcadores" value={content.list_accent || ''} fallback="#2563eb" onChange={list_accent => onChange({ list_accent })} /></div>;
    if (block.block_type === 'callout') return <div className="visual-properties-specific-style"><h4>Acabado de la caja destacada</h4><SelectField label="Diseño" value={content.callout_style || 'modern'} options={[{ value: 'modern', label: 'Moderna con degradado suave' }, { value: 'accent', label: 'Limpia con franja lateral' }, { value: 'tinted', label: 'Fondo de color suave' }, { value: 'outline', label: 'Solo contorno' }]} onChange={callout_style => onChange({ callout_style })} /><SelectField label="Ancho de la caja" value={content.callout_width || 'full'} options={[{ value: 'full', label: 'Todo el ancho disponible' }, { value: 'wide', label: 'Amplia (900 px)' }, { value: 'medium', label: 'Media (700 px)' }, { value: 'compact', label: 'Compacta (520 px)' }]} onChange={callout_width => onChange({ callout_width })} /><SelectField label="Icono" value={content.callout_show_icon || 'true'} options={[{ value: 'true', label: 'Mostrar icono' }, { value: 'false', label: 'Ocultar icono' }]} onChange={callout_show_icon => onChange({ callout_show_icon })} /><ColorField label="Color principal" value={content.callout_bg || ''} fallback="#dbeafe" onChange={callout_bg => onChange({ callout_bg })} /><ColorField label="Color del borde y acento" value={content.callout_border || ''} fallback="#60a5fa" onChange={callout_border => onChange({ callout_border })} /></div>;
    if (block.block_type === 'weekly_publication') return <div className="visual-properties-specific-style"><h4>Diseño de la publicación semanal</h4><SelectField label="Estilo visual" value={content.weekly_style || 'premium'} options={[{ value: 'premium', label: 'Editorial premium' }, { value: 'clean', label: 'Blanco y limpio' }, { value: 'outline', label: 'Contorno elegante' }]} onChange={weekly_style => onChange({ weekly_style })} /><ColorField label="Color de acento" value={content.weekly_accent || ''} fallback="#1677b8" onChange={weekly_accent => onChange({ weekly_accent })} /><ColorField label="Color de fondo" value={content.weekly_bg || ''} fallback="#eef8ff" onChange={weekly_bg => onChange({ weekly_bg })} /></div>;
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
