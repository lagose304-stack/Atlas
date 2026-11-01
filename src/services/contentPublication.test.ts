import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: supabaseMock }));

import {
  clearRenderableBlocksCache,
  getCachedRenderableBlocks,
  getRenderableBlocks,
  publishBlocksSnapshot,
  setPublicationDraft,
  type PublicationBlock,
} from './contentPublication';

const publicationBlock = {
  id: '11111111-1111-1111-1111-111111111111',
  entity_type: 'home_page',
  entity_id: 0,
  block_type: 'heading',
  sort_order: 0,
  content: { text: 'Última versión publicada' },
};

describe('separación entre borrador y publicación', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    clearRenderableBlocksCache();
  });

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

  it('reutiliza la caché en memoria para llamadas sucesivas', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { status: 'published', published_blocks: [publicationBlock], published_at: '2026-01-01T00:00:00Z' },
      error: null,
    });
    const eqEntityId = vi.fn().mockReturnValue({ maybeSingle });
    const eqEntityType = vi.fn().mockReturnValue({ eq: eqEntityId });
    const select = vi.fn().mockReturnValue({ eq: eqEntityType });
    supabaseMock.from.mockReturnValue({ select });

    const first = await getRenderableBlocks('home_page', 0);
    const second = await getRenderableBlocks('home_page', 0);

    expect(first).toEqual(second);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it('conserva la publicación durante la edición y muestra la nueva al publicar, sin usar caché antigua', async () => {
    // Simulación de la fila persistida: un upsert parcial conserva el snapshot anterior.
    let row: Record<string, unknown> = {
      status: 'published', published_blocks: [publicationBlock], published_at: '2026-01-01T00:00:00Z',
    };
    const maybeSingle = vi.fn(async () => ({ data: { ...row }, error: null }));
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle };
    const upsert = vi.fn(async (payload: Record<string, unknown>) => {
      row = { ...row, ...payload };
      return { error: null };
    });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'content_page_publications') throw new Error(`Lectura inesperada de ${table}`);
      return { select: vi.fn(() => query), upsert };
    });
    const editedBlock: PublicationBlock = {
      ...publicationBlock, entity_type: 'home_page', block_type: 'heading',
      content: { text: 'Contenido nuevo de prueba' },
    };

    expect((await getRenderableBlocks('home_page', 0))[0].content.text).toBe('Última versión publicada');
    await setPublicationDraft('home_page', 0);
    expect(row.status).toBe('draft');
    expect(getCachedRenderableBlocks('home_page', 0)).toBeNull();
    expect((await getRenderableBlocks('home_page', 0))[0].content.text).toBe('Última versión publicada');

    await publishBlocksSnapshot('home_page', 0, [editedBlock]);
    expect(row.status).toBe('published');
    expect(getCachedRenderableBlocks('home_page', 0)).toBeNull();
    expect((await getRenderableBlocks('home_page', 0))[0].content.text).toBe('Contenido nuevo de prueba');
    expect(maybeSingle).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      entity_type: 'home_page', entity_id: 0, status: 'draft',
    }, { onConflict: 'entity_type,entity_id' });
    expect(publicationBlock.content.text).toBe('Última versión publicada');
  });

  it('informa un fallo de publicación y conserva el contenido público en caché', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { status: 'published', published_blocks: [publicationBlock] }, error: null,
    });
    const query = { eq: vi.fn().mockReturnThis(), maybeSingle };
    const failure = { message: 'No se pudo guardar la publicación' };
    supabaseMock.from.mockReturnValue({
      select: vi.fn(() => query), upsert: vi.fn().mockResolvedValue({ error: failure }),
    });
    const previous = await getRenderableBlocks('home_page', 0);

    await expect(publishBlocksSnapshot('home_page', 0, [])).rejects.toEqual(failure);
    expect(getCachedRenderableBlocks('home_page', 0)).toEqual(previous);
    expect(await getRenderableBlocks('home_page', 0)).toEqual(previous);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('respeta una publicación vacía sin recuperar bloques antiguos del borrador', async () => {
    const query = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { status: 'published', published_blocks: [] }, error: null,
      }),
    };
    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'content_page_publications') throw new Error('No debe consultar el borrador');
      return { select: vi.fn(() => query) };
    });

    expect(await getRenderableBlocks('home_page', 0)).toEqual([]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });
});

