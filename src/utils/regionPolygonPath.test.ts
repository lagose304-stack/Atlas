import { expect, it } from 'vitest';
import { regionPolygonPath, smoothRegionPoints } from './regionPolygonPath';
it('conserva exactamente la ruta antigua sin suavizado', () => {
  expect(regionPolygonPath([0, 0, 1, 0, 1, 1], null, 100, 100)).toBe('M 0 0 L 100 0 L 100 100 Z');
});
it('limita la corrección de temblores y no modifica los puntos originales', () => {
  const points = [0.1, 0.1, 0.3, 0.102, 0.5, 0.098, 0.8, 0.1, 0.8, 0.8, 0.1, 0.8];
  const original = [...points];
  const result = smoothRegionPoints(points, 1600, 1000);
  for (let i = 0; i < points.length; i += 2) expect(Math.hypot((result[i] - points[i]) * 1600, (result[i + 1] - points[i + 1]) * 1000)).toBeLessThanOrEqual(1.000001);
  expect(points).toEqual(original);
  const first = regionPolygonPath(points, null, 1600, 1000, true);
  expect(first).toContain(' Q ');
  expect(regionPolygonPath(points, null, 1600, 1000, true)).toBe(first);
});
it('mantiene cerrados y separados contorno y huecos incluso con puntos repetidos', () => {
  const path = regionPolygonPath([0,0, 1,0, 1,1, 0,1, 0,0], [[0.2,0.2, 0.4,0.2, 0.3,0.4]], 1000, 800, true);
  expect(path.match(/M /g)).toHaveLength(2);
  expect(path.match(/ Z/g)).toHaveLength(2);
  expect(path).not.toMatch(/NaN|Infinity/);
});
