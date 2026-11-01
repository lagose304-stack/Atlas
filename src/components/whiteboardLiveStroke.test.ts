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
    const run = () => paint(ctx as unknown as CanvasRenderingContext2D, mark, 800, 600, [0, 2, -2, 0, 100, 200], 2, { width: 1600, height: 1200 } as HTMLCanvasElement);
    run();
    const expected = [[0, 80, 120], [1, 160, 180, 240.00000000000003, 210], [2, 320, 240]];
    expect((ctx.stroke.mock.calls[0][0] as TestPath).commands).toEqual(expected);
    run();
    expect((ctx.stroke.mock.calls[1][0] as TestPath).commands).toEqual(expected);
    expect(ctx.globalAlpha).toBe(0.3);
    expect(ctx.lineWidth).toBe(16);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.setTransform).toHaveBeenCalledWith(0, 4, -4, 0, 200, 400);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
    expect(mark.points).toHaveLength(3);
  });
});
