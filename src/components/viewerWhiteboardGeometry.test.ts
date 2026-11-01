import { describe, expect, it } from 'vitest';
import { constrainedEnd, createStrokePathBuilder, moveMark, strokePath, type BoardMark } from './viewerWhiteboardGeometry';

describe('Geometría de la pizarra', () => {
  it('la curva incremental conserva exactamente el trazo completo al crecer, redimensionar y empezar otro', () => {
    const build = createStrokePathBuilder();
    const points = [{ x: 0.1, y: 0.2 }];
    for (let i = 1; i < 100; i++) {
      points.push({ x: i / 100, y: Math.sin(i) / 4 + 0.5 });
      expect(build(points, 800, 600)).toBe(strokePath(points, 800, 600));
      expect(build(points, 800, 600)).toBe(strokePath(points, 800, 600));
    }
    expect(build(points, 400, 300)).toBe(strokePath(points, 400, 300));
    const shorter = points.slice(0, 3);
    expect(build(shorter, 400, 300)).toBe(strokePath(shorter, 400, 300));
    const moved = shorter.map(point => ({ x: point.x + 0.1, y: point.y + 0.1 }));
    expect(build(moved, 400, 300)).toBe(strokePath(moved, 400, 300));
    expect(build([], 400, 300)).toBe('');
    expect(build(moved, 400, 300)).toBe(strokePath(moved, 400, 300));
  });
  it('conserva círculos y cuadrados físicos en una placa rectangular y cerca del borde', () => {
    for (const tool of ['ellipse', 'rectangle'] as const) {
      const start = { x: 0.9, y: 0.7 };
      const end = constrainedEnd(start, { x: 1, y: 1 }, tool, 800, 400);
      expect((end.x - start.x) * 800).toBeCloseTo((end.y - start.y) * 400);
      expect(end.x).toBeLessThanOrEqual(1);
      expect(end.y).toBeLessThanOrEqual(1);
    }
  });
  it('alinea líneas a 45 grados sin deformarlas al limitar la imagen', () => {
    const end = constrainedEnd({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.8 }, 'arrow', 800, 400);
    expect((end.x - 0.2) * 800).toBeCloseTo((end.y - 0.2) * 400);
  });
  it('limita el movimiento de toda la figura y conserva la forma', () => {
    const mark: BoardMark = { id: 1, tool: 'line', points: [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.5 }], width: 0.01, color: '#fff', opacity: 1 };
    const moved = moveMark(mark, 1, -1, 800, 400);
    expect(moved.points[1].x).toBeLessThan(1);
    expect(moved.points[0].y).toBeGreaterThan(0);
    expect(moved.points[1].x - moved.points[0].x).toBeCloseTo(0.3);
  });
  it('suaviza un trazo conservando su inicio y su punta', () => {
    const path = strokePath([{ x: 0, y: 0 }, { x: 0.2, y: 0.7 }, { x: 0.4, y: 0.3 }], 800, 400);
    expect(path).toMatch(/^M0,0 Q/);
    expect(path).toMatch(/L320,120$/);
  });
});
