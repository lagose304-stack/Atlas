import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
