import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('herramientas del editor: alineación y teclado', () => {
  it('desplaza el borde y sus huecos juntos al alinear y conserva ambos al guardar', () => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
    const save = vi.fn();
    const outer = [0.1, 0.1, 0.8, 0.1, 0.8, 0.8, 0.1, 0.8];
    const hole = [0.3, 0.3, 0.5, 0.3, 0.5, 0.5, 0.3, 0.5];
    render(<PlateAnnotationViewerEditor imageSrc="https://pub-isolated.r2.dev/placa.webp"
      initialSenalados={['Región']} initialSenaladosPos={[{ x: 0.45, y: 0.45, regionPoints: outer, regionHoles: [hole] }]}
      onSaveAll={save} onCancel={vi.fn()} />);
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    fireEvent.click(screen.getByTitle('Mover todos los señalados a la vez'));
    const image = screen.getByAltText('Placa histológica');
    Object.defineProperties(image, { clientWidth: { value: 1000 }, clientHeight: { value: 800 } });
    fireEvent(window, new Event('resize'));
    fireEvent.click(screen.getByTitle('Mover todos a la derecha'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar alineación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
    const result = save.mock.calls[0][1][0];
    expect(result.regionPoints[0]).toBeCloseTo(outer[0] + 0.005);
    expect(result.regionHoles[0][0]).toBeCloseTo(hole[0] + 0.005);
    expect(result.regionHoles[0][1]).toBe(hole[1]);
    expect(hole[0]).toBe(0.3);
    act(() => vi.runOnlyPendingTimers());
  });

  it('libera el paneo al soltar espacio sobre un campo o al perder el foco', () => {
    render(<PlateAnnotationViewerEditor imageSrc="https://pub-isolated.r2.dev/placa.webp" onCancel={vi.fn()} />);
    const canvas = screen.getByTestId('annotation-editor-canvas');
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(canvas).toHaveStyle({ cursor: 'grabbing' });
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.keyUp(screen.getByRole('textbox'), { key: ' ', code: 'Space' });
    expect(canvas).not.toHaveStyle({ cursor: 'grabbing' });
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    fireEvent.blur(window);
    expect(canvas).not.toHaveStyle({ cursor: 'grabbing' });
  });
});
