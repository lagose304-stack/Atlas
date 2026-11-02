import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import TrasladarPlaca from './TrasladarPlaca';
import { movePlate } from '../services/movePlate';
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/ResilientPlacaThumb', () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, rol: 'Administrador' } }) }));
vi.mock('../services/plateActivityAudit', () => ({ logPlateActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/movePlate', () => ({ movePlate: vi.fn() }));
vi.mock('../services/catalogService', () => ({
  getCachedTemas: async () => [{ id: 1, nombre: 'Origen' }, { id: 3, nombre: 'Destino' }],
  getCachedSubtemas: async (id: number) => id === 1 ? [{ id: 2, nombre: 'Subtema origen' }] : [{ id: 4, nombre: 'Subtema destino' }],
}));
vi.mock('../services/supabase', () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, range: async () => ({ data: [{ id: 7, tema_id: 1, subtema_id: 2, photo_url: 'imagen' }], error: null }) };
  return query;
} } }));
beforeEach(() => { vi.clearAllMocks(); });
async function choose() {
  render(<MemoryRouter><TrasladarPlaca /></MemoryRouter>);
  await screen.findByRole('option', { name: 'Origen' });
  fireEvent.change(screen.getByLabelText('Tema de origen'), { target: { value: '1' } });
  await screen.findByRole('option', { name: 'Subtema origen' });
  fireEvent.change(screen.getByLabelText('Subtema de origen'), { target: { value: '2' } });
  fireEvent.click(await screen.findByRole('button', { name: /Placa #7/ }));
  fireEvent.change(screen.getByLabelText('Tema de destino'), { target: { value: '3' } });
  await screen.findByRole('option', { name: 'Subtema destino' });
  fireEvent.change(screen.getByLabelText('Subtema de destino'), { target: { value: '4' } });
}
it('exige confirmación y conserva la identidad seleccionada', async () => {
  vi.mocked(movePlate).mockResolvedValue({ id: 7, tema_id: 3, subtema_id: 4, map_id: 10, map_number: 2 });
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Mover placa' }));
  expect(movePlate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
  await screen.findByText(/Placa #7 movida a Destino/);
  expect(movePlate).toHaveBeenCalledWith({ id: 7, tema_id: 1, subtema_id: 2, photo_url: 'imagen' }, 3, 4);
});
it('muestra errores de servidor sin anunciar éxito ni perder la selección', async () => {
  vi.mocked(movePlate).mockRejectedValue(new Error('La ubicación cambió'));
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Mover placa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('La ubicación cambió'));
  expect(screen.getByRole('heading', { name: '2. Destino de la placa #7' })).toBeInTheDocument();
  expect(screen.queryByText(/Placa #7 movida/)).not.toBeInTheDocument();
});
it('cambiar el tema de origen limpia selección y subtema', async () => {
  await choose();
  fireEvent.change(screen.getByLabelText('Tema de origen'), { target: { value: '3' } });
  await screen.findByRole('option', { name: 'Subtema destino' });
  expect(screen.queryByLabelText('Tema de destino')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Subtema de origen')).toHaveValue('0');
  expect(movePlate).not.toHaveBeenCalled();
});
