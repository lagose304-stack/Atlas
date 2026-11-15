import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MicroscopyChiefEditor from './MicroscopyChiefEditor';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), refreshSession: vi.fn(),
  user: { can_manage_microscopy: true },
}));
vi.mock('../services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshSession: mocks.refreshSession }) }));

describe('Jefatura independiente de Microscopia', () => {
  beforeEach(() => {
    mocks.user.can_manage_microscopy = true;
    mocks.rpc.mockReset();
    mocks.refreshSession.mockReset().mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'atlas_get_microscopy_chief') return { data: { user_id: 8, revision: 3 }, error: null };
      if (name === 'atlas_list_microscopy_candidates') return {
        data: [{ id: 8, nombre: 'Titular', username: 'titular@example.test' },
          { id: 9, nombre: 'Sucesor', username: 'sucesor@example.test' }], error: null,
      };
      return { data: null, error: null };
    });
  });

  it('oculta la opción y no consulta la jefatura sin autorización', () => {
    mocks.user.can_manage_microscopy = false;
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol: 'Administrador' }} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(['Instructor', 'Microscopía'])('no permite asignar la jefatura a un usuario %s', rol => {
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol }} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/solo puede asignarse a un usuario con rol Administrador/)).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('transfiere en una sola RPC con la revisión leída y refresca los permisos', async () => {
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol: 'Administrador' }} />);
    const checkbox = screen.getByRole('checkbox');
    await waitFor(() => expect(checkbox).toBeEnabled());
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_set_microscopy_chief', {
      p_user_id: 9, p_revision: 3,
    }));
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
  });

  it('permite retirar la función al titular y advierte antes de guardarlo', async () => {
    render(<MicroscopyChiefEditor target={{ id: 8, nombre: 'Titular', rol: 'Administrador' }} />);
    const checkbox = screen.getByRole('checkbox');
    await waitFor(() => expect(checkbox).toBeChecked());
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_set_microscopy_chief', {
      p_user_id: null, p_revision: 3,
    }));
    expect(window.confirm).toHaveBeenCalled();
  });

  it('no escribe si se cancela la transferencia', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol: 'Administrador' }} />);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('bloquea reintentos tras un conflicto en lugar de sobrescribir otra transferencia', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_get_microscopy_chief'
      ? { data: { user_id: 8, revision: 3 }, error: null }
      : { data: null, error: { code: '40001' } });
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol: 'Administrador' }} />);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    expect(await screen.findByRole('status')).toHaveTextContent('La jefatura cambió');
    expect(screen.getByRole('button', { name: 'Guardar jefatura' })).toBeDisabled();
  });

  it('distingue un rechazo SQL de un error de permisos y no confirma el guardado', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_get_microscopy_chief'
      ? { data: { user_id: 8, revision: 3 }, error: null }
      : { data: null, error: { code: '21000', message: 'UPDATE requires a WHERE clause' } });
    render(<MicroscopyChiefEditor target={{ id: 9, nombre: 'Sucesor', rol: 'Administrador' }} />);
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    expect(await screen.findByRole('status')).toHaveTextContent('La función de jefatura necesita una corrección SQL');
    expect(screen.queryByText(/Cambio guardado correctamente/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar jefatura' })).toBeDisabled();
  });

  it('ofrece selección limitada de usuarios cuando no hay un editor administrativo', async () => {
    render(<MicroscopyChiefEditor />);
    await screen.findByRole('option', { name: 'Sucesor (sucesor@example.test)' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jefatura' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_set_microscopy_chief', {
      p_user_id: 9, p_revision: 3,
    }));
  });
});
