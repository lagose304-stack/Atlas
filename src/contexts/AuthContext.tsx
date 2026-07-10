import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ATLAS_SESSION_TOKEN_KEY, supabase } from '../services/supabase';
import type { UserRole } from '../security/permissions';

interface AuthUser {
  id: number;
  username: string;
  rol?: UserRole;
  activo?: boolean;
  session_version?: number;
  is_protected?: boolean;
}

export type LoginStatus =
  | 'success' | 'missing_credentials' | 'credentials_with_whitespace'
  | 'locked' | 'backend_unavailable' | 'invalid_credentials'
  | 'user_deactivated' | 'login_exception';

export interface LoginResult {
  ok: boolean;
  status: LoginStatus;
  message: string;
  lockoutRemainingMs?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  user: AuthUser | null;
}

type SessionResponse = {
  ok?: boolean;
  status?: LoginStatus;
  token?: string;
  user?: AuthUser;
  lockout_remaining_ms?: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_KEY = 'atlas_user';

const messageForStatus = (status: LoginStatus, remainingMs?: number) => {
  if (status === 'locked') {
    const minutes = Math.max(1, Math.ceil((remainingMs || 0) / 60000));
    return `Acceso temporalmente bloqueado. Intenta de nuevo en ${minutes} min.`;
  }
  if (status === 'user_deactivated') return 'Tu cuenta está desactivada. Contacta al administrador.';
  if (status === 'backend_unavailable') return 'No se pudo conectar con el servicio de autenticación.';
  return 'Usuario o contraseña incorrectos.';
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearLocalSession = () => {
    localStorage.removeItem(ATLAS_SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('atlas_auth');
    setUser(null);
    setIsAuthenticated(false);
  };

  const acceptSession = (nextUser: AuthUser, token?: string) => {
    if (token) localStorage.setItem(ATLAS_SESSION_TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    localStorage.setItem('atlas_auth', 'true');
    setUser(nextUser);
    setIsAuthenticated(true);
  };

  const validateSession = async () => {
    if (!localStorage.getItem(ATLAS_SESSION_TOKEN_KEY)) {
      clearLocalSession();
      return false;
    }
    const { data, error } = await supabase.rpc('atlas_validate_session');
    const result = data as SessionResponse | null;
    if (error || !result?.ok || !result.user) {
      clearLocalSession();
      return false;
    }
    acceptSession(result.user);
    return true;
  };

  const login = async (username: string, password: string): Promise<LoginResult> => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password) {
      return { ok: false, status: 'missing_credentials', message: 'Debes ingresar usuario y contraseña.' };
    }
    if (/\s/.test(username) || /\s/.test(password)) {
      return { ok: false, status: 'credentials_with_whitespace', message: 'Usuario y contraseña no pueden contener espacios en blanco.' };
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('atlas_login', {
        p_username: normalizedUsername,
        p_password: password,
      });
      if (error) {
        return { ok: false, status: 'backend_unavailable', message: messageForStatus('backend_unavailable') };
      }
      const result = data as SessionResponse;
      const status = result.status || 'invalid_credentials';
      if (!result.ok || !result.token || !result.user) {
        return {
          ok: false,
          status,
          message: messageForStatus(status, result.lockout_remaining_ms),
          lockoutRemainingMs: result.lockout_remaining_ms,
        };
      }
      acceptSession(result.user, result.token);
      return { ok: true, status: 'success', message: 'Inicio de sesión exitoso.' };
    } catch {
      return { ok: false, status: 'login_exception', message: 'Error de conexión al iniciar sesión.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    void (async () => {
      try {
        await supabase.rpc('atlas_logout');
      } finally {
        clearLocalSession();
      }
    })();
  };

  useEffect(() => {
    void validateSession().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => void validateSession(), 60_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
};
