import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MapasInteractivos from './MapasInteractivos';

const fixture = vi.hoisted(() => ({
  tema: { id: 91, nombre: 'Tema aislado', parcial: 'primer', sort_order: 0 },
  subtema: { id: 92, nombre: 'Subtema aislado', tema_id: 91 },
  placa: { id: 93, photo_url: 'https://r2.atlas-tests.invalid/placa.webp', tema_id: 91, subtema_id: 92, sort_order: 0 },
  otherPlaca: { id: 95, photo_url: 'https://r2.atlas-tests.invalid/next.webp', tema_id: 91, subtema_id: 92, sort_order: 1 },
  map: { id: 94, map_number: 1, tema_id: 91, subtema_id: null as number | null, placa_id: 93,
    sections: [{ title: 'Zona inicial', description: 'Información', color: '#0ea5e9', points: [0.2, 0.2, 0.6, 0.2, 0.6, 0.6, 0.2, 0.6], sort_order: 0, coordinate_space: 'image_uv_v1' }] },
  writes: [] as Record<string, unknown>[],
  imageMode: 'ready' as 'ready' | 'error' | 'pending',
}));

vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/ResilientPlacaThumb', () => ({ default: () => null }));
vi.mock('../services/catalogService', () => ({
  getQuickTemas: () => [fixture.tema], getCachedTemas: async () => [fixture.tema],
  getQuickSubtemas: () => [fixture.subtema], getCachedSubtemas: async () => [fixture.subtema],
  getQuickPlacasForSubtema: () => ({ placas: [fixture.placa, fixture.otherPlaca], placasConMapa: [93] }),
  getCachedPlacasForSubtema: async () => ({ placas: [fixture.placa, fixture.otherPlaca], placasConMapa: [93] }),
  invalidatePlacasCache: vi.fn(),
}));
vi.mock('../services/supabase', () => ({ supabase: { from: (table: string) => {
  let single = false;
  let update: Record<string, unknown> | null = null;
  const filters: Array<[string, unknown]> = [];
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'order', 'limit']) chain[name] = () => chain;
  chain.eq = (key: string, value: unknown) => { filters.push([key, value]); return chain; };
  chain.maybeSingle = () => { single = true; return chain; };
  chain.update = (payload: Record<string, unknown>) => { update = payload; return chain; };
  chain.then = (resolve: (result: unknown) => unknown) => {
    if (update) { fixture.writes.push(update); Object.assign(fixture.map, update); }
    const rows: Record<string, unknown>[] = table === 'interactive_maps' ? [fixture.map] : [fixture.placa, fixture.otherPlaca];
    const filtered = rows.filter(row => filters.every(([key, value]) => row[key] === value));
    return Promise.resolve({ data: JSON.parse(JSON.stringify(single ? filtered[0] ?? null : filtered)), error: null }).then(resolve);
  };
  return chain;
} } }));

