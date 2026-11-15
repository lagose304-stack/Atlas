import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GestionUsuarios from './GestionUsuarios';

const mocks = vi.hoisted(() => ({
  user: { rol: 'Administrador', can_manage_microscopy: true },
  from: vi.fn(), rpc: vi.fn(),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshSession: vi.fn() }) }));
vi.mock('../services/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/BackButton', () => ({ default: () => null }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));
vi.mock('../hooks/usePreservedParam', () => ({ usePreservedParam: () => ['editar', vi.fn()] }));
vi.mock('../services/unifiedAuditService', () => ({ logAuditEvent: vi.fn() }));

describe('Jefatura desde la edición de usuarios', () => {
  beforeEach(() => {
    mocks.user.rol = 'Administrador';
    mocks.user.can_manage_microscopy = true;
    mocks.from.mockReset();
    mocks.rpc.mockReset().mockResolvedValue({ data: { user_id: null, revision: 0 }, error: null });
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      order: vi.fn().mockResolvedValue({ data: [
        { id: 9, nombre: 'Persona', username: 'persona@example.test', rol: 'Administrador', activo: true },
        { id: 1, nombre: 'Protegido', username: 'protegido@example.test', rol: 'Administrador', activo: true, is_protected: true },
      ], error: null }),
    };
    mocks.from.mockReturnValue(query);
  });

  it('muestra la casilla dentro del usuario seleccionado, sin añadir otro rol', async () => {
    render(<GestionUsuarios />);
    fireEvent.click(await screen.findByRole('button', { name: /Persona persona@example.test/ }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Jefe de Microscopia' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Administrador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar jefatura' })).toHaveAttribute('type', 'button');
  });

  it('permite asignar a un usuario protegido sin habilitar su edición general', async () => {
    render(<GestionUsuarios />);
    fireEvent.click(await screen.findByRole('button', { name: /Protegido protegido@example.test/ }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Jefe de Microscopia' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: /Guardar cambios/ })).not.toBeInTheDocument();
  });

  it('un administrador ordinario conserva la edición habitual sin ver la opción', async () => {
    mocks.user.can_manage_microscopy = false;
    render(<GestionUsuarios />);
    fireEvent.click(await screen.findByRole('button', { name: /Persona persona@example.test/ }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('la cuenta inicial sin rol administrador solo usa las RPC limitadas, sin consultar la tabla usuarios', async () => {
    mocks.user.rol = 'Instructor';
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === 'atlas_list_microscopy_candidates' ? [] : { user_id: 9, revision: 1 }, error: null,
    }));
    render(<GestionUsuarios />);
    await screen.findByRole('combobox');
    expect(screen.queryByRole('button', { name: /Crear usuario/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desactivar usuario/ })).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
