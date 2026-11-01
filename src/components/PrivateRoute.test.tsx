import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivateRoute from './PrivateRoute';
import type { ComponentProps } from 'react';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: false,
    user: null as null | { id: number; username: string; rol: 'Administrador' | 'Microscopía' | 'Instructor' },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState.current,
}));

vi.mock('../services/securityAudit', () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

const renderProtectedRoute = (
  allowedRoles?: Array<'Administrador' | 'Microscopía' | 'Instructor'>,
  restrictions: Pick<ComponentProps<typeof PrivateRoute>, 'allowedUserIds' | 'requireProtectedUser'> = {},
) => render(
  <MemoryRouter initialEntries={['/privada']}>
    <Routes>
      <Route path="/" element={<div>Página pública</div>} />
      <Route path="/acceso-denegado" element={<div>Acceso denegado</div>} />
      <Route
        path="/privada"
        element={(
          <PrivateRoute allowedRoles={allowedRoles} {...restrictions}>
            <div>Contenido privado</div>
          </PrivateRoute>
        )}
      />
    </Routes>
  </MemoryRouter>,
);

describe('PrivateRoute', () => {
  beforeEach(() => {
    authState.current = { isAuthenticated: false, isLoading: false, user: null };
  });

  it('redirige al inicio cuando no existe una sesión', () => {
    renderProtectedRoute(['Administrador']);
    expect(screen.getByText('Página pública')).toBeInTheDocument();
  });

  it('no muestra contenido privado ni redirige mientras se verifica la sesión', () => {
    authState.current.isLoading = true;
    renderProtectedRoute(['Administrador']);
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument();
    expect(screen.queryByText('Página pública')).not.toBeInTheDocument();
    expect(screen.getByText('Verificando acceso…')).toBeInTheDocument();
  });

  it.each([
    { id: 4, role: 'Administrador' as const, expected: 'Contenido privado' },
    { id: 5, role: 'Administrador' as const, expected: 'Acceso denegado' },
    { id: 4, role: 'Instructor' as const, expected: 'Acceso denegado' },
  ])('aplica conjuntamente rol e identidad para $role con ID $id', ({ id, role, expected }) => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id, username: 'usuario_prueba', rol: role },
    };
    renderProtectedRoute(['Administrador'], { allowedUserIds: [4] });
    expect(screen.getByText(expected)).toBeInTheDocument();
    if (expected === 'Acceso denegado') {
      expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument();
    }
  });

  it('permite entrar cuando el rol está autorizado', () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, username: 'admin', rol: 'Administrador' },
    };
    renderProtectedRoute(['Administrador']);
    expect(screen.getByText('Contenido privado')).toBeInTheDocument();
  });

  it('redirige a acceso denegado cuando el rol no está autorizado', () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 2, username: 'instructor', rol: 'Instructor' },
    };
    renderProtectedRoute(['Administrador', 'Microscopía']);
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });

  it('bloquea a usuarios sin is_protected cuando requireProtectedUser es true', () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 3, username: 'otro_admin', rol: 'Administrador', is_protected: false } as any,
    };
    render(
      <MemoryRouter initialEntries={['/historial']}>
        <Routes>
          <Route path="/acceso-denegado" element={<div>Acceso denegado</div>} />
          <Route
            path="/historial"
            element={(
              <PrivateRoute requireProtectedUser={true} allowedRoles={['Administrador']}>
                <div>Historial Privado</div>
              </PrivateRoute>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });

  it('permite el acceso cuando el usuario tiene is_protected = true', () => {
    authState.current = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: 1, username: 'superadmin', rol: 'Administrador', is_protected: true } as any,
    };
    render(
      <MemoryRouter initialEntries={['/historial']}>
        <Routes>
          <Route path="/acceso-denegado" element={<div>Acceso denegado</div>} />
          <Route
            path="/historial"
            element={(
              <PrivateRoute requireProtectedUser={true} allowedRoles={['Administrador']}>
                <div>Historial Privado</div>
              </PrivateRoute>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Historial Privado')).toBeInTheDocument();
  });
});
