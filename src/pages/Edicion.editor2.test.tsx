import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../security/permissions';
import Edicion from './Edicion';

const auth = vi.hoisted(() => ({
  user: {
    id: 4,
    username: 'elamlagos3@gmail.com',
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
  beforeEach(() => {
    auth.user.username = 'elamlagos3@gmail.com';
    auth.user.rol = 'Administrador';
  });

  it('aparece para la cuenta autorizada, incluso con espacios y mayúsculas', () => {
    auth.user.username = '  ELAMlagos3@GMAIL.com  ';
    renderEdicion();

    expect(screen.getByRole('heading', { name: 'Editor de páginas 2.0' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir editor 2.0 →' })).toHaveAttribute('href', '/editor-paginas-v2');
    expect(screen.getByRole('link', { name: 'Abrir editor →' })).toHaveAttribute('href', '/editor-paginas');
  });

  it('no aparece para otra cuenta aunque tenga permisos de edición', () => {
    auth.user.username = 'otra.cuenta@gmail.com';
    renderEdicion();

    expect(screen.queryByRole('heading', { name: 'Editor de páginas 2.0' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir editor →' })).toBeInTheDocument();
  });

  it('no aparece para la cuenta autorizada sin permiso de edición de páginas', () => {
    auth.user.rol = 'Instructor';
    renderEdicion();

    expect(screen.queryByRole('link', { name: 'Abrir editor 2.0 →' })).not.toBeInTheDocument();
  });
});
