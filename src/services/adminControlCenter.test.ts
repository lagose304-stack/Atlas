import { describe, expect, it, vi } from 'vitest';
import { getStorageInventory } from './adminControlCenter';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }));

describe('Inventario del centro de mantenimiento', () => {
  it('lee la imagen de los mapas desde su placa, sin consultar una columna inexistente', async () => {
    const url = 'https://r2.atlas-tests.invalid/placas/a.webp';
    const select = vi.fn();
    mocks.from.mockImplementation((table: string) => ({ select: (columns: string) => {
      select(table, columns);
      return Promise.resolve({ error: null, data: table === 'placas' ? [{ photo_url: url }]
        : table === 'interactive_maps' ? [{ plate: { photo_url: url } }, { plate: null }] : [] });
    } }));
    const result = await getStorageInventory();
    expect(select).toHaveBeenCalledWith('interactive_maps', 'id, plate:placas(photo_url)');
    expect(result).toMatchObject({ referencedImages: 2, uniqueImages: 1, duplicateReferences: 1, queryErrors: 0 });
  });
});
