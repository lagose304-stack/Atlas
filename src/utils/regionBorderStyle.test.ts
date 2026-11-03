import { expect, it } from 'vitest';
import { regionBorderStyle, regionStrokeMetrics } from './regionBorderStyle';
it('mantiene el aspecto público anterior sin propiedades nuevas', () => {
  expect(regionBorderStyle({})).toEqual({ width: 2.5, dash: 10, gap: 7 });
});
it('compensa grosor, longitud y hueco con la misma escala de pantalla', () => {
  const border = { regionStrokeWidth: 4, regionDashLength: 10, regionDashGap: 7 };
  for (const zoom of [0.5, 1, 2, 5]) {
    const metrics = regionStrokeMetrics(border, zoom);
    expect(metrics.width * zoom).toBe(4);
    expect(metrics.dash * zoom).toBe(10);
    expect((metrics.gap - metrics.width) * zoom).toBeCloseTo(7);
  }
});
it('acota valores guardados inválidos para no romper el SVG', () => {
  expect(regionBorderStyle({ regionStrokeWidth: NaN, regionDashLength: -5, regionDashGap: Infinity })).toEqual({ width: 2.5, dash: 1, gap: 7 });
});
