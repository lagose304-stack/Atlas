import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SecurityGuardProps {
  children: React.ReactNode;
}

interface SecurityEvent {
  id: string;
  type: 'page_access' | 'unauthorized_attempt' | 'suspicious_activity' | 'session_anomaly';
  timestamp: number;
  path: string;
  userAgent: string;
  details: string;
}

interface SecurityMetrics {
  totalVisits: number;
  unauthorizedAttempts: number;
  suspiciousEvents: number;
  lastActivity: number;
}

const SecurityGuard: React.FC<SecurityGuardProps> = ({ children }) => {
  const { isAuthenticated, checkAuthStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    totalVisits: 0,
    unauthorizedAttempts: 0,
    suspiciousEvents: 0,
    lastActivity: Date.now()
  });

  // Rutas protegidas que requieren autenticación
  const PROTECTED_ROUTES = ['/edicion', '/temario', '/placas'];
  
  // Detectar si la ruta actual es protegida
  const isProtectedRoute = (path: string): boolean => {
    return PROTECTED_ROUTES.some(route => 
      path === route || path.startsWith(`${route}/`)
    );
  };

  // Función para registrar eventos de seguridad
  const logSecurityEvent = (
    type: SecurityEvent['type'], 
    details: string, 
    path?: string
  ) => {
    const event: SecurityEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      path: path || location.pathname,
      userAgent: navigator.userAgent.substr(0, 100),
      details
    };

    setSecurityEvents(prev => [...prev.slice(-19), event]); // Mantener últimos 20 eventos
    
    // Actualizar métricas
    setSecurityMetrics(prev => ({
      ...prev,
      totalVisits: type === 'page_access' ? prev.totalVisits + 1 : prev.totalVisits,
      unauthorizedAttempts: type === 'unauthorized_attempt' ? prev.unauthorizedAttempts + 1 : prev.unauthorizedAttempts,
      suspiciousEvents: (type === 'suspicious_activity' || type === 'session_anomaly') ? prev.suspiciousEvents + 1 : prev.suspiciousEvents,
      lastActivity: Date.now()
    }));

    // Log en consola con emoji para fácil identificación
    const emoji = {
      'page_access': '📖',
      'unauthorized_attempt': '🚫',
      'suspicious_activity': '🕵️',
      'session_anomaly': '⚠️'
    };

    console.log(`${emoji[type]} [SecurityGuard] ${type.toUpperCase()}: ${details}`);
    
    // Almacenar en localStorage para persistencia (últimos 50 eventos)
    try {
      const storedEvents = JSON.parse(localStorage.getItem('atlas_security_log') || '[]');
      const updatedEvents = [...storedEvents.slice(-49), event];
      localStorage.setItem('atlas_security_log', JSON.stringify(updatedEvents));
    } catch (error) {
      console.warn('Error guardando log de seguridad:', error);
    }
  };

  // Detectar actividad sospechosa
  const detectSuspiciousActivity = () => {
    const now = Date.now();
    const recentEvents = securityEvents.filter(e => now - e.timestamp < 60000); // Último minuto
    
    // Múltiples intentos de acceso no autorizado
    const recentUnauthorized = recentEvents.filter(e => e.type === 'unauthorized_attempt');
    if (recentUnauthorized.length >= 3) {
      logSecurityEvent('suspicious_activity', 
        `Múltiples intentos no autorizados detectados: ${recentUnauthorized.length} en el último minuto`
      );
    }

    // Actividad excesiva en rutas protegidas
    const recentPageAccess = recentEvents.filter(e => e.type === 'page_access');
    if (recentPageAccess.length >= 10) {
      logSecurityEvent('suspicious_activity', 
        'Actividad excesiva detectada: demasiadas navegaciones en poco tiempo'
      );
    }
  };

  // Monitorear cambios de ruta
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (isProtectedRoute(currentPath)) {
      if (!isAuthenticated) {
        // Intento de acceso no autorizado
        logSecurityEvent('unauthorized_attempt', 
          `Intento de acceso no autorizado a ruta protegida: ${currentPath}`
        );
        
        // Redireccionar con mensaje de seguridad
        navigate('/', {
          replace: true,
          state: {
            securityAlert: true,
            message: 'Acceso denegado: Se requiere autenticación',
            attemptedPath: currentPath,
            timestamp: Date.now()
          }
        });
        return;
      } else {
        // Acceso autorizado a ruta protegida
        logSecurityEvent('page_access', 
          `Acceso autorizado a ruta protegida: ${currentPath}`
        );
      }
    } else {
      // Acceso a ruta pública
      if (currentPath === '/' || currentPath === '') {
        logSecurityEvent('page_access', 'Acceso a página principal');
      } else {
        logSecurityEvent('page_access', `Acceso a ruta pública: ${currentPath}`);
      }
    }

    // Verificar actividad sospechosa
    detectSuspiciousActivity();
  }, [location.pathname, isAuthenticated]);

  // Monitorear integridad de sesión periódicamente
  useEffect(() => {
    if (!isAuthenticated) return;

    const sessionMonitor = setInterval(() => {
      const isValid = checkAuthStatus();
      
      if (!isValid) {
        logSecurityEvent('session_anomaly', 
          'Anomalía de sesión detectada: sesión inválida o expirada'
        );
        clearInterval(sessionMonitor);
      }
    }, 30000); // Verificar cada 30 segundos

    return () => clearInterval(sessionMonitor);
  }, [isAuthenticated, checkAuthStatus]);

  // Detectar cambios en el localStorage/sessionStorage (posible manipulación)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('atlas_')) {
        logSecurityEvent('session_anomaly',
          `Posible manipulación de almacenamiento detectada: ${e.key}`
        );
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Detectar intentos de abrir DevTools (solo en producción)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const detectDevTools = () => {
        const threshold = 160;
        if (window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold) {
          logSecurityEvent('suspicious_activity', 
            'Posible apertura de herramientas de desarrollo detectada'
          );
        }
      };

      const devToolsChecker = setInterval(detectDevTools, 5000);
      return () => clearInterval(devToolsChecker);
    }
  }, []);

  // Limpiar eventos antiguos periódicamente (mantener solo últimos 7 días)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      setSecurityEvents(prev => 
        prev.filter(event => event.timestamp > sevenDaysAgo)
      );

      // Limpiar también localStorage
      try {
        const storedEvents = JSON.parse(localStorage.getItem('atlas_security_log') || '[]');
        const filteredEvents = storedEvents.filter((event: SecurityEvent) => 
          event.timestamp > sevenDaysAgo
        );
        localStorage.setItem('atlas_security_log', JSON.stringify(filteredEvents));
      } catch (error) {
        console.warn('Error limpiando log de seguridad:', error);
      }
    }, 24 * 60 * 60 * 1000); // Ejecutar cada 24 horas

    return () => clearInterval(cleanup);
  }, []);

  // Solo en desarrollo: mostrar métricas de seguridad en consola
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('🛡️ Atlas Security Metrics');
      console.log('Total Visits:', securityMetrics.totalVisits);
      console.log('Unauthorized Attempts:', securityMetrics.unauthorizedAttempts);
      console.log('Suspicious Events:', securityMetrics.suspiciousEvents);
      console.log('Last Activity:', new Date(securityMetrics.lastActivity).toLocaleString());
      console.log('Recent Events:', securityEvents.slice(-5));
      console.groupEnd();
    }
  }, [securityMetrics, securityEvents]);

  return <>{children}</>;
};

export default SecurityGuard;