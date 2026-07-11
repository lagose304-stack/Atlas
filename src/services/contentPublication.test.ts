import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import { getRenderableBlocks } from './contentPublication';

const publicationBlock = {
  id: '11111111-1111-1111-1111-111111111111',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'heading',
  sort_order: 0,
  content: { text: 'Última versión publicada' },
};

describe('separación entre borrador y publicación', () => {
  beforeEach(() => supabaseMock.from.mockReset());

  it('muestra el último snapshot aunque la página esté nuevamente en borrador', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { status: 'draft', published_blocks: [publicationBlock], published_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    const eqEntityId = vi.fn().mockReturnValue({ maybeSingle });
    const eqEntityType = vi.fn().mockReturnValue({ eq: eqEntityId });
    const select = vi.fn().mockReturnValue({ eq: eqEntityType });
    supabaseMock.from.mockReturnValue({ select });

    const blocks = await getRenderableBlocks('home_page', 0);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content.text).toBe('Última versión publicada');
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it('conserva temporalmente la lectura legada cuando aún no existe fila de publicación', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const publicationSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });
    const order = vi.fn().mockResolvedValue({ data: [publicationBlock], error: null });
    const draftSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }),
    });
    supabaseMock.from
      .mockReturnValueOnce({ select: publicationSelect })
      .mockReturnValueOnce({ select: draftSelect });

    const blocks = await getRenderableBlocks('home_page', 0);
    expect(blocks).toHaveLength(1);
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });
});
