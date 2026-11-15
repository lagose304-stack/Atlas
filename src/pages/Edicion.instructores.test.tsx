import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Edicion from './Edicion';
import PruebaInstructores from './PruebaInstructores';
import PrivateRoute from '../components/PrivateRoute';

const auth = vi.hoisted(() => ({
  user: { id: 4, username: 'owner@example.test', rol: 'Administrador', can_manage_microscopy: true },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({
  user: auth.user, isAuthenticated: true, isLoading: false, logout: vi.fn(),
}) }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/BackButton', () => ({ default: () => null }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));
vi.mock('../services/securityAudit', () => ({ logSecurityEvent: vi.fn() }));
vi.mock('../services/instructorTests', () => ({ listInstructorTests: vi.fn().mockResolvedValue([]) }));

describe('Entrada a prueba de instructores', () => {
  it.each([
    { id: 4, authority: true, visible: true },
    { id: 9, authority: true, visible: true },
    { id: 10, authority: false, visible: false },
  ])('muestra el botón solo a la cuenta inicial y al titular ($id)', async ({ id, authority, visible }) => {
    auth.user = { id, username: 'admin@example.test', rol: 'Administrador', can_manage_microscopy: authority };
    render(<MemoryRouter initialEntries={['/edicion']}><Routes>
      <Route path="/edicion" element={<Edicion />} />
      <Route path="/pruebas/instructores" element={<PrivateRoute requireMicroscopyManager><PruebaInstructores /></PrivateRoute>} />
    </Routes></MemoryRouter>);
    const button = screen.queryByRole('button', { name: 'Prueba de instructores' });
    if (!visible) {
      expect(button).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument();
      return;
    }
    expect(button).toBeInTheDocument();
    fireEvent.click(button!);
    expect(screen.getByRole('heading', { name: 'Prueba de instructores' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva prueba' })).toBeEnabled());
  });
});
