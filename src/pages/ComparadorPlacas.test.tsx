import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom no interpreta las consultas CSS de contenedor; se verifican en Chromium.
vi.mock('../styles/comparador.css', () => ({}));

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../services/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: mocks.fetch }) }) },
}));
vi.mock('../components/comparador/DualPlateViewport', () => ({
  default: ({ letter, plate, zoom, pan, showSignalings, onOpenPicker, onPanZoomChange }: any) => (
    <div data-testid={`plate-${letter}`}>
      <span>{plate?.subtema_nombre ?? 'Vacía'}|{zoom}|{pan.x}|{String(showSignalings)}</span>
      <button onClick={onOpenPicker}>Elegir {letter}</button>
      <button onClick={() => onPanZoomChange(2, { x: 35, y: 20 })}>Ampliar {letter}</button>
    </div>
  ),
}));
vi.mock('../components/comparador/PlatePickerModal', () => ({
  default: ({ isOpen, targetLetter, onSelectPlate, onClose }: any) => isOpen ? (
    <button onClick={() => {
      onSelectPlate({ id: targetLetter.charCodeAt(0), subtema_nombre: `Tejido ${targetLetter}` });
      onClose();
    }}>Confirmar {targetLetter}</button>
  ) : null,
}));
import ComparadorPlacas from './ComparadorPlacas';

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/herramientas/comparador');
  mocks.fetch.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

const setMode = (mode: number) => fireEvent.change(screen.getByLabelText('Número de placas'), { target: { value: String(mode) } });
const choose = (letter: string) => {
  fireEvent.click(screen.getByText(`Elegir ${letter}`));
  fireEvent.click(screen.getByText(`Confirmar ${letter}`));
};

describe('Versus de placas', () => {
  it('ofrece las distribuciones de cada modo y conserva las placas al reducirlo y ampliarlo', () => {
    render(<ComparadorPlacas />);
    expect(screen.getAllByTestId(/^plate-/)).toHaveLength(2);
    expect(screen.getByText('Distribución').closest('footer')).toHaveClass('comparador-layout-bar');
    setMode(3);
    choose('C');
    fireEvent.click(screen.getByText('Distribución'));
    expect(screen.queryByText('2 × 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Una mitad + 2 apiladas'));
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('count-3', 'layout-featured');
    setMode(4);
    choose('D');
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.click(screen.getByText('Una mitad + 3 apiladas'));
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('count-4', 'layout-featured');
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.click(screen.getByText('2 × 2'));
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('layout-grid');
    setMode(2);
    expect(screen.getByText('Distribución').closest('footer')).toHaveClass('comparador-layout-bar');
    setMode(4);
    expect(screen.getByTestId('plate-C')).toHaveTextContent('Tejido C');
    expect(screen.getByTestId('plate-D')).toHaveTextContent('Tejido D');
    setMode(3);
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('layout-featured');
  });

  it('ofrece las dos orientaciones del modo 2 desde la barra inferior', () => {
    render(<ComparadorPlacas />);
    expect(screen.queryByLabelText('Cambiar orientación')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.click(screen.getByText('Una arriba de otra'));
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('count-2', 'layout-vertical');
    fireEvent.click(screen.getByText('Distribución'));
    expect(screen.getByRole('button', { name: 'Una arriba de otra' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByText('Una al lado de otra'));
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('layout-horizontal');
  });

  it('sincroniza, restablece y rota todos los visores visibles, conservando el oculto', () => {
    render(<ComparadorPlacas />);
    setMode(4);
    ['A', 'B', 'C', 'D'].forEach(choose);
    fireEvent.click(screen.getByText('Sincronizar'));
    fireEvent.click(screen.getByText('Ampliar D'));
    screen.getAllByTestId(/^plate-/).forEach(pane => expect(pane).toHaveTextContent('|2|35|false'));
    fireEvent.click(screen.getByText('Señalados'));
    screen.getAllByTestId(/^plate-/).forEach(pane => expect(pane).toHaveTextContent('|true'));
    setMode(3);
    fireEvent.click(screen.getByLabelText('Restablecer vistas'));
    fireEvent.click(screen.getByText('Intercambiar'));
    expect(screen.getByTestId('plate-A')).toHaveTextContent('Tejido B|1|0|true');
    expect(screen.getByTestId('plate-C')).toHaveTextContent('Tejido A|1|0|true');
    setMode(4);
    expect(screen.getByTestId('plate-D')).toHaveTextContent('Tejido D|2|35|true');
  });

  it.each([3, 4])('alterna la destacada en modo %i siguiendo el orden de las pequeñas', (count) => {
    render(<ComparadorPlacas />);
    expect(screen.queryByText('Alternar destacada')).not.toBeInTheDocument();
    setMode(count);
    const letters = ['A', 'B', 'C', 'D'].slice(0, count);
    letters.forEach(choose);
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.click(screen.getByText(`Una mitad + ${count - 1} apiladas`));
    for (let step = 1; step <= count; step++) {
      fireEvent.click(screen.getByText('Alternar destacada'));
      letters.forEach((letter, index) => {
        expect(screen.getByTestId(`plate-${letter}`)).toHaveTextContent(`Tejido ${letters[(index + step) % count]}`);
      });
      expect(screen.getByLabelText('Área de comparación')).toHaveClass('layout-featured');
    }
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.click(screen.getByText('Una al lado de otra'));
    expect(screen.queryByText('Alternar destacada')).not.toBeInTheDocument();
  });

  it('restaura A/B/C/D y espera a terminar la lectura antes de sincronizar los enlaces', async () => {
    window.history.replaceState({}, '', '/herramientas/comparador?placaA=1&placaB=1&placaC=3&placaD=4&modo=4&distribucion=featured');
    let resolve!: (result: any) => void;
    mocks.fetch.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<ComparadorPlacas />);
    expect(window.location.search).toContain('placaD=4');
    await act(async () => resolve({ data: [1, 3, 4].map(id => ({ id, photo_url: '', subtemas: { nombre: `Tejido ${id}` } })), error: null }));
    await waitFor(() => expect(screen.getByTestId('plate-D')).toHaveTextContent('Tejido 4'));
    expect(screen.getByTestId('plate-A')).toHaveTextContent('Tejido 1');
    expect(screen.getByTestId('plate-B')).toHaveTextContent('Tejido 1');
    expect(mocks.fetch).toHaveBeenCalledWith('id', [1, 1, 3, 4]);
    expect(screen.getByLabelText('Área de comparación')).toHaveClass('count-4', 'layout-featured');
    expect(window.location.search).toContain('placaD=4');
  });

  it('respeta el modo 2 al recargar aunque existan placas C y D conservadas', async () => {
    window.history.replaceState({}, '', '/herramientas/comparador?placaC=3&placaD=4&modo=2');
    mocks.fetch.mockResolvedValue({ data: [{ id: 4, subtemas: { nombre: 'Tejido conservado' } }], error: null });
    render(<ComparadorPlacas />);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(screen.getAllByTestId(/^plate-/)).toHaveLength(2);
    setMode(4);
    await waitFor(() => expect(screen.getByTestId('plate-D')).toHaveTextContent('Tejido conservado'));
  });

  it('mantiene los enlaces antiguos de dos placas y cierra el menú con Escape', async () => {
    window.history.replaceState({}, '', '/herramientas/comparador?placaA=1&placaB=2');
    render(<ComparadorPlacas />);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('id', [1, 2]));
    expect(screen.getAllByTestId(/^plate-/)).toHaveLength(2);
    setMode(3);
    fireEvent.click(screen.getByText('Distribución'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Distribución de placas' })).not.toBeInTheDocument();
  });
});
