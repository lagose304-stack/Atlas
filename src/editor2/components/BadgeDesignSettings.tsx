import { useState } from 'react';
import { Microscope } from 'lucide-react';
import BadgeFace, { BADGE_SIZES, BADGE_VARIANTS, type BadgeAppearance } from './BadgeFace';
import IconPickerModal, { renderAtlasIcon } from './IconPickerModal';
import TextColorPicker from './TextColorPicker';

export default function BadgeDesignSettings({ appearance, onChange }: {
  appearance: BadgeAppearance;
  onChange: (patch: BadgeAppearance) => void;
}) {
  const [pickingIcon, setPickingIcon] = useState(false);
  return (
    <details className="e2-design-section" open>
      <summary>Aspecto de la insignia</summary>
      <div className="e2-design-section__body">
        <div className="e2-badge-design-preview" aria-hidden="true">
          <BadgeFace {...appearance}><span>Epitelio</span></BadgeFace>
        </div>
        <label className="e2-design-field">
          <span className="e2-design-label">Estilo de insignia</span>
          <select value={appearance.variant ?? 'soft'}
            onChange={event => onChange({ variant: event.target.value as BadgeAppearance['variant'] })}>
            {BADGE_VARIANTS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="e2-design-field">
          <span className="e2-design-label">Tamaño de insignia</span>
          <select value={appearance.size ?? 'md'}
            onChange={event => onChange({ size: event.target.value as BadgeAppearance['size'] })}>
            {BADGE_SIZES.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="e2-badge-design-actions">
          <TextColorPicker label="Color de insignia" value={appearance.color} fallback="#0284c7"
            onChange={color => onChange({ color })} />
          <button type="button" className="e2-button e2-button--quiet" onClick={() => setPickingIcon(true)}>
            {appearance.icon ? renderAtlasIcon(appearance.icon, 14) : <Microscope size={14} aria-hidden="true" />}
            {appearance.icon ? 'Cambiar icono' : 'Añadir icono'}
          </button>
        </div>
        <IconPickerModal open={pickingIcon} value={appearance.icon} allowClear
          onSelect={icon => onChange({ icon })} onClose={() => setPickingIcon(false)} />
      </div>
    </details>
  );
}
