import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamWeekTestsCarousel from './ExamWeekTestsCarousel';
import { supabase } from '../services/supabase';
import { getCachedTemas } from '../services/catalogService';
import { fetchSiteMaintenanceStatus } from '../services/siteMaintenance';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../services/catalogService', () => ({ getCachedTemas: vi.fn() }));
vi.mock('../services/siteMaintenance', async importOriginal => ({
  ...await importOriginal<typeof import('../services/siteMaintenance')>(),
  fetchSiteMaintenanceStatus: vi.fn(),
  subscribeSiteMaintenanceStatus: () => () => {},
}));
vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), undefined] }));

const test = (id: string, tema_id: number, created_at = '2026-01-01') => ({
  id, nombre: `<p>Prueba ${id}</p>`, estado: 'publicada', parcial_key: 'primer', tema_id, created_at, image_url: 'https://example.com/test.webp',
  tema: null, subtema: null,
});
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn> };
const show = (parcial = 'primer') => render(<MemoryRouter initialEntries={['/']}><ExamWeekTestsCarousel parcial={parcial} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [], error: null });
  vi.mocked(supabase.from).mockReturnValue(query as never);
  vi.mocked(getCachedTemas).mockResolvedValue([
    { id: 1, nombre: 'Primero', parcial: 'primer', sort_order: 0 },
    { id: 2, nombre: 'Segundo', parcial: 'primer', sort_order: 1 },
  ]);
  vi.mocked(fetchSiteMaintenanceStatus).mockResolvedValue({
    enabled: false, message: '', updatedAt: null, bannerEnabled: false, bannerMessage: '', disabledFeatures: [],
  });
});

describe('Pruebas de la semana de exámenes', () => {
  it('consulta solo publicadas del parcial seleccionado y respeta el orden del temario', async () => {
    query.order.mockResolvedValue({ data: [test('B', 2), test('A', 1), test('C', 1, '2026-02-01')], error: null });
    show();
    await screen.findByRole('link', { name: 'Prueba A' });
    expect(query.eq).toHaveBeenCalledWith('estado', 'publicada');
    expect(query.eq).toHaveBeenCalledWith('parcial_key', 'primer');
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Prueba C', 'Prueba A', 'Prueba B']);
    expect(screen.getByRole('link', { name: 'Prueba A' })).toHaveAttribute('href', '/evaluaciones/ejecutar/A');
    const first = screen.getByRole('link', { name: 'Prueba C' }).parentElement!;
    const last = screen.getByRole('link', { name: 'Prueba A' }).parentElement!;
    expect(first).toHaveClass('is-group-start');
    expect(last).toHaveClass('is-group-end');
    expect(first).toHaveAttribute('aria-label', 'Primero, prueba 1 de 2, inicio del tema');
    expect(last).toHaveAttribute('aria-label', 'Primero, prueba 2 de 2, fin del tema');
  });

  it('abre la prueba directamente conservando el regreso a la página de origen', async () => {
    query.order.mockResolvedValue({ data: [test('A', 1)], error: null });
    const Destination = () => <p>Regresar a {useLocation().state?.from}</p>;
    render(<MemoryRouter initialEntries={['/temario?parcial=primer']}><Routes>
      <Route path="/temario" element={<ExamWeekTestsCarousel parcial="primer" />} />
      <Route path="/evaluaciones/ejecutar/A" element={<Destination />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('link', { name: 'Prueba A' }));
    expect(screen.getByText('Regresar a /temario?parcial=primer')).toBeInTheDocument();
  });

  it('excluye pruebas de otros parciales y borradores aunque lleguen en la respuesta', async () => {
    query.order.mockResolvedValue({ data: [test('A', 1), { ...test('B', 1), parcial_key: 'segundo' }, { ...test('C', 2), estado: 'borrador' }], error: null });
    show();
    await screen.findByRole('link', { name: 'Prueba A' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Primer parcial')).toBeInTheDocument();
  });

  it('agrupa según el catálogo, resuelve el tema del subtema y deja las generales al final', async () => {
    vi.mocked(getCachedTemas).mockResolvedValue([
      { id: 2, nombre: 'Sangre', parcial: 'primer', sort_order: 1 },
      { id: 1, nombre: 'Linfático', parcial: 'primer', sort_order: 2 },
      { id: 3, nombre: 'Otro parcial', parcial: 'segundo', sort_order: 0 },
    ]);
    query.order.mockResolvedValue({ data: [
      test('A', 1), { ...test('General', 0), tema_id: null },
      { ...test('B', 0), tema_id: null, subtema: { tema_id: 2, logo_url: null } },
    ], error: null });
    show();
    await screen.findByRole('link', { name: 'Prueba B' });
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Prueba B', 'Prueba A', 'Prueba General']);
    const topicNavigation = screen.getByRole('navigation', { name: 'Ir a las pruebas de un tema' });
    expect([...topicNavigation.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Sangre1', 'Linfático1', 'Repaso general1']);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar movimiento' }));
    expect(screen.getByRole('button', { name: 'Reanudar movimiento' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('oculta los temas deshabilitados para visitantes', async () => {
    query.order.mockResolvedValue({ data: [test('A', 1), test('B', 2)], error: null });
    vi.mocked(fetchSiteMaintenanceStatus).mockResolvedValue({
      enabled: false, message: '', updatedAt: null, bannerEnabled: false, bannerMessage: '', disabledFeatures: ['tema_1'],
    });
    show();
    await screen.findByRole('link', { name: 'Prueba B' });
    expect(screen.queryByRole('link', { name: 'Prueba A' })).not.toBeInTheDocument();
  });

  it('indica cuando no hay pruebas y permite reintentar un error de carga', async () => {
    query.order.mockResolvedValueOnce({ data: null, error: { message: 'Sin conexión' } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByText('No hay pruebas disponibles para este parcial.');
  });

  it('retira las tarjetas del parcial anterior mientras carga la nueva selección', async () => {
    query.order.mockResolvedValueOnce({ data: [test('A', 1)], error: null });
    const view = show();
    await screen.findByRole('link', { name: 'Prueba A' });
    query.order.mockReturnValue(new Promise(() => {}));
    view.rerender(<MemoryRouter><ExamWeekTestsCarousel parcial="segundo" /></MemoryRouter>);
    await waitFor(() => expect(query.eq).toHaveBeenCalledWith('parcial_key', 'segundo'));
    expect(screen.queryByRole('link', { name: 'Prueba A' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando pruebas');
  });
});