// Konva requiere un canvas real. Aquí solo se sustituyen sus nodos; se ejercitan
// la página, sus formularios, estados, eventos de teclado y escritura simulada.
vi.mock('react-konva', async () => {
  const React = await import('react');
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Stage: React.forwardRef(({ children }: { children?: React.ReactNode }, ref) => {
      React.useImperativeHandle(ref, () => ({ getPointerPosition: () => ({ x: 0.4, y: 0.4 }) }));
      return <div data-testid="map-stage">{children}</div>;
    }),
    Layer: Container,
    Image: () => null,
    Line: ({ closed, onMouseDown }: { closed?: boolean; onMouseDown?: (event: object) => void }) => closed && onMouseDown
      ? <button data-testid="map-region" onClick={() => onMouseDown({ cancelBubble: false })}>Región</button> : null,
    Circle: () => null, Path: () => null,
  };
});

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/mapas-interactivos?modo=editar&tema=91&subtema=92');
  fixture.writes.length = 0;
  fixture.imageMode = 'ready';
  fixture.map.subtema_id = null;
  fixture.map.placa_id = 93;
  fixture.map.sections[0].title = 'Zona inicial';
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('Image', class {
    width = 1000; height = 800; naturalWidth = 1000; naturalHeight = 800;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      if (value.includes('next.webp')) { this.width = 400; this.height = 900; }
      if (fixture.imageMode === 'ready') queueMicrotask(() => this.onload?.());
      if (fixture.imageMode === 'error') queueMicrotask(() => this.onerror?.());
    }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const open = async () => {
  render(<MemoryRouter initialEntries={['/mapas-interactivos?modo=editar&tema=91&subtema=92']}><MapasInteractivos /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('Abrir mapa para edición'));
  await screen.findByTestId('map-stage');
  await waitFor(() => expect(screen.getAllByTestId('map-region').length).toBeGreaterThan(0));
};

describe('editor de mapas: escritura y protección de cambios', () => {
  it('cambiar a una placa con otra proporción conserva el mapa y sus coordenadas normalizadas', async () => {
    await open();
    const original = [...fixture.map.sections[0].points];
    fireEvent.click(screen.getByTitle('Vincular este mapa a otra placa del subtema'));
    fireEvent.click(screen.getByText(/^Placa 2/));
    await screen.findByTestId('map-stage');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeEnabled());
    expect(fixture.writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar mapa' }));
    await waitFor(() => expect(fixture.writes).toHaveLength(1));
    expect(fixture.map.placa_id).toBe(95);
    expect(fixture.map.sections[0].points).toHaveLength(original.length);
    fixture.map.sections[0].points.forEach((point, i) => expect(point).toBeCloseTo(original[i], 8));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(await screen.findByTitle('Abrir mapa para edición'));
    await screen.findByTestId('map-stage');
    await waitFor(() => expect(screen.getAllByTestId('map-region').length).toBeGreaterThan(0));
    expect(screen.getByText(/Placa 2/)).toBeInTheDocument();
  });

  it('descartar el cambio de placa recupera la referencia original sin escribir', async () => {
    await open();
    fireEvent.click(screen.getByTitle('Vincular este mapa a otra placa del subtema'));
    fireEvent.click(screen.getByText(/^Placa 1/));
    expect(screen.getByTestId('map-stage')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Vincular este mapa a otra placa del subtema'));
    fireEvent.click(screen.getByText(/^Placa 2/));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar no guardadas' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeDisabled());
    expect(fixture.map.placa_id).toBe(93);
    expect(fixture.writes).toEqual([]);
  });

  it('explica el fallo de imagen y permite reintentar conservando el mapa', async () => {
    fixture.imageMode = 'error';
    render(<MemoryRouter initialEntries={['/mapas-interactivos?modo=editar&tema=91&subtema=92']}><MapasInteractivos /></MemoryRouter>);
    fireEvent.click(await screen.findByTitle('Abrir mapa para edición'));
    await screen.findByText('No se pudo cargar la imagen de la placa actual.');
    expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeDisabled();
    fixture.imageMode = 'ready';
    fireEvent.click(screen.getByRole('button', { name: /Reintentar carga/ }));
    await screen.findByTestId('map-stage');
    await waitFor(() => expect(screen.getAllByTestId('map-region').length).toBeGreaterThan(0));
    expect(fixture.writes).toEqual([]);
  });

  it('termina la espera si el original no responde en lugar de cargar indefinidamente', async () => {
    fixture.imageMode = 'pending';
    render(<MemoryRouter initialEntries={['/mapas-interactivos?modo=editar&tema=91&subtema=92']}><MapasInteractivos /></MemoryRouter>);
    const button = await screen.findByTitle('Abrir mapa para edición');
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(button); });
    act(() => vi.advanceTimersByTime(45000));
    expect(screen.getByText('No se pudo cargar la imagen de la placa actual.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeDisabled();
    expect(fixture.writes).toEqual([]);
  });

  it('abrir un mapa con subtema antiguo no escribe automáticamente', async () => {
    await open();
    expect(fixture.writes).toEqual([]);
    expect(fixture.map.subtema_id).toBeNull();
  });

  it('no descarta cambios del mapa con Escape y conserva el descarte explícito', async () => {
    await open();
    fireEvent.click(screen.getByTitle('Mover todo (Alinear todas las selecciones en bloque)'));
    fireEvent.click(screen.getByTitle('Mover todo hacia la derecha'));
    expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeEnabled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar no guardadas' }));
    expect(screen.getByRole('button', { name: 'Actualizar mapa' })).toBeDisabled();
    expect(fixture.writes).toEqual([]);
  });

  it('permite espacios y corrector en título e información sin cerrar el formulario con Escape', async () => {
    await open();
    fireEvent.click(screen.getAllByTestId('map-region')[0]);
    fireEvent.click(screen.getByTitle('Editar información de la selección'));
    const title = screen.getByLabelText(/Título/);
    const description = screen.getByLabelText('Información');
    for (const field of [title, description]) {
      expect(field).toHaveAttribute('spellcheck', 'true');
      expect(field).toHaveAttribute('lang', 'es');
      expect(fireEvent.keyDown(field, { key: ' ', code: 'Space' })).toBe(true);
      expect(fireEvent.contextMenu(field)).toBe(true);
      fireEvent.keyDown(field, { key: 'Escape' });
    }
    expect(title).toBeInTheDocument();
    title.innerHTML = '<b> </b>';
    fireEvent.input(title);
    expect(screen.getByRole('button', { name: /^Actualizar$/ })).toBeDisabled();
    title.innerHTML = '<b>Núcleo de célula</b>';
    fireEvent.input(title);
    description.innerHTML = 'Primera línea<div>Segunda línea</div>';
    fireEvent.input(description);
    fireEvent.click(screen.getByRole('button', { name: /^Actualizar$/ }));
    expect(fixture.writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar mapa' }));
    await waitFor(() => expect(fixture.writes).toHaveLength(1));
    expect(fixture.map.sections[0].title).toBe('**Núcleo de célula**');
    expect(fixture.map.sections[0].description).toBe('Primera línea\nSegunda línea');
    expect(fixture.map.subtema_id).toBe(92);
  });
});
