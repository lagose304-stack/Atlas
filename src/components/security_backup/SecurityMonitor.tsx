import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouteInfo } from '../hooks/useSecureNavigation';

interface SecurityMonitorProps {
  children: React.ReactNode;
}

interface SecurityEvent {
  type: 'unauthorized_access' | 'session_expired' | 'login_attempt' | 'suspicious_activity';
  timestamp: number;
  details: string;
  path?: string;
}

const SecurityMonitor: React.FC<SecurityMonitorProps> = ({ children }) => {
  const { isAuthenticated, checkAuthStatus } = useAuth();
  const { currentPath, isOnProtectedRoute, routeState } = useRouteInfo();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<SecurityEvent | null>(null);

  // Función para agregar eventos de seguridad
  const addSecurityEvent = (event: Omit<SecurityEvent, 'timestamp'>) => {
    const newEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now()
    };

    setSecurityEvents(prev => [...prev.slice(-9), newEvent]); // Mantener solo los últimos 10 eventos
    
    // Mostrar alerta para eventos críticos
    if (event.type === 'unauthorized_access' || event.type === 'session_expired') {
      setCurrentAlert(newEvent);
      setShowAlert(true);
      
      // Auto-ocultar después de 5 segundos
      setTimeout(() => {
        setShowAlert(false);
        setCurrentAlert(null);
      }, 5000);
    }

    // Log en consola para desarrollo
    console.warn('🚨 Evento de seguridad:', event);
  };

  // Monitorear acceso no autorizado a rutas protegidas
  useEffect(() => {
    // Solo verificar si no estamos cargando y hay un estado estable
    if (!isLoading && isOnProtectedRoute && !isAuthenticated) {
      // Añadir un pequeño delay para permitir que la autenticación se complete
      const timeoutId = setTimeout(() => {
        if (!isAuthenticated && isOnProtectedRoute) {
          addSecurityEvent({
            type: 'unauthorized_access',
            details: `Intento de acceso no autorizado a ruta protegida`,
            path: currentPath
          });
        }
      }, 100); // 100ms de delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentPath, isOnProtectedRoute, isAuthenticated, isLoading]);

  // Monitorear estado de autenticación
  useEffect(() => {
    if (isAuthenticated) {
      // Verificar periódicamente el estado de la sesión
      const interval = setInterval(() => {
        const isValid = checkAuthStatus();
        if (!isValid) {
          addSecurityEvent({
            type: 'session_expired',
            details: 'Sesión expirada detectada',
            path: currentPath
          });
        }
      }, 30000); // Verificar cada 30 segundos

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, checkAuthStatus, currentPath]);

  // Monitorear mensajes de estado de navegación
  useEffect(() => {
    if (routeState && routeState.message && routeState.attemptedPath) {
      addSecurityEvent({
        type: 'unauthorized_access',
        details: routeState.message,
        path: routeState.attemptedPath
      });
    }
  }, [routeState]);

  return (
    <>
      {children}
      
      {/* Alerta de seguridad */}
      {showAlert && currentAlert && (
        <SecurityAlert 
          event={currentAlert}
          onClose={() => {
            setShowAlert(false);
            setCurrentAlert(null);
          }}
        />
      )}
      
      {/* Monitor de eventos (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <SecurityEventLog events={securityEvents} />
      )}
    </>
  );
};

// Componente de alerta de seguridad
interface SecurityAlertProps {
  event: SecurityEvent;
  onClose: () => void;
}

const SecurityAlert: React.FC<SecurityAlertProps> = ({ event, onClose }) => {
  const getAlertStyle = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'unauthorized_access':
        return { backgroundColor: '#dc3545', borderColor: '#c82333' };
      case 'session_expired':
        return { backgroundColor: '#fd7e14', borderColor: '#e55a00' };
      default:
        return { backgroundColor: '#ffc107', borderColor: '#ffae00' };
    }
  };

  const getAlertIcon = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'unauthorized_access':
        return '🚨';
      case 'session_expired':
        return '⏰';
      default:
        return '⚠️';
    }
  };

  return (
    <div style={{
      ...alertStyles.overlay,
      zIndex: 10000
    }}>
      <div style={{
        ...alertStyles.alert,
        ...getAlertStyle(event.type)
      }}>
        <div style={alertStyles.header}>
          <span style={alertStyles.icon}>
            {getAlertIcon(event.type)}
          </span>
          <h3 style={alertStyles.title}>Alerta de Seguridad</h3>
          <button 
            onClick={onClose}
            style={alertStyles.closeButton}
          >
            ✕
          </button>
        </div>
        <p style={alertStyles.message}>{event.details}</p>
        {event.path && (
          <p style={alertStyles.path}>Ruta: {event.path}</p>
        )}
        <small style={alertStyles.timestamp}>
          {new Date(event.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
};

// Componente de log de eventos (solo desarrollo)
interface SecurityEventLogProps {
  events: SecurityEvent[];
}

const SecurityEventLog: React.FC<SecurityEventLogProps> = ({ events }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0) return null;

  return (
    <div style={logStyles.container}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        style={logStyles.toggle}
      >
        🔍 Security Log ({events.length})
      </button>
      
      {isExpanded && (
        <div style={logStyles.log}>
          <h4 style={logStyles.title}>Eventos de Seguridad</h4>
          {events.slice().reverse().map((event, index) => (
            <div key={index} style={logStyles.event}>
              <span style={logStyles.type}>{event.type}</span>
              <span style={logStyles.details}>{event.details}</span>
              <span style={logStyles.time}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Estilos
const alertStyles = {
  overlay: {
    position: 'fixed' as const,
    top: '20px',
    right: '20px',
    zIndex: 10000
  },
  alert: {
    minWidth: '300px',
    maxWidth: '400px',
    padding: '1rem',
    borderRadius: '8px',
    color: 'white',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    border: '2px solid',
    fontFamily: "'Segoe UI', sans-serif"
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem'
  },
  icon: {
    fontSize: '1.2em',
    marginRight: '0.5rem'
  },
  title: {
    margin: 0,
    fontSize: '1.1em',
    fontWeight: 'bold'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1.2em',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  message: {
    margin: '0.5rem 0',
    fontSize: '0.9em'
  },
  path: {
    margin: '0.5rem 0',
    fontSize: '0.8em',
    fontStyle: 'italic' as const,
    opacity: 0.9
  },
  timestamp: {
    fontSize: '0.75em',
    opacity: 0.8
  }
};

const logStyles = {
  container: {
    position: 'fixed' as const,
    bottom: '20px',
    left: '20px',
    zIndex: 9999
  },
  toggle: {
    padding: '0.5rem 1rem',
    backgroundColor: '#343a40',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.8em'
  },
  log: {
    marginTop: '0.5rem',
    backgroundColor: 'rgba(0,0,0,0.9)',
    color: 'white',
    padding: '1rem',
    borderRadius: '5px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    minWidth: '400px',
    fontSize: '0.8em'
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1em',
    color: '#ffc107'
  },
  event: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.3rem',
    borderBottom: '1px solid #555',
    marginBottom: '0.3rem'
  },
  type: {
    color: '#ff6b6b',
    fontWeight: 'bold' as const,
    width: '120px'
  },
  details: {
    flex: 1,
    marginRight: '1rem'
  },
  time: {
    color: '#adb5bd',
    fontSize: '0.8em'
  }
};

export default SecurityMonitor;