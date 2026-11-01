import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageViewerModal from './ImageViewerModal';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../services/supabase', () => ({ supabase: {} }));

let frames: Map<number, FrameRequestCallback>;
let now: number;
beforeEach(() => {
  frames = new Map(); now = 0;
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 1; b = 0; c = 0; d = 1; });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function frame(time: number) {
  now = time;
  act(() => {
    const callbacks = [...frames]; frames.clear();
    callbacks.forEach(([, callback]) => callback(time));
  });
}
function viewer() {
  const result = render(<ImageViewerModal src="https://isolated.atlas-tests.invalid/placa.webp" onClose={() => {}} hasInteractiveMapHint={false} />);
  const image = screen.getByRole('img', { name: 'Vista ampliada' });
  Object.defineProperties(image, { naturalWidth: { value: 4800 }, naturalHeight: { value: 3200 }, clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  fireEvent.load(image);
  const layer = image.parentElement!, surface = layer.parentElement!;
  Object.defineProperties(surface, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  return { ...result, layer, surface };
}

describe('Respuesta del visor público', () => {
  it('acumula el zoom de rueda y confirma el último arrastre aunque termine antes del fotograma', () => {
    const { layer, surface } = viewer();
    for (let i = 0; i < 4; i++) fireEvent.wheel(surface, { deltaY: -100, clientX: 400, clientY: 300 });
    frame(16);
    expect(Number(layer.style.transform.match(/scale\(([^)]+)/)![1])).toBeCloseTo(1.6);
    fireEvent.mouseDown(surface, { button: 0, clientX: 300, clientY: 300 });
    fireEvent.mouseMove(surface, { buttons: 1, clientX: 400, clientY: 320 });
    fireEvent.mouseMove(surface, { buttons: 1, clientX: 450, clientY: 340 });
    fireEvent.mouseUp(surface);
    expect(layer.style.transform).toContain('translate3d(150px, 40px, 0)');
    frame(32);
    expect(layer.style.transform).toContain('translate3d(150px, 40px, 0)');
    const minimap = screen.getByRole('region', { name: 'Minimapa de navegación interactivo' });
    minimap.getBoundingClientRect = () => ({ left: 0, top: 0, width: 136, height: 90 } as DOMRect);
    fireEvent.mouseDown(minimap, { clientX: 68, clientY: 45 });
    fireEvent.mouseMove(window, { clientX: 102, clientY: 45 });
    fireEvent.mouseUp(window);
    expect(Number(layer.style.transform.match(/translate3d\(([^p]+)/)![1])).toBeCloseTo(-240);
  });

  it('descarta el zoom pendiente al cambiar de placa', () => {
    const { layer, surface, rerender } = viewer();
    fireEvent.wheel(surface, { deltaY: -100, clientX: 400, clientY: 300 });
    rerender(<ImageViewerModal src="https://isolated.atlas-tests.invalid/otra.webp" onClose={() => {}} hasInteractiveMapHint={false} />);
    frame(16);
    expect(layer.style.transform).toContain('scale(1)');
    expect(layer.style.transform).toContain('translate3d(0px, 0px, 0)');
  });

  it('sitúa la punta del láser en el cursor y deja de repintar cuando termina la estela', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), scale: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), createRadialGradient: () => ({ addColorStop: vi.fn() }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const { container } = viewer();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pizarra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Puntero láser' }));
    const canvas = container.ownerDocument.querySelector('canvas')!;
    frame(0);
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 200 });
    frame(16);
    fireEvent.mouseMove(canvas, { clientX: 101.5, clientY: 201.5 });
    frame(32);
    expect(ctx.arc.mock.calls.some(([x, y]) => x === 101.5 && y === 201.5)).toBe(true);
    frame(1900);
    const clears = ctx.clearRect.mock.calls.length;
    frame(1920);
    expect(ctx.clearRect).toHaveBeenCalledTimes(clears);
    fireEvent.mouseLeave(canvas);
    frame(1940);
    expect(ctx.clearRect).toHaveBeenCalledTimes(clears + 1);
    fireEvent.mouseEnter(canvas, { clientX: 300, clientY: 350 });
    frame(1960);
    expect(ctx.clearRect).toHaveBeenCalledTimes(clears + 2);
  });
});
