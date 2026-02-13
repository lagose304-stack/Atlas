import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

interface UseSecureNavigationReturn {
  navigateSecurely: (path: string) => void;
  goToPreviousSecurePage: () => void;
  isNavigating: boolean;
  canAccessPath: (path: string) => boolean;
}

// Rutas que requieren autenticación
const PROTECTED_ROUTES = [
  '/edicion',
  '/temario', 
  '/placas'
];

// Rutas públicas permitidas
const PUBLIC_ROUTES = [
  '/',
  '/home'
];

export const useSecureNavigation = (): UseSecureNavigationReturn => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, checkAuthStatus } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  // Función para verificar si una ruta requiere autenticación
  const isProtectedRoute = (path: string): boolean => {
    return PROTECTED_ROUTES.some(route => 
      path === route || path.startsWith(`${route}/`)
    );
  };

  // Verificar si el usuario puede acceder a una ruta específica
  const canAccessPath = (path: string): boolean => {
    if (PUBLIC_ROUTES.includes(path) || !isProtectedRoute(path)) {
      return true;
    }
    
    return isAuthenticated && checkAuthStatus();
  };

  // Navegación segura con verificación de autenticación
  const navigateSecurely = async (path: string) => {
    setIsNavigating(true);
    
    try {
      // Verificar si la ruta es accesible
      if (!canAccessPath(path)) {
        console.log('Acceso denegado a ruta:', path);
        
        // Guardar la ruta destino para redirección post-login
        if (isProtectedRoute(path)) {
          sessionStorage.setItem('redirect_after_login', path);
        }
        
        // Redireccionar a home con mensaje de error
        navigate('/', { 
          replace: true,
          state: { 
            message: 'Debes iniciar sesión para acceder a esa página',
            attemptedPath: path
          }
        });
        return;
      }

      // Navegación exitosa
      console.log('Navegando de forma segura a:', path);
      navigate(path);
      
    } catch (error) {
      console.error('Error durante navegación segura:', error);
      navigate('/');
    } finally {
      setIsNavigating(false);
    }
  };

  // Ir a la página anterior segura (post-login)
  const goToPreviousSecurePage = () => {
    const redirectPath = sessionStorage.getItem('redirect_after_login');
    
    if (redirectPath && canAccessPath(redirectPath)) {
      sessionStorage.removeItem('redirect_after_login');
      navigateSecurely(redirectPath);
    } else {
      // Si no hay ruta guardada o no es accesible, ir a edición por defecto
      navigateSecurely('/edicion');
    }
  };

  // Efecto para verificar la ruta actual al cambiar la autenticación
  useEffect(() => {
    if (!isNavigating) {
      const currentPath = location.pathname;
      
      if (isProtectedRoute(currentPath) && !canAccessPath(currentPath)) {
        console.log('Ruta actual no autorizada, redirigiendo...');
        navigateSecurely('/');
      }
    }
  }, [isAuthenticated, location.pathname]);

  return {
    navigateSecurely,
    goToPreviousSecurePage,
    isNavigating,
    canAccessPath
  };
};

// Hook adicional para obtener información de rutas
export const useRouteInfo = () => {
  const location = useLocation();
  
  return {
    currentPath: location.pathname,
    isOnProtectedRoute: PROTECTED_ROUTES.some(route => 
      location.pathname === route || location.pathname.startsWith(`${route}/`)
    ),
    isOnPublicRoute: PUBLIC_ROUTES.includes(location.pathname),
    routeState: location.state
  };
};