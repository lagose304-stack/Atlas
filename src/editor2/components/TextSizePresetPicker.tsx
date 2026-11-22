import { headingTextSizePresetSchema, textSizePresetSchema, type HeadingTextSizePreset } from '../domain/schema';

export default function TextSizePresetPicker({
  label = 'Tamaño del texto', value, legacySize = false, heading = false, onChange,
}: {
  label?: string;
  value: unknown;
  legacySize?: boolean;
  heading?: boolean;
  onChange: (value: HeadingTextSizePreset) => void;
}) {
  const schema = heading ? headingTextSizePresetSchema : textSizePresetSchema;
  const preset = schema.safeParse(value).data;

  return (
    <label className="e2-design-field">
      <span className="e2-design-label">{label}</span>
      <select value={preset ?? (legacySize ? '' : 'normal')}
        onChange={event => onChange(schema.parse(event.target.value))}>
        {legacySize && !preset && <option value="" disabled>Tamaño guardado</option>}
        <option value="normal">Normal</option>
        <option value="large">Grande</option>
        <option value="extra-large">Más grande</option>
        {heading && <>
          <option value="jumbo">Jumbo</option>
          <option value="huge">Enorme</option>
        </>}
      </select>
    </label>
  );
}
