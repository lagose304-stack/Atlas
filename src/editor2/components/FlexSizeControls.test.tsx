import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FlexSizeControls from './FlexSizeControls';
import { spanIntentSchema } from '../domain/schema';

describe('Tamaño de bloques en filas y columnas', () => {
  it('guarda el ancho sin perder las coordenadas de cuadrícula', () => {
    const onChange = vi.fn();
    render(<FlexSizeControls base={{ span: 8, start: 3, flexSize: 'fixed' }} onChange={onChange} />);
    const input = screen.getByLabelText('Ancho (px)');
    fireEvent.change(input, { target: { value: '312' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ span: 8, start: 3, flexSize: 'fixed', widthPx: 312 });
  });
  it('rechaza límites contradictorios y admite quitarlos', () => {
    const onChange = vi.fn();
    render(<FlexSizeControls base={{ span: 6, minWidthPx: 160, maxWidthPx: 300 }} onChange={onChange} />);
    const input = screen.getByLabelText('Máximo (px)');
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(spanIntentSchema.safeParse({span: 6, minWidthPx: 160, maxWidthPx: 120}).success).toBe(false);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({span: 6, minWidthPx: 160});
  });
});
