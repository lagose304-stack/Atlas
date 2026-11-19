import { describe, expect, it, vi } from 'vitest';
import { createEmptyCanvasDoc, createNestedCanvasNode, createPlacedBlock } from '../domain/defaults';
import {
  Editor2ApiError,
  createEditor2Api,
  type Editor2RpcClient,
} from './editor2Api';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CANVAS_ID = '22222222-2222-4222-8222-222222222222';
const VERSION_ID = '33333333-3333-4333-8333-333333333333';
const ISO = '2026-11-18T19:00:00.000Z';

function sampleDoc(pageKey = 'home') {
  return createEmptyCanvasDoc(pageKey, {
    id: ROOT_ID,
    children: [createPlacedBlock(createNestedCanvasNode({ id: CANVAS_ID }))],
  });
}

function makeMockClient(
  handler: (fn: string, params?: Record<string, unknown>) => { data: unknown; error: { code?: string; message?: string } | null },
): { client: Editor2RpcClient; rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn(async (fn: string, params?: Record<string, unknown>) => handler(fn, params));
  return { client: { rpc }, rpc };
}

describe('editor2Api', () => {
  it('lista páginas del índice v2 y valida el contrato con Zod', async () => {
    const { client, rpc } = makeMockClient(() => ({
      data: [
        {
          pageKey: 'home',
          title: 'Inicio',
          section: 'Inicio',
          publicPath: '/',
          description: 'Portada',
          keywords: ['portada'],
          kind: 'fixed',
          parentPageKey: null,
          parcial: null,
          sortOrder: 0,
          enabled: true,
          hasDraft: true,
          draftUpdatedAt: ISO,
          publishedVersionId: VERSION_ID,
          publishedVersionNumber: 1,
          publishedAt: ISO,
        },
      ],
      error: null,
    }));

    const api = createEditor2Api(client);
    const pages = await api.listPages();

    expect(rpc).toHaveBeenCalledWith('editor2_list_pages', undefined);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageKey).toBe('home');
    expect(pages[0].publishedVersionNumber).toBe(1);
  });

  it('guarda borrador tras validar doc y pageKey', async () => {
    const doc = sampleDoc('tema-1');
    const { client, rpc } = makeMockClient((_fn, params) => ({
      data: {
        pageKey: params?.p_page_key,
        doc: params?.p_doc,
        baseVersionId: null,
        actorId: 7,
        updatedAt: ISO,
      },
      error: null,
    }));

    const api = createEditor2Api(client);
    const saved = await api.saveDraft('tema-1', doc);

    expect(rpc).toHaveBeenCalledWith('editor2_save_draft', {
      p_page_key: 'tema-1',
      p_doc: doc,
      p_base_version_id: null,
    });
    expect(saved.doc).toEqual(doc);
    expect(saved.actorId).toBe(7);
  });

  it('rechaza antes de llamar a RPC si el documento tiene schemaVersion desconocida o pageKey distinto', async () => {
    const { client, rpc } = makeMockClient(() => ({ data: null, error: null }));
    const api = createEditor2Api(client);

    await expect(
      api.saveDraft('home', { ...sampleDoc('home'), schemaVersion: 99 } as never),
    ).rejects.toMatchObject({ name: 'Editor2ApiError', code: 'validation' });

    await expect(api.saveDraft('home', sampleDoc('tema-2'))).rejects.toMatchObject({
      name: 'Editor2ApiError',
      code: 'validation',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('carga workspace, crea versión y publica borrador atómicamente', async () => {
    const doc = sampleDoc('home');
    const { client } = makeMockClient((fn) => {
      if (fn === 'editor2_get_workspace') {
        return {
          data: {
            pageKey: 'home',
            draft: { pageKey: 'home', doc, baseVersionId: null, actorId: 1, updatedAt: ISO },
            versions: [],
            publication: null,
          },
          error: null,
        };
      }
      if (fn === 'editor2_create_version') {
        return {
          data: {
            id: VERSION_ID,
            pageKey: 'home',
            versionNumber: 1,
            label: 'Revisión inicial',
            source: 'draft',
            actorId: 1,
            createdAt: ISO,
            isPublished: false,
          },
          error: null,
        };
      }
      if (fn === 'editor2_publish_draft') {
        return {
          data: {
            pageKey: 'home',
            versionId: VERSION_ID,
            versionNumber: 2,
            label: 'Publicación 1',
            actorId: 1,
            publishedAt: ISO,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const api = createEditor2Api(client);
    const ws = await api.getWorkspace('home');
    expect(ws.draft?.doc).toEqual(doc);
    expect(ws.publication).toBeNull();

    const ver = await api.createVersion('home', { label: 'Revisión inicial' });
    expect(ver.versionNumber).toBe(1);
    expect(ver.isPublished).toBe(false);

    const pub = await api.publishDraft('home', 'Publicación 1');
    expect(pub.versionNumber).toBe(2);
  });

  it('distingue error de sesión inválida y conflicto al intentar borrar la versión publicada', async () => {
    const { client: unauthClient } = makeMockClient(() => ({
      data: null,
      error: { code: '28000', message: 'editor2_unauthorized: sesión de Atlas inválida' },
    }));
    await expect(createEditor2Api(unauthClient).listPages()).rejects.toBeInstanceOf(Editor2ApiError);
    await expect(createEditor2Api(unauthClient).listPages()).rejects.toMatchObject({ code: 'unauthorized' });

    const { client: conflictClient } = makeMockClient(() => ({
      data: null,
      error: { code: '23503', message: 'editor2_conflict: no se puede eliminar la versión publicada activa' },
    }));
    await expect(createEditor2Api(conflictClient).deleteVersion('home', VERSION_ID)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('devuelve null en getPublicDoc cuando no hay publicación (sin fallback a borrador)', async () => {
    const { client, rpc } = makeMockClient(() => ({ data: null, error: null }));
    const api = createEditor2Api(client);

    const publicDoc = await api.getPublicDoc('home');
    expect(rpc).toHaveBeenCalledWith('editor2_get_public_doc', { p_page_key: 'home' });
    expect(publicDoc).toBeNull();
  });

  it('devuelve el documento publicado validado en getPublicDoc cuando existe publicación', async () => {
    const doc = sampleDoc('home');
    const { client } = makeMockClient(() => ({
      data: {
        pageKey: 'home',
        versionId: VERSION_ID,
        versionNumber: 3,
        publishedAt: ISO,
        doc,
      },
      error: null,
    }));

    const api = createEditor2Api(client);
    const publicDoc = await api.getPublicDoc('home');
    expect(publicDoc?.versionId).toBe(VERSION_ID);
    expect(publicDoc?.doc).toEqual(doc);
  });
});
