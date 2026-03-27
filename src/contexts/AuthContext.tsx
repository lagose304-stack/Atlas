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
  const SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  const LEGACY_FAILED_ATTEMPTS_KEY = 'atlas_failed_attempts';
  const LEGACY_LOCKOUT_UNTIL_KEY = 'atlas_lockout_until';

  const normalizeUsername = (raw: string) => raw.trim().toLowerCase();

  const getFailedAttemptsKey = (normalizedUsername: string) =>
    `atlas_failed_attempts_${normalizedUsername || 'global'}`;

  const getLockoutUntilKey = (normalizedUsername: string) =>
    `atlas_lockout_until_${normalizedUsername || 'global'}`;

  const persistSession = (nextUser: AuthUser) => {
    localStorage.setItem('atlas_user', JSON.stringify(nextUser));
    localStorage.setItem('atlas_auth', 'true');
  };

  const clearLegacyLockoutKeys = () => {
    localStorage.removeItem(LEGACY_FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LEGACY_LOCKOUT_UNTIL_KEY);
  };

  const isLockedOut = (normalizedUsername: string): boolean => {
    const lockoutUntilKey = getLockoutUntilKey(normalizedUsername);
    const failedAttemptsKey = getFailedAttemptsKey(normalizedUsername);
    const lockoutUntilRaw = localStorage.getItem(lockoutUntilKey);
    if (!lockoutUntilRaw) {
      return false;
    }

    const lockoutUntil = Number(lockoutUntilRaw);
    if (Number.isNaN(lockoutUntil)) {
      localStorage.removeItem(lockoutUntilKey);
      localStorage.removeItem(failedAttemptsKey);
      return false;
    }

    if (Date.now() >= lockoutUntil) {
      localStorage.removeItem(lockoutUntilKey);
      localStorage.removeItem(failedAttemptsKey);
      return false;
    }

    return true;
  };

  const incrementFailedAttempts = (normalizedUsername: string) => {
    const failedAttemptsKey = getFailedAttemptsKey(normalizedUsername);
    const lockoutUntilKey = getLockoutUntilKey(normalizedUsername);
    const attempts = Number(localStorage.getItem(failedAttemptsKey) ?? '0');
    const nextAttempts = Number.isNaN(attempts) ? 1 : attempts + 1;

    localStorage.setItem(failedAttemptsKey, String(nextAttempts));
    if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(lockoutUntilKey, String(lockoutUntil));
    }
  };

  const clearFailedAttempts = (normalizedUsername: string) => {
    const failedAttemptsKey = getFailedAttemptsKey(normalizedUsername);
    const lockoutUntilKey = getLockoutUntilKey(normalizedUsername);
    localStorage.removeItem(failedAttemptsKey);
    localStorage.removeItem(lockoutUntilKey);
  };

  const clearSession = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('atlas_user');
    localStorage.removeItem('atlas_auth');
  };

  const getUserById = async (
    userId: number
  ): Promise<{ user: AuthUser | null; fetchError: boolean }> => {
    const primaryQuery = await supabase
      .from('usuarios')
      .select('id, username, rol, activo, session_version, is_protected')
      .eq('id', userId)
      .single();

    if (!primaryQuery.error && primaryQuery.data) {
      return { user: primaryQuery.data as AuthUser, fetchError: false };
    }

    if (primaryQuery.error && primaryQuery.error.code && primaryQuery.error.code !== 'PGRST116') {
      return { user: null, fetchError: true };
    }

    const fallbackQuery = await supabase
      .from('usuarios')
      .select('id, username, rol, is_protected')
      .eq('id', userId)
      .single();

    if (fallbackQuery.error) {
      if (fallbackQuery.error.code === 'PGRST116') {
        return { user: null, fetchError: false };
      }
      return { user: null, fetchError: true };
    }

    if (!fallbackQuery.data) {
      return { user: null, fetchError: false };
    }

    const fallbackUser = fallbackQuery.data as AuthUser;
    return {
      user: {
        ...fallbackUser,
        activo: true,
        session_version: 1,
        is_protected: fallbackUser.is_protected ?? false,
      },
      fetchError: false,
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

      const userLookup = await getUserById(parsedUser.id);
      if (userLookup.fetchError) {
        // Mantener la sesión local ante fallos transitorios de red o backend.
        const optimisticUser: AuthUser = {
          ...parsedUser,
          activo: true,
          session_version: parsedUser.session_version ?? 1,
          is_protected: parsedUser.is_protected ?? false,
          auth_time: authTime,
        };
        setUser(optimisticUser);
        setIsAuthenticated(true);
        persistSession(optimisticUser);
        return true;
      }

      const dbUser = userLookup.user;
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
        // Sesión deslizante: si el usuario sigue activo se renueva el tiempo de autenticación.
        auth_time: Date.now(),
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
      const normalizedUsername = normalizeUsername(username);

      // Validación básica
      if (!username || !password) {
        void logSecurityEvent('login_failed', {
          username: normalizedUsername || null,
          details: { reason: 'missing_credentials' },
        });
        setIsLoading(false);
        return false;
      }

      if (isLockedOut(normalizedUsername)) {
        void logSecurityEvent('login_locked', {
          username: normalizedUsername,
          details: { reason: 'lockout_active' },
        });
        setIsLoading(false);
        return false;
      }

      // Consultar la base de datos
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username, rol, activo, session_version, is_protected')
        .ilike('username', normalizedUsername)
        .eq('password', password)
        .order('id', { ascending: true })
        .limit(1);

      let authUser: AuthUser | null = null;
      let backendAuthError = false;

      if (!error && data && data.length > 0) {
        authUser = data[0] as AuthUser;
      } else {
        if (error) {
          backendAuthError = true;
        }

        const fallback = await supabase
          .from('usuarios')
          .select('id, username, rol, is_protected')
          .ilike('username', normalizedUsername)
          .eq('password', password)
          .order('id', { ascending: true })
          .limit(1);

        if (!fallback.error && fallback.data && fallback.data.length > 0) {
          const fallbackRecord = fallback.data[0] as AuthUser;
          authUser = {
            ...fallbackRecord,
            activo: true,
            session_version: 1,
            is_protected: fallbackRecord.is_protected ?? false,
          };
          backendAuthError = false;
        } else if (fallback.error) {
          backendAuthError = true;
        }
      }

      if (!authUser) {
        if (backendAuthError) {
          void logSecurityEvent('login_failed', {
            username: normalizedUsername,
            details: { reason: 'auth_backend_unavailable' },
          });
          setIsLoading(false);
          return false;
        }

        incrementFailedAttempts(normalizedUsername);
        void logSecurityEvent('login_failed', {
          username: normalizedUsername,
          details: { reason: 'invalid_credentials' },
        });
        setIsLoading(false);
        return false;
      }

      if (authUser.activo === false) {
        incrementFailedAttempts(normalizedUsername);
        void logSecurityEvent('login_failed', {
          userId: authUser.id,
          username: authUser.username,
          details: { reason: 'user_deactivated' },
        });
        setIsLoading(false);
        return false;
      }

      // Login exitoso
      clearFailedAttempts(normalizedUsername);
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
      const normalizedUsername = normalizeUsername(username);
      incrementFailedAttempts(normalizedUsername);
      void logSecurityEvent('login_failed', {
        username: normalizedUsername || null,
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
    clearLegacyLockoutKeys();

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