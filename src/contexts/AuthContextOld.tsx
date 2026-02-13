import React, { createContext, useState, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthStatus: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuración de seguridad
const AUTH_CONFIG = {
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 horas en milisegundos
  TOKEN_KEY: 'atlas_auth_session',
  TIMESTAMP_KEY: 'atlas_auth_timestamp',
  USER_KEY: 'atlas_auth_user',
  INTEGRITY_KEY: 'atlas_session_integrity',
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutos
  FAILED_ATTEMPTS_KEY: 'atlas_failed_attempts',
  LOCKOUT_TIME_KEY: 'atlas_lockout_time'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Función para generar token de sesión seguro
  const generateSessionToken = (userId: string): string => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const userAgent = navigator.userAgent.substr(0, 50); // Primeros 50 chars del user agent
    return btoa(`${userId}-${timestamp}-${random}-${userAgent}`);
  };

  // Generar hash de integridad para validar la sesión
  const generateSessionIntegrity = (token: string, timestamp: string): string => {
    const data = `${token}${timestamp}${navigator.userAgent}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return btoa(hash.toString());
  };

  // Verificar si el usuario está bloqueado por intentos fallidos
  const isUserLocked = (): boolean => {
    try {
      const lockoutTime = localStorage.getItem(AUTH_CONFIG.LOCKOUT_TIME_KEY);
      if (!lockoutTime) return false;
      
      const lockoutEnd = parseInt(lockoutTime);
      const now = Date.now();
      
      if (now > lockoutEnd) {
        // El bloqueo ha expirado, limpiar datos
        localStorage.removeItem(AUTH_CONFIG.LOCKOUT_TIME_KEY);
        localStorage.removeItem(AUTH_CONFIG.FAILED_ATTEMPTS_KEY);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  // Incrementar contador de intentos fallidos
  const incrementFailedAttempts = (): void => {
    try {
      const currentAttempts = parseInt(localStorage.getItem(AUTH_CONFIG.FAILED_ATTEMPTS_KEY) || '0');
      const newAttempts = currentAttempts + 1;
      
      localStorage.setItem(AUTH_CONFIG.FAILED_ATTEMPTS_KEY, newAttempts.toString());
      
      if (newAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const lockoutEnd = Date.now() + AUTH_CONFIG.LOCKOUT_DURATION;
        localStorage.setItem(AUTH_CONFIG.LOCKOUT_TIME_KEY, lockoutEnd.toString());
        console.warn('🔒 Usuario bloqueado por múltiples intentos fallidos');
      }
    } catch (error) {
      console.error('Error al incrementar intentos fallidos:', error);
    }
  };

  // Limpiar intentos fallidos en login exitoso
  const clearFailedAttempts = (): void => {
    localStorage.removeItem(AUTH_CONFIG.FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(AUTH_CONFIG.LOCKOUT_TIME_KEY);
  };

  // Verificar validez de la sesión
  const isValidSession = (): boolean => {
    try {
      const token = sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
      const timestamp = sessionStorage.getItem(AUTH_CONFIG.TIMESTAMP_KEY);
      const storedIntegrity = sessionStorage.getItem(AUTH_CONFIG.INTEGRITY_KEY);

      if (!token || !timestamp || !storedIntegrity) {
        return false;
      }

      // Verificar validez temporal
      const sessionAge = Date.now() - parseInt(timestamp);
      if (sessionAge >= AUTH_CONFIG.SESSION_TIMEOUT) {
        return false;
      }

      // Verificar integridad de la sesión
      const expectedIntegrity = generateSessionIntegrity(token, timestamp);
      if (storedIntegrity !== expectedIntegrity) {
        console.warn('🚨 Posible manipulación de sesión detectada');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verificando sesión:', error);
      return false;
    }
  };

  // Limpiar sesión
  const clearSession = () => {
    sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    sessionStorage.removeItem(AUTH_CONFIG.TIMESTAMP_KEY);
    sessionStorage.removeItem(AUTH_CONFIG.USER_KEY);
    sessionStorage.removeItem(AUTH_CONFIG.INTEGRITY_KEY);
    setIsAuthenticated(false);
  };

  // Verificar estado de autenticación
  const checkAuthStatus = (): boolean => {
    if (!isValidSession()) {
      clearSession();
      return false;
    }
    return true;
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Verificar si el usuario está bloqueado
      if (isUserLocked()) {
        console.warn('🔒 Intento de login con usuario bloqueado');
        setIsLoading(false);
        return false;
      }

      // Validaciones básicas de seguridad
      if (!username || !password || username.length < 3 || password.length < 4) {
        incrementFailedAttempts();
        setIsLoading(false);
        return false;
      }

      // Sanitizar entrada
      const sanitizedUsername = username.trim().toLowerCase();
      
      // Log del intento de login (sin la contraseña)
      console.log(`🔐 Intento de login para usuario: ${sanitizedUsername}`);

      // Consultar la tabla de usuarios en Supabase
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username')
        .eq('username', sanitizedUsername)
        .eq('password', password) // NOTA: En producción, usar hash de contraseñas
        .single();

      if (error || !data) {
        console.warn(`❌ Login fallido para usuario: ${sanitizedUsername}`);
        incrementFailedAttempts();
        setIsLoading(false);
        return false;
      }

      // Login exitoso - limpiar intentos fallidos
      clearFailedAttempts();
      console.log(`✅ Login exitoso para usuario: ${data.username}`);

      // Crear sesión segura
      const token = generateSessionToken(data.id);
      const timestamp = Date.now().toString();
      const integrity = generateSessionIntegrity(token, timestamp);

      sessionStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
      sessionStorage.setItem(AUTH_CONFIG.TIMESTAMP_KEY, timestamp);
      sessionStorage.setItem(AUTH_CONFIG.INTEGRITY_KEY, integrity);
      sessionStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify({
        id: data.id,
        username: data.username,
        loginTime: timestamp
      }));

      setIsAuthenticated(true);
      setIsLoading(false);
      
      // Pequeño delay adicional para asegurar que todos los componentes se actualicen
      setTimeout(() => {
        console.log('🎯 Estado de autenticación completamente actualizado');
      }, 100);
      
      return true;
    } catch (error) {
      console.error('🚨 Error crítico en login:', error);
      incrementFailedAttempts();
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    clearSession();
  };

  // Verificar sesión al cargar y configurar verificación periódica
  React.useEffect(() => {
    // Verificación inicial con delay para evitar problemas de timing
    const initializeAuth = () => {
      try {
        if (checkAuthStatus()) {
          setIsAuthenticated(true);
          console.log('✅ Sesión existente válida encontrada');
        }
      } catch (error) {
        console.error('Error durante inicialización de autenticación:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Ejecutar inicialización con un pequeño delay
    const timeoutId = setTimeout(initializeAuth, 50);

    // Verificación periódica cada 5 minutos
    const interval = setInterval(() => {
      if (isAuthenticated && !checkAuthStatus()) {
        console.log('Sesión expirada, cerrando automáticamente...');
        logout();
      }
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      login, 
      logout, 
      checkAuthStatus 
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
