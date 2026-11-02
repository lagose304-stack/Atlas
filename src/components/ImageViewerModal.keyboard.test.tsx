import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageViewerModal from './ImageViewerModal';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../services/supabase', () => ({ supabase: {} }));

beforeEach(() => {
  vi.stubGlobal('DOMMatrixReadOnly', class { a = 1; b = 0; c = 0; d = 1; });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ImageViewerModal: no captura la escritura del editor superpuesto', () => {
  it('ofrece la pizarra a la izquierda y conserva los controles de visualización al abrirla', () => {
    const { rerender } = render(<ImageViewerModal placaId={1} src="https://pub-isolated.r2.dev/placa.webp" onClose={() => {}} hasInteractiveMapHint={false} />);
    // jsdom no calcula layout: la marca solo es visible cuando hay área de imagen.
    const image = screen.getByRole('img', { name: 'Vista ampliada' });
    const layer = image.parentElement!, frame = layer.parentElement!;
    for (const element of [layer, frame]) {
      Object.defineProperties(element, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
      element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect);
    }
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
    fireEvent.load(screen.getByRole('img', { name: 'Vista ampliada' }));
    expect(screen.getByText('Atlas Histolab')).toBeVisible();
    const rightToolbar = screen.getByRole('toolbar', { name: 'Controles de zoom y visualización' });
    expect(screen.queryByRole('toolbar', { name: 'Pizarra temporal' })).not.toBeInTheDocument();
    fireEvent.click(within(rightToolbar).getByRole('button', { name: 'Abrir pizarra' }));
    expect(screen.getByRole('toolbar', { name: 'Pizarra temporal' })).toBeVisible();
    expect(rightToolbar).not.toContainElement(screen.getByRole('button', { name: 'Lápiz' }));
    expect(screen.getByText('Atlas Histolab')).toBeVisible();
    expect(screen.getByRole('toolbar', { name: 'Controles de zoom y visualización' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lápiz' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Puntero láser' }));
    expect(screen.getByRole('button', { name: 'Puntero láser' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(rightToolbar).getByRole('button', { name: 'Cerrar pizarra' }));
    expect(screen.queryByRole('toolbar', { name: 'Pizarra temporal' })).not.toBeInTheDocument();
    fireEvent.click(within(rightToolbar).getByRole('button', { name: 'Abrir pizarra' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Abrir pizarra' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pizarra' }));
    rerender(<ImageViewerModal placaId={2} src="https://pub-isolated.r2.dev/otra.webp" onClose={() => {}} hasInteractiveMapHint={false} />);
    expect(screen.getByRole('button', { name: 'Abrir pizarra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deshacer apunte' })).not.toBeInTheDocument();
  });

  it('deja pasar espacio, copiar y Escape desde texto editable y permite el menú ortográfico', () => {
    const close = vi.fn();
    render(<ImageViewerModal src="https://pub-isolated.r2.dev/placa.webp" onClose={close} hasInteractiveMapHint={false} />);
    const field = document.createElement('div');
    field.setAttribute('contenteditable', 'true');
    const word = field.appendChild(document.createElement('strong'));
    word.textContent = 'Núcleo';
    screen.getByRole('button', { name: 'Cerrar visor' }).parentElement!.appendChild(field);
    expect(fireEvent.keyDown(word, { key: ' ', code: 'Space' })).toBe(true);
    expect(fireEvent.keyDown(word, { key: 'c', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(word, { key: 'Escape' })).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(fireEvent.contextMenu(word)).toBe(true);
    field.remove();
  });
});
