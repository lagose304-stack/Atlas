import React from 'react';
import { Check, Palette, RotateCcw, X } from 'lucide-react';
import {
  ATLAS_PAGE_THEMES,
  THEME_FONTS,
  type PageTheme,
  type PageThemePalette,
} from '../domain/styleSchema';
import { useEditor2Store } from '../store/editor2Store';

export type ThemeDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const PALETTE_FIELDS: Array<{ key: keyof PageThemePalette; label: string }> = [
  { key: 'primary', label: 'Primario' },
  { key: 'accent', label: 'Acento' },
  { key: 'pageBg', label: 'Fondo del lienzo (edición)' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
  { key: 'border', label: 'Bordes' },
];

const RADIUS_OPTIONS: Array<{ value: PageTheme['radiusScale']; label: string }> = [
  { value: 'none', label: 'Recto' },
  { value: 'sm', label: 'Sutil' },
  { value: 'md', label: 'Medio' },
  { value: 'lg', label: 'Amplio' },
  { value: 'pill', label: 'Pastilla' },
];

const DENSITY_OPTIONS: Array<{ value: PageTheme['density']; label: string }> = [
  { value: 'compact', label: 'Compacta' },
  { value: 'comfortable', label: 'Cómoda' },
  { value: 'spacious', label: 'Amplia' },
];

const SCALE_OPTIONS: Array<{ value: PageTheme['typography']['scale']; label: string }> = [
  { value: 'compact', label: 'Compacta' },
  { value: 'balanced', label: 'Equilibrada' },
  { value: 'editorial', label: 'Editorial' },
];

const ThemeDrawer: React.FC<ThemeDrawerProps> = ({ open, onClose }) => {
  const currentTheme = useEditor2Store((state) => state.doc?.pageTheme);
  const setPageTheme = useEditor2Store((state) => state.setPageTheme);

  if (!open) return null;

  const activeTheme: PageTheme = currentTheme ?? ATLAS_PAGE_THEMES[0].theme;

  const updateTheme = (next: PageTheme) => {
    setPageTheme({ ...next, presetId: undefined });
  };

  const updatePalette = (key: keyof PageThemePalette, color: string) => {
    updateTheme({
      ...activeTheme,
      palette: { ...activeTheme.palette, [key]: color },
    });
  };

  return (
    <div
      className="e2-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Tema global de la página"
      onClick={onClose}
    >
      <aside className="e2-version-drawer e2-theme-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="e2-version-drawer__head">
          <div className="e2-version-drawer__title">
            <Palette size={16} aria-hidden="true" />
            <h2>Tema de la página</h2>
          </div>
          <button
            type="button"
            className="e2-icon-button"
            aria-label="Cerrar panel de tema"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="e2-theme-drawer__body">
          <p className="e2-theme-drawer__intro">
            Cambia la identidad visual de toda la página en 1 clic sin perder el contenido.
          </p>

          <div className="e2-theme-grid" role="group" aria-label="Temas predefinidos">
            {ATLAS_PAGE_THEMES.map((preset) => {
              const isSelected = currentTheme?.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`e2-theme-card${isSelected ? ' is-active' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setPageTheme({ ...preset.theme, palette: { ...preset.theme.palette }, typography: { ...preset.theme.typography } })}
                >
                  <div
                    className="e2-theme-card__preview"
                    style={{
                      backgroundColor: preset.theme.palette.pageBg,
                      borderColor: preset.theme.palette.border,
                    }}
                    aria-hidden="true"
                  >
                    <span className="e2-theme-dot" style={{ backgroundColor: preset.theme.palette.primary }} />
                    <span className="e2-theme-dot" style={{ backgroundColor: preset.theme.palette.accent }} />
                    <span className="e2-theme-dot" style={{ backgroundColor: preset.theme.palette.surface }} />
                    <span className="e2-theme-dot" style={{ backgroundColor: preset.theme.palette.text }} />
                  </div>
                  <div className="e2-theme-card__meta">
                    <strong>
                      {preset.name}
                      {isSelected && <Check size={13} aria-hidden="true" />}
                    </strong>
                    <span>{preset.description}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <details className="e2-design-section">
            <summary>Personalizar colores del tema</summary>
            <div className="e2-design-section__body">
              <div className="e2-quad-grid">
                {PALETTE_FIELDS.map((field) => (
                  <label key={field.key} className="e2-color-chip">
                    <input
                      type="color"
                      aria-label={`Color ${field.label}`}
                      value={activeTheme.palette[field.key]}
                      onChange={(e) => updatePalette(field.key, e.target.value)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>

          <details className="e2-design-section">
            <summary>Tipografía de página</summary>
            <div className="e2-design-section__body">
              <label className="e2-design-field">
                <span className="e2-design-label">Fuente de títulos</span>
                <select
                  aria-label="Fuente de títulos"
                  value={activeTheme.typography.headingFont}
                  onChange={(e) =>
                    updateTheme({
                      ...activeTheme,
                      typography: {
                        ...activeTheme.typography,
                        headingFont: e.target.value as PageTheme['typography']['headingFont'],
                      },
                    })
                  }
                >
                  {THEME_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>

              <label className="e2-design-field">
                <span className="e2-design-label">Fuente de cuerpo</span>
                <select
                  aria-label="Fuente de cuerpo"
                  value={activeTheme.typography.bodyFont}
                  onChange={(e) =>
                    updateTheme({
                      ...activeTheme,
                      typography: {
                        ...activeTheme.typography,
                        bodyFont: e.target.value as PageTheme['typography']['bodyFont'],
                      },
                    })
                  }
                >
                  {THEME_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>

              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Escala tipográfica</span>
                <div className="e2-segmented" role="group" aria-label="Escala tipográfica">
                  {SCALE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={activeTheme.typography.scale === opt.value ? 'is-active' : undefined}
                      aria-pressed={activeTheme.typography.scale === opt.value}
                      onClick={() =>
                        updateTheme({
                          ...activeTheme,
                          typography: { ...activeTheme.typography, scale: opt.value },
                        })
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <details className="e2-design-section">
            <summary>Forma y densidad</summary>
            <div className="e2-design-section__body">
              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Redondeado base</span>
                <div className="e2-angle-chips" role="group" aria-label="Redondeado base">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`e2-chip-btn${activeTheme.radiusScale === opt.value ? ' is-active' : ''}`}
                      onClick={() => updateTheme({ ...activeTheme, radiusScale: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="e2-design-row e2-design-row--stack">
                <span className="e2-design-label">Espaciado de página</span>
                <div className="e2-segmented" role="group" aria-label="Espaciado de página">
                  {DENSITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={activeTheme.density === opt.value ? 'is-active' : undefined}
                      aria-pressed={activeTheme.density === opt.value}
                      onClick={() => updateTheme({ ...activeTheme, density: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className="e2-design-panel__foot">
            <button
              type="button"
              className="e2-button e2-button--quiet"
              disabled={!currentTheme}
              onClick={() => setPageTheme(undefined)}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Quitar tema personalizado</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ThemeDrawer;
