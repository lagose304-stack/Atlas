import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  listPageVersions,
  createPageVersion,
  publishPageVersion,
  deletePageVersion,
} from './pageVersionsService';
import { supabase } from './supabase';

vi.mock('./supabase', () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

describe('pageVersionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista versiones correctamente ordenadas con campos mapeados', async () => {
    const mockRows = [
      {
        id: 1,
        entity_type: 'placas_page',
        entity_id: 156,
        version_name: 'Versión Oficial 1.0',
        description: 'Primera versión publicada',
        is_published: true,
        blocks: [{ id: 'b1', block_type: 'heading', content: { text: 'Título' } }],
        blocks_count: 1,
        created_by_name: 'Dr. García',
        updated_by_name: 'Dr. García',
        published_at: '2026-08-20T10:00:00Z',
        created_at: '2026-08-20T09:00:00Z',
        updated_at: '2026-08-20T10:00:00Z',
      },
    ];

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(function (this: unknown) {
        return {
          order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
        };
      }),
    });

    const result = await listPageVersions('placas_page', 156);
    expect(result).toHaveLength(1);
    expect(result[0].version_name).toBe('Versión Oficial 1.0');
    expect(result[0].is_published).toBe(true);
    expect(result[0].blocks_count).toBe(1);
  });

  it('crea una nueva versión desde plantilla con autoría', async () => {
    const mockCreated = {
      id: 2,
      entity_type: 'placas_page',
      entity_id: 156,
      version_name: 'Versión 2.0 Borrador',
      description: 'Copia con ajustes',
      is_published: false,
      blocks: [{ id: 'b1', block_type: 'heading', content: { text: 'Título' } }],
      blocks_count: 1,
      created_by_name: 'Prof. Martínez',
      updated_by_name: 'Prof. Martínez',
      created_at: '2026-08-20T12:00:00Z',
      updated_at: '2026-08-20T12:00:00Z',
    };

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
    });

    const result = await createPageVersion({
      entityType: 'placas_page',
      entityId: 156,
      versionName: 'Versión 2.0 Borrador',
      description: 'Copia con ajustes',
      sourceBlocks: [{ id: 'b1', entity_type: 'placas_page', entity_id: 156, block_type: 'heading', sort_order: 0, content: { text: 'Título' } }],
      user: { id: 5, nombre: 'Prof. Martínez', username: 'martinez' },
    });

    expect(result.version_name).toBe('Versión 2.0 Borrador');
    expect(result.is_published).toBe(false);
    expect(result.created_by_name).toBe('Prof. Martínez');
  });

  it('publica una versión llamando al RPC de supabase', async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });

    await publishPageVersion(2, { id: 5, nombre: 'Prof. Martínez', username: 'martinez' });
    expect(supabase.rpc).toHaveBeenCalledWith('publish_page_version', {
      p_version_id: 2,
      p_user_id: '5',
      p_user_name: 'Prof. Martínez',
    });
  });

  it('elimina una versión llamando al delete de supabase', async () => {
    const deleteMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      delete: deleteMock,
      eq: eqMock,
    });

    await deletePageVersion(2);
    expect(supabase.from).toHaveBeenCalledWith('content_page_versions');
  });
});
