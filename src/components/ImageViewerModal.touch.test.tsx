import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageViewerModal from './ImageViewerModal';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../services/supabase', () => ({ supabase: {} }));
beforeEach(() => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 1; b = 0; c = 0; d = 1; });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { vi.unstubAllGlobals(); });
const touch = (identifier: number, clientX: number, clientY = 300) => ({ identifier, clientX, clientY });
function viewer() {
  render(<ImageViewerModal src="https://isolated.atlas-tests.invalid/placa.webp" onClose={() => {}} hasInteractiveMapHint={false} />);
  const image = screen.getByRole('img', { name: 'Vista ampliada' });
  Object.defineProperties(image, { naturalWidth: { value: 4800 }, naturalHeight: { value: 3200 }, clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  fireEvent.load(image);
  const layer = image.parentElement!;
  const surface = layer.parentElement!;
  Object.defineProperties(surface, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} });
  return { surface, layer };
}

describe('Pellizco del visor público', () => {
  it('confirma el último fotograma y no arrastra ni interpreta un tap con el dedo restante', () => {
    const { surface, layer } = viewer();
    fireEvent.touchStart(surface, { touches: [touch(1, 300)] });
    fireEvent.touchStart(surface, { touches: [touch(1, 300), touch(2, 500)] });
    fireEvent.touchMove(surface, { touches: [touch(1, 200), touch(2, 600)] });
    fireEvent.touchEnd(surface, { touches: [touch(1, 200)], changedTouches: [touch(2, 600)] });
    expect(layer.style.transform).toContain('scale(2)');
    const transform = layer.style.transform;
    fireEvent.touchMove(surface, { touches: [touch(1, 280, 340)] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(1, 280, 340)] });
    expect(layer.style.transform).toBe(transform);
  });

  it('cancela el gesto sin perder el último zoom y permite empezar otro desde esa vista', () => {
    const { surface, layer } = viewer();
    fireEvent.touchStart(surface, { touches: [touch(1, 300), touch(2, 500)] });
    fireEvent.touchMove(surface, { touches: [touch(1, 200), touch(2, 600)] });
    fireEvent.touchCancel(surface, { touches: [] });
    expect(layer.style.transform).toContain('scale(2)');
    fireEvent.touchStart(surface, { touches: [touch(3, 200), touch(4, 600)] });
    fireEvent.touchMove(surface, { touches: [touch(3, 300), touch(4, 500)] });
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(3, 300), touch(4, 500)] });
    expect(layer.style.transform).toContain('scale(1)');
    expect(layer.style.transform).toContain('translate3d(0px, 0px, 0)');
  });
});
