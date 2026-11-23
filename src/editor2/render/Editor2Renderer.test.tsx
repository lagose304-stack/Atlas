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
  createCarouselBlock,
  createCalloutBlock,
  createCompareBlock,
  createDividerBlock,
  createEmptyCanvasDoc,
  createGifBlock,
  createHeadingBlock,
  createImageBlock,
  createIconBlock,
  createLeafPlacedBlock,
  createNestedCanvasNode,
  createPlacedBlock,
  createTableBlock,
  createTextBlock,
  createVideoBlock,
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
  it.each(['preview', 'public'] as const)('conserva el aspecto de GIF y video tras guardar y reabrir en %s', variant => {
    const gif = createGifBlock({ src: 'https://example.com/tejido.gif', alt: 'Mitosis', caption: 'Pie de GIF' });
    gif.props.media = { aspect: '3/4', stageBackground: '#f3e1e7', showCaption: false, radius: 2 };
    const video = createVideoBlock({ url: 'https://example.com/tejido.mp4', caption: 'Pie de video', aspect: '1/1' });
    video.props.media = { showCaption: true, captionAlign: 'right', stageBackground: '#102a43', radius: 10 };
    const legacyVideo = createVideoBlock({ url: 'https://example.com/archivo.mp4', caption: 'Pie anterior', aspect: '4/3' });
    const doc = createEmptyCanvasDoc('home', { children: [gif, video, legacyVideo].map(block => createPlacedBlock(block)) });
    const reopened = fromPuckData(JSON.parse(JSON.stringify(toPuckData(doc))));
    expect(reopened).toEqual(doc);
    const { container } = render(<Editor2Renderer doc={reopened} variant={variant} />);

    expect(screen.getByAltText('Mitosis')).toHaveAttribute('src', gif.props.src);
    expect(screen.queryByText('Pie de GIF')).not.toBeInTheDocument();
    expect(container.querySelector('[data-e2-block="gif"] .e2-media-stage')).toHaveStyle({ aspectRatio: '3 / 4' });
    expect(screen.getByText('Pie de video')).toHaveStyle({ textAlign: 'right' });
    expect(container.querySelector('video[src="https://example.com/tejido.mp4"]')).toHaveAttribute('controls');
    expect(container.querySelector('.e2-video-stage')).toHaveStyle({ aspectRatio: '1 / 1', borderRadius: '10px' });
    expect(screen.getByText('Pie anterior').previousElementSibling).toHaveStyle({ aspectRatio: '4 / 3' });
  });

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

  it.each(['preview', 'public'] as const)('muestra los ajustes de diseño guardados en %s', (variant) => {
    const heading = createHeadingBlock({ text: 'Epitelio' });
    heading.props.textSizePreset = 'huge';
    const paragraph = createTextBlock({ text: 'Tejido de revestimiento' });
    paragraph.props.appearance = { color: '#413176', font: 'Fraunces' };
    const badge = createBadgeBlock({ text: 'Muestra', variant: 'outline', color: '#725588' });
    const icon = createIconBlock({ name: 'microscope', frame: 'circle', bgColor: '#efe5f3' });
    const callout = createCalloutBlock({ tone: 'clinical' });
    const table = createTableBlock({ headers: ['Tejido'], rows: [['Epitelio']] });
    table.props.striped = true;
    const divider = createDividerBlock({ lineStyle: 'dashed', thickness: 3, color: '#654987' });
    const button = createButtonBlock({ label: 'Ver epitelio', href: '/temario' });
    button.props.textSizePreset = 'extra-large';
    const image = createImageBlock({ alt: 'Detalle del tejido', caption: 'Pie de imagen oculto', fit: 'cover' });
    const carousel = createCarouselBlock({ fit: 'cover' });
    const compare = createCompareBlock({ leftLabel: 'Vista 10×', rightLabel: 'Vista 40×' });
    compare.props.fit = 'cover';
    for (const block of [image, carousel, compare]) {
      block.props.media = { aspect: '16/9', radius: 12, stageBackground: '#eeddf1', showCaption: false, objectPosition: 'left' };
    }
    const blocks = [heading, paragraph, badge, icon, callout, table, divider, button, image, carousel, compare];
    for (const block of blocks) {
      block.props.style = {
        border: { style: 'solid', width: 2, color: '#725588', sides: 'left' },
        opacity: 0.8,
        motion: { entrance: 'slide-up', hover: 'lift' },
      };
    }
    const doc = createEmptyCanvasDoc('home', { children: blocks.map(block => createPlacedBlock(block)) });
    const snapshot = fromPuckData(toPuckData(doc));
    expect(snapshot).toEqual(doc);
    const { container } = render(<Editor2Renderer doc={snapshot} variant={variant} />);
    expect(container.firstElementChild).toHaveClass('editor2-scope');
    for (const block of blocks) {
      expect(container.querySelector(`[data-e2-block="${block.type}"]`)).toHaveClass('e2-anim-in--slide-up', 'e2-hover--lift');
    }
    expect(screen.getByRole('heading', { name: 'Epitelio' }).parentElement).toHaveAttribute('data-e2-text-size-preset', 'huge');
    expect(screen.getByText('Tejido de revestimiento')).toHaveStyle({ color: '#413176', fontFamily: 'Fraunces' });
    expect(container.querySelector('.e2-icon-frame')).toHaveClass('e2-icon-frame--circle');
    expect(container.querySelector('.e2-block--callout')).toHaveClass('e2-callout--clinical');
    expect(container.querySelector('.e2-table')).toHaveClass('e2-table--striped');
    expect(container.querySelector('.e2-divider-line')).toHaveStyle({ borderTop: '3px dashed #654987' });
    expect(screen.getByRole('link', { name: 'Ver epitelio' })).toHaveAttribute('data-e2-text-size-preset', 'extra-large');
    expect(container.querySelectorAll('.e2-media-stage > img')).toHaveLength(4);
    for (const img of container.querySelectorAll('.e2-media-stage > img')) {
      expect(img).toHaveStyle({ objectFit: 'cover', objectPosition: 'left' });
      expect(img.parentElement).toHaveStyle({ borderRadius: '12px', backgroundColor: '#eeddf1' });
    }
    expect(container.querySelector('.e2-media-caption')).toBeNull();
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
