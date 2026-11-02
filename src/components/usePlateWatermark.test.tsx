import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePlateWatermark, watermarkPlacement } from './usePlateWatermark';
import { DIRECT_VIEW_TRANSFORM_EVENT } from './viewerTouchNavigation';
afterEach(() => { vi.unstubAllGlobals(); });
it('coloca la marca dentro de la imagen y no en el margen negro', () => {
  expect(watermarkPlacement({ left: 150, top: 100, right: 650, bottom: 450 }, { width: 800, height: 600 }, { width: 240, height: 50 })).toEqual({ left: 164, top: 386, scale: 1 });
});
it('mantiene la esquina visible al ampliar o desplazar y reduce la marca si no cabe', () => {
  expect(watermarkPlacement({ left: -500, top: -300, right: 1300, bottom: 900 }, { width: 800, height: 600 }, { width: 240, height: 50 })).toEqual({ left: 14, top: 536, scale: 1 });
  const next = watermarkPlacement({ left: 600, top: 500, right: 900, bottom: 700 }, { width: 800, height: 600 }, { width: 240, height: 50 })!;
  expect(next.left).toBeGreaterThan(600);
  expect(next.left + 240 * next.scale).toBeLessThan(800);
  expect(next.top + 50 * next.scale).toBeLessThan(600);
  expect(next.scale).toBeLessThan(1);
  expect(watermarkPlacement({ left: 900, top: 0, right: 1000, bottom: 600 }, { width: 800, height: 600 }, { width: 240, height: 50 })).toBeNull();
});
it('sigue el zoom táctil directo sin medir el DOM de nuevo', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const frame = document.createElement('div'), layer = document.createElement('div');
  frame.appendChild(layer); document.body.appendChild(frame);
  Object.defineProperties(frame, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  Object.defineProperties(layer, { clientWidth: { value: 500 }, clientHeight: { value: 350 } });
  frame.getBoundingClientRect = () => ({ left: 0, top: 0 } as DOMRect);
  const bounds = vi.fn(() => ({ left: 150, top: 125, right: 650, bottom: 475 } as DOMRect));
  layer.getBoundingClientRect = bounds;
  function Harness() { const ref = usePlateWatermark(layer, true, 'initial'); return <div ref={ref} data-testid="mark" />; }
  vi.stubGlobal('ResizeObserver', class { observe(element: HTMLElement) { if (element.dataset.testid === 'mark') { Object.defineProperties(element, { offsetWidth: { value: 240 }, offsetHeight: { value: 50 } }); } } disconnect() {} });
  const { getByTestId, unmount } = render(<Harness />);
  // La marca se mide al preparar el layout (simulado por resize).
  act(() => { window.dispatchEvent(new Event('resize')); });
  bounds.mockClear();
  act(() => { layer.dispatchEvent(new CustomEvent(DIRECT_VIEW_TRANSFORM_EVENT, { detail: { zoom: 2, pos: { x: 0, y: 0 }, rotation: 0 } })); });
  expect(getByTestId('mark').style.left).toBe('14px');
  expect(getByTestId('mark').style.top).toBe('536px');
  expect(bounds).not.toHaveBeenCalled();
  unmount(); frame.remove();
});
