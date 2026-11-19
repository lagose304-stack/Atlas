import { withPageSections } from '../domain/defaults';
import { create } from 'zustand';
import {
  canvasDocSchema,
  type BlockStyle,
  type CanvasDoc,
  type HeadingBlock,
  type ImageBlock,
  type LayoutIntent,
  type NestedCanvasNode,
  type PageTheme,
  type PlacedBlock,
  type RootCanvasNode,
  type TextBlock,
} from '../domain/schema';
import {
  editor2Api,
  type Editor2PublicationRecord,
  type Editor2VersionSummary,
} from '../services/editor2Api';
import { invalidatePublicDocCache } from '../public/publicDocCache';

export const EDITOR2_HISTORY_LIMIT = 100;

export type Editor2SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Editor2ApiLike = Pick<
  typeof editor2Api,
  'saveDraft' | 'createVersion' | 'publishDraft' | 'publishVersion' | 'deleteVersion' | 'getWorkspace'
> & {
  unpublishPage?: (typeof editor2Api)['unpublishPage'];
};

let sharedSavePromise: Promise<boolean> | null = null;

type MutableCanvas = Omit<NestedCanvasNode, 'slots'> & { slots: { children: AnyPlaced[] } };
type AnyBlockLike = HeadingBlock | TextBlock | ImageBlock | MutableCanvas;
type AnyPlaced = { block: AnyBlockLike; layout: LayoutIntent };
type ParentRef = string | null;

interface Editor2State {
  doc: CanvasDoc | null;
  selection: string | null;
  dirty: boolean;
  saveState: Editor2SaveState;
  lastError: string | null;
  history: CanvasDoc[];
  future: CanvasDoc[];
  puckRevision: number;
  versions: Editor2VersionSummary[];
  publication: Editor2PublicationRecord | null;
  baseVersionId: string | null;
  lastSavedAt: string | null;
  publishing: boolean;
  copiedStyle: BlockStyle | null;

  setDoc: (doc: CanvasDoc) => void;
  setPageTheme: (theme: PageTheme | undefined) => void;
  appendSection: (section: PlacedBlock) => void;
  copyBlockStyle: (style: BlockStyle | null) => void;
  applyDoc: (doc: CanvasDoc) => void;
  setWorkspaceMeta: (meta: {
    versions: Editor2VersionSummary[];
    publication: Editor2PublicationRecord | null;
    baseVersionId?: string | null;
    updatedAt?: string | null;
  }) => void;
  selectBlock: (id: string | null) => void;
  updateBlock: (id: string, updater: (block: AnyBlockLike) => AnyBlockLike) => void;
  updateLayout: (id: string, updater: (layout: LayoutIntent) => LayoutIntent) => void;
  insertBlock: (block: PlacedBlock, parentId?: ParentRef) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, targetIndex: number, parentId?: ParentRef) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: (message: string) => void;
  saveDraftNow: (api?: Editor2ApiLike) => Promise<boolean>;
  createVersionNow: (label?: string, api?: Editor2ApiLike) => Promise<Editor2VersionSummary | null>;
  publishDraftNow: (label?: string, api?: Editor2ApiLike) => Promise<Editor2PublicationRecord | null>;
  publishVersionNow: (versionId: string, api?: Editor2ApiLike) => Promise<Editor2PublicationRecord | null>;
  unpublishNow: (api?: Editor2ApiLike) => Promise<boolean>;
  deleteVersionNow: (versionId: string, api?: Editor2ApiLike) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  doc: null,
  selection: null,
  dirty: false,
  saveState: 'idle' as Editor2SaveState,
  lastError: null,
  history: [] as CanvasDoc[],
  future: [] as CanvasDoc[],
  puckRevision: 0,
  versions: [] as Editor2VersionSummary[],
  publication: null as Editor2PublicationRecord | null,
  baseVersionId: null as string | null,
  lastSavedAt: null as string | null,
  publishing: false,
  copiedStyle: null as BlockStyle | null,
};

