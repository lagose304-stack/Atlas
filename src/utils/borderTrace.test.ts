import { expect, it } from 'vitest';
import { borderTraceHasArea, closeBorderTrace, joinBorderTrace } from './borderTrace';
it('engancha al tramo final y elimina el solapamiento, sin modificar sus entradas', () => {
  const base = [0.1,0.2, 0.15,0.2, 0.2,0.2];
  const stroke = [0.19,0.205, 0.21,0.21, 0.25,0.25];
  const result = joinBorderTrace(base,stroke,1000,800)!;
  expect(result.slice(0,4)).toEqual(base.slice(0,4));
  expect(result[4]).toBeCloseTo(0.19);
  expect(result[5]).toBeCloseTo(0.2);
  expect(result.slice(-2)).toEqual(stroke.slice(-2));
  expect(base).toEqual([0.1,0.2, 0.15,0.2, 0.2,0.2]);
});
it('la tolerancia se mide en pantalla y no engancha a partes antiguas de un trazo largo', () => {
  const base=[0,0.2, 0.9,0.2];
  expect(joinBorderTrace(base,[0.9,0.22,0.92,0.24],1000,1000)).not.toBeNull();
  expect(joinBorderTrace(base,[0.9,0.22,0.92,0.24],2000,2000)).toBeNull();
  expect(joinBorderTrace(base,[0.2,0.2,0.3,0.3],1000,1000)).toBeNull();
});
it('ajusta un cierre cercano sin desplazar el comienzo ni los puntos lejanos', () => {
  const points=[0.1,0.1, 0.5,0.1, 0.5,0.5, 0.1,0.5, 0.105,0.11];
  const result=closeBorderTrace(points,1000,1000);
  expect(result.slice(0,8)).toEqual(points.slice(0,8));
  expect(result.slice(-2)).toEqual([0.1,0.1]);
  expect(borderTraceHasArea(result)).toBe(true);
  expect(borderTraceHasArea([0,0,0.1,0.1,0.2,0.2])).toBe(false);
});
