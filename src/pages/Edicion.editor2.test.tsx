import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../security/permissions';
import Edicion from './Edicion';

const auth = vi.hoisted(() => ({
  user: {
    id: 4,
    username: 'edicion@example.test',
    rol: 'Administrador' as UserRole,
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: auth.user,
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/BackButton', () => ({ default: () => null }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));

const renderEdicion = () => render(
  <MemoryRouter initialEntries={['/edicion']}>
    <Edicion />
  </MemoryRouter>,
);

describe('tarjeta de entrada al editor 2.0 en Edición', () => {
  it.each(['Administrador', 'Microscopía'] as const)('aparece para el rol %s', (role) => {
    auth.user.rol = role;
    renderEdicion();

    expect(screen.getByRole('heading', { name: 'Editor de páginas 2.0' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir editor 2.0 →' })).toHaveAttribute('href', '/editor-paginas-v2');
    expect(screen.getByRole('link', { name: 'Abrir editor →' })).toHaveAttribute('href', '/editor-paginas');
  });

  it('oculta la entrada al rol Instructor', () => {
    auth.user.rol = 'Instructor';
    renderEdicion();

    expect(screen.queryByRole('link', { name: 'Abrir editor 2.0 →' })).not.toBeInTheDocument();
  });
});
