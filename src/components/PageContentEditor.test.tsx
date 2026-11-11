import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageContentEditor, { type PageContentEditorHandle } from './PageContentEditor';
import type { ContentBlock } from '../types/contentBlocks';
import type { PageVersionRow } from '../services/pageVersionsService';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), upsert: vi.fn(), remove: vi.fn(),
  deleteImage: vi.fn(), saveVersion: vi.fn(), setDraft: vi.fn(),
  publication: vi.fn(),
}));
vi.mock('../services/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../services/cloudinary', () => ({
  uploadToCloudinary: vi.fn(), deleteFromCloudinary: mocks.deleteImage,
  getCloudinaryPublicId: (url: string) => url.replace(/^https?:\/\/[^/]+\//, ''),
}));
vi.mock('../services/pageVersionsService', () => ({ savePageVersionBlocks: mocks.saveVersion }));
vi.mock('../services/contentPublication', () => ({ getPublicationInfo: mocks.publication, setPublicationDraft: mocks.setDraft }));
vi.mock('./ContentBlockRenderer', () => ({ default: () => null }));
vi.mock('./page-editor/SpanishEditorShortcuts', () => ({ default: () => null }));
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }));

const oldUrl = 'https://r2.atlas-tests.invalid/atlas-content/imagen-publicada.webp';
const newUrl = 'https://r2.atlas-tests.invalid/atlas-content/imagen-nueva.webp';
const block: ContentBlock = {
  id: 'image-block', entity_type: 'home_page', entity_id: 0,
  block_type: 'image', sort_order: 0, content: { url: oldUrl },
};

describe('Conservación de archivos al guardar páginas', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    mocks.upsert.mockReset().mockResolvedValue({ error: null });
    mocks.remove.mockReset().mockResolvedValue({ error: null });
    mocks.deleteImage.mockReset();
    mocks.saveVersion.mockReset().mockResolvedValue(undefined);
    mocks.setDraft.mockReset().mockResolvedValue(undefined);
    mocks.publication.mockReset().mockResolvedValue({ status: 'published', blocks: [block] });
    mocks.from.mockReset().mockImplementation((table: string) => {
      const query = {
        select: vi.fn(), eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: table === 'content_blocks' ? [block] : [], error: null }),
        upsert: mocks.upsert,
        delete: () => ({ in: mocks.remove }),
        // La antigua limpieza solo veía los bloques actuales, ya modificados.
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  async function mountEditor(activeVersion?: PageVersionRow) {
    const ref = createRef<PageContentEditorHandle>();
    const onBlocksChange = vi.fn();
    render(<PageContentEditor ref={ref} entityType="home_page" entityId={0} activeVersion={activeVersion} autoSave={false} onBlocksChange={onBlocksChange} />);
    await waitFor(() => expect(onBlocksChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: block.id })]));
    return ref;
  }

  it('reemplaza una imagen del borrador sin borrar el archivo del snapshot publicado', async () => {
    const snapshot = structuredClone(block);
    const ref = await mountEditor();
    act(() => ref.current!.updateBlock(block.id, { url: newUrl }));
    let saved;
    await act(async () => { saved = await ref.current!.saveChanges(); });
    expect(saved).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ content: expect.objectContaining({ url: newUrl }) })]);
    expect(mocks.deleteImage).not.toHaveBeenCalled();
    expect(block).toEqual(snapshot);
    expect(mocks.setDraft).toHaveBeenCalledWith('home_page', 0);
  });

  it('espera el guardado en curso y guarda las ediciones nuevas antes de completar la salida', async () => {
    const ref = await mountEditor();
    let finish!: (result: { error: null }) => void;
    mocks.upsert.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    act(() => ref.current!.updateBlock(block.id, { url: newUrl }));
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = ref.current!.saveChanges();
      second = ref.current!.saveChanges();
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const latestUrl = 'https://r2.atlas-tests.invalid/atlas-content/ultima-imagen.webp';
    act(() => ref.current!.updateBlock(block.id, { url: latestUrl }));
    await act(async () => {
      finish({ error: null });
      expect(await first).toBe(true);
      expect(await second).toBe(true);
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenLastCalledWith([expect.objectContaining({ content: expect.objectContaining({ url: latestUrl }) })]);
  });

  it('elimina el bloque del borrador conservando su archivo para versiones anteriores', async () => {
    const ref = await mountEditor();
    act(() => ref.current!.requestDeleteBlock(block.id));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar bloque' }));
    await act(async () => { expect(await ref.current!.saveChanges()).toBe(true); });
    expect(mocks.remove).toHaveBeenCalledWith('id', [block.id]);
    expect(mocks.deleteImage).not.toHaveBeenCalled();
    expect(block.content.url).toBe(oldUrl);
  });

  it('no borra imágenes cuando falla el guardado del borrador', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: new Error('Fallo simulado') });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const ref = await mountEditor();
      act(() => ref.current!.updateBlock(block.id, { url: newUrl }));
      await act(async () => { expect(await ref.current!.saveChanges()).toBe(false); });
      expect(mocks.deleteImage).not.toHaveBeenCalled();
      expect(mocks.setDraft).not.toHaveBeenCalled();

    } finally { log.mockRestore(); }
  });

  it.each([false, true])('conserva archivos al guardar una versión (fallo: %s)', async fails => {
    const version: PageVersionRow = {
      id: 12, entity_type: 'home_page', entity_id: 0, version_name: 'Versión de prueba',
      blocks: [structuredClone(block)], blocks_count: 1, description: null, is_published: false,
      created_by: null, created_by_name: null, updated_by: null, updated_by_name: null,
      published_at: null, created_at: '2026-10-30', updated_at: '2026-10-30',
    };
    if (fails) mocks.saveVersion.mockRejectedValueOnce(new Error('Fallo simulado de versión'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const ref = await mountEditor(version);
      act(() => ref.current!.updateBlock(block.id, { url: newUrl }));
      await act(async () => { expect(await ref.current!.saveChanges()).toBe(!fails); });
      expect(mocks.saveVersion).toHaveBeenCalledWith(12, [expect.objectContaining({ content: expect.objectContaining({ url: newUrl }) })]);
      expect(mocks.deleteImage).not.toHaveBeenCalled();
      expect(mocks.setDraft).not.toHaveBeenCalled();
      if (fails) {
        expect(version.blocks[0].content.url).toBe(oldUrl);
        await act(async () => { expect(await ref.current!.saveChanges()).toBe(true); });
        expect(mocks.saveVersion).toHaveBeenCalledTimes(2);
        expect(version.blocks[0].content.url).toBe(newUrl);
      }
    } finally { log.mockRestore(); }
  });
});
