import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedLayoutProps {
  children: React.ReactElement;
}

interface SecurityAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [accessAttempts, setAccessAttempts] = useState(0);
  const location = useLocation();

  // Función para agregar alertas de seguridad
  const addSecurityAlert = (type: SecurityAlert['type'], message: string) => {
    const alert: SecurityAlert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: Date.now()
    };
    
    setSecurityAlerts(prev => [...prev.slice(-4), alert]); // Mantener últimas 5
    
    // Auto-remover después de 8 segundos
    setTimeout(() => {
      setSecurityAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 8000);
  };

  // Verificar estado de autenticación al montar el componente
  useEffect(() => {
    const verifyAuth = async () => {
      setIsChecking(true);
      
      try {
        // Si aún estamos cargando, no hacer verificaciones
        if (isLoading) {
          setIsChecking(false);
          return;
        }
        
        // Verificar si la sesión es válida
        const isValid = checkAuthStatus();
        
        if (!isValid && !isAuthenticated && !isLoading) {
          // Primera vez accediendo sin autenticación (solo si no estamos cargando)
          addSecurityAlert('warning', 'Acceso denegado: Se requiere autenticación');
          console.log('🚫 Acceso denegado a ruta protegida:', location.pathname);
        } else if (!isValid && isAuthenticated && !isLoading) {
          // Sesión expirada o corrompida (solo si no estamos cargando)
          addSecurityAlert('error', 'Sesión expirada o corrupta. Redirigiendo...');
          console.warn('⚠️ Sesión no válida detectada en ruta protegida:', location.pathname);
        }
        
        // Incrementar contador de intentos de acceso no autorizados
        if (!isValid && !isLoading) {
          setAccessAttempts(prev => prev + 1);
          
          if (accessAttempts >= 3) {
            addSecurityAlert('error', '🚨 Múltiples intentos de acceso no autorizado detectados');
          }
        } else {
          // Resetear contador en acceso exitoso
          setAccessAttempts(0);
        }
        
      } catch (error) {
        console.error('Error durante verificación de autenticación:', error);
        addSecurityAlert('error', 'Error del sistema durante verificación');
      } finally {
        setIsChecking(false);
      }
    };

    // Añadir un pequeño delay para permitir que el estado se estabilice
    const timeoutId = setTimeout(verifyAuth, 50);
    return () => clearTimeout(timeoutId);
  }, [checkAuthStatus, location.pathname, isAuthenticated, isLoading, accessAttempts]);

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading || isChecking) {
    return (
      <div style={loadingStyles.container}>
        <div style={loadingStyles.spinner}></div>
        <p style={loadingStyles.text}>🔐 Verificando acceso seguro...</p>
        <p style={loadingStyles.subtext}>Protegiendo tu sesión</p>
      </div>
    );
  }

  // Redireccionar a home si no está autenticado
  if (!isAuthenticated) {
    console.log('❌ Acceso denegado a ruta protegida:', location.pathname);
    return <Navigate to="/" replace state={{ 
      from: location,
      message: 'Se requiere autenticación para acceder a esta sección',
      timestamp: Date.now()
    }} />;
  }

  // Renderizar contenido protegido con wrapper de seguridad
  return (
    <div style={protectedStyles.container}>
      <SecurityHeader />
      
      {/* Mostrar alertas de seguridad */}
      <SecurityAlertsContainer alerts={securityAlerts} />
      
      <div style={protectedStyles.content}>
        {children}
      </div>
    </div>
  );
};

// Componente para mostrar alertas de seguridad
const SecurityAlertsContainer: React.FC<{ alerts: SecurityAlert[] }> = ({ alerts }) => {
  if (alerts.length === 0) return null;

  return (
    <div style={alertStyles.container}>
      {alerts.map(alert => (
        <div 
          key={alert.id} 
          style={{
            ...alertStyles.alert,
            backgroundColor: alertStyles[alert.type].bg,
            borderColor: alertStyles[alert.type].border
          }}
        >
          <span style={{ color: alertStyles[alert.type].text }}>
            {alert.message}
          </span>
        </div>
      ))}
    </div>
  );
};

// Componente de header de seguridad que muestra estado de sesión
const SecurityHeader: React.FC = () => {
  const { logout, checkAuthStatus } = useAuth();
  const [sessionValid, setSessionValid] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      const isValid = checkAuthStatus();
      setSessionValid(isValid);
      setLastCheck(new Date().toLocaleTimeString());
      
      if (!isValid) {
        console.warn('🔴 Sesión inválida detectada, cerrando automáticamente...');
        clearInterval(interval);
        logout();
      }
    }, 60000); // Verificar cada minuto

    return () => clearInterval(interval);
  }, [checkAuthStatus, logout]);

  return (
    <div style={headerStyles.container}>
      <div style={headerStyles.status}>
        <span style={{
          ...headerStyles.indicator,
          backgroundColor: sessionValid ? '#27ae60' : '#e74c3c'
        }}>
          {sessionValid ? '🔒 Sesión Activa' : '⚠️ Sesión Expirada'}
        </span>
        {sessionValid && (
          <span style={headerStyles.lastCheck}>
            Verificado: {lastCheck}
          </span>
        )}
      </div>
    </div>
  );
};

// Estilos para loading
const loadingStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  text: {
    fontSize: '1.3em',
    color: '#2c3e50',
    margin: '0 0 8px 0',
    fontWeight: 'bold' as const
  },
  subtext: {
    fontSize: '0.9em',
    color: '#7f8c8d',
    margin: 0
  }
};

// Estilos para contenedor protegido
const protectedStyles = {
  container: {
    minHeight: '100vh',
    position: 'relative' as const,
    backgroundColor: '#ffffff'
  },
  content: {
    position: 'relative' as const,
    zIndex: 1
  }
};

// Estilos para alertas de seguridad
const alertStyles = {
  container: {
    position: 'fixed' as const,
    top: '60px',
    right: '20px',
    zIndex: 9999,
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '2px solid',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    animation: 'slideIn 0.3s ease-out'
  },
  warning: {
    bg: '#fff3cd',
    border: '#ffc107',
    text: '#856404'
  },
  error: {
    bg: '#f8d7da',
    border: '#dc3545',
    text: '#721c24'
  },
  info: {
    bg: '#d1ecf1',
    border: '#17a2b8',
    text: '#0c5460'
  }
};

// Estilos para header de seguridad
const headerStyles = {
  container: {
    position: 'absolute' as const,
    top: '15px',
    right: '15px',
    zIndex: 1000
  },
  status: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px'
  },
  indicator: {
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '0.85em',
    fontWeight: 'bold' as const,
    boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  lastCheck: {
    fontSize: '0.7em',
    color: '#7f8c8d',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #ddd'
  }
};

// CSS para animaciones
const animationCSS = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// Insertar estilos CSS en el documento
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationCSS;
  if (!document.head.querySelector('style[data-component="ProtectedLayout"]')) {
    style.setAttribute('data-component', 'ProtectedLayout');
    document.head.appendChild(style);
  }
}

export default ProtectedLayout;