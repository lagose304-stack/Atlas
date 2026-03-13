import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../security/permissions';
import { logSecurityEvent } from '../services/securityAudit';

interface PrivateRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Cargando...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Si no está autenticado, redirigir a home
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const currentRole = user?.rol;
    if (!currentRole || !allowedRoles.includes(currentRole)) {
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

  // Si está autenticado, mostrar el contenido
  return children;
};

export default PrivateRoute;
