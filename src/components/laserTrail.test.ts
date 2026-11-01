import { describe, expect, it } from 'vitest';
import { appendLaserPoint, LASER_TRAIL_LIFETIME, prepareLaserStroke, splitLaserTrail } from './laserTrail';

describe('Continuidad y desvanecimiento del láser', () => {
  it('prepara una curva con los mismos extremos, tiempos y normales para las cuatro capas de luz', () => {
    const raw = [{ x: 0, y: 0, time: 0 }, { x: 10, y: 10, time: 10 }, { x: 20, y: 0, time: 20 }];
    const prepared = prepareLaserStroke(raw);
    expect(prepared.points).toHaveLength(11);
    expect(prepared.points[0]).toEqual(raw[0]);
    expect(prepared.points[10]).toEqual(raw[2]);
    expect(prepared.points[1].x).toBeCloseTo(1.36);
    expect(prepared.points[1].y).toBeCloseTo(1.68);
    expect(prepared.points[1].time).toBe(2);
    expect(prepared.normals).toHaveLength(prepared.points.length);
    expect(prepared.normals.every(n => Math.abs(Math.hypot(n.nx, n.ny) - 1) < 0.00001)).toBe(true);
    expect(raw).toHaveLength(3);
    expect(prepareLaserStroke([{ x: 1, y: 1, time: 0 }]).normals).toEqual([{ nx: 0, ny: 1 }]);
  });
  it('conserva el rastro al recorrer cientos de píxeles en un solo evento', () => {
    const first = appendLaserPoint([], null, { x: 50, y: 80 }, 0);
    const fast = appendLaserPoint(first.trail, first.position, { x: 1150, y: 80 }, 16);
    expect(fast.trail[0]).toEqual(first.trail[0]);
    expect(splitLaserTrail(fast.trail)).toHaveLength(1);
    expect(fast.trail.length).toBeGreaterThan(2);
    expect(fast.position.x).toBe(1150);
  });
  it('separa pausas y reentradas sin borrar la estela anterior ni crear líneas entre ellas', () => {
    const first = appendLaserPoint([], null, { x: 50, y: 80 }, 0);
    const fast = appendLaserPoint(first.trail, first.position, { x: 350, y: 80 }, 16);
    const pause = appendLaserPoint(fast.trail, fast.position, { x: 700, y: 400 }, 400);
    expect(splitLaserTrail(pause.trail)).toHaveLength(2);
    expect(pause.trail[0]).toEqual(first.trail[0]);
    const reentry = appendLaserPoint(pause.trail, null, { x: 100, y: 500 }, 450, true);
    expect(splitLaserTrail(reentry.trail)).toHaveLength(3);
  });
  it('descarta puntos por antigüedad y mantiene densidad acotada sin perder los extremos', () => {
    let result = appendLaserPoint([], null, { x: 0, y: 80 }, 0);
    for (let i = 1; i <= 200; i++) result = appendLaserPoint(result.trail, result.position, { x: i % 2 ? 1400 : 0, y: 80 }, i * 4);
    expect(result.trail.length).toBeLessThanOrEqual(512);
    expect(result.trail[0].time).toBe(0);
    expect(result.trail[result.trail.length - 1].time).toBe(800);
    const expired = appendLaserPoint(result.trail, null, { x: 30, y: 40 }, 800 + LASER_TRAIL_LIFETIME, true);
    expect(expired.trail).toHaveLength(1);
  });
});
