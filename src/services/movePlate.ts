import { supabase } from './supabase';
import { invalidatePlacasCache } from './catalogService';

export type PlateLocation = { id: number; tema_id: number; subtema_id: number };
export async function movePlate(plate: PlateLocation, temaId: number, subtemaId: number) {
  if (![plate.id, plate.tema_id, plate.subtema_id, temaId, subtemaId].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Selecciona una placa y un destino válido.');
  if (plate.tema_id === temaId && plate.subtema_id === subtemaId) throw new Error('Selecciona una ubicación diferente.');
  const { data, error } = await supabase.rpc('atlas_move_plate', {
    p_placa_id: plate.id, p_from_tema_id: plate.tema_id, p_from_subtema_id: plate.subtema_id,
    p_tema_id: temaId, p_subtema_id: subtemaId,
  });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('La función de movimiento todavía no está habilitada en el servidor.');
    throw new Error(error.message || 'No se pudo mover la placa.');
  }
  if (!data || data.id !== plate.id || data.tema_id !== temaId || data.subtema_id !== subtemaId) throw new Error('No se pudo confirmar el movimiento. Actualiza el listado antes de reintentar.');
  invalidatePlacasCache(plate.subtema_id);
  invalidatePlacasCache(subtemaId);
  return data as PlateLocation & { map_id: number | null; map_number: number | null };
}
