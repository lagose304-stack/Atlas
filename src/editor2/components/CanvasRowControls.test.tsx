import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CanvasRowControls from './CanvasRowControls';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('@puckeditor/core', () => ({ usePuck: () => ({ dispatch }) }));

describe('controles de filas del lienzo', () => {
  it.each([
    ['Quitar 8 filas', 32],
    ['Quitar 1 fila', 39],
    ['Añadir 1 fila', 41],
    ['Añadir 8 filas', 48],
  ])('%s ajusta las 40 filas al valor esperado', (label, minRows) => {
    dispatch.mockClear();
    render(<CanvasRowControls host={{ current: null }} minRows={40} />);
    fireEvent.click(screen.getByRole('button', { name: label }));

    const [action] = dispatch.mock.calls[0];
    const content = [{ type: 'text', props: { id: 'bloque' } }];
    const result = action.data({ root: { props: { minRows: 40 } }, content });
    expect(result.root.props.minRows).toBe(minRows);
    expect(result.content).toBe(content);
  });
});
