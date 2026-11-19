import React from 'react';
import { Plus, X } from 'lucide-react';
import type { GradientStyle } from '../domain/styleSchema';

export const ATLAS_GRADIENT_PRESETS: Array<{ label: string; gradient: GradientStyle }> = [
  {
    label: 'Cielo clínico',
    gradient: { kind: 'linear', angle: 135, stops: ['#f0f9ff', '#e0f2fe'] },
  },
  {
    label: 'Tinción H&E suave',
    gradient: { kind: 'linear', angle: 135, stops: ['#fdf4ff', '#fce7f3'] },
  },
  {
    label: 'Menta laboratorio',
    gradient: { kind: 'linear', angle: 135, stops: ['#ecfdf5', '#e0f2fe'] },
  },
  {
    label: 'Papel cálido',
    gradient: { kind: 'linear', angle: 180, stops: ['#ffffff', '#f8fafc'] },
  },
  {
    label: 'Azul profundo',
    gradient: { kind: 'linear', angle: 135, stops: ['#0b2545', '#0369a1'] },
  },
];

const ANGLE_PRESETS = [0, 45, 90, 135, 180] as const;

export type GradientPickerProps = {
  value: GradientStyle;
  onChange: (next: GradientStyle) => void;
};

const GradientPicker: React.FC<GradientPickerProps> = ({ value, onChange }) => {
  const stops = value.stops.length >= 2 ? value.stops : ['#f0f9ff', '#e0f2fe'];
  const previewCss =
    value.kind === 'radial'
      ? `radial-gradient(circle, ${stops.join(', ')})`
      : `linear-gradient(${value.angle}deg, ${stops.join(', ')})`;

  const updateStop = (index: number, color: string) => {
    const nextStops = stops.map((s, i) => (i === index ? color : s));
    onChange({ ...value, stops: nextStops });
  };

  const addThirdStop = () => {
    if (stops.length >= 3) return;
    onChange({ ...value, stops: [...stops, '#bae6fd'] });
  };

  const removeThirdStop = () => {
    if (stops.length <= 2) return;
    onChange({ ...value, stops: stops.slice(0, 2) });
  };

  return (
    <div className="e2-gradient-picker">
      <div className="e2-gradient-picker__preview" style={{ backgroundImage: previewCss }} aria-hidden="true" />

      <div className="e2-gradient-picker__presets" role="group" aria-label="Degradados rápidos">
        {ATLAS_GRADIENT_PRESETS.map((preset) => {
          const bg =
            preset.gradient.kind === 'radial'
              ? `radial-gradient(circle, ${preset.gradient.stops.join(', ')})`
              : `linear-gradient(${preset.gradient.angle}deg, ${preset.gradient.stops.join(', ')})`;
          return (
            <button
              key={preset.label}
              type="button"
              className="e2-gradient-swatch"
              style={{ backgroundImage: bg }}
              title={preset.label}
              aria-label={`Aplicar degradado ${preset.label}`}
              onClick={() => onChange({ ...preset.gradient, stops: [...preset.gradient.stops] })}
            />
          );
        })}
      </div>

      <div className="e2-design-row">
        <span className="e2-design-label">Tipo</span>
        <div className="e2-segmented" role="group" aria-label="Tipo de degradado">
          <button
            type="button"
            className={value.kind === 'linear' ? 'is-active' : undefined}
            aria-pressed={value.kind === 'linear'}
            onClick={() => onChange({ ...value, kind: 'linear' })}
          >
            Lineal
          </button>
          <button
            type="button"
            className={value.kind === 'radial' ? 'is-active' : undefined}
            aria-pressed={value.kind === 'radial'}
            onClick={() => onChange({ ...value, kind: 'radial' })}
          >
            Radial
          </button>
        </div>
      </div>

      {value.kind === 'linear' && (
        <div className="e2-design-row e2-design-row--stack">
          <div className="e2-design-row__head">
            <label htmlFor="e2-grad-angle" className="e2-design-label">
              Ángulo
            </label>
            <span className="e2-design-value">{value.angle}°</span>
          </div>
          <input
            id="e2-grad-angle"
            type="range"
            min={0}
            max={360}
            step={5}
            value={value.angle}
            onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
          />
          <div className="e2-angle-chips">
            {ANGLE_PRESETS.map((angle) => (
              <button
                key={angle}
                type="button"
                className={`e2-chip-btn${value.angle === angle ? ' is-active' : ''}`}
                onClick={() => onChange({ ...value, angle })}
              >
                {angle}°
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="e2-design-row e2-design-row--stack">
        <div className="e2-design-row__head">
          <span className="e2-design-label">Colores</span>
          {stops.length < 3 ? (
            <button type="button" className="e2-chip-btn" onClick={addThirdStop}>
              <Plus size={11} aria-hidden="true" />
              <span>3.er color</span>
            </button>
          ) : (
            <button type="button" className="e2-chip-btn" onClick={removeThirdStop}>
              <X size={11} aria-hidden="true" />
              <span>Quitar 3.º</span>
            </button>
          )}
        </div>
        <div className="e2-gradient-stops">
          {stops.map((stop, idx) => (
            <label key={idx} className="e2-color-chip">
              <input
                type="color"
                aria-label={`Color ${idx + 1} del degradado`}
                value={stop}
                onChange={(e) => updateStop(idx, e.target.value)}
              />
              <span className="e2-mono">{stop.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GradientPicker;
