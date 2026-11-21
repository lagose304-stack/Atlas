import type { SpanIntent } from '../domain/schema';

type WidthField = 'widthPx' | 'minWidthPx' | 'maxWidthPx';

export default function FlexSizeControls({ base, onChange }: {
  base: SpanIntent;
  onChange: (base: SpanIntent) => void;
}) {
  function widthInput(field: WidthField, label: string, min = 1, max = 4096) {
    const value = base[field] ?? (field === 'widthPx' ? 240 : '');
    return (
      <label>{label}
        <input type="number" key={String(value)} defaultValue={value} min={min} max={max}
          required={field === 'widthPx'} placeholder={field === 'widthPx' ? undefined : 'Sin límite'}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={({ currentTarget: input }) => {
            if (!input.validity.valid) {
              input.reportValidity();
              input.value = String(value);
              return;
            }
            const next = { ...base };
            if (input.value === '') delete next[field];
            else next[field] = input.valueAsNumber;
            if (next[field] !== base[field]) onChange(next);
          }} />
      </label>
    );
  }
  return (
    <>
      <label>Tamaño en el contenedor
        <select value={base.flexSize ?? 'fit'} onChange={({ target }) =>
          onChange({ ...base, flexSize: target.value as SpanIntent['flexSize'] })}>
          <option value="fit">Ajustar al contenido</option>
          <option value="fill">Ocupar espacio disponible</option>
          <option value="fixed">Ancho fijo</option>
        </select>
      </label>
      {base.flexSize === 'fixed' && widthInput('widthPx', 'Ancho (px)')}
      <details className="e2-width-limits">
        <summary>Límites de ancho</summary>
        {widthInput('minWidthPx', 'Mínimo (px)', 1, base.maxWidthPx)}
        {widthInput('maxWidthPx', 'Máximo (px)', base.minWidthPx)}
      </details>
    </>
  );
}
