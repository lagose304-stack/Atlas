import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditor2Store } from '../store/editor2Store';
import DesignInspector from './DesignInspector';
import GradientPicker from './GradientPicker';

const mockDispatch = vi.fn();
const mockGetSelectorForId = vi.fn();
let mockSelectedItem: Record<string, unknown> | null = null;

vi.mock('@puckeditor/core', () => ({
  usePuck: () => ({
    getParentById: () => undefined,
    selectedItem: mockSelectedItem,
    dispatch: mockDispatch,
    getSelectorForId: mockGetSelectorForId,
  }),
}));

describe('DesignInspector (Fase 2 — Parte 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditor2Store.getState().reset();
    mockGetSelectorForId.mockReturnValue({ index: 0, zone: 'canvas-1:content' });
    mockSelectedItem = {
      type: 'box',
      props: {
        id: 'box-1',
        layout: { base: { span: 12 } },
        style: {
          background: { type: 'solid', color: '#f0f9ff' },
          shadow: 'soft',
        },
      },
    };
  });

  it('activa la distribución en fila sin perder el diseño de la tarjeta', () => {
    render(<DesignInspector />);
    const distribution = screen.getByLabelText('Distribución');
    expect(distribution).toHaveValue('grid');
    fireEvent.change(distribution, { target: { value: 'row' } });
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        props: expect.objectContaining({
          style: expect.objectContaining({ flow: { direction: 'row' }, shadow: 'soft' }),
        }),
      }),
    }));
  });

  it('cambia el color de fondo rápido y despacha el estilo actualizado', () => {
    render(<DesignInspector />);
    const input = screen.getByLabelText('Color de fondo rápido');
    fireEvent.change(input, { target: { value: '#ecfdf5' } });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'replace',
        data: expect.objectContaining({
          props: expect.objectContaining({
            style: expect.objectContaining({
              background: { type: 'solid', color: '#ecfdf5' },
              shadow: 'soft',
            }),
          }),
        }),
      }),
    );
  });

  it('copia y pega estilos entre bloques mediante el portapapeles del store', () => {
    render(<DesignInspector />);

    const pasteBtn = screen.getByRole('button', { name: /Pegar estilo/i });
    expect(pasteBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Copiar estilo/i }));
    expect(useEditor2Store.getState().copiedStyle).toEqual({
      background: { type: 'solid', color: '#f0f9ff' },
      shadow: 'soft',
    });

    expect(pasteBtn).not.toBeDisabled();
    fireEvent.click(pasteBtn);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'replace',
        data: expect.objectContaining({
          props: expect.objectContaining({
            style: {
              background: { type: 'solid', color: '#f0f9ff' },
              shadow: 'soft',
            },
          }),
        }),
      }),
    );
  });

  it('cambia alineación vertical en bloques no textuales', () => {
    render(<DesignInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'Centrar verticalmente' }));

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'replace',
        data: expect.objectContaining({
          props: expect.objectContaining({
            layout: { base: { span: 12, verticalAlign: 'center' } },
          }),
        }),
      }),
    );
  });

  it('restablece el diseño eliminando style de las props', () => {
    render(<DesignInspector />);
    fireEvent.click(screen.getByRole('button', { name: /Restablecer diseño/i, hidden: true }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const callArg = mockDispatch.mock.calls[0][0];
    expect(callArg.data.props.style).toBeUndefined();
  });

  it('aplica una plantilla al párrafo sin tocar su contenido y recupera el tamaño automático', () => {
    const props = {
      id: 'text-1',
      text: 'Un párrafo del atlas',
      richText: { format: 'rich', runs: [{ text: 'Un párrafo del atlas', bold: true }] },
      appearance: { bold: true, align: 'center' },
      layout: { base: { span: 8 } },
      style: { textSize: 32, responsive: { mobile: { textSize: 24 }, tablet: { textSize: 26 } }, motion: { entrance: 'fade' } },
    };
    mockSelectedItem = { type: 'text', props };
    const { rerender } = render(<DesignInspector editScreen="mobile" onEditScreenChange={vi.fn()} />);
    expect(screen.queryByLabelText('Tamaño del texto')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar ajustes de')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nota de estudio' }));
    const next = mockDispatch.mock.calls[0][0].data;
    expect(next.props).toEqual({
      ...props,
      appearance: { ...props.appearance, color: '#0b2545' },
      style: {
        motion: { entrance: 'fade' },
        background: { type: 'solid', color: '#f2f9fd' },
        border: { style: 'solid', sides: 'left', width: 3, color: '#0284c7' },
        padding: { mode: 'axis', x: 18, y: 12 },
      },
    });
    mockSelectedItem = next;
    rerender(<DesignInspector />);
    expect(screen.getByRole('button', { name: 'Nota de estudio' })).toHaveAttribute('aria-pressed', 'true');
    const spacing = screen.getByLabelText('Margen interior');
    fireEvent.change(spacing, { target: { value: '8' } });
    const customized = mockDispatch.mock.calls[1][0].data;
    expect(customized.props.style).toEqual({ ...next.props.style, padding: { mode: 'uniform', value: 8 } });
    mockSelectedItem = customized;
    rerender(<DesignInspector />);
    expect(screen.getByRole('button', { name: 'Nota de estudio' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('ofrece las mismas diez familias con una composición propia para el título', () => {
    mockSelectedItem = { type: 'text', props: { id: 'text-1' } };
    const { rerender } = render(<DesignInspector />);
    const paragraph = screen.getByRole('group', { name: 'Plantillas de párrafo' });
    const paragraphTemplates = Array.from(paragraph.querySelectorAll('.e2-text-template__label'), label => label.textContent);
    expect(paragraphTemplates).toHaveLength(10);
    expect(screen.queryByLabelText('Tamaño del texto')).not.toBeInTheDocument();

    const props = {
      id: 'heading-1',
      text: 'Epitelio simple',
      level: 3,
      richText: { format: 'rich', runs: [{ text: 'Epitelio simple', italic: true }] },
      style: { textSize: 40, responsive: { mobile: { textSize: 24 } } },
    };
    mockSelectedItem = { type: 'heading', props };
    rerender(<DesignInspector />);
    const heading = screen.getByRole('group', { name: 'Plantillas de título' });
    expect(Array.from(heading.querySelectorAll('.e2-text-template__label'), label => label.textContent)).toEqual(paragraphTemplates);
    const size = screen.getByLabelText('Tamaño del texto');
    expect(size).toHaveValue('');
    expect(within(size).getByText('Jumbo')).toHaveValue('jumbo');
    expect(within(size).getByText('Enorme')).toHaveValue('huge');
    fireEvent.change(size, { target: { value: 'normal' } });
    mockSelectedItem = mockDispatch.mock.calls[0][0].data;
    expect(mockSelectedItem?.props).toEqual({ ...props, textSizePreset: 'normal' });
    rerender(<DesignInspector />);
    fireEvent.click(within(heading).getByRole('button', { name: 'Nota de estudio' }));
    expect(mockDispatch.mock.calls[1][0].data.props).toEqual({
      ...props,
      textSizePreset: 'normal',
      appearance: { color: '#0b2545' },
      style: {
        border: { style: 'solid', sides: 'bottom', width: 2, color: '#0284c7' },
        padding: { mode: 'custom', b: 6 },
      },
    });
  });

  it('aplica una de las diez plantillas de insignia conservando el texto y la posición', () => {
    const props = { id: 'badge-1', text: 'Tejido epitelial', align: 'right', layout: { base: { span: 6 } } };
    mockSelectedItem = { type: 'badge', props };
    const { rerender, container } = render(<DesignInspector />);
    const gallery = screen.getByRole('group', { name: 'Plantillas de insignia' });
    expect(within(gallery).getAllByRole('button')).toHaveLength(10);
    fireEvent.click(within(gallery).getByRole('button', { name: 'Detalle de lámina' }));
    mockSelectedItem = mockDispatch.mock.calls[0][0].data;
    expect(mockSelectedItem?.props).toEqual({
      ...props, variant: 'swatch', size: 'md', color: '#986181', icon: 'scan-eye',
    });
    rerender(<DesignInspector />);
    const dialog = container.querySelector('dialog')!;
    dialog.setAttribute('open', '');
    const size = within(dialog).getByLabelText('Tamaño de insignia');
    expect(size).toHaveValue('md');
    fireEvent.change(size, { target: { value: 'lg' } });
    expect(mockDispatch.mock.calls[1][0].data.props).toMatchObject({ ...props, variant: 'swatch', size: 'lg' });
  });

  it.each([
    ['icon', 'Plantillas de icono', { name: 'dna', label: 'Tejido', align: 'right' }, { name: 'layers', label: 'Tejido', frame: 'rounded' }],
    ['callout', 'Plantillas de nota / aviso', { title: 'Resumen', text: 'Contenido' }, { title: 'Resumen', text: 'Contenido', tone: 'clinical' }],
    ['table', 'Plantillas de tabla', { headers: ['Tejido'], rows: [['Epitelio']] }, { headers: ['Tejido'], rows: [['Epitelio']], accentColor: '#cfe6f6', compact: true }],
    ['button', 'Plantillas de botón', { label: 'Ver muestra', href: '/temario', newTab: true, align: 'right' },
      { label: 'Ver muestra', href: '/temario', newTab: true, align: 'right', variant: 'gradient', color: '#255a83' }],
    ['divider', 'Plantillas de separador', { orientation: 'vertical', label: 'Capas' },
      { orientation: 'vertical', label: 'Capas', thickness: 4, color: '#6089ad', widthPercent: 60 }],
    ['examCarousel', 'Plantillas de pruebas por parcial', { parcial: 'segundo', title: 'Tejido epitelial', maxItems: 4 },
      { parcial: 'segundo', title: 'Tejido epitelial', maxItems: 4, accentColor: '#255a83' }],
  ])('aplica una plantilla de %s sin perder contenido ni posición', (type, galleryLabel, content, expected) => {
    const layout = { base: { span: 6, row: 2 } };
    mockSelectedItem = { type, props: { id: 'block-1', layout, ...content } };
    render(<DesignInspector />);
    const gallery = screen.getByRole('group', { name: galleryLabel });
    expect(within(gallery).getAllByRole('button')).toHaveLength(10);
    fireEvent.click(within(gallery).getByRole('button', { name: 'Definición' }));
    expect(mockDispatch.mock.calls[0][0].data.props).toMatchObject({ ...expected, layout });
  });

  it('muestra diez plantillas y permite editar la línea elegida desde Diseño', () => {
    mockSelectedItem = { type: 'text', props: { id: 'text-1', text: 'Epitelio' } };
    const { container, rerender } = render(<DesignInspector />);
    const gallery = screen.getByRole('group', { name: 'Plantillas de párrafo' });
    expect(within(gallery).getAllByRole('button')).toHaveLength(10);
    fireEvent.click(within(gallery).getByRole('button', { name: 'Detalle de lámina' }));
    const updateSelection = () => {
      const calls = mockDispatch.mock.calls;
      const next = calls[calls.length - 1][0].data;
      mockSelectedItem = next;
      rerender(<DesignInspector />);
      return next.props;
    };
    updateSelection();
    const dialog = container.querySelector('dialog')!;
    dialog.setAttribute('open', '');
    expect(dialog.querySelector('details > summary')).toHaveTextContent('Línea y borde');
    expect(dialog.querySelector('details')).toHaveAttribute('open');
    expect(within(dialog).getByRole('button', { name: 'Puntos' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(within(dialog).getByLabelText('Color de borde'), { target: { value: '#8b335b' } });
    updateSelection();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guiones' }));
    updateSelection();
    fireEvent.change(within(dialog).getByLabelText('Grosor del borde'), { target: { value: '5' } });
    updateSelection();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Derecha' }));
    expect(updateSelection()).toMatchObject({
      text: 'Epitelio',
      style: {
        background: { color: '#fdf6fa' },
        border: { style: 'dashed', sides: 'right', width: 5, color: '#8b335b' },
      },
    });
    expect(dialog.querySelector('.e2-border-preview')).toHaveStyle({ borderRight: '5px dashed #8b335b' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sin borde' }));
    expect(updateSelection().style.border).toBeUndefined();
    expect(dialog.querySelector('.e2-border-preview')).not.toBeInTheDocument();
  });
});

describe('GradientPicker', () => {
  it('permite alternar radial/lineal y añadir un tercer color', () => {
    const onChange = vi.fn();
    render(
      <GradientPicker
        value={{ kind: 'linear', angle: 135, stops: ['#f0f9ff', '#e0f2fe'] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Radial' }));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'radial',
      angle: 135,
      stops: ['#f0f9ff', '#e0f2fe'],
    });

    fireEvent.click(screen.getByRole('button', { name: /3\.er color/i }));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'linear',
      angle: 135,
      stops: ['#f0f9ff', '#e0f2fe', '#bae6fd'],
    });
  });
});
