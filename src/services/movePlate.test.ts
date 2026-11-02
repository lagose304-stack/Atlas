import { beforeEach, describe, expect, it, vi } from 'vitest';
import { movePlate } from './movePlate';
import { supabase } from './supabase';
import { invalidatePlacasCache } from './catalogService';
vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./catalogService', () => ({ invalidatePlacasCache: vi.fn() }));
const plate = { id: 7, tema_id: 1, subtema_id: 2 };
beforeEach(() => { vi.clearAllMocks(); });
describe('Movimiento exclusivo de ubicación', () => {
  it('envía el origen para detectar conflictos y solo destino/identidad en una operación', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { id: 7, tema_id: 3, subtema_id: 4 }, error: null } as never);
    await movePlate({ ...plate, photo_url: 'intacta', senalados: ['intacto'] } as typeof plate, 3, 4);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('atlas_move_plate', { p_placa_id: 7, p_from_tema_id: 1, p_from_subtema_id: 2, p_tema_id: 3, p_subtema_id: 4 });
    expect(invalidatePlacasCache).toHaveBeenCalledWith(2);
    expect(invalidatePlacasCache).toHaveBeenCalledWith(4);
  });
  it('rechaza destino idéntico o inválido sin escribir', async () => {
    await expect(movePlate(plate, 1, 2)).rejects.toThrow('diferente');
    await expect(movePlate(plate, 3, 0)).rejects.toThrow('válido');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('no anuncia éxito cuando el servidor falla o no confirma la placa', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { message: 'La ubicación cambió' }, data: null } as never);
    await expect(movePlate(plate, 3, 4)).rejects.toThrow('La ubicación cambió');
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: null } as never);
    await expect(movePlate(plate, 3, 4)).rejects.toThrow('confirmar');
    expect(invalidatePlacasCache).not.toHaveBeenCalled();
  });
  it('explica que falta habilitar la función sin recurrir a escrituras parciales', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { code: 'PGRST202' }, data: null } as never);
    await expect(movePlate(plate, 3, 4)).rejects.toThrow('no está habilitada');
    expect(invalidatePlacasCache).not.toHaveBeenCalled();
  });
});
