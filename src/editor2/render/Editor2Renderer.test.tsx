import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// @dnd-kit/dom, que Puck importa aunque solo se use <Render>, exige
// ResizeObserver al cargar el módulo. jsdom no lo trae.
vi.hoisted(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

import {
  createBadgeBlock,
  createButtonBlock,
  createCalloutBlock,
  createEmptyCanvasDoc,
  createHeadingBlock,
  createImageBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTableBlock,
  createTextBlock,
} from '../domain/defaults';
import { ATLAS_PAGE_THEMES } from '../domain/styleSchema';
import Editor2Renderer from './Editor2Renderer';
import { fromPuckData, toPuckData } from '../adapters/puck';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CANVAS_ID = '22222222-2222-4222-8222-222222222222';
const HEADING_ID = '33333333-3333-4333-8333-333333333333';
const TEXT_ID = '44444444-4444-4444-8444-444444444444';
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
const NESTED_TEXT_ID = '66666666-6666-4666-8666-666666666666';

describe('Editor2Renderer', () => {
  it.each(['preview', 'public'] as const)('aplica la altura guardada en %s', (variant) => {
    const doc = createEmptyCanvasDoc('home');
    doc.root.props.minRows = 48;
    const { container } = render(<Editor2Renderer doc={doc} variant={variant} />);
    const canvas = container.querySelector<HTMLElement>('[data-e2-canvas-root]')!;
    expect(canvas.dataset.e2MinRows).toBe('48');
    expect(canvas.style.getPropertyValue('--e2-min-rows')).toBe('48');
  });

  it.each(['preview', 'public'] as const)('muestra los bloques de texto en modo de solo lectura en %s', (variant) => {
    const heading = createHeadingBlock();
    heading.props.text = { format: 'rich', runs: [{ text: 'Título con formato', bold: true }] };
    const doc = createEmptyCanvasDoc('home', {
      children: [
        heading,
        createTextBlock({ text: 'Texto del Atlas' }),
        createCalloutBlock(),
        createBadgeBlock(),
        createButtonBlock({ label: 'Consultar temario', href: '/temario' }),
        createTableBlock({ headers: ['Estructura'], rows: [['Epitelio']] }),
      ].map(block => createPlacedBlock(block)),
    });
    const { container } = render(<Editor2Renderer doc={doc} variant={variant} />);

    expect(screen.getByText('Título con formato')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('Texto del Atlas')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Epitelio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consultar temario' })).toHaveAttribute('href', '/temario');
    expect(container.firstElementChild).toHaveAttribute('contenteditable', 'false');
    expect(container.querySelector('[contenteditable="true"], [data-e2-editable], [data-e2-resize]')).toBeNull();
  });

  it('conserva la tipografía y el área de un componente al pasar a vista previa', () => {
    const text = createTextBlock({ text: 'Epitelio' });
    text.props.appearance = { font: 'Georgia', bold: true, size: 24 };
    const section = createNestedCanvasNode({ children: [{
      block: text, layout: { base: { start: 3.5, span: 6, row: 2.5, rowSpan: 3, verticalAlign: 'center' } },
    }] });
    const doc = createEmptyCanvasDoc('home', { children: [createPlacedBlock(section)] });
    const snapshot = fromPuckData(toPuckData(doc));
    expect(snapshot).toEqual(doc);
    render(<Editor2Renderer doc={snapshot} />);
    const paragraph = screen.getByText('Epitelio');
    expect(paragraph).toHaveStyle({ fontFamily: 'Georgia', fontWeight: '700' });
    expect(paragraph.style.fontSize).toBe('');
    expect(paragraph.parentElement?.style.getPropertyValue('--e2-column-base')).toBe('6 / span 12');
    expect(paragraph.parentElement?.style.getPropertyValue('--e2-row-base')).toBe('4 / span 6');
    expect(paragraph.parentElement?.style.getPropertyValue('--e2-align-lg')).toBe('center');
  });
  it('reserva el fondo de lienzo para edición y conserva el fondo de cada bloque', () => {
    const section = createNestedCanvasNode();
    section.props.style = { background: { type: 'solid', color: '#dbe7f3' } };
    const doc = createEmptyCanvasDoc('home', { children: [createPlacedBlock(section)] });
    doc.pageTheme = {
      ...ATLAS_PAGE_THEMES[0].theme,
      pageBgGradient: { kind: 'linear', angle: 135, stops: ['#ffffff', '#dbe7f3'] },
    };

    const { container, rerender } = render(<Editor2Renderer doc={doc} variant="public" />);
    for (const variant of ['public', 'preview'] as const) {
      rerender(<Editor2Renderer doc={doc} variant={variant} />);
      const root = container.querySelector<HTMLElement>('[data-e2-canvas-root]')!;
      expect(root.style.backgroundColor).toBe('');
      expect(root.style.backgroundImage).toBe('');
      expect(root.style.getPropertyValue('--e2-page-heading-font')).toContain('Montserrat');
      expect(container.querySelector('.e2-block--canvas')).toHaveStyle({ backgroundColor: '#dbe7f3' });
    }
  });

  it('pinta los primitivos y el lienzo anidado sin controles de edición', () => {
    const doc = createEmptyCanvasDoc('home', {
      id: ROOT_ID,
      children: [
        createPlacedBlock(createHeadingBlock({ id: HEADING_ID, level: 2, text: 'Anatomía' }), 12),
        createPlacedBlock(createTextBlock({ id: TEXT_ID, text: 'Texto de apoyo' }), 6),
        createPlacedBlock(
          createImageBlock({
            id: IMAGE_ID,
            src: 'https://r2.atlas-tests.invalid/placa.webp',
            alt: 'Placa de tejido',
            caption: 'Pie de placa',
          }),
          6,
        ),
        createPlacedBlock(
          createNestedCanvasNode({
            id: CANVAS_ID,
            children: [
              createLeafPlacedBlock(createTextBlock({ id: NESTED_TEXT_ID, text: 'Dentro del lienzo' }), 12),
            ],
          }),
          12,
        ),
      ],
    });

    const { container } = render(<Editor2Renderer doc={doc} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Anatomía' })).toBeInTheDocument();
    expect(screen.getByText('Texto de apoyo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Placa de tejido' })).toHaveAttribute(
      'src',
      'https://r2.atlas-tests.invalid/placa.webp',
    );
    expect(screen.getByText('Pie de placa')).toBeInTheDocument();
    expect(screen.getByText('Dentro del lienzo')).toBeInTheDocument();
    expect(container.querySelector('[data-puck-component]')).toBeNull();
    expect(container.querySelector('[data-e2-canvas-root] > div')).not.toBeNull();
    expect(container.querySelector('.e2-block--canvas .e2-slot-grid')).not.toBeNull();
  });
});
