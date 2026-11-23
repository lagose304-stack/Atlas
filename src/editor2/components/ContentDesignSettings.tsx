import { useState } from 'react';
import type { ButtonTemplate, CalloutTone, DividerTemplate, IconTemplate, TableTemplate } from '../domain/componentTemplates';
import type { MediaAppearance } from '../domain/styleSchema';
import type { ContentTemplateType } from './ContentTemplateGallery';
import { CALLOUT_TONES } from './Editor2Blocks';
import IconPickerModal, { renderAtlasIcon } from './IconPickerModal';
import MediaStyleFields, { MediaRadiusField } from './MediaStyleFields';
import TextColorPicker from './TextColorPicker';
import TextSizePresetPicker from './TextSizePresetPicker';

const titles = {
  icon: 'Aspecto del icono',
  callout: 'Aspecto de la nota',
  table: 'Aspecto de la tabla',
  button: 'Aspecto del botón',
  divider: 'Aspecto del separador',
  examCarousel: 'Aspecto de las pruebas',
  image: 'Aspecto de la imagen',
  carousel: 'Aspecto del carrusel',
  compare: 'Aspecto del comparador',
  gif: 'Aspecto del GIF',
  video: 'Aspecto del video',
};
const tableOptions = [
  ['striped', 'Alternar fondo de las filas'],
  ['compact', 'Reducir el espacio de las celdas'],
  ['bordered', 'Resaltar la cuadrícula'],
] as const;

