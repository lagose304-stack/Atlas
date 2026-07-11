import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivateRoute from './PrivateRoute';

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

const renderProtectedRoute = (allowedRoles?: Array<'Administrador' | 'Microscopía' | 'Instructor'>) => render(
  <MemoryRouter initialEntries={['/privada']}>
    <Routes>
      <Route path="/" element={<div>Página pública</div>} />
      <Route path="/acceso-denegado" element={<div>Acceso denegado</div>} />
      <Route
        path="/privada"
        element={(
          <PrivateRoute allowedRoles={allowedRoles}>
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
});
