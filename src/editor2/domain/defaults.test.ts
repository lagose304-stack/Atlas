import { describe, expect, it } from 'vitest';
import {
  createEmptyCanvasDoc,
  createHeadingBlock,
  createImageBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTextBlock,
} from './defaults';
import { canvasDocSchema } from './schema';

const ROOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('defaults', () => {
  it('crea un documento vacío que cumple el contrato', () => {
    expect(canvasDocSchema.safeParse(createEmptyCanvasDoc('creditos', { id: ROOT_ID })).success).toBe(true);
  });

  it('crea un subtítulo como heading de nivel 3', () => {
    const heading = createHeadingBlock({ level: 3, text: 'Subtítulo' });

    expect(heading.type).toBe('heading');
    expect(heading.props.level).toBe(3);
    expect(heading.props.text.format === 'plain' && heading.props.text.value).toBe('Subtítulo');
  });

  it('crea textos en formato plano', () => {
    expect(createTextBlock({ text: 'Hola' }).props.text).toEqual({ format: 'plain', value: 'Hola' });
  });

  it('crea imágenes con URL HTTPS y texto alternativo', () => {
    const image = createImageBlock({ src: 'https://r2.atlas-tests.invalid/placa.webp', alt: 'Placa' });

    expect(image.props.src).toBe('https://r2.atlas-tests.invalid/placa.webp');
    expect(image.props.alt).toBe('Placa');
  });

  it('crea IDs únicos por defecto', () => {
    expect(createTextBlock().id).not.toBe(createTextBlock().id);
  });

  it('acepta un lienzo anidado vacío en el documento', () => {
    const doc = createEmptyCanvasDoc('temario', {
      id: ROOT_ID,
      children: [createPlacedBlock(createNestedCanvasNode(), 12)],
    });

    expect(canvasDocSchema.safeParse(doc).success).toBe(true);
  });
});
