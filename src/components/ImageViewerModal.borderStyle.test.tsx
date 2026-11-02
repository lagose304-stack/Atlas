import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ImageViewerModal from './ImageViewerModal';
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../services/supabase', () => ({ supabase: {} }));
afterEach(() => { vi.unstubAllGlobals(); });
it('renderiza el estilo persistido y conserva el estilo público antiguo sin valores', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const points = [0.1, 0.1, 0.8, 0.1, 0.4, 0.8];
  const { container } = render(<ImageViewerModal src="https://isolated.atlas-tests.invalid/placa.webp" onClose={() => {}} hasInteractiveMapHint={false} initialActiveMarkerIndex={0}
    senalados={['Personalizado', 'Antiguo']} senaladosMeta={[
      { label: 'Personalizado', x: 0.4, y: 0.4, regionPoints: points, regionStrokeWidth: 5, regionDashLength: 3, regionDashGap: 9, regionSmooth: true },
      { label: 'Antiguo', x: 0.4, y: 0.4, regionPoints: points },
    ]} />);
  const image = screen.getByAltText('Vista ampliada');
  Object.defineProperties(image, { naturalWidth: { value: 1000 }, naturalHeight: { value: 800 } });
  fireEvent.load(image);
  const paths = document.querySelectorAll('path[fill-rule="evenodd"]');
  expect([...paths].some(path => path.getAttribute('stroke-width') === '5' && path.getAttribute('stroke-dasharray') === '3 9')).toBe(true);
  expect([...paths].some(path => path.getAttribute('d')?.includes(' Q '))).toBe(true);
  const cleanDashes = document.querySelector('[data-region-clean-dashes]');
  expect(cleanDashes).toHaveAttribute('stroke-linecap', 'round');
  expect(cleanDashes?.getAttribute('d')).toContain(' L ');
  expect(cleanDashes?.getAttribute('d')).not.toContain(' Q ');
  fireEvent.click(screen.getByText('Antiguo'));
  expect([...document.querySelectorAll('path[fill-rule="evenodd"]')].some(path => path.getAttribute('stroke-width') === '2.5' && path.getAttribute('stroke-dasharray') === '10 7')).toBe(true);
  expect(container).toBeInTheDocument();
});
