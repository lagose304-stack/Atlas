import { expect, it } from 'vitest';
import { validRegionExclusion } from './regionExclusion';
const outer = [0,0, 1,0, 1,1, 0,1];
const hole = [0.2,0.2, 0.4,0.2, 0.4,0.4, 0.2,0.4];
it('acepta un hueco interior incluso con cierre explícito', () => {
  expect(validRegionExclusion(outer, [], hole)).toBe(true);
  expect(validRegionExclusion(outer, [], [...hole, 0.2, 0.2])).toBe(true);
});
it('rechaza exclusiones fuera, cruzadas, sobrepuestas o que engloban huecos existentes', () => {
  expect(validRegionExclusion(outer, [], [-0.1,0.2, 0.4,0.2, 0.3,0.4])).toBe(false);
  expect(validRegionExclusion(outer, [], [0.1,0.1, 0.8,0.8, 0.1,0.8, 0.8,0.1])).toBe(false);
  expect(validRegionExclusion(outer, [hole], [0.3,0.3, 0.6,0.3, 0.6,0.6, 0.3,0.6])).toBe(false);
  expect(validRegionExclusion(outer, [hole], [0.1,0.1, 0.8,0.1, 0.8,0.8, 0.1,0.8])).toBe(false);
});
it('rechaza segmentos que atraviesan la concavidad aunque los vértices estén dentro', () => {
  const concave = [0,0, 1,0, 1,1, 0.6,1, 0.6,0.3, 0.4,0.3, 0.4,1, 0,1];
  expect(validRegionExclusion(concave, [], [0.2,0.6, 0.8,0.6, 0.8,0.8, 0.2,0.8])).toBe(false);
});
