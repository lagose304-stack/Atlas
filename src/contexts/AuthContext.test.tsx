import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { ATLAS_SESSION_TOKEN_KEY } from '../services/supabase';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../services/supabase', () => ({
  ATLAS_SESSION_TOKEN_KEY: 'atlas_session_token',
  supabase: { rpc },
}));

vi.mock('../services/unifiedAuditService', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const SessionState = () => {
  const { isAuthenticated, isLoading } = useAuth();
  return <div>{isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'anonymous'}</div>;
};

const LoginState = () => {
  const { isLoading, login } = useAuth();
  return (
    <>
      <div>{isLoading ? 'loading' : 'ready'}</div>
      <button type="button" onClick={() => void login('admin', 'incorrecta')}>Ingresar</button>
    </>
  );
};

const AccountActions = () => {
  const { isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <>
      <div>{isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <button onClick={() => void login('ADMIN', 'clave-de-prueba')}>Entrar</button>
      <button onClick={logout}>Salir</button>
    </>
  );
};

const validSession = {
  data: {
    ok: true,
    user: { id: 1, username: 'admin', rol: 'Administrador', activo: true },
  },
  error: null,
};

describe('AuthProvider session validation', () => {
  beforeEach(() => {
    vi.useRealTimers();
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, String(value)),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
      },
    });
    localStorage.setItem(ATLAS_SESSION_TOKEN_KEY, 'valid-token');
    rpc.mockReset();
  });

  it('conserva la sesión cuando una revalidación falla temporalmente', async () => {
    rpc.mockResolvedValueOnce(validSession);
    render(<AuthProvider><SessionState /></AuthProvider>);
    await screen.findByText('authenticated');

    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(4), { timeout: 4000 });
    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBe('valid-token');
  });

  it('cierra la sesión cuando el servidor confirma que ya no es válida', async () => {
    rpc.mockResolvedValueOnce(validSession);
    render(<AuthProvider><SessionState /></AuthProvider>);
    await screen.findByText('authenticated');

    rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    act(() => window.dispatchEvent(new Event('online')));

    await screen.findByText('anonymous');
    expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('atlas_user')).toBeNull();
    expect(localStorage.getItem('atlas_auth')).toBeNull();
  });

  it('guarda la sesión confirmada al entrar y la elimina al salir', async () => {
    localStorage.clear();
    rpc.mockResolvedValueOnce({
      data: { ...validSession.data, token: 'token-de-prueba', status: 'success' },
      error: null,
    });
    render(<AuthProvider><AccountActions /></AuthProvider>);
    await screen.findByText('anonymous');

    act(() => screen.getByRole('button', { name: 'Entrar' }).click());
    await screen.findByText('authenticated');
    expect(rpc).toHaveBeenCalledWith('atlas_login', {
      p_username: 'admin', p_password: 'clave-de-prueba',
    });
    expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBe('token-de-prueba');
    expect(JSON.parse(localStorage.getItem('atlas_user')!)).toEqual(validSession.data.user);

    rpc.mockResolvedValueOnce({ data: null, error: null });
    act(() => screen.getByRole('button', { name: 'Salir' }).click());
    await screen.findByText('anonymous');
    expect(rpc).toHaveBeenCalledWith('atlas_logout');
    expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('atlas_user')).toBeNull();
    expect(localStorage.getItem('atlas_auth')).toBeNull();
  });

  it.each(['invalid_credentials', 'user_deactivated', 'locked'])(
    'no crea una sesión cuando el servidor responde %s', async status => {
      localStorage.clear();
      rpc.mockResolvedValueOnce({ data: { ok: false, status }, error: null });
      render(<AuthProvider><AccountActions /></AuthProvider>);
      await screen.findByText('anonymous');

      await act(async () => screen.getByRole('button', { name: 'Entrar' }).click());
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(screen.getByText('anonymous')).toBeInTheDocument();
      expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem('atlas_user')).toBeNull();
    },
  );

  it('restaura la sesión guardada si la página carga durante una caída temporal', async () => {
    localStorage.setItem('atlas_user', JSON.stringify(validSession.data.user));
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

    render(<AuthProvider><SessionState /></AuthProvider>);

    await screen.findByText('authenticated', {}, { timeout: 4000 });
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)).toBe('valid-token');
  });

  it('no vuelve a poner toda la aplicacion en carga durante un intento de login', async () => {
    localStorage.clear();
    let finishLogin!: (value: unknown) => void;
    rpc.mockImplementationOnce(() => new Promise((resolve) => { finishLogin = resolve; }));

    render(<AuthProvider><LoginState /></AuthProvider>);
    await screen.findByText('ready');

    act(() => screen.getByRole('button', { name: 'Ingresar' }).click());

    expect(screen.getByText('ready')).toBeInTheDocument();

    await act(async () => {
      finishLogin({ data: { ok: false, status: 'invalid_credentials' }, error: null });
    });
  });
});
