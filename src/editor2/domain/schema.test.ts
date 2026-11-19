import { describe, expect, it } from 'vitest';
import {
  createEmptyCanvasDoc,
  createHeadingBlock,
  createImageBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTextBlock,
} from './defaults';
import { canvasDocSchema } from './schema';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const NESTED_ID = '22222222-2222-4222-8222-222222222222';
const HEADING_ID = '33333333-3333-4333-8333-333333333333';
const TEXT_ID = '44444444-4444-4444-8444-444444444444';
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';

describe('canvasDocSchema', () => {
  it('duplica la resolución una sola vez en los borradores de 12 columnas', () => {
    const nested = createNestedCanvasNode({ children: [{
      block: createTextBlock(), layout: {
        base: { start: 12, span: 1, row: 500, rowSpan: 1 },
        lg: { span: 6, start: 3, row: 4, rowSpan: 2, verticalAlign: 'center' },
      },
    }] });
    const legacy = { ...createEmptyCanvasDoc('home', { children: [createPlacedBlock(nested, 12)] }), schemaVersion: 1 };
    const upgraded = canvasDocSchema.parse(legacy);
    expect(upgraded.root.slots.children[0]).toMatchObject({
      layout: { base: { span: 24 } },
      block: { slots: { children: [{ layout: {
        base: { start: 23, span: 2, row: 999, rowSpan: 2 },
        lg: { span: 12, start: 5, row: 7, rowSpan: 4, verticalAlign: 'center' },
      } }] } },
    });
    expect(canvasDocSchema.parse(upgraded)).toEqual(upgraded);
  });

  it('acepta un documento vacío válido', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });

    expect(canvasDocSchema.safeParse(doc).success).toBe(true);
  });

  it('acepta los tres primitivos y un lienzo anidado de un nivel', () => {
    const doc = createEmptyCanvasDoc('tema-12', {
      id: ROOT_ID,
      children: [
        createPlacedBlock(createHeadingBlock({ id: HEADING_ID, level: 3, text: 'Subtítulo' }), 8),
        createPlacedBlock(createTextBlock({ id: TEXT_ID, text: 'Contenido' }), 4),
        createPlacedBlock(
          createImageBlock({ id: IMAGE_ID, src: 'https://r2.atlas-tests.invalid/placa.webp', alt: 'Placa' }),
          6,
        ),
        createPlacedBlock(
          createNestedCanvasNode({
            id: NESTED_ID,
            children: [createLeafPlacedBlock(createTextBlock({ text: 'Dentro' }), 6)],
          }),
          12,
        ),
      ],
    });

    expect(canvasDocSchema.safeParse(doc).success).toBe(true);
  });

  it('rechaza una versión de esquema desconocida', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    const result = canvasDocSchema.safeParse({ ...doc, schemaVersion: 3 });

    expect(result.success).toBe(false);
  });

  it('rechaza campos desconocidos en la raíz', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    const result = canvasDocSchema.safeParse({ ...doc, legacyBlocks: [] });

    expect(result.success).toBe(false);
  });

  it('rechaza spans fuera de 1..24 y starts que exceden la rejilla', () => {
    const invalidSpan = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [{ ...createPlacedBlock(createTextBlock({ id: TEXT_ID })), layout: { base: { span: 25 } } }],
    });
    const invalidStart = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [{ ...createPlacedBlock(createTextBlock({ id: TEXT_ID })), layout: { base: { span: 6, start: 20 } } }],
    });

    expect(canvasDocSchema.safeParse(invalidSpan).success).toBe(false);
    expect(canvasDocSchema.safeParse(invalidStart).success).toBe(false);
  });

  it('rechaza un lienzo anidado dentro de otro lienzo anidado', () => {
    const nestedWithNested = createNestedCanvasNode({
      id: NESTED_ID,
      children: [
        {
          block: createNestedCanvasNode({ children: [] }) as unknown as ReturnType<typeof createTextBlock>,
          layout: { base: { span: 12 } },
        },
      ],
    });
    const doc = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [createPlacedBlock(nestedWithNested, 12)],
    });

    expect(canvasDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rechaza imágenes que no usan HTTPS', () => {
    const doc = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [createPlacedBlock(createImageBlock({ id: IMAGE_ID, src: 'http://r2.atlas-tests.invalid/placa.webp' }), 6)],
    });

    expect(canvasDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rechaza una raíz con profundidad distinta de cero', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    const result = canvasDocSchema.safeParse({
      ...doc,
      root: { ...doc.root, props: { ...doc.root.props, depth: 1 } },
    });

    expect(result.success).toBe(false);
  });
});
