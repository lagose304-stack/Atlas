type Border = { regionStrokeWidth?: number | null; regionDashLength?: number | null; regionDashGap?: number | null };
export const REGION_BORDER_PRESETS = {
  width: [{ label: 'Muy delgado', value: 1 }, { label: 'Delgado', value: 1.75 }, { label: 'Medio', value: 2.5 }, { label: 'Grueso', value: 4 }],
  gap: [{ label: 'Corta', value: 3 }, { label: 'Media', value: 7 }, { label: 'Larga', value: 12 }],
  dash: [{ label: 'Corto', value: 4 }, { label: 'Medio', value: 10 }, { label: 'Largo', value: 16 }],
};
const bounded = (value: number | null | undefined, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function regionBorderStyle(border: Border) {
  return {
    width: bounded(border.regionStrokeWidth, 2.5, 0.5, 8),
    dash: bounded(border.regionDashLength, 10, 1, 32),
    gap: bounded(border.regionDashGap, 7, 1, 24),
  };
}

/** Unidades de la imagen necesarias para obtener medidas constantes en pantalla. */
export function regionStrokeMetrics(border: Border, zoom: number) {
  const style = regionBorderStyle(border);
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { width: style.width / scale, dash: style.dash / scale, gap: (style.gap + style.width) / scale };
}
