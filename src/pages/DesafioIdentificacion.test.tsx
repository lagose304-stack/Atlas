import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesafioIdentificacion, { generateDiverseMatchPlates } from './DesafioIdentificacion';

const plates = [
  { id: 1, tema: 10, name: 'Epitelial', parcial: 'primer' },
  { id: 2, tema: 20, name: 'Conectivo', parcial: 'primer' },
  { id: 3, tema: 30, name: 'Muscular', parcial: 'segundo' },
].map(p => ({ id: p.id, photo_url: `https://r2.atlas-tests.invalid/${p.id}.jpg`, subtema_id: p.id, senalados: p.id === 2 ? ['Núcleo', 'Citoplasma'] : [], senalados_meta: p.id === 2 ? [{ label: 'Núcleo', x: .3, y: .5 }, { label: 'Citoplasma', x: .6, y: .5 }] : [], subtemas: { id: p.id, nombre: `Subtema ${p.id}`, temas: { id: p.tema, nombre: p.name, parcial: p.parcial, sort_order: p.id * 10 } } }));

vi.mock('../services/supabase', () => ({ supabase: { from: () => ({ select: async () => ({ data: plates, error: null }) }) } }));
vi.mock('../services/cloudinaryImages', () => ({ getCloudinaryImageUrl: (url: string) => url }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('../services/siteMaintenance', () => ({
  canBypassMaintenance: () => false, isParcialDisabled: () => false, isTemaDisabled: () => false,
  fetchSiteMaintenanceStatus: async () => ({ disabledFeatures: [] }), subscribeSiteMaintenanceStatus: () => () => {},
}));

describe('Selección del desafío', () => {
  it.each([1, 7, 29, 30, 45])('usa hasta 30 placas únicas cuando el tema contiene %s', (count) => {
    const pool = Array.from({ length: count }, (_, index) => ({
      id: index + 1, photo_url: `/plate-${index}.jpg`, subtema_id: index % 3,
      subtema_nombre: `Subtema ${index % 3}`, tema_id: 20, tema_nombre: 'Conectivo', parcial: 'primer',
    }));
    const match = generateDiverseMatchPlates(pool);
    expect(match).toHaveLength(Math.min(30, count));
    expect(new Set(match.map(plate => plate.id)).size).toBe(match.length);
    if (count <= 30) expect(match.map(plate => plate.id).sort((a, b) => a - b)).toEqual(pool.map(plate => plate.id));
    expect(match.every(plate => plate.tema_id === 20)).toBe(true);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => 'false', setItem: vi.fn() });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', window.clearTimeout);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('quita todos los parciales y exige un tema del parcial elegido', async () => {
    await act(async () => render(<DesafioIdentificacion />));
    expect(screen.queryByText('Todos los Parciales')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tema específico/ }));
    expect(screen.getByRole('button', { name: 'Selecciona un tema' })).toBeDisabled();
    fireEvent.click(screen.getByText('Elige un tema'));
    const themeButtons = screen.getByRole('group', { name: 'Temas disponibles' }).querySelectorAll('button');
    expect([...themeButtons].map(button => button.querySelector('.desafio-theme-name')?.childNodes[0].textContent)).toEqual(['Epitelial', 'Conectivo']);
    fireEvent.click(screen.getByRole('button', { name: /Epitelial/ }));
    expect(screen.getByRole('button', { name: /Comenzar Desafío \(1 placa\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Segundo Parcial/ }));
    expect(screen.getByText('Elige un tema')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Elige un tema'));
    expect(screen.queryByRole('button', { name: /Epitelial/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Muscular/ })).toBeInTheDocument();
  });

  it('solo muestra la placa del tema elegido y mantiene el reloj parado si no carga', async () => {
    await act(async () => render(<DesafioIdentificacion />));
    fireEvent.click(screen.getByRole('button', { name: /Tema específico/ }));
    fireEvent.click(screen.getByText('Elige un tema'));
    fireEvent.click(screen.getByRole('button', { name: /Conectivo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Comenzar Desafío/ }));
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => vi.advanceTimersByTime(6000));
    const image = screen.getByAltText('Placa histológica a identificar');
    expect(image).toHaveAttribute('src', 'https://r2.atlas-tests.invalid/2.jpg');
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText('15.0')).toBeInTheDocument();
    expect(screen.getByText('Tiempo detenido')).toBeInTheDocument();
    fireEvent.error(image);
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText('15.0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar carga' })).toBeInTheDocument();
  });

  it('ofrece temas con señalados y muestra una sola marca con sus alternativas', async () => {
    await act(async () => render(<DesafioIdentificacion />));
    fireEvent.click(screen.getByRole('button', { name: /Modo señalados/ }));
    fireEvent.click(screen.getByText('Elige un tema'));
    expect(screen.queryByRole('button', { name: /Epitelial/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Conectivo/ }));
    expect(screen.getByRole('button', { name: /Comenzar Desafío \(2 preguntas\)/ })).toBeEnabled();
    expect(screen.queryByText(/Un señalado por placa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Comenzar Desafío/ }));
    await act(async () => vi.advanceTimersByTime(1000));
    await act(async () => vi.advanceTimersByTime(6000));
    const image = screen.getByAltText('Placa histológica a identificar');
    expect(image).toHaveAttribute('src', 'https://r2.atlas-tests.invalid/2.jpg');
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 800 }, naturalHeight: { value: 500 }, decode: { value: async () => {} } });
    await act(async () => fireEvent.load(image));
    act(() => vi.advanceTimersByTime(32));
    const marker = screen.getByRole('img', { name: 'Señalado a identificar' });
    expect(marker.textContent).toBe('');
    expect(screen.getAllByRole('img', { name: 'Señalado a identificar' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Núcleo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Citoplasma/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subtema 2/ })).not.toBeInTheDocument();
    const firstX = marker.querySelector('circle')?.getAttribute('cx');
    fireEvent.click(screen.getByRole('button', { name: firstX === '240' ? /Núcleo/ : /Citoplasma/ }));
    act(() => vi.advanceTimersByTime(850));
    expect(screen.queryByRole('img', { name: 'Señalado a identificar' })).not.toBeInTheDocument();
    const nextImage = screen.getByAltText('Placa histológica a identificar');
    expect(nextImage).toHaveAttribute('src', 'https://r2.atlas-tests.invalid/2.jpg');
    Object.defineProperties(nextImage, { complete: { value: true }, naturalWidth: { value: 800 }, naturalHeight: { value: 500 }, decode: { value: async () => {} } });
    await act(async () => fireEvent.load(nextImage));
    act(() => vi.advanceTimersByTime(32));
    expect(screen.getByRole('img', { name: 'Señalado a identificar' }).querySelector('circle')?.getAttribute('cx')).not.toBe(firstX);
  });
});
