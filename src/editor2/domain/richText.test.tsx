import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fromPuckData, toPuckData } from '../adapters/puck';
import {
  createDividerBlock,
  createEmptyCanvasDoc,
  createNestedCanvasNode,
  createPlacedBlock,
  createTableBlock,
  createTextBlock,
} from './defaults';
import {
  renderRichTextContent,
  richTextToPlain,
  runsToTiptapDoc,
  sanitizeSafeHref,
  tiptapDocToRuns,
  type RichTextV2,
} from './richText';

describe('RichTextV2 y utilidades seguras (Fase 2 — Parte 4)', () => {
  it('convierte runs <-> Tiptap JSON conservando marcas, enlaces, sub/superíndice y saltos de línea', () => {
    const rich: RichTextV2 = {
      format: 'rich',
      runs: [
        { text: 'Fórmula: H' },
        { text: '2', sub: true },
        { text: 'O a 10' },
        { text: '×', sup: true },
        { text: '\n' },
        { text: 'Ver temario', bold: true, color: '#0284c7', highlight: '#fef08a', href: '/temario' },
      ],
    };

    const doc = runsToTiptapDoc(rich);
    const back = tiptapDocToRuns(doc);

    expect(richTextToPlain({ format: 'rich', runs: back })).toBe('Fórmula: H2O a 10×\nVer temario');
    expect(back[1]).toEqual({ text: '2', sub: true });
    expect(back[3]).toEqual({ text: '×', sup: true });
    expect(back[5]).toMatchObject({
      text: 'Ver temario',
      bold: true,
      color: '#0284c7',
      highlight: '#fef08a',
      href: '/temario',
    });
  });

  it('bloquea URLs inseguras (javascript:, data:) y acepta https/mailto/rutas internas', () => {
    expect(sanitizeSafeHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeSafeHref('data:text/html,<script>x</script>')).toBeUndefined();
    expect(sanitizeSafeHref('/temario')).toBe('/temario');
    expect(sanitizeSafeHref('https://atlas.example/placas')).toBe('https://atlas.example/placas');
  });

  it('renderiza RichTextV2 declarativamente con sub, sup y enlace seguro', () => {
    const rich: RichTextV2 = {
      format: 'rich',
      runs: [
        { text: 'CO' },
        { text: '2', sub: true },
        { text: ' · ' },
        { text: 'Guía', href: 'https://atlas.example', newTab: true, color: '#0369a1' },
      ],
    };

    const { container } = render(<p>{renderRichTextContent(rich)}</p>);
    expect(container.querySelector('sub')?.textContent).toBe('2');
    const link = screen.getByRole('link', { name: 'Guía' });
    expect(link).toHaveAttribute('href', 'https://atlas.example');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('conserva RichTextV2, estilos de tabla y separador con etiqueta en ida y vuelta con Puck', () => {
    const textBlock = createTextBlock({ text: 'Plano' });
    textBlock.props.text = {
      format: 'rich',
      runs: [
        { text: 'Núcleos ', bold: true },
        { text: 'basófilos', color: '#6d28d9' },
      ],
    };
    textBlock.props.appearance = {
      bullets: true,
      bulletStyle: 'check',
      bulletColor: '#0f766e',
    };

    const table = createTableBlock();
    table.props.striped = true;
    table.props.compact = true;
    table.props.bordered = true;

    const divider = createDividerBlock({ lineStyle: 'gradient' });
    divider.props.label = 'Correlación clínica';
    divider.props.widthPercent = 80;

    const section = createNestedCanvasNode({
      children: [
        { block: textBlock, layout: { base: { span: 24 } } },
        { block: table, layout: { base: { span: 24 } } },
        { block: divider, layout: { base: { span: 24 } } },
      ],
    });
    const doc = createEmptyCanvasDoc('parte4-check', { children: [createPlacedBlock(section)] });

    const roundtrip = fromPuckData(toPuckData(doc));
    const rtSection = roundtrip.root.slots.children[0].block;
    expect(rtSection.type).toBe('canvas');
    if (rtSection.type !== 'canvas') return;

    const [rtText, rtTable, rtDiv] = rtSection.slots.children.map((c) => c.block);
    expect(rtText.type === 'text' && rtText.props.text.format).toBe('rich');
    expect(rtText.type === 'text' && rtText.props.appearance?.bulletStyle).toBe('check');
    expect(rtTable.type === 'table' && rtTable.props.striped).toBe(true);
    expect(rtTable.type === 'table' && rtTable.props.compact).toBe(true);
    expect(rtTable.type === 'table' && rtTable.props.bordered).toBe(true);
    expect(rtDiv.type === 'divider' && rtDiv.props.label).toBe('Correlación clínica');
    expect(rtDiv.type === 'divider' && rtDiv.props.widthPercent).toBe(80);
  });
});
