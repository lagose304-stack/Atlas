import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlateAnnotationViewerEditor from './PlateAnnotationViewerEditor';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('herramientas del editor: alineación y teclado', () => {
  it('conserva estilos antiguos sin redondearlos a una opción estándar al abrir y guardar', () => {
    const save = vi.fn();
    render(<PlateAnnotationViewerEditor imageSrc="https://isolated.atlas-tests.invalid/placa.webp" initialSenalados={['Región']} initialSenaladosPos={[{ x: 0.4, y: 0.4, regionPoints: [0.1, 0.1, 0.8, 0.1, 0.4, 0.8], regionStrokeWidth: 5, regionDashLength: 3, regionDashGap: 9 }]} onSaveAll={save} onCancel={vi.fn()} />);
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    fireEvent.click(screen.getByRole('button', { name: 'Borde' }));
    fireEvent.click(document.querySelector('path[fill-rule="evenodd"]')!);
    expect(screen.getByLabelText('Grosor de la línea')).toHaveValue('5');
    expect(screen.getByLabelText('Separación entre segmentos')).toHaveValue('9');
    expect(screen.getByLabelText('Longitud de los segmentos')).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
    expect(save.mock.calls[0][1][0]).toMatchObject({ regionStrokeWidth: 5, regionDashLength: 3, regionDashGap: 9 });
  });
  it('comparte los ajustes de la guía entre borde individual y múltiple y guarda el estilo sin cambiar la geometría', () => {
    const save = vi.fn();
    const location = { x: 0.4, y: 0.4, regionPoints: [0.1, 0.1, 0.8, 0.1, 0.4, 0.8] };
    render(<PlateAnnotationViewerEditor imageSrc="https://isolated.atlas-tests.invalid/placa.webp" initialSenalados={['Región']} initialSenaladosPos={[location]} onSaveAll={save} onCancel={vi.fn()} />);
    fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
    fireEvent.click(screen.getByRole('button', { name: 'Borde' }));
    fireEvent.click(document.querySelector('path[fill-rule="evenodd"]')!);
    fireEvent.change(screen.getByLabelText('Grosor de la línea'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Separación entre segmentos'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Longitud de los segmentos'), { target: { value: '16' } });
    fireEvent.click(screen.getByLabelText('Suavizado leve del trazo'));
    const line = screen.getByRole('img', { name: 'Vista previa de la guía del borde' }).querySelector('line');
    expect(line).toHaveAttribute('stroke-width', '4');
    expect(line).toHaveAttribute('stroke-dasharray', '16 16');
    expect(line).toHaveAttribute('stroke-linecap', 'round');
    fireEvent.click(screen.getByRole('button', { name: 'Bordes Múltiples' }));
    expect(screen.getByLabelText('Grosor de la línea')).toHaveValue('4');
    expect(screen.getByLabelText('Separación entre segmentos')).toHaveValue('12');
    expect(screen.getByLabelText('Longitud de los segmentos')).toHaveValue('16');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
    const saved = save.mock.calls[0][1][0];
    expect(saved.regionPoints).toEqual(location.regionPoints);
    expect(saved.regionStrokeWidth).toBe(4);
    expect(saved.regionDashLength).toBe(16);
    expect(saved.regionDashGap).toBe(12);
    expect(saved.regionSmooth).toBe(true);
  });
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
