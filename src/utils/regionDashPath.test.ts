import { expect, it } from 'vitest';
import { regionDashPath } from './regionDashPath';
it('crea palitos rectos independientes aunque la muestra original tiemble', () => {
  const points = [0, 0, 0.002, 0.001, 0.004, -0.001, 0.006, 0.001, 0.1, 0, 0.1, 0.1];
  const original = [...points];
  const path = regionDashPath(points, null, 1000, 1000, 1, { regionDashLength: 10, regionDashGap: 4 });
  expect(path).toMatch(/^M [-\d.e]+ [-\d.e]+ L [-\d.e]+ [-\d.e]+/);
  expect(path).not.toMatch(/[QZC]/);
  for (const match of path.matchAll(/M (\S+) (\S+) L (\S+) (\S+)/g)) {
    expect(Math.hypot(Number(match[3]) - Number(match[1]), Number(match[4]) - Number(match[2]))).toBeLessThanOrEqual(10.000001);
  }
  expect(points).toEqual(original);
});
it('compensa los extremos redondos para conservar el espacio y adapta el paso al zoom', () => {
  const points = [0, 0, 1, 0, 1, 1];
  const style = { regionStrokeWidth: 4, regionDashLength: 8, regionDashGap: 6 };
  expect(regionDashPath(points, null, 100, 100, 1, style)).toContain('M 18 0 L 26 0');
  expect(regionDashPath(points, null, 100, 100, 2, style)).toContain('M 9 0 L 13 0');
});
