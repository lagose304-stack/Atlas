import { describe, it, expect, vi } from 'vitest';
import { collectReferences, compareReferences, listObjects, checkHttpReferences, MEDIA_SOURCES } from '../../scripts/lib/media-audit.mjs';

const domain = 'https://r2.atlas-tests.invalid';

describe('Auditorías multimedia sin escrituras', () => {
  it('recorre todas las páginas incluso si el servidor limita la cantidad devuelta', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, content: { nested: [{ image_url: `${domain}/atlas-content/${i}.webp` }] } }));
    const range = vi.fn(async (start, end) => ({ data: rows.slice(start, Math.min(end + 1, start + 2)), count: 5, error: null }));
    const query = { select: vi.fn(), order: vi.fn(), range };
    query.select.mockReturnValue(query); query.order.mockReturnValue(query);
    const result = await collectReferences({ from: () => query }, [{ table: 'content_blocks', id: 'id', column: 'content' }], 250);
    expect(result.complete).toBe(true);
    expect(result.references).toHaveLength(5);
    expect(range).toHaveBeenCalledTimes(3);
    expect(query.select).toHaveBeenCalledWith('id, content', { count: 'exact' });
  });

  it.each([
    { data: null, count: null, error: { code: '42703' } },
    { data: [], count: 12, error: null },
    { data: [], count: null, error: null },
  ])('marca la auditoría como incompleta ante errores o filas no leídas', async response => {
    const query = { select() { return this; }, order() { return this; }, range: async () => response };
    const result = await collectReferences({ from: () => query }, [{ table: 'content_blocks', id: 'id', column: 'content' }]);
    expect(result.complete).toBe(false);
    expect(result.coverage[0].complete).toBe(false);
  });

  it('incluye publicación, versiones, lista de espera, preguntas, créditos y mapas con columnas vigentes', () => {
    expect(MEDIA_SOURCES).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'content_blocks', column: 'content' }),
      expect.objectContaining({ table: 'content_page_publications', column: 'published_blocks' }),
      expect.objectContaining({ table: 'content_page_versions', column: 'blocks' }),
      expect.objectContaining({ table: 'content_block_versions', column: 'blocks' }),
      expect.objectContaining({ table: 'credit_profiles', id: 'profile_key' }),
      expect.objectContaining({ table: 'prueba_preguntas', column: 'reference_photo_url' }),
      expect.objectContaining({ table: 'placas_sin_clasificar' }),
      expect.objectContaining({ table: 'interactive_maps', column: 'placa_id' }),
    ]));
  });

  it('detecta objetos vacíos y miniaturas ausentes sin confundir enlaces de navegación', () => {
    const refs = ['placas/a.webp?v=10', 'placas/b.webp', 'placas/c.webp'].map(key => ({ url: `${domain}/${key}` }));
    refs.push({ url: 'https://example.com/temario' });
    const objects = new Map([['placas/a.webp', 100], ['placas/a_thumb.webp', 0], ['placas/b.webp', 0]]);
    const result = compareReferences(refs, objects, domain);
    expect(result.map(item => item.status)).toEqual(['available', 'empty_object', 'missing', 'external_or_navigation']);
    expect(result[0].thumbnailStatus).toBe('empty_object');
    expect(result[1].thumbnailStatus).toBe('missing');
  });

  it('resuelve enlaces históricos al objeto de R2 y decodifica sus claves una sola vez', () => {
    const refs = [
      { url: 'https://res.cloudinary.com/legacy/image/upload/v123/atlas-content/a.jpg' },
      { url: `${domain}/atlas-content/corte%2520original.webp` },
    ];
    const results = compareReferences(refs, new Map([['atlas-content/a.webp', 100], ['atlas-content/corte%20original.webp', 100]]), domain);
    expect(results.every(row => row.status === 'available')).toBe(true);
    expect(results[0].legacy).toBe(true);
  });

  it('pagina el inventario de R2 y detecta truncamientos sin continuación válida', async () => {
    class Command { constructor(input) { this.input = input; } }
    const send = vi.fn().mockResolvedValueOnce({ Contents: [{ Key: 'a', Size: 10 }], IsTruncated: true, NextContinuationToken: 'next' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'b', Size: 0 }], IsTruncated: false });
    expect([...await listObjects(send, Command, 'isolated-test')]).toEqual([['a', 10], ['b', 0]]);
    expect(send.mock.calls[1][0].input.ContinuationToken).toBe('next');
    await expect(listObjects(async () => ({ IsTruncated: true }), Command, 'isolated-test')).rejects.toThrow('incompleto');
  });

  it('HTTP verifica únicamente almacenamiento conocido, sin seguir redirecciones ni consultar enlaces externos', async () => {
    const fetchImage = vi.fn().mockResolvedValue({ status: 200, headers: new Headers({ 'content-type': 'text/html' }) });
    const results = await checkHttpReferences([{ url: `${domain}/placas/a.webp` }, { url: 'http://localhost/private' }], domain, fetchImage);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage.mock.calls[0][1]).toMatchObject({ method: 'HEAD', redirect: 'manual' });
    expect(results[0].status).toBe('failed');
  });
});