function isCanvas(block: AnyBlockLike): block is MutableCanvas {
  return block.type === 'canvas' || (block as { type: string }).type === 'box';
}

function childrenOf(node: RootCanvasNode | MutableCanvas): AnyPlaced[] {
  return node.slots.children as AnyPlaced[];
}

function mapChildren(children: AnyPlaced[], transform: (item: AnyPlaced) => AnyPlaced): AnyPlaced[] {
  return children.map((item) => {
    const nextItem = isCanvas(item.block)
      ? {
          ...item,
          block: {
            ...item.block,
            slots: {
              children: mapChildren(childrenOf(item.block), transform),
            },
          },
        }
      : item;

    return transform(nextItem);
  });
}

function findPlaced(children: AnyPlaced[], id: string): AnyPlaced | undefined {
  for (const item of children) {
    if (item.block.id === id) return item;
    if (isCanvas(item.block)) {
      const nested = findPlaced(childrenOf(item.block), id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function removePlaced(children: AnyPlaced[], id: string): AnyPlaced[] {
  const nextChildren: AnyPlaced[] = [];

  for (const item of children) {
    if (item.block.id === id) continue;

    if (isCanvas(item.block)) {
      nextChildren.push({
        ...item,
        block: {
          ...item.block,
          slots: { children: removePlaced(childrenOf(item.block), id) },
        },
      });
      continue;
    }

    nextChildren.push(item);
  }

  return nextChildren;
}

function setCanvasChildren(children: AnyPlaced[], canvasId: string, nextChildren: AnyPlaced[]): AnyPlaced[] {
  return children.map((item) => {
    if (!isCanvas(item.block)) return item;

    if (item.block.id === canvasId) {
      return {
        ...item,
        block: {
          ...item.block,
          slots: { children: nextChildren },
        },
      };
    }

    return {
      ...item,
      block: {
        ...item.block,
        slots: {
          children: setCanvasChildren(childrenOf(item.block), canvasId, nextChildren),
        },
      },
    };
  });
}

function findParentRef(doc: CanvasDoc, id: string): ParentRef | undefined {
  for (const item of childrenOf(doc.root)) {
    if (item.block.id === id) return null;
    if (isCanvas(item.block) && findPlaced(childrenOf(item.block), id)) return item.block.id;
  }
  return undefined;
}

function getChildrenForParent(doc: CanvasDoc, parentId: ParentRef): AnyPlaced[] | undefined {
  if (parentId === null) return childrenOf(doc.root);

  const parent = findPlaced(childrenOf(doc.root), parentId);
  if (!parent || !isCanvas(parent.block)) return undefined;
  return childrenOf(parent.block);
}

function withChildren(doc: CanvasDoc, parentId: ParentRef, children: AnyPlaced[]): CanvasDoc {
  if (parentId === null) {
    return {
      ...doc,
      root: {
        ...doc.root,
        slots: { children: children as PlacedBlock[] },
      },
    };
  }

  return {
    ...doc,
    root: {
      ...doc.root,
      slots: {
        children: setCanvasChildren(childrenOf(doc.root), parentId, children) as PlacedBlock[],
      },
    },
  };
}

function commit(state: Editor2State, nextDoc: CanvasDoc): Partial<Editor2State> {
  const parsed = canvasDocSchema.safeParse(nextDoc);
  if (!parsed.success) {
    return { lastError: 'El cambio no produjo un documento válido.', dirty: state.dirty };
  }

  return {
    doc: parsed.data,
    dirty: true,
    saveState: 'idle',
    lastError: null,
    history: [...state.history, state.doc].filter((item): item is CanvasDoc => item !== null).slice(-EDITOR2_HISTORY_LIMIT),
    future: [],
  };
}

function docMutation(state: Editor2State, mutate: (doc: CanvasDoc) => CanvasDoc): Partial<Editor2State> {
  if (!state.doc) return {};
  const nextDoc = mutate(state.doc);
  if (nextDoc === state.doc) return {};
  return commit(state, nextDoc);
}

export const useEditor2Store = create<Editor2State>((set, get) => ({
  ...initialState,

  setDoc: (doc) => {
    const parsed = canvasDocSchema.safeParse(doc);
    set((state) =>
      parsed.success
        ? {
            doc: withPageSections(parsed.data),
            selection: null,
            dirty: false,
            saveState: 'idle',
            lastError: null,
            history: [],
            future: [],
            puckRevision: state.puckRevision + 1,
          }
        : { lastError: 'No se pudo cargar el documento porque no cumple el contrato.' },
    );
  },

  setWorkspaceMeta: (meta) =>
    set({
      versions: meta.versions,
      publication: meta.publication,
      baseVersionId: meta.baseVersionId ?? null,
      lastSavedAt: meta.updatedAt ?? null,
    }),

  applyDoc: (doc) => {
    const parsed = canvasDocSchema.safeParse(doc);
    if (!parsed.success) {
      set({ lastError: 'El cambio del lienzo no cumple el contrato y se descartó.' });
      return;
    }

    if (
      parsed.data.root.slots.children.some(
        ({ block }) => block.type !== 'canvas' && block.type !== 'tabs' && block.type !== 'accordion',
      )
    ) {
      set((state) => ({
        lastError: 'Coloca el componente dentro de un bloque de página.',
        puckRevision: state.puckRevision + 1,
      }));
      return;
    }

    set((state) => {
      if (!state.doc) {
        return {
          doc: parsed.data,
          dirty: false,
          saveState: 'idle',
          lastError: null,
          history: [],
          future: [],
          puckRevision: state.puckRevision + 1,
        };
      }

      if (JSON.stringify(state.doc) === JSON.stringify(parsed.data)) return {};

      return {
        doc: parsed.data,
        dirty: true,
        saveState: 'idle',
        lastError: null,
        history: [...state.history, state.doc].slice(-EDITOR2_HISTORY_LIMIT),
        future: [],
      };
    });
  },

  selectBlock: (id) => set({ selection: id }),

  updateBlock: (id, updater) =>
    set((state) =>
      docMutation(state, (doc) => ({
        ...doc,
        root: {
          ...doc.root,
          slots: {
            children: mapChildren(childrenOf(doc.root), (item) =>
              item.block.id === id ? { ...item, block: updater(item.block) } : item,
            ) as PlacedBlock[],
          },
        },
      })),
    ),

  updateLayout: (id, updater) =>
    set((state) =>
      docMutation(state, (doc) => ({
        ...doc,
        root: {
          ...doc.root,
          slots: {
            children: mapChildren(childrenOf(doc.root), (item) =>
              item.block.id === id ? { ...item, layout: updater(item.layout) } : item,
            ) as PlacedBlock[],
          },
        },
      })),
    ),

  insertBlock: (block, parentId = null) =>
    set((state) =>
      docMutation(state, (doc) => {
        const children = getChildrenForParent(doc, parentId);
        if (!children) return doc;
        if ((block.block.type === 'canvas') !== (parentId === null)) return doc;
        return withChildren(doc, parentId, [...children, block as AnyPlaced]);
      }),
    ),

  removeBlock: (id) =>
    set((state) =>
      docMutation(state, (doc) => ({
        ...doc,
        root: {
          ...doc.root,
          slots: {
            children: removePlaced(childrenOf(doc.root), id) as PlacedBlock[],
          },
        },
      })),
    ),

  moveBlock: (id, targetIndex, parentId) =>
    set((state) =>
      docMutation(state, (doc) => {
        const sourceParent = findParentRef(doc, id);
        if (sourceParent === undefined) return doc;

        const destinationParent = parentId === undefined ? sourceParent : parentId;
        const sourceChildren = getChildrenForParent(doc, sourceParent);
        if (!sourceChildren) return doc;

        const currentIndex = sourceChildren.findIndex((item) => item.block.id === id);
        if (currentIndex < 0) return doc;

        const moved = sourceChildren[currentIndex];
        if ((moved.block.type === 'canvas') !== (destinationParent === null)) return doc;

        if (sourceParent !== destinationParent) {
          const destinationChildren = getChildrenForParent(doc, destinationParent);
          if (!destinationChildren) return doc;

          let nextDoc = withChildren(
            doc,
            sourceParent,
            sourceChildren.filter((item) => item.block.id !== id),
          );
          const refreshedDestination = getChildrenForParent(nextDoc, destinationParent);
          if (!refreshedDestination) return doc;
          const safeIndex = Math.max(0, Math.min(targetIndex, refreshedDestination.length));
          const insertedDestination = [...refreshedDestination];
          insertedDestination.splice(safeIndex, 0, moved);
          nextDoc = withChildren(nextDoc, destinationParent, insertedDestination);
          return nextDoc;
        }

        const nextChildren = [...sourceChildren];
        nextChildren.splice(currentIndex, 1);
        const safeIndex = Math.max(0, Math.min(targetIndex, nextChildren.length));
        nextChildren.splice(safeIndex, 0, moved);
        return withChildren(doc, destinationParent, nextChildren);
      }),
    ),

  undo: () =>
    set((state) => {
      if (!state.doc || state.history.length === 0) return {};
      const previous = state.history[state.history.length - 1];
      return {
        doc: previous,
        history: state.history.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, EDITOR2_HISTORY_LIMIT),
        dirty: true,
        saveState: 'idle',
        lastError: null,
        puckRevision: state.puckRevision + 1,
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.doc || state.future.length === 0) return {};
      const next = state.future[0];
      return {
        doc: next,
        history: [...state.history, state.doc].slice(-EDITOR2_HISTORY_LIMIT),
        future: state.future.slice(1),
        dirty: true,
        saveState: 'idle',
        lastError: null,
        puckRevision: state.puckRevision + 1,
      };
    }),

  markSaving: () => set({ saveState: 'saving', lastError: null }),
  markSaved: () => set({ dirty: false, saveState: 'saved', lastError: null }),
  markSaveError: (message) => set({ saveState: 'error', lastError: message }),

  saveDraftNow: async (api = editor2Api) => {
    if (sharedSavePromise) {
      await sharedSavePromise;
      const afterWait = get();
      if (!afterWait.dirty) return afterWait.saveState !== 'error';
    }

    const current = get();
    if (!current.doc) return false;
    const snapshot = current.doc;
    const baseVersionId = current.baseVersionId;

    set({ saveState: 'saving', lastError: null });

    const run = (async (): Promise<boolean> => {
      try {
        const saved = await api.saveDraft(snapshot.pageKey, snapshot, baseVersionId);
        const latest = get();
        const unchanged = latest.doc === snapshot;
        set({
          dirty: unchanged ? false : latest.dirty,
          saveState: unchanged ? 'saved' : 'idle',
          lastError: null,
          lastSavedAt: saved.updatedAt,
          baseVersionId: saved.baseVersionId,
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo guardar el borrador.';
        set({ saveState: 'error', lastError: message });
        return false;
      } finally {
        sharedSavePromise = null;
      }
    })();

    sharedSavePromise = run;
    const ok = await run;
    if (ok && get().dirty) {
      return get().saveDraftNow(api);
    }
    return ok;
  },

  createVersionNow: async (label = '', api = editor2Api) => {
    const state = get();
    if (!state.doc) return null;
    if (state.dirty || !state.lastSavedAt) {
      const saved = await get().saveDraftNow(api);
      if (!saved) return null;
    }
    try {
      const created = await api.createVersion(state.doc.pageKey, { label, source: 'draft' });
      set((prev) => ({
        versions: [created, ...prev.versions.filter((v) => v.id !== created.id)],
        lastError: null,
      }));
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la versión.';
      set({ lastError: message });
      return null;
    }
  },

  publishDraftNow: async (label = '', api = editor2Api) => {
    const state = get();
    if (!state.doc) return null;
    set({ publishing: true, lastError: null });
    try {
      const saved = await get().saveDraftNow(api);
      if (!saved) {
        set({ publishing: false });
        return null;
      }
      const pub = await api.publishDraft(state.doc.pageKey, label);
      invalidatePublicDocCache(state.doc.pageKey);
      const workspace = await api.getWorkspace(state.doc.pageKey).catch(() => null);
      set((prev) => ({
        publishing: false,
        publication: pub,
        baseVersionId: pub.versionId,
        versions: workspace
          ? workspace.versions
          : [
              {
                id: pub.versionId,
                pageKey: pub.pageKey,
                versionNumber: pub.versionNumber,
                label: pub.label,
                source: 'draft',
                actorId: pub.actorId,
                createdAt: pub.publishedAt,
                isPublished: true,
              },
              ...prev.versions.map((v) => ({ ...v, isPublished: false })),
            ],
        lastError: null,
      }));
      return pub;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo publicar el borrador.';
      set({ publishing: false, lastError: message });
      return null;
    }
  },

  publishVersionNow: async (versionId, api = editor2Api) => {
    const state = get();
    if (!state.doc) return null;
    set({ publishing: true, lastError: null });
    try {
      const pub = await api.publishVersion(state.doc.pageKey, versionId);
      invalidatePublicDocCache(state.doc.pageKey);
      set((prev) => ({
        publishing: false,
        publication: pub,
        versions: prev.versions.map((v) => ({ ...v, isPublished: v.id === pub.versionId })),
        lastError: null,
      }));
      return pub;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo publicar esa versión.';
      set({ publishing: false, lastError: message });
      return null;
    }
  },

  unpublishNow: async (api = editor2Api) => {
    const state = get();
    if (!state.doc || !api.unpublishPage) return false;
    set({ publishing: true, lastError: null });
    try {
      await api.unpublishPage(state.doc.pageKey);
      invalidatePublicDocCache(state.doc.pageKey);
      set((prev) => ({
        publishing: false,
        publication: null,
        versions: prev.versions.map((v) => ({ ...v, isPublished: false })),
        lastError: null,
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo retirar la publicación v2 (verifica 003_unpublish.sql).';
      set({ publishing: false, lastError: message });
      return false;
    }
  },

  deleteVersionNow: async (versionId, api = editor2Api) => {
    const state = get();
    if (!state.doc) return false;
    try {
      await api.deleteVersion(state.doc.pageKey, versionId);
      set((prev) => ({
        versions: prev.versions.filter((v) => v.id !== versionId),
        lastError: null,
      }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar esa versión.';
      set({ lastError: message });
      return false;
    }
  },

  setPageTheme: (theme) =>
    set((state) => {
      if (!state.doc) return {};
      const nextDoc: CanvasDoc = { ...state.doc };
      if (theme) {
        nextDoc.pageTheme = theme;
      } else {
        delete nextDoc.pageTheme;
      }
      const parsed = canvasDocSchema.safeParse(nextDoc);
      if (!parsed.success) {
        return { lastError: 'El tema de página no cumple el contrato.' };
      }
      return {
        ...commit(state, parsed.data),
        puckRevision: state.puckRevision + 1,
      };
    }),

  appendSection: (section) =>
    set((state) => {
      if (!state.doc) return {};
      const nextDoc: CanvasDoc = {
        ...state.doc,
        root: {
          ...state.doc.root,
          slots: {
            children: [...state.doc.root.slots.children, section],
          },
        },
      };
      const parsed = canvasDocSchema.safeParse(nextDoc);
      if (!parsed.success) {
        return { lastError: 'La plantilla de sección no cumple el contrato del documento.' };
      }
      return {
        ...commit(state, parsed.data),
        puckRevision: state.puckRevision + 1,
      };
    }),

  copyBlockStyle: (style) =>
    set({ copiedStyle: style ? (JSON.parse(JSON.stringify(style)) as BlockStyle) : null }),

  reset: () => {
    sharedSavePromise = null;
    set((state) => ({ ...initialState, puckRevision: state.puckRevision + 1 }));
  },
}));

export function getEditor2Doc(): CanvasDoc | null {
  return useEditor2Store.getState().doc;
}
