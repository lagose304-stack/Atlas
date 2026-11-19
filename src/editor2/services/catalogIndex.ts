import { z } from 'zod';
import { supabase } from '../../services/supabase';

// Fuente de navegación del 2.0: solo lectura del catálogo compartido.
// No importa servicios del editor actual ni toca contenido, borradores ni versiones.
const temaSchema = z.strictObject({
  id: z.number().int().positive(),
  nombre: z.string().min(1),
  parcial: z.string(),
  sort_order: z.number().int().nullable().optional(),
});

const subtemaSchema = z.strictObject({
  id: z.number().int().positive(),
  nombre: z.string().min(1),
  tema_id: z.number().int().positive(),
  sort_order: z.number().int().nullable().optional(),
});

const catalogSchema = z.strictObject({
  temas: z.array(temaSchema),
  subtemas: z.array(subtemaSchema),
});

export type Editor2CatalogTema = z.infer<typeof temaSchema>;
export type Editor2CatalogSubtema = z.infer<typeof subtemaSchema>;
export type Editor2CatalogSnapshot = z.infer<typeof catalogSchema>;

export async function loadCatalog(): Promise<Editor2CatalogSnapshot> {
  const [temasResult, subtemasResult] = await Promise.all([
    supabase
      .from('temas')
      .select('id, nombre, parcial, sort_order')
      .order('parcial')
      .order('sort_order', { ascending: true }),
    supabase
      .from('subtemas')
      .select('id, nombre, tema_id, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  if (temasResult.error) throw new Error('No se pudo cargar el catálogo de temas.');
  if (subtemasResult.error) throw new Error('No se pudo cargar el catálogo de subtemas.');

  return catalogSchema.parse({
    temas: temasResult.data ?? [],
    subtemas: subtemasResult.data ?? [],
  });
}
