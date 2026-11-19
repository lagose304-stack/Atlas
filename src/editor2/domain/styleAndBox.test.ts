import { describe, expect, it } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import {
  createBoxBlock,
  createEmptyCanvasDoc,
  createHeadingBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTabsBlock,
  createTextBlock,
} from './defaults';
import { canvasDocSchema } from './schema';
import { DEFAULT_BOX_STYLE, blockStyleSchema, sanitizeBlockStyle } from './styleSchema';
import { blockStyleToCss, hasVisualStyle, mergeBlockStyle } from './styleToCss';

describe('Editor 2.0 Fase 2 — BlockStyle y styleToCss', () => {
  it('valida y traduce todos los estilos visuales a CSS determinista', () => {
    const style = blockStyleSchema.parse({
      background: {
        type: 'gradient',
        gradient: { kind: 'linear', angle: 120, stops: ['#0284c7', '#4f46e5'] },
      },
      border: { width: 4, style: 'solid', color: '#0ea5e9', sides: 'left' },
      radius: { mode: 'custom', tl: 16, tr: 8, br: 16, bl: 8 },
      padding: { mode: 'axis', x: 24, y: 16 },
      maxWidth: '960',
      shadow: 'glow',
      shadowColor: '#0284c7',
      opacity: 0.95,
      backdropBlur: 12,
    });

    const css = blockStyleToCss(style);
    expect(css.backgroundImage).toBe('linear-gradient(120deg, #0284c7, #4f46e5)');
    expect(css.borderLeft).toBe('4px solid #0ea5e9');
    expect(css.border).toBeUndefined();
    expect(css.borderRadius).toBe('16px 8px 16px 8px');
    expect(css.padding).toBe('16px 24px');
    expect(css.maxWidth).toBe('960px');
    expect(css.marginInline).toBe('auto');
    expect(css.boxShadow).toContain('rgba(2, 132, 199');
    expect(css.opacity).toBe(0.95);
    expect(css.backdropFilter).toBe('blur(12px)');
    expect(hasVisualStyle(style)).toBe(true);
  });

  it('genera fondo de imagen con overlay semitransparente', () => {
    const css = blockStyleToCss({
      background: {
        type: 'image',
        imageUrl: 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/demo.webp',
        overlayColor: '#0f172a',
        overlayOpacity: 0.4,
      },
    });
    expect(css.backgroundImage).toContain('linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.4))');
    expect(css.backgroundImage).toContain('url("https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/demo.webp")');
    expect(css.backgroundSize).toBe('cover');
  });

  it('rechaza colores inválidos, URLs no HTTPS y rangos fuera de límite', () => {
    expect(sanitizeBlockStyle({ background: { type: 'solid', color: 'red' } })).toBeUndefined();
    expect(
      sanitizeBlockStyle({
        background: { type: 'image', imageUrl: 'http://insecure.example/img.png' },
      }),
    ).toBeUndefined();
    expect(sanitizeBlockStyle({ opacity: 0.01 })).toBeUndefined();
    expect(sanitizeBlockStyle({ backdropBlur: 40 })).toBeUndefined();
  });

  it('combina layoutStyle y blockStyle sin perder variables de fila', () => {
    const merged = mergeBlockStyle(
      { ['--e2-row-base' as string]: '1 / span 2' },
      { background: { type: 'solid', color: '#f8fafc' } },
    );
    expect((merged as Record<string, unknown>)['--e2-row-base']).toBe('1 / span 2');
    expect(merged.backgroundColor).toBe('#f8fafc');
  });
});

