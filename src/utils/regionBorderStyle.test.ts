import { expect, it } from 'vitest';
import { regionBorderStyle } from './regionBorderStyle';
it('mantiene el aspecto público anterior sin propiedades nuevas', () => {
  expect(regionBorderStyle({})).toEqual({ width: 2.5, dash: 10, gap: 7 });
});
it('acota valores guardados inválidos para no romper el SVG', () => {
  expect(regionBorderStyle({ regionStrokeWidth: NaN, regionDashLength: -5, regionDashGap: Infinity })).toEqual({ width: 2.5, dash: 1, gap: 7 });
});
