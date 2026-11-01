import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import PlateEditorPanel from './PlateEditorPanel';
import * as AuthContextModule from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('PlateEditorPanel - Botón de actualizar imagen', () => {
  it('renderiza el botón "Actualizar imagen" cuando el usuario es Administrador', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 1, username: 'admin', rol: 'Administrador' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      isProtected: true,
    } as any);

    render(
      <PlateEditorPanel
        title="Editar placa"
        imageSrc="https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/sample.webp"
        aumento="10x"
        onAumentoChange={vi.fn()}
        showTincion={false}
        onShowTincion={vi.fn()}
        tincion=""
        onTincionChange={vi.fn()}
        senalados={[]}
        senaladosPos={[]}
        showComentario={false}
        onShowComentario={vi.fn()}
        comentario=""
        onComentarioChange={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /actualizar imagen/i });
    expect(button).toBeInTheDocument();
  });

  it('NO renderiza el botón "Actualizar imagen" cuando el rol no es Administrador', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 2, username: 'microscopista', rol: 'Microscopía' } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      isProtected: false,
    } as any);

    render(
      <PlateEditorPanel
        title="Editar placa"
        imageSrc="https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/placas/sample.webp"
        aumento="10x"
        onAumentoChange={vi.fn()}
        showTincion={false}
        onShowTincion={vi.fn()}
        tincion=""
        onTincionChange={vi.fn()}
        senalados={[]}
        senaladosPos={[]}
        showComentario={false}
        onShowComentario={vi.fn()}
        comentario=""
        onComentarioChange={vi.fn()}
      />
    );

    const button = screen.queryByRole('button', { name: /actualizar imagen/i });
    expect(button).toBeNull();
  });
});

describe('PlateEditorPanel - conservación de cambios sin guardar', () => {
  beforeEach(() => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: 4, username: 'usuario_prueba', rol: 'Microscopía' },
      isAuthenticated: true, isLoading: false, login: vi.fn(), logout: vi.fn(),
    });
  });

  const Editor = ({ onClose, onSave }: { onClose: () => void; onSave: (value: string) => void }) => {
    const [aumento, setAumento] = useState('x10');
    return (
      <PlateEditorPanel
        title="Placa de prueba local"
        aumento={aumento}
        onAumentoChange={setAumento}
        showTincion={false}
        onShowTincion={vi.fn()}
        tincion=""
        onTincionChange={vi.fn()}
        senalados={[]}
        senaladosPos={[]}
        showComentario={false}
        onShowComentario={vi.fn()}
        comentario=""
        onComentarioChange={vi.fn()}
        hasChanges={aumento !== 'x10'}
        onRequestClose={onClose}
        primaryActionLabel="Guardar cambios"
        primaryActionDisabled={aumento === 'x10'}
        onPrimaryAction={() => onSave(aumento)}
      />
    );
  };

  it('permite volver a la edición sin cerrar ni guardar al cancelar la salida', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<Editor onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'x40' }));
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(screen.getByText('¿Salir sin guardar?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.queryByText('¿Salir sin guardar?')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSave).toHaveBeenCalledWith('x40');
  });

  it('descarta cambios únicamente al confirmar la salida, sin guardarlos', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<Editor onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'x40' }));
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cierra directamente cuando no hay cambios y no ejecuta el guardado deshabilitado', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<Editor onClose={onClose} onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(screen.queryByText('¿Salir sin guardar?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
