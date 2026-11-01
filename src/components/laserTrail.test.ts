import { describe, expect, it } from 'vitest';
import { appendLaserPoint, LASER_TRAIL_LIFETIME, splitLaserTrail } from './laserTrail';

describe('Continuidad y desvanecimiento del láser', () => {
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
