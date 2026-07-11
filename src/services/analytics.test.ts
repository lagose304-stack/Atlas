import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import { fetchTotalSiteViews } from './analytics';

describe('contador público de visualizaciones', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockReset();
  });

  it('obtiene solamente el total mediante la RPC pública', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 1842, error: null });

    await expect(fetchTotalSiteViews()).resolves.toBe(1842);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('atlas_get_total_site_views');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('normaliza respuestas inválidas sin mostrar valores incorrectos', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'valor-invalido', error: null });

    await expect(fetchTotalSiteViews()).resolves.toBe(0);
  });

  it('mantiene compatibilidad con la consulta anterior para un administrador', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC no instalada' } });
    const eq = vi.fn().mockResolvedValue({ count: 25, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    supabaseMock.from.mockReturnValue({ select });

    await expect(fetchTotalSiteViews()).resolves.toBe(25);
  });
});
