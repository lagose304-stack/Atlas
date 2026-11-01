import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoldField from './BoldField';

afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(document, 'execCommand'); });

describe('BoldField: escritura dentro del visor', () => {
  it('habilita corrector español y permite espacios, copia y el menú ortográfico', () => {
    const change = vi.fn();
    const contextMenu = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<div onContextMenu={contextMenu}><BoldField value="" onChange={change} placeholder="Nombre" /></div>);
    const field = screen.getByRole('textbox', { name: 'Nombre' });
    expect(field).toHaveAttribute('spellcheck', 'true');
    expect(field).toHaveAttribute('lang', 'es');
    expect(field).toHaveStyle({ whiteSpace: 'pre' });
    expect(fireEvent.keyDown(field, { key: ' ', code: 'Space' })).toBe(true);
    expect(fireEvent.keyDown(field, { key: 'c', ctrlKey: true })).toBe(true);
    expect(fireEvent.contextMenu(field)).toBe(true);
    expect(contextMenu).not.toHaveBeenCalled();
    field.innerHTML = 'Núcleo  de célula';
    fireEvent.input(field);
    expect(change).toHaveBeenLastCalledWith('Núcleo  de célula');
  });

  it('conserva espacios tras saltos de línea y negritas al guardar comentarios', () => {
    const change = vi.fn();
    render(<BoldField as="textarea" value="" onChange={change} />);
    const field = screen.getByRole('textbox');
    field.innerHTML = '<strong>Núcleo</strong><br>  segunda línea';
    fireEvent.input(field);
    expect(change).toHaveBeenLastCalledWith('**Núcleo**\n  segunda línea');
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(true);
    field.innerHTML = 'Primera línea<div>  segunda línea</div><div>tercera línea</div>';
    fireEvent.input(field);
    expect(change).toHaveBeenLastCalledWith('Primera línea\n  segunda línea\ntercera línea');
  });

  it('acepta negrita con botón y atajos, sin interceptar composición de texto', () => {
    const command = vi.fn();
    Object.defineProperty(document, 'execCommand', { configurable: true, value: command });
    render(<BoldField value="Texto" onChange={vi.fn()} />);
    const field = screen.getByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: /Negrita/ }));
    fireEvent.keyDown(field, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(field, { key: 'n', metaKey: true });
    expect(command).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(field, { key: 'b', ctrlKey: true, isComposing: true });
    expect(command).toHaveBeenCalledTimes(3);
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
  });

  it('deshabilita también la acción de negrita cuando el campo está bloqueado', () => {
    render(<BoldField value="Texto" onChange={vi.fn()} disabled inline />);
    expect(screen.getByRole('button', { name: /Negrita/ })).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
  });

  it('conserva la selección al pasar al botón de negrita y respeta el pegado de texto', () => {
    const command = vi.fn();
    Object.defineProperty(document, 'execCommand', { configurable: true, value: command });
    const props = { value: '**Núcleo**', onChange: vi.fn() };
    const { rerender } = render(<BoldField {...props} />);
    const field = screen.getByRole('textbox');
    field.innerHTML = '<b>Núcleo</b>';
    const range = document.createRange();
    range.selectNodeContents(field.firstChild!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.blur(field);
    rerender(<BoldField {...props} />);
    expect(field.innerHTML).toBe('<b>Núcleo</b>');
    window.getSelection()!.removeAllRanges();
    fireEvent.click(screen.getByRole('button', { name: /Negrita/ }));
    expect(window.getSelection()!.toString()).toBe('Núcleo');
    fireEvent.paste(field, { clipboardData: { getData: () => 'una\r\ndos\ntres' } });
    expect(command).toHaveBeenLastCalledWith('insertText', false, 'una dos tres');
  });
});
