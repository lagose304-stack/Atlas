import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyCanvasDoc,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTextBlock,
} from '../domain/defaults';
import type { CanvasDoc } from '../domain/schema';
import { EDITOR2_HISTORY_LIMIT, getEditor2Doc, useEditor2Store } from './editor2Store';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CANVAS_ID = '22222222-2222-4222-8222-222222222222';
const TEXT_A = '33333333-3333-4333-8333-333333333333';
const TEXT_B = '44444444-4444-4444-8444-444444444444';

function baseDoc(): CanvasDoc {
  return createEmptyCanvasDoc('home', { id: ROOT_ID });
}

function docWithNestedCanvas(): CanvasDoc {
  return createEmptyCanvasDoc('home', {
    id: ROOT_ID,
    children: [createPlacedBlock(createNestedCanvasNode({ id: CANVAS_ID }), 12)],
  });
}

function nestedChildren(doc: CanvasDoc) {
  const block = doc.root.slots.children.find((item) => item.block.type === 'canvas')?.block;
  if (!block || block.type !== 'canvas') throw new Error('Se esperaba un canvas anidado');
  return block.slots.children;
}

function topLevelIds(doc: CanvasDoc | null): string[] {
  return doc?.root.slots.children.map((item) => item.block.id) ?? [];
}