export default function ContentDesignSettings({ type, properties, onChange }: {
  type: ContentTemplateType;
  properties: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [pickingIcon, setPickingIcon] = useState(false);
  const icon = properties as Partial<IconTemplate>;
  const table = properties as Partial<TableTemplate>;
  const frame = icon.frame ?? 'rounded';
  const name = icon.name ?? 'microscope';
  const media = properties.media as MediaAppearance | undefined;
  const captionLabel = type === 'video' ? 'pie de video' : type === 'gif' ? 'pie de GIF' : 'pie de foto';

  return (
    <details className="e2-design-section" open>
      <summary>{titles[type]}</summary>
      <div className="e2-design-section__body">
        {(type === 'image' || type === 'carousel' || type === 'compare' || type === 'gif' || type === 'video') && (
          <>
            <label className="e2-design-checkbox">
              <input type="checkbox" checked={media?.showCaption !== false}
                onChange={event => onChange({ media: { ...media, showCaption: event.target.checked } })} />
              Mostrar {captionLabel}
            </label>
            {type === 'compare' && (
              <label className="e2-design-field">
                <span className="e2-design-label">Pie de foto</span>
                <input type="text" maxLength={500} value={typeof properties.caption === 'string' ? properties.caption : ''}
                  onChange={event => onChange({ caption: event.target.value })} />
              </label>
            )}
            {type !== 'video' && (
              <label className="e2-design-field">
                <span className="e2-design-label">Ajuste de la imagen</span>
                <select value={properties.fit === 'cover' ? 'cover' : 'contain'}
                  onChange={event => onChange({ fit: event.target.value })}>
                  <option value="contain">Mostrar completa</option>
                  <option value="cover">Cubrir</option>
                </select>
              </label>
            )}
            {media?.showCaption !== false && (
              <label className="e2-design-field">
                <span className="e2-design-label">Alineación del {captionLabel}</span>
                <select value={media?.captionAlign ?? (type === 'image' || type === 'gif' || type === 'video' ? 'left' : 'center')}
                  onChange={event => onChange({
                    media: { ...media, captionAlign: event.target.value as MediaAppearance['captionAlign'] },
                  })}>
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </label>
            )}
            <div className="e2-badge-design-actions">
              <span className="e2-design-label">Fondo del marco</span>
              <TextColorPicker label="Fondo del marco" value={media?.stageBackground} fallback="#eef7fc"
                onChange={stageBackground => onChange({ media: { ...media, stageBackground } })}
                onReset={() => onChange({ media: { ...media, stageBackground: undefined } })} />
            </div>
            {type === 'video' ? (
              <div className="e2-quad-grid">
                <label className="e2-design-field">
                  <span className="e2-design-label">Relación de aspecto</span>
                  <select value={typeof properties.aspect === 'string' ? properties.aspect : '16/9'}
                    onChange={event => onChange({ aspect: event.target.value })}>
                    <option value="16/9">16:9 (Panorámica)</option>
                    <option value="4/3">4:3</option>
                    <option value="1/1">1:1 (Cuadrada)</option>
                  </select>
                </label>
                <MediaRadiusField radius={media?.radius} label="Redondeado del video"
                  onChange={radius => onChange({ media: { ...media, radius } })} />
              </div>
            ) : <MediaStyleFields media={media} allowOverlay={type !== 'compare'} onChange={next => onChange({ media: next })} />}
          </>
        )}
        {type === 'icon' && (
          <>
            <div className="e2-badge-design-actions">
              <button type="button" className="e2-button e2-button--quiet" onClick={() => setPickingIcon(true)}>
                {renderAtlasIcon(name, 14)} Cambiar icono
              </button>
              <TextColorPicker label="Color del icono" value={icon.color} fallback="#0284c7"
                onChange={color => onChange({ color })} />
              {frame !== 'none' && <TextColorPicker label="Fondo del marco" value={icon.bgColor} fallback="#e0f2fe"
                onChange={bgColor => onChange({ bgColor })} onReset={() => onChange({ bgColor: undefined })} />}
            </div>
            <label className="e2-design-field">
              <span className="e2-design-label">Forma del marco</span>
              <select value={frame} onChange={event => onChange({ frame: event.target.value })}>
                <option value="none">Sin marco</option>
                <option value="circle">Círculo</option>
                <option value="rounded">Cuadrado redondeado</option>
              </select>
            </label>
            <label className="e2-design-slider">
              <span>Tamaño · {icon.size ?? 32} px</span>
              <input type="range" aria-label="Tamaño del icono" min={16} max={96} value={icon.size ?? 32}
                onChange={event => onChange({ size: Number(event.target.value) })} />
            </label>
            <IconPickerModal open={pickingIcon} value={name}
              onSelect={next => { if (next) onChange({ name: next }); }} onClose={() => setPickingIcon(false)} />
          </>
        )}
        {type === 'callout' && (
          <label className="e2-design-field">
            <span className="e2-design-label">Tipo e icono de la nota</span>
            <select value={(properties.tone as CalloutTone | undefined) ?? 'info'}
              onChange={event => onChange({ tone: event.target.value })}>
              {Object.entries(CALLOUT_TONES).map(([value, tone]) => <option key={value} value={value}>{tone.label}</option>)}
            </select>
          </label>
        )}
        {type === 'table' && (
          <>
            <div className="e2-badge-design-actions">
              <span className="e2-design-label">Fondo de la cabecera</span>
              <TextColorPicker label="Fondo de la cabecera" value={table.accentColor} fallback="#e0f2fe"
                onChange={accentColor => onChange({ accentColor })} />
            </div>
            {tableOptions.map(([key, label]) => (
              <label key={key} className="e2-design-checkbox">
                <input type="checkbox" checked={Boolean(table[key])}
                  onChange={event => onChange({ [key]: event.target.checked })} />
                {label}
              </label>
            ))}
          </>
        )}
        {type === 'button' && (
          <>
            <TextSizePresetPicker value={properties.textSizePreset} onChange={textSizePreset => onChange({ textSizePreset })} />
            <label className="e2-design-field">
              <span className="e2-design-label">Estilo del botón</span>
              <select value={(properties as Partial<ButtonTemplate>).variant ?? 'solid'}
                onChange={event => onChange({ variant: event.target.value })}>
                <option value="solid">Sólido</option>
                <option value="gradient">Degradado</option>
                <option value="pill">Pastilla</option>
                <option value="outline">Contorno</option>
                <option value="soft">Suave</option>
                {properties.variant === 'weekly' && <option value="weekly">Ficha semanal</option>}
              </select>
            </label>
            <div className="e2-badge-design-actions">
              <TextColorPicker label="Color del botón" value={(properties as Partial<ButtonTemplate>).color}
                fallback="#0284c7" onChange={color => onChange({ color })} />
              <button type="button" className="e2-button e2-button--quiet" onClick={() => setPickingIcon(true)}>
                {renderAtlasIcon(typeof properties.icon === 'string' ? properties.icon : 'arrow-right', 14)}
                {properties.icon ? 'Cambiar icono' : 'Añadir icono'}
              </button>
            </div>
            <IconPickerModal open={pickingIcon} value={typeof properties.icon === 'string' ? properties.icon : undefined}
              allowClear onSelect={icon => onChange({ icon })} onClose={() => setPickingIcon(false)} />
            {properties.variant === 'weekly' && (
              <p className="e2-destination-hint">El nombre y la imagen se toman del destino en Atlas.</p>
            )}
          </>
        )}
        {type === 'divider' && (
          <>
            <div className="e2-badge-design-actions">
              <span className="e2-design-label">Color de línea</span>
              <TextColorPicker label="Color de línea" value={(properties as Partial<DividerTemplate>).color}
                fallback="#0284c7" onChange={color => onChange({ color })} />
            </div>
            <label className="e2-design-field">
              <span className="e2-design-label">Trazo del separador</span>
              <select value={(properties as Partial<DividerTemplate>).lineStyle ?? 'solid'}
                onChange={event => onChange({ lineStyle: event.target.value })}>
                <option value="solid">Continuo</option>
                <option value="dashed">Guiones</option>
                <option value="gradient">Degradado</option>
              </select>
            </label>
            <label className="e2-design-slider">
              <span>Grosor · {Number(properties.thickness ?? 2)} px</span>
              <input type="range" aria-label="Grosor del separador" min={1} max={16} value={Number(properties.thickness ?? 2)}
                onChange={event => onChange({ thickness: Number(event.target.value) })} />
            </label>
            <label className="e2-design-field">
              <span className="e2-design-label">Dirección del separador</span>
              <select value={properties.orientation === 'vertical' ? 'vertical' : 'horizontal'}
                onChange={event => onChange({ orientation: event.target.value })}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            {properties.orientation !== 'vertical' && (
              <label className="e2-design-slider">
                <span>Ancho · {Number(properties.widthPercent ?? 100)} %</span>
                <input type="range" aria-label="Ancho del separador" min={20} max={100} step={20} value={Number(properties.widthPercent ?? 100)}
                  onChange={event => onChange({ widthPercent: Number(event.target.value) })} />
              </label>
            )}
          </>
        )}
        {type === 'examCarousel' && (
          <>
            <div className="e2-badge-design-actions">
              <span className="e2-design-label">Color de acento</span>
              <TextColorPicker label="Color de acento" value={typeof properties.accentColor === 'string' ? properties.accentColor : undefined}
                fallback="#6d28d9" onChange={accentColor => onChange({ accentColor })} />
            </div>
            <TextSizePresetPicker label="Tamaño del texto de Iniciar prueba" value={properties.buttonTextSize}
              onChange={buttonTextSize => onChange({ buttonTextSize })} />
          </>
        )}
      </div>
    </details>
  );
}
