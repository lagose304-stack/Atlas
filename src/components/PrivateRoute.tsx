import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../security/permissions';
import { logSecurityEvent } from '../services/securityAudit';
import AtlasLoadingScreen from './AtlasLoadingScreen';

interface PrivateRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
  requireProtectedUser?: boolean;
  allowedUserIds?: number[];
  allowMicroscopyManager?: boolean;
  requireMicroscopyManager?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles, requireProtectedUser, allowedUserIds, allowMicroscopyManager, requireMicroscopyManager }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return <AtlasLoadingScreen fullScreen label="Verificando acceso…" />;
  }

  // Si no está autenticado, redirigir a home
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireMicroscopyManager && user?.can_manage_microscopy !== true) {
    void logSecurityEvent('route_denied', {
      userId: user?.id ?? null,
      username: user?.username ?? null,
      details: { path: location.pathname, reason: 'requires_microscopy_manager' },
    });
    return <Navigate to="/acceso-denegado" replace state={{ from: location.pathname }} />;
  }

  // Si la ruta requiere ser el usuario protegido/propietario
  if (requireProtectedUser && user?.is_protected !== true) {
    void logSecurityEvent('route_denied', {
      userId: user?.id ?? null,
      username: user?.username ?? null,
      details: {
        path: location.pathname,
        reason: 'requires_protected_user',
      },
    });
    return <Navigate to="/acceso-denegado" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = user?.rol;
    if ((!currentRole || !allowedRoles.includes(currentRole)) && !(allowMicroscopyManager && user?.can_manage_microscopy === true)) {
      void logSecurityEvent('route_denied', {
        userId: user?.id ?? null,
        username: user?.username ?? null,
        details: {
          path: location.pathname,
          role: currentRole ?? null,
          allowedRoles,
        },
      });
      return <Navigate to="/acceso-denegado" replace state={{ from: location.pathname }} />;
    }
  }

  // Si la ruta requiere un usuario específico por ID
  if (allowedUserIds && allowedUserIds.length > 0) {
    if (!user?.id || !allowedUserIds.includes(user.id)) {
      void logSecurityEvent('route_denied', {
        userId: user?.id ?? null,
        username: user?.username ?? null,
        details: {
          path: location.pathname,
          reason: 'user_id_not_allowed',
        },
      });
      return <Navigate to="/acceso-denegado" replace state={{ from: location.pathname }} />;
    }
  }

  // Si está autenticado y cumple los requisitos, mostrar el contenido
  return children;
};

export default PrivateRoute;
