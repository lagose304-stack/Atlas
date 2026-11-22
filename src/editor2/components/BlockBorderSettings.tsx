import type { BorderStyle, RadiusStyle } from '../domain/styleSchema';
import { blockStyleToCss } from '../domain/styleToCss';

const strokes = [
  ['none', 'Sin borde'],
  ['solid', 'Continuo'],
  ['dashed', 'Guiones'],
  ['dotted', 'Puntos'],
] as const;

const sides = [
  ['all', 'Contorno'],
  ['left', 'Izquierda'],
  ['top', 'Arriba'],
  ['bottom', 'Abajo'],
  ['right', 'Derecha'],
] as const;

type Props = {
  border: BorderStyle;
  radius?: RadiusStyle;
  forText: boolean;
  onChange: (border?: BorderStyle) => void;
};

export default function BlockBorderSettings({ border, radius, forText, onChange }: Props) {
  const visible = border.style !== 'none' && border.width > 0;
  return (
    <details className="e2-design-section" open={forText || undefined}>
      <summary>{forText ? 'Línea y borde' : 'Borde y acento lateral'}</summary>
      <div className="e2-design-section__body">
        {forText && visible && (
          <div className="e2-border-preview" aria-hidden="true" style={blockStyleToCss({ border, radius })}>
            Muestra del borde
          </div>
        )}
        {forText && <span className="e2-design-label">Trazo</span>}
        <div className="e2-segmented" role="group" aria-label="Estilo de borde">
          {strokes.map(([stroke, label]) => {
            const active = (visible ? border.style : 'none') === stroke;
            return (
              <button key={stroke} type="button" className={active ? 'is-active' : undefined} aria-pressed={active}
                onClick={() => onChange(stroke === 'none' ? undefined : { ...border, width: border.width || 1, style: stroke })}>
                {label}
              </button>
            );
          })}
        </div>
        {visible && (
          <>
            <div className="e2-design-row e2-border-settings__values">
              <label className="e2-color-chip">
                <input type="color" aria-label="Color de borde" value={border.color}
                  onChange={(event) => onChange({ ...border, color: event.target.value })} />
                <span>Color</span>
              </label>
              <label className="e2-design-slider">
                <span>Grosor · {border.width} px</span>
                <input type="range" aria-label="Grosor del borde" min={1} max={16} step={1} value={border.width}
                  onChange={(event) => onChange({ ...border, width: Number(event.target.value) })} />
              </label>
            </div>
            <div className="e2-design-row e2-design-row--stack">
              <span className="e2-design-label">Posición</span>
              <div className="e2-angle-chips" role="group" aria-label="Lados del borde">
                {sides.map(([side, label]) => {
                  const active = (border.sides ?? 'all') === side;
                  return (
                    <button key={side} type="button" className={`e2-chip-btn${active ? ' is-active' : ''}`}
                      aria-pressed={active} onClick={() => onChange({ ...border, sides: side })}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
