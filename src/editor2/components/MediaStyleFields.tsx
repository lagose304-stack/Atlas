import type { MediaAppearance } from '../domain/styleSchema';

export default function MediaStyleFields({ media, onChange, allowOverlay = true }: {
  media?: MediaAppearance;
  onChange: (next: MediaAppearance | undefined) => void;
  allowOverlay?: boolean;
}) {
  const current: MediaAppearance = media ?? {};
  const patch = (partial: Partial<MediaAppearance>) => {
    const merged: MediaAppearance = { ...current, ...partial };
    for (const key of Object.keys(merged) as Array<keyof MediaAppearance>) {
      if (merged[key] === undefined || merged[key] === '') delete merged[key];
    }
    onChange(Object.keys(merged).length > 0 ? merged : undefined);
  };

  return (
    <>
      <div className="e2-quad-grid">
        <label className="e2-design-field">
          <span className="e2-design-label">Relación de aspecto</span>
          <select
            aria-label="Relación de aspecto"
            value={current.aspect ?? 'auto'}
            onChange={(e) =>
              patch({ aspect: e.target.value === 'auto' ? undefined : (e.target.value as MediaAppearance['aspect']) })
            }
          >
            <option value="auto">Automática</option>
            <option value="16/9">16:9 (Panorámica)</option>
            <option value="4/3">4:3 (Micrografía)</option>
            <option value="1/1">1:1 (Cuadrada)</option>
            <option value="3/4">3:4 (Vertical)</option>
          </select>
        </label>
        <label className="e2-design-field">
          <span className="e2-design-label">Punto focal</span>
          <select
            aria-label="Punto focal de la imagen"
            value={current.objectPosition ?? 'center'}
            onChange={(e) =>
              patch({
                objectPosition:
                  e.target.value === 'center' ? undefined : (e.target.value as MediaAppearance['objectPosition']),
              })
            }
          >
            <option value="center">Centro</option>
            <option value="top">Arriba</option>
            <option value="bottom">Abajo</option>
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      </div>

      <div className="e2-quad-grid">
        <label className="e2-design-field">
          <span className="e2-design-label">Filtro visual</span>
          <select
            aria-label="Filtro visual de la imagen"
            value={current.filter ?? 'none'}
            onChange={(e) =>
              patch({ filter: e.target.value === 'none' ? undefined : (e.target.value as MediaAppearance['filter']) })
            }
          >
            <option value="none">Original</option>
            <option value="vivid">Vívido</option>
            <option value="contrast">Alto contraste</option>
            <option value="warm">Cálido</option>
            <option value="grayscale">Escala de grises</option>
          </select>
        </label>
        <label className="e2-design-slider">
          <span>Redondeado: {current.radius ?? 0} px</span>
          <input
            type="range"
            aria-label="Redondeado de la imagen"
            min={0}
            max={40}
            step={2}
            value={current.radius ?? 0}
            onChange={(e) => patch({ radius: Number(e.target.value) })}
          />
        </label>
      </div>

      {allowOverlay && (
        <div className="e2-quad-grid">
          <label className="e2-design-field">
            <span className="e2-design-label">Etiqueta sobre la foto</span>
            <input
              type="text"
              maxLength={60}
              placeholder="Ej. H&E · 40×"
              value={current.overlayBadge ?? ''}
              onChange={(e) => patch({ overlayBadge: e.target.value.trim() ? e.target.value : undefined })}
            />
          </label>
          <label className="e2-design-field">
            <span className="e2-design-label">Esquina de etiqueta</span>
            <select
              aria-label="Esquina de la etiqueta"
              value={current.overlayPosition ?? 'tl'}
              onChange={(e) => patch({ overlayPosition: e.target.value as MediaAppearance['overlayPosition'] })}
            >
              <option value="tl">Superior izquierda</option>
              <option value="tr">Superior derecha</option>
              <option value="bl">Inferior izquierda</option>
              <option value="br">Inferior derecha</option>
            </select>
          </label>
        </div>
      )}
    </>
  );
}
