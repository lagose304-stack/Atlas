import { fireEvent, render, screen } from '@testing-library/react';
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
