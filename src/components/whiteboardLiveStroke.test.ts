import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiveStrokePainter } from './whiteboardLiveStroke';
import type { BoardMark } from './viewerWhiteboardGeometry';

class TestPath {
  commands: number[][];
  constructor(previous?: TestPath) { this.commands = previous ? previous.commands.map(command => [...command]) : []; }
  moveTo(...p: number[]) { this.commands.push([0, ...p]); }
  quadraticCurveTo(...p: number[]) { this.commands.push([1, ...p]); }
  lineTo(...p: number[]) { this.commands.push([2, ...p]); }
}
afterEach(() => { vi.unstubAllGlobals(); });
describe('Tinta provisional en Canvas', () => {
  it('conserva curva, punta, recorte y transparencia sin acumular segmentos de fotogramas anteriores', () => {
    vi.stubGlobal('Path2D', TestPath);
    const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(), globalAlpha: 1, lineWidth: 0 };
    const mark: BoardMark = { id: 1, tool: 'highlight', points: [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }, { x: 0.4, y: 0.4 }], width: 0.02, color: '#facc15', opacity: 0.3 };
    const paint = createLiveStrokePainter();
    const run = () => paint(ctx as unknown as CanvasRenderingContext2D, mark, 800, 600, [0, 2, -2, 0, 1000, 200], 2, { width: 2400, height: 2400 } as HTMLCanvasElement);
    run();
    const expected = [[0, 80, 120], [1, 160, 180, 240.00000000000003, 210], [2, 320, 240]];
    expect((ctx.stroke.mock.calls[0][0] as TestPath).commands).toEqual(expected);
    run();
    expect((ctx.stroke.mock.calls[1][0] as TestPath).commands).toEqual(expected);
    expect(ctx.globalAlpha).toBe(0.3);
    expect(ctx.lineWidth).toBe(16);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.setTransform).toHaveBeenCalledWith(0, 4, -4, 0, 2000, 400);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(mark.points).toHaveLength(3);
  });

  it('limpia solo la huella de tinta y vuelve a limpiar toda la capa si cambia la proyección', () => {
    vi.stubGlobal('Path2D', TestPath);
    const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn() };
    const mark: BoardMark = { id: 1, tool: 'pen', points: [{ x: 0.1, y: 0.2 }], width: 0.01, color: '#000', opacity: 1 };
    const paint = createLiveStrokePainter();
    const canvas = { width: 2400, height: 1600 } as HTMLCanvasElement;
    const run = (matrix = [1, 0, 0, 1, 0, 0]) => paint(ctx as unknown as CanvasRenderingContext2D, mark, 1200, 800, matrix, 2, canvas);
    run();
    mark.points.push({ x: 0.11, y: 0.21 }); run();
    const region = ctx.clearRect.mock.calls[1];
    expect(region).toEqual([226, 306, 52, 44]);
    expect(region[2] * region[3]).toBeLessThan(canvas.width * canvas.height / 100);
    // La huella incluye la cola recta anterior para no dejar restos al curvarla.
    mark.points.push({ x: 0.12, y: 0.19 }); run();
    expect(ctx.clearRect.mock.calls[2]).toEqual([226, 290, 76, 60]);
    run([0, 1, -1, 0, 1200, 0]);
    expect(ctx.clearRect.mock.calls[3]).toEqual([0, 0, 2400, 1600]);
    mark.points = [{ x: 0.3, y: 0.3 }]; run();
    expect(ctx.clearRect.mock.calls[4]).toEqual([0, 0, 2400, 1600]);
  });
});
