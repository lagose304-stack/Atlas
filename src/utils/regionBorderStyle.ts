type Border = { regionStrokeWidth?: number | null; regionDashLength?: number | null; regionDashGap?: number | null };
const bounded = (value: number | null | undefined, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function regionBorderStyle(border: Border) {
  return {
    width: bounded(border.regionStrokeWidth, 2.5, 0.5, 8),
    dash: bounded(border.regionDashLength, 10, 1, 32),
    gap: bounded(border.regionDashGap, 7, 1, 24),
  };
}
