import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import {
  getCachedTemas,
  getCachedSubtemas,
  getQuickTemas,
  getQuickSubtemas,
  invalidateCatalogCache,
} from './catalogService';

describe('catalogService', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => store.set(key, val),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
      },
      writable: true,
    });

    invalidateCatalogCache();
    supabaseMock.from.mockReset();
  });

  it('obtiene temas desde supabase y los guarda en caché', async () => {
    const mockTemas = [
      { id: 1, nombre: 'Tejido Epitelial', parcial: 'primer', sort_order: 0 },
      { id: 2, nombre: 'Tejido Conectivo', parcial: 'primer', sort_order: 1 },
    ];

    const order2 = vi.fn().mockResolvedValue({ data: mockTemas, error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    supabaseMock.from.mockReturnValue({ select });

    const temas = await getCachedTemas();

    expect(temas).toEqual(mockTemas);
    expect(supabaseMock.from).toHaveBeenCalledWith('temas');

    // Segunda llamada debe salir de la memoria sin consultar Supabase de nuevo
    supabaseMock.from.mockClear();
    const temasCached = await getCachedTemas();
    expect(temasCached).toEqual(mockTemas);
    expect(supabaseMock.from).not.toHaveBeenCalled();

    // getQuickTemas sincrónico debe entregar los mismos datos a 0 ms
    expect(getQuickTemas()).toEqual(mockTemas);
  });

  it('deduplica peticiones en vuelo concurrentes de temas', async () => {
    const mockTemas = [{ id: 1, nombre: 'Epitelial', parcial: 'primer', sort_order: 0 }];

    let resolvePromise: (val: unknown) => void;
    const pendingPromise = new Promise((res) => {
      resolvePromise = res;
    });

    const order2 = vi.fn().mockReturnValue(pendingPromise);
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    supabaseMock.from.mockReturnValue({ select });

    // Disparamos 3 llamadas concurrentes
    const p1 = getCachedTemas();
    const p2 = getCachedTemas();
    const p3 = getCachedTemas();

    // Solo se debe llamar a supabase.from una única vez
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);

    resolvePromise!({ data: mockTemas, error: null });

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
    expect(res1).toEqual(mockTemas);
    expect(res2).toEqual(mockTemas);
    expect(res3).toEqual(mockTemas);
  });

  it('obtiene y filtra subtemas por tema_id', async () => {
    const mockSubtemas = [
      { id: 10, nombre: 'Plano simple', tema_id: 1, sort_order: 0 },
      { id: 11, nombre: 'Cúbico simple', tema_id: 1, sort_order: 1 },
      { id: 20, nombre: 'Laxo', tema_id: 2, sort_order: 0 },
    ];

    const order = vi.fn().mockResolvedValue({ data: mockSubtemas, error: null });
    const select = vi.fn().mockReturnValue({ order });
    supabaseMock.from.mockReturnValue({ select });

    const subtemasTema1 = await getCachedSubtemas(1);
    expect(subtemasTema1).toHaveLength(2);
    expect(subtemasTema1[0].nombre).toBe('Plano simple');

    // Filtrado sincrónico
    expect(getQuickSubtemas(2)).toEqual([mockSubtemas[2]]);
  });

  it('invalida la caché correctamente', async () => {
    const mockTemas = [{ id: 1, nombre: 'Epitelial', parcial: 'primer', sort_order: 0 }];
    const order2 = vi.fn().mockResolvedValue({ data: mockTemas, error: null });
    const order1 = vi.fn().mockReturnValue({ order: order2 });
    const select = vi.fn().mockReturnValue({ order: order1 });
    supabaseMock.from.mockReturnValue({ select });

    await getCachedTemas();
    expect(getQuickTemas()).toEqual(mockTemas);

    invalidateCatalogCache();
    expect(getQuickTemas()).toBeNull();
  });
});
