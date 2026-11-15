import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HoldToRevealCodeInput from './HoldToRevealCodeInput';

describe('Código visible solo mientras se mantiene presionado', () => {
  beforeEach(() => { vi.stubGlobal('PointerEvent', MouseEvent); });
  afterEach(() => { vi.unstubAllGlobals(); });
  const renderInput = () => {
    render(<HoldToRevealCodeInput label="Código" value="001234" readOnly />);
    return { input: screen.getByLabelText('Código'), button: screen.getByRole('button', { name: 'Mantén presionado para ver el código' }) };
  };

  it('se oculta por defecto, se revela al presionar y se oculta al soltar fuera del botón', () => {
    const { input, button } = renderInput();
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.pointerDown(button, { button: 0 });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('001234');
    fireEvent.pointerUp(window);
    expect(input).toHaveAttribute('type', 'password');
  });

  it.each(['pointerLeave', 'pointerCancel', 'lostPointerCapture', 'blur'] as const)('se oculta si ocurre %s', event => {
    const { input, button } = renderInput();
    fireEvent.pointerDown(button, { button: 0 });
    expect(input).toHaveAttribute('type', 'text');
    fireEvent[event](button);
    expect(input).toHaveAttribute('type', 'password');
  });

  it.each(['blur', 'visibilitychange'])('se oculta al cambiar la ventana o la pestaña: %s', event => {
    const { input, button } = renderInput();
    fireEvent.pointerDown(button, { button: 0 });
    fireEvent(event === 'blur' ? window : document, new Event(event));
    expect(input).toHaveAttribute('type', 'password');
  });

  it.each([' ', 'Enter'])('admite mantener la tecla %s sin enviar el formulario', key => {
    const submit = vi.fn(e => e.preventDefault());
    render(<form onSubmit={submit}><HoldToRevealCodeInput label="Código" value="001234" readOnly /></form>);
    const button = screen.getByRole('button');
    const input = screen.getByLabelText('Código');
    fireEvent.keyDown(button, { key });
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.keyUp(button, { key });
    expect(input).toHaveAttribute('type', 'password');
    expect(submit).not.toHaveBeenCalled();
  });

  it('un clic no activa un modo de visibilidad permanente y el botón secundario no revela el código', () => {
    const { input, button } = renderInput();
    fireEvent.click(button);
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.pointerDown(button, { button: 2 });
    expect(input).toHaveAttribute('type', 'password');
  });

  it('se oculta cuando se borra el código al guardar o se deshabilita el campo', () => {
    const view = render(<HoldToRevealCodeInput label="Código" value="001234" readOnly />);
    fireEvent.pointerDown(screen.getByRole('button'), { button: 0 });
    view.rerender(<HoldToRevealCodeInput label="Código" value="" disabled readOnly />);
    expect(screen.getByLabelText('Código')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