describe('Editor 2.0 Fase 2 — Tarjeta / Caja (box) y retrocompatibilidad', () => {
  it('acepta documentos de Fase 1 sin style ni box', () => {
    const section = createNestedCanvasNode({
      children: [createLeafPlacedBlock(createHeadingBlock({ text: 'Título Fase 1' }), 12)],
    });
    const doc = createEmptyCanvasDoc('fase1-compat', { children: [createPlacedBlock(section)] });
    const parsed = canvasDocSchema.parse(doc);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.root.slots.children).toHaveLength(1);
  });

  it('preserva Tarjeta / Caja con estilo y 1 nivel de caja anidada en ida y vuelta con Puck', () => {
    const innerBox = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'box' as const,
      props: {
        gap: 'sm' as const,
        boxDepth: 1 as const,
        style: {
          background: { type: 'solid' as const, color: '#f0f9ff' },
          border: { width: 3, style: 'solid' as const, color: '#0284c7', sides: 'left' as const },
        },
      },
      slots: {
        children: [createLeafPlacedBlock(createTextBlock({ text: 'Subtarjeta clínica' }), 24)],
      },
    };

    const outerBox = createBoxBlock({
      id: '22222222-2222-4222-8222-222222222222',
      style: DEFAULT_BOX_STYLE,
      children: [
        createLeafPlacedBlock(createHeadingBlock({ text: 'Generalidades' }), 24),
        { block: innerBox, layout: { base: { span: 24 } } },
      ],
    });

    const section = {
      id: '33333333-3333-4333-8333-333333333333',
      type: 'canvas' as const,
      props: {
        gap: 'md' as const,
        depth: 1 as const,
        style: { maxWidth: '1200' as const, padding: { mode: 'uniform' as const, value: 24 } },
      },
      slots: {
        children: [{ block: outerBox, layout: { base: { span: 12 } } }],
      },
    };

    const doc = createEmptyCanvasDoc('pagina-tarjetas', {
      children: [{ block: section, layout: { base: { span: 24 } } }],
    });

    const puckData = toPuckData(doc);
    const roundtrip = fromPuckData(puckData);

    const rtSection = roundtrip.root.slots.children[0].block;
    expect(rtSection.type).toBe('canvas');
    if (rtSection.type !== 'canvas') return;
    expect(rtSection.props.style?.maxWidth).toBe('1200');

    const rtOuterBox = rtSection.slots.children[0].block;
    expect(rtOuterBox.type).toBe('box');
    if (rtOuterBox.type !== 'box') return;
    expect(rtOuterBox.props.boxDepth).toBe(0);
    expect(rtOuterBox.props.style?.radius?.value).toBe(16);
    expect(rtOuterBox.slots.children).toHaveLength(2);

    const rtInnerBox = rtOuterBox.slots.children[1].block;
    expect(rtInnerBox.type).toBe('box');
    if (rtInnerBox.type !== 'box') return;
    expect(rtInnerBox.props.boxDepth).toBe(1);
    expect(rtInnerBox.props.style?.border?.sides).toBe('left');
  });

  it('permite Tarjeta / Caja dentro de un Bloque de página ubicado en Pestañas', () => {
    const boxInTab = createBoxBlock({
      children: [createLeafPlacedBlock(createTextBlock({ text: 'Dentro de pestaña' }), 24)],
    });
    const tabs = createTabsBlock({
      items: [
        {
          title: 'Parcial 1',
          children: [
            {
              block: {
                id: '44444444-4444-4444-8444-444444444444',
                type: 'canvas',
                props: { gap: 'md', depth: 1 },
                slots: { children: [{ block: boxInTab, layout: { base: { span: 12 } } }] },
              },
              layout: { base: { span: 24 } },
            },
          ],
        },
      ],
    });

    const doc = createEmptyCanvasDoc('tabs-con-box', {
      children: [{ block: tabs, layout: { base: { span: 24 } } }],
    });
    const roundtrip = fromPuckData(toPuckData(doc));
    const rtTabs = roundtrip.root.slots.children[0].block;
    expect(rtTabs.type).toBe('tabs');
    if (rtTabs.type !== 'tabs') return;
    const tabSection = rtTabs.props.items[0].children?.[0].block;
    expect(tabSection?.slots.children[0].block.type).toBe('box');
  });
});
