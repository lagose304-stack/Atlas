import React, { createContext, useState, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import type { UserRole } from '../security/permissions';
import { logSecurityEvent } from '../services/securityAudit';

interface AuthUser {
  id: number;
  username: string;
  rol?: UserRole;
  activo?: boolean;
  session_version?: number;
  is_protected?: boolean;
  auth_time?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const SESSION_CHECK_INTERVAL_MS = 60 * 1000;
  const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  const FAILED_ATTEMPTS_KEY = 'atlas_failed_attempts';
  const LOCKOUT_UNTIL_KEY = 'atlas_lockout_until';

  const persistSession = (nextUser: AuthUser) => {
    localStorage.setItem('atlas_user', JSON.stringify(nextUser));
    localStorage.setItem('atlas_auth', 'true');
  };

  const isLockedOut = (): boolean => {
    const lockoutUntilRaw = localStorage.getItem(LOCKOUT_UNTIL_KEY);
    if (!lockoutUntilRaw) {
      return false;
    }

    const lockoutUntil = Number(lockoutUntilRaw);
    if (Number.isNaN(lockoutUntil)) {
      localStorage.removeItem(LOCKOUT_UNTIL_KEY);
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      return false;
    }

    if (Date.now() >= lockoutUntil) {
      localStorage.removeItem(LOCKOUT_UNTIL_KEY);
      localStorage.removeItem(FAILED_ATTEMPTS_KEY);
      return false;
    }

    return true;
  };

  const incrementFailedAttempts = () => {
    const attempts = Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) ?? '0');
    const nextAttempts = Number.isNaN(attempts) ? 1 : attempts + 1;

    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(nextAttempts));
    if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(LOCKOUT_UNTIL_KEY, String(lockoutUntil));
    }
  };

  const clearFailedAttempts = () => {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  };

  const clearSession = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('atlas_user');
    localStorage.removeItem('atlas_auth');
  };

  const getUserById = async (userId: number): Promise<AuthUser | null> => {
    const primaryQuery = await supabase
      .from('usuarios')
      .select('id, username, rol, activo, session_version, is_protected')
      .eq('id', userId)
      .single();

    if (!primaryQuery.error && primaryQuery.data) {
      return primaryQuery.data as AuthUser;
    }

    const fallbackQuery = await supabase
      .from('usuarios')
      .select('id, username, rol, is_protected')
      .eq('id', userId)
      .single();

    if (fallbackQuery.error || !fallbackQuery.data) {
      return null;
    }

    const fallbackUser = fallbackQuery.data as AuthUser;
    return {
      ...fallbackUser,
      activo: true,
      session_version: 1,
      is_protected: fallbackUser.is_protected ?? false,
    };
  };

  const validatePersistedSession = async (): Promise<boolean> => {
    const savedAuth = localStorage.getItem('atlas_auth');
    const savedUser = localStorage.getItem('atlas_user');

    if (savedAuth !== 'true' || !savedUser) {
      return false;
    }

    try {
      const parsedUser = JSON.parse(savedUser) as AuthUser;
      if (!parsedUser?.id) {
        void logSecurityEvent('session_invalidated', {
          details: { reason: 'invalid_saved_user_payload' },
        });
        clearSession();
        return false;
      }

      const authTime = Number(parsedUser.auth_time);
      if (!authTime || Number.isNaN(authTime)) {
        void logSecurityEvent('session_invalidated', {
          userId: parsedUser.id,
          username: parsedUser.username,
          details: { reason: 'missing_auth_time' },
        });
        clearSession();
        return false;
      }

      if (Date.now() - authTime > SESSION_TIMEOUT_MS) {
        void logSecurityEvent('session_invalidated', {
          userId: parsedUser.id,
          username: parsedUser.username,
          details: { reason: 'session_timeout' },
        });
        clearSession();
        return false;
      }

      const dbUser = await getUserById(parsedUser.id);
      if (!dbUser) {
        void logSecurityEvent('session_invalidated', {
          userId: parsedUser.id,
          username: parsedUser.username,
          details: { reason: 'user_not_found' },
        });
        clearSession();
        return false;
      }

      const isActive = dbUser.activo !== false;
      if (!isActive) {
        void logSecurityEvent('session_invalidated', {
          userId: parsedUser.id,
          username: parsedUser.username,
          details: { reason: 'user_deactivated' },
        });
        clearSession();
        return false;
      }

      const previousSessionVersion = parsedUser.session_version ?? 1;
      const currentSessionVersion = dbUser.session_version ?? 1;
      if (currentSessionVersion !== previousSessionVersion) {
        void logSecurityEvent('session_invalidated', {
          userId: parsedUser.id,
          username: parsedUser.username,
          details: {
            reason: 'session_version_mismatch',
            previousSessionVersion,
            currentSessionVersion,
          },
        });
        clearSession();
        return false;
      }

      const normalizedUser: AuthUser = {
        ...dbUser,
        activo: true,
        session_version: currentSessionVersion,
        auth_time: authTime,
      };

      setUser(normalizedUser);
      setIsAuthenticated(true);
      persistSession(normalizedUser);
      return true;
    } catch (error) {
      console.error('Error validando sesion persistida:', error);
      void logSecurityEvent('session_invalidated', {
        details: { reason: 'validation_exception' },
      });
      clearSession();
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Validación básica
      if (!username || !password) {
        incrementFailedAttempts();
        void logSecurityEvent('login_failed', {
          username: username?.trim().toLowerCase() || null,
          details: { reason: 'missing_credentials' },
        });
        setIsLoading(false);
        return false;
      }

      if (isLockedOut()) {
        void logSecurityEvent('login_locked', {
          username: username.trim().toLowerCase(),
          details: { reason: 'lockout_active' },
        });
        setIsLoading(false);
        return false;
      }

      // Consultar la base de datos
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username, rol, activo, session_version, is_protected')
        .eq('username', username.trim().toLowerCase())
        .eq('password', password) // En producción usar bcrypt
        .single();

      let authUser: AuthUser | null = null;

      if (!error && data) {
        authUser = data as AuthUser;
      } else {
        const fallback = await supabase
          .from('usuarios')
          .select('id, username, rol, is_protected')
          .eq('username', username.trim().toLowerCase())
          .eq('password', password)
          .single();

        if (!fallback.error && fallback.data) {
          authUser = {
            ...(fallback.data as AuthUser),
            activo: true,
            session_version: 1,
            is_protected: (fallback.data as AuthUser).is_protected ?? false,
          };
        }
      }

      if (!authUser) {
        incrementFailedAttempts();
        void logSecurityEvent('login_failed', {
          username: username.trim().toLowerCase(),
          details: { reason: 'invalid_credentials' },
        });
        setIsLoading(false);
        return false;
      }

      if (authUser.activo === false) {
        incrementFailedAttempts();
        void logSecurityEvent('login_failed', {
          userId: authUser.id,
          username: authUser.username,
          details: { reason: 'user_deactivated' },
        });
        setIsLoading(false);
        return false;
      }

      // Login exitoso
      clearFailedAttempts();
      const normalizedUser: AuthUser = {
        ...authUser,
        activo: true,
        session_version: authUser.session_version ?? 1,
        is_protected: authUser.is_protected ?? false,
        auth_time: Date.now(),
      };

      setUser(normalizedUser);
      setIsAuthenticated(true);
      
      // Guardar en localStorage para persistencia
      persistSession(normalizedUser);
      void logSecurityEvent('login_success', {
        userId: normalizedUser.id,
        username: normalizedUser.username,
        details: { role: normalizedUser.rol ?? null },
      });
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error en login:', error);
      incrementFailedAttempts();
      void logSecurityEvent('login_failed', {
        username: username?.trim().toLowerCase() || null,
        details: { reason: 'login_exception' },
      });
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    void logSecurityEvent('logout', {
      userId: user?.id ?? null,
      username: user?.username ?? null,
    });
    clearSession();
  };

  // Verificar sesión al iniciar
  React.useEffect(() => {
    const checkAuth = async () => {
      await validatePersistedSession();
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void validatePersistedSession();
    }, SESSION_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      login,
      logout,
      user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};