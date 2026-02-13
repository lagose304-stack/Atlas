import React, { createContext, useState, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Validación básica
      if (!username || !password) {
        setIsLoading(false);
        return false;
      }

      // Consultar la base de datos
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username')
        .eq('username', username.trim().toLowerCase())
        .eq('password', password) // En producción usar bcrypt
        .single();

      if (error || !data) {
        setIsLoading(false);
        return false;
      }

      // Login exitoso
      setUser(data);
      setIsAuthenticated(true);
      
      // Guardar en localStorage para persistencia
      localStorage.setItem('atlas_user', JSON.stringify(data));
      localStorage.setItem('atlas_auth', 'true');
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error en login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('atlas_user');
    localStorage.removeItem('atlas_auth');
  };

  // Verificar sesión al iniciar
  React.useEffect(() => {
    const checkAuth = () => {
      const savedAuth = localStorage.getItem('atlas_auth');
      const savedUser = localStorage.getItem('atlas_user');
      
      if (savedAuth === 'true' && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          logout(); // Limpiar datos corruptos
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

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