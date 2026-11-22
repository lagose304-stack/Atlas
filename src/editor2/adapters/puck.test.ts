import { describe, expect, it } from 'vitest';
import {
  createButtonBlock,
  createEmptyCanvasDoc,
  createHeadingBlock,
  createImageBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTabsBlock,
  createTextBlock,
} from '../domain/defaults';
import { EDITOR2_PUCK_TYPES, fromPuckData, toPuckCompatibleData, toPuckData, type Editor2PuckData } from './puck';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CANVAS_ID = '22222222-2222-4222-8222-222222222222';
const HEADING_ID = '33333333-3333-4333-8333-333333333333';
const TEXT_ID = '44444444-4444-4444-8444-444444444444';
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
const NESTED_TEXT_ID = '66666666-6666-4666-8666-666666666666';
const TABS_ID = '77777777-7777-4777-8777-777777777777';
const TAB_CANVAS_ID = '88888888-8888-4888-8888-888888888888';
const TAB_TEXT_ID = '99999999-9999-4999-8999-999999999999';

describe('adaptador Puck', () => {
  it('expone los tipos permitidos del editor', () => {
    expect(EDITOR2_PUCK_TYPES).toEqual([
      'heading',
      'text',
      'image',
      'gif',
      'video',
      'compare',
      'callout',
      'divider',
      'button',
      'table',
      'carousel',
      'badge',
      'icon',
      'examCarousel',
      'box',
      'tabs',
      'accordion',
      'canvas',
    ]);
  });

  it('convierte un documento vacío y lo reconstruye igual', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    const puck = toPuckData(doc);

    expect(puck.root.props).toEqual({ rootId: ROOT_ID, pageKey: 'home', gap: 'md' });
    expect(puck.content).toEqual([]);
    expect(fromPuckData(puck)).toEqual(doc);
  });

  it('conserva las filas mínimas y los bloques al convertir el documento', () => {
    const doc = createEmptyCanvasDoc('home', {
      children: [createPlacedBlock(createTextBlock({ text: 'Conservar este bloque' }))],
    });
    doc.root.props.minRows = 48;
    const data = toPuckData(doc);
    expect(data.root.props.minRows).toBe(48);
    expect(fromPuckData(data)).toEqual(doc);
  });

  it('conserva la miniatura y el destino del botón de ficha semanal', () => {
    const button = createButtonBlock({ variant: 'weekly', href: '/subtemas/1', newTab: true, label: 'Epitelio' });
    button.props.thumbnailSrc = 'https://r2.atlas-tests.invalid/placa.webp';
    const doc = createEmptyCanvasDoc('home', { children: [createPlacedBlock(button)] });
    expect(fromPuckData(toPuckData(doc))).toEqual(doc);
  });

  it('conserva primitivos, layout y un canvas anidado en la ida y vuelta', () => {
    const doc = createEmptyCanvasDoc('tema-1', {
      id: ROOT_ID,
      children: [
        createPlacedBlock(createHeadingBlock({ id: HEADING_ID, level: 3, text: 'Subtítulo' }), 8),
        createPlacedBlock(createTextBlock({ id: TEXT_ID, text: 'Contenido' }), 4),
        createPlacedBlock(
          createImageBlock({
            id: IMAGE_ID,
            src: 'https://r2.atlas-tests.invalid/placa.webp',
            alt: 'Placa',
            caption: 'Pie de placa',
          }),
          6,
        ),
        createPlacedBlock(
          createNestedCanvasNode({
            id: CANVAS_ID,
            children: [createLeafPlacedBlock(createTextBlock({ id: NESTED_TEXT_ID, text: 'Dentro' }), 6)],
          }),
          12,
        ),
        createPlacedBlock(
          createTabsBlock({
            id: TABS_ID,
            items: [
              {
                title: 'Pestaña 1',
                children: [
                  {
                    block: createNestedCanvasNode({
                      id: TAB_CANVAS_ID,
                      children: [
                        createLeafPlacedBlock(createTextBlock({ id: TAB_TEXT_ID, text: 'En pestaña' }), 8),
                      ],
                    }),
                    layout: { base: { span: 24 } },
                  },
                ],
              },
            ],
          }),
          24,
        ),
      ],
    });

    const puck = toPuckData(doc);

    expect(puck.content.map((item) => item.type)).toEqual(['heading', 'text', 'image', 'canvas', 'tabs']);
    expect(puck.content[0]).toMatchObject({
      props: { id: `heading-${HEADING_ID}`, level: 3, text: 'Subtítulo' },
    });
    expect(puck.content[2]).toMatchObject({
      props: { id: `image-${IMAGE_ID}`, caption: 'Pie de placa' },
    });
    expect(puck.content[3]).toMatchObject({
      props: {
        id: `canvas-${CANVAS_ID}`,
        gap: 'md',
        content: [{ props: { id: `text-${NESTED_TEXT_ID}`, text: 'Dentro' } }],
      },
    });
    expect(puck.content[4]).toMatchObject({
      props: {
        id: `tabs-${TABS_ID}`,
        items: [
          {
            title: 'Pestaña 1',
            content: [
              {
                type: 'canvas',
                props: {
                  id: `canvas-${TAB_CANVAS_ID}`,
                  content: [{ props: { id: `text-${TAB_TEXT_ID}`, text: 'En pestaña' } }],
                },
              },
            ],
          },
        ],
      },
    });
    expect(fromPuckData(puck)).toEqual(doc);
  });

  it('no altera los spans por breakpoint', () => {
    const block = createPlacedBlock(createTextBlock({ id: TEXT_ID }), 12);
    block.layout = {
      base: { span: 12 },
      md: { span: 6, start: 2 },
      lg: { span: 4 },
    };
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID, children: [block] });

    expect(fromPuckData(toPuckData(doc)).root.slots.children[0].layout).toEqual(block.layout);
  });

  it('acepta ids de Puck sin prefijo y conserva el UUID', () => {
    const doc = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [createPlacedBlock(createTextBlock({ id: TEXT_ID, text: 'Sin prefijo' }), 12)],
    });
    const puck = toPuckData(doc);
    const sinPrefijo = {
      ...puck,
      content: [{ ...puck.content[0], props: { ...puck.content[0].props, id: TEXT_ID } }],
    } as Editor2PuckData;

    expect(fromPuckData(sinPrefijo)).toEqual(doc);
  });

  it('entrega datos compatibles con la forma de Puck', () => {
    const doc = createEmptyCanvasDoc('home', { id: ROOT_ID });
    const data = toPuckCompatibleData(doc) as unknown as Editor2PuckData;

    expect(data.root.props.pageKey).toBe('home');
    expect(data.content).toEqual([]);
  });

  it('rechaza datos sin propiedades raíz', () => {
    expect(() => fromPuckData({ root: {}, content: [] } as unknown as Editor2PuckData)).toThrow(
      'propiedades raíz',
    );
  });

  it('rechaza contenido que no cumple el contrato al reconstruir', () => {
    const puck = toPuckData(createEmptyCanvasDoc('home', { id: ROOT_ID }));
    const invalido = {
      ...puck,
      content: [
        {
          type: 'heading',
          props: {
            id: 'heading-no-es-un-uuid',
            layout: { base: { span: 12 } },
            level: 2,
            text: 'Título',
          },
        },
      ],
    } as unknown as Editor2PuckData;

    expect(() => fromPuckData(invalido)).toThrow();
  });
});
