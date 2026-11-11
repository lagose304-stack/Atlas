import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnsavedChangesDialog from './UnsavedChangesDialog';

describe('Salida con cambios sin guardar', () => {
  it('permite cancelar sin abandonar la edición', () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<UnsavedChangesDialog onCancel={onCancel} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Salir sin guardar' })).not.toBeInTheDocument();
  });

  it('espera el guardado y evita acciones duplicadas mientras está pendiente', async () => {
    let finish!: (saved: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    render(<UnsavedChangesDialog onCancel={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(onSave).toHaveBeenCalledOnce();
    await act(async () => finish(false));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron guardar');
    expect(screen.getByRole('button', { name: 'Guardar y salir' })).toBeEnabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('trata Escape como cancelar y mantiene el foco dentro del cuadro', () => {
    const onCancel = vi.fn();
    render(<UnsavedChangesDialog onCancel={onCancel} onSave={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    const save = screen.getByRole('button', { name: 'Guardar y salir' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