describe('editor2Store', () => {
  beforeEach(() => {
    useEditor2Store.getState().reset();
  });

  it('carga un documento y limpia selección, historial y dirty', () => {
    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));
    useEditor2Store.getState().selectBlock(TEXT_A);

    useEditor2Store.getState().setDoc(baseDoc());

    expect(getEditor2Doc()).toEqual(baseDoc());
    expect(useEditor2Store.getState().selection).toBeNull();
    expect(useEditor2Store.getState().dirty).toBe(false);
    expect(useEditor2Store.getState().history).toEqual([]);
  });

  it('rechaza cargar un documento que no cumple el contrato', () => {
    useEditor2Store.getState().setDoc({ ...baseDoc(), schemaVersion: 3 } as unknown as CanvasDoc);

    expect(getEditor2Doc()).toBeNull();
    expect(useEditor2Store.getState().lastError).toContain('No se pudo cargar');
  });

  it('inserta en root, marca dirty y registra historial', () => {
    useEditor2Store.getState().setDoc(baseDoc());

    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));

    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_A]);
    expect(useEditor2Store.getState().dirty).toBe(true);
    expect(useEditor2Store.getState().history).toHaveLength(1);
  });

  it('inserta dentro de un canvas anidado', () => {
    useEditor2Store.getState().setDoc(docWithNestedCanvas());

    useEditor2Store.getState().insertBlock(
      createLeafPlacedBlock(createTextBlock({ id: TEXT_A }), 6),
      CANVAS_ID,
    );

    expect(nestedChildren(getEditor2Doc()!).map((item) => item.block.id)).toEqual([TEXT_A]);
    expect(topLevelIds(getEditor2Doc())).toEqual([CANVAS_ID]);
  });

  it('no inserta un canvas dentro de otro canvas', () => {
    useEditor2Store.getState().setDoc(docWithNestedCanvas());
    const otroCanvas = createNestedCanvasNode();

    useEditor2Store.getState().insertBlock(createPlacedBlock(otroCanvas), CANVAS_ID);

    expect(nestedChildren(getEditor2Doc()!)).toEqual([]);
    expect(useEditor2Store.getState().history).toEqual([]);
  });

  it('elimina bloques en root y dentro de un canvas anidado', () => {
    const doc = docWithNestedCanvas();
    doc.root.slots.children.push(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));
    doc.root.slots.children[0].block.type === 'canvas' &&
      (doc.root.slots.children[0].block as ReturnType<typeof createNestedCanvasNode>).slots.children.push(
        createLeafPlacedBlock(createTextBlock({ id: TEXT_B }), 6),
      );
    useEditor2Store.getState().setDoc(doc);

    useEditor2Store.getState().removeBlock(TEXT_A);
    useEditor2Store.getState().removeBlock(TEXT_B);

    expect(topLevelIds(getEditor2Doc())).toEqual([CANVAS_ID]);
    expect(nestedChildren(getEditor2Doc()!)).toEqual([]);
  });

  it('mueve bloques dentro de root', () => {
    const doc = baseDoc();
    doc.root.slots.children.push(
      createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })),
      createPlacedBlock(createNestedCanvasNode({ id: TEXT_B })),
    );
    useEditor2Store.getState().setDoc(doc);

    useEditor2Store.getState().moveBlock(TEXT_A, 1);

    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_B, TEXT_A]);
  });

  it('mueve un componente de una sección guardada al lienzo', () => {
    const doc = docWithNestedCanvas();
    (doc.root.slots.children[0].block as ReturnType<typeof createNestedCanvasNode>).slots.children.push(
      createLeafPlacedBlock(createTextBlock({ id: TEXT_A }), 6),
    );
    useEditor2Store.getState().setDoc(doc);

    useEditor2Store.getState().moveBlock(TEXT_A, 0, null);

    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_A, CANVAS_ID]);
  });

  it('actualiza props y layout de un bloque', () => {
    const doc = baseDoc();
    doc.root.slots.children.push(createPlacedBlock(createTextBlock({ id: TEXT_A })));
    useEditor2Store.getState().setDoc(doc);

    useEditor2Store.getState().updateBlock(TEXT_A, (block) =>
      block.type === 'text'
        ? { ...block, props: { text: { format: 'plain', value: 'Nuevo texto' } } }
        : block,
    );
    useEditor2Store.getState().updateLayout(TEXT_A, () => ({ base: { span: 6 } }));

    const placed = getEditor2Doc()!.root.slots.children[0];
    expect(placed.layout).toEqual({ base: { span: 6 } });
    expect(
      placed.block.type === 'text' &&
        placed.block.props.text.format === 'plain' &&
        placed.block.props.text.value,
    ).toBe('Nuevo texto');
  });

  it('deshace y rehace cambios', () => {
    useEditor2Store.getState().setDoc(baseDoc());
    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));
    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_B })));

    useEditor2Store.getState().undo();
    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_A]);
    expect(useEditor2Store.getState().future).toHaveLength(1);

    useEditor2Store.getState().redo();
    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_A, TEXT_B]);
    expect(useEditor2Store.getState().future).toEqual([]);
  });

  it('limita el historial a 100 estados', () => {
    useEditor2Store.getState().setDoc(baseDoc());

    for (let index = 0; index < EDITOR2_HISTORY_LIMIT + 5; index += 1) {
      useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode()));
    }

    expect(useEditor2Store.getState().history).toHaveLength(EDITOR2_HISTORY_LIMIT);
  });

  it('aplica documentos del lienzo al historial sin remontar Puck', () => {
    useEditor2Store.getState().setDoc(baseDoc());
    const revision = useEditor2Store.getState().puckRevision;
    const next = baseDoc();
    next.root.slots.children.push(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));

    useEditor2Store.getState().applyDoc(next);

    expect(topLevelIds(getEditor2Doc())).toEqual([TEXT_A]);
    expect(useEditor2Store.getState().history).toHaveLength(1);
    expect(useEditor2Store.getState().dirty).toBe(true);
    expect(useEditor2Store.getState().puckRevision).toBe(revision);
  });

  it('no apila historial cuando el documento no cambia', () => {
    const doc = baseDoc();
    useEditor2Store.getState().setDoc(doc);

    useEditor2Store.getState().applyDoc(JSON.parse(JSON.stringify(doc)) as CanvasDoc);

    expect(useEditor2Store.getState().history).toEqual([]);
    expect(useEditor2Store.getState().dirty).toBe(false);
  });

  it('descarta documentos inválidos y conserva el último válido', () => {
    const doc = baseDoc();
    useEditor2Store.getState().setDoc(doc);
    const invalid = { ...doc, root: { ...doc.root, id: 'no-es-un-uuid' } } as CanvasDoc;

    useEditor2Store.getState().applyDoc(invalid);

    expect(getEditor2Doc()).toEqual(doc);
    expect(useEditor2Store.getState().lastError).toContain('contrato');
    expect(useEditor2Store.getState().history).toEqual([]);
  });

  it('incrementa puckRevision al cargar, deshacer, rehacer y reiniciar', () => {
    const initial = useEditor2Store.getState().puckRevision;

    useEditor2Store.getState().setDoc(baseDoc());
    const loaded = useEditor2Store.getState().puckRevision;
    expect(loaded).toBe(initial + 1);

    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));
    useEditor2Store.getState().undo();
    expect(useEditor2Store.getState().puckRevision).toBe(loaded + 1);

    useEditor2Store.getState().redo();
    expect(useEditor2Store.getState().puckRevision).toBe(loaded + 2);

    useEditor2Store.getState().reset();
    expect(useEditor2Store.getState().puckRevision).toBe(loaded + 3);
  });

  it('gestiona los estados de guardado', () => {
    useEditor2Store.getState().setDoc(baseDoc());
    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));

    useEditor2Store.getState().markSaving();
    expect(useEditor2Store.getState().saveState).toBe('saving');
    expect(useEditor2Store.getState().dirty).toBe(true);

    useEditor2Store.getState().markSaveError('Sin conexión');
    expect(useEditor2Store.getState().saveState).toBe('error');
    expect(useEditor2Store.getState().lastError).toBe('Sin conexión');

    useEditor2Store.getState().markSaved();
    expect(useEditor2Store.getState().saveState).toBe('saved');
    expect(useEditor2Store.getState().dirty).toBe(false);
    expect(useEditor2Store.getState().lastError).toBeNull();
  });

  it('reinicia todo el estado', () => {
    useEditor2Store.getState().setDoc(baseDoc());
    useEditor2Store.getState().insertBlock(createPlacedBlock(createNestedCanvasNode({ id: TEXT_A })));

    useEditor2Store.getState().reset();

    expect(getEditor2Doc()).toBeNull();
    expect(useEditor2Store.getState().history).toEqual([]);
    expect(useEditor2Store.getState().dirty).toBe(false);
  });
});
