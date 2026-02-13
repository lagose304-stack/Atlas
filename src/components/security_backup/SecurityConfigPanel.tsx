import React, { useState, useEffect } from 'react';

interface SecurityConfig {
  maxLoginAttempts: number;
  sessionTimeout: number; // en horas
  lockoutDuration: number; // en minutos
  monitoringEnabled: boolean;
  devToolsDetection: boolean;
  suspiciousActivityThreshold: number;
  logRetentionDays: number;
}

interface SecurityStats {
  totalSessions: number;
  activeUsers: number;
  blockedAttempts: number;
  suspiciousEvents: number;
  lastCleanup: string;
}

const SecurityConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<SecurityConfig>({
    maxLoginAttempts: 5,
    sessionTimeout: 8,
    lockoutDuration: 15,
    monitoringEnabled: true,
    devToolsDetection: true,
    suspiciousActivityThreshold: 10,
    logRetentionDays: 7
  });

  const [stats, setStats] = useState<SecurityStats>({
    totalSessions: 0,
    activeUsers: 0,
    blockedAttempts: 0,
    suspiciousEvents: 0,
    lastCleanup: 'Nunca'
  });

  const [isVisible, setIsVisible] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  // Combinación de teclas para mostrar el panel (Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  // Cargar configuración desde localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('atlas_security_config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Error cargando configuración de seguridad:', error);
    }
  }, []);

  // Cargar estadísticas y logs
  useEffect(() => {
    if (isVisible) {
      loadSecurityStats();
      loadSecurityLogs();
    }
  }, [isVisible]);

  const loadSecurityStats = () => {
    try {
      // Simular estadísticas (en implementación real, estos datos vendrían del backend)
      const logs = JSON.parse(localStorage.getItem('atlas_security_log') || '[]');
      const failedAttempts = parseInt(localStorage.getItem('atlas_failed_attempts') || '0');
      
      setStats({
        totalSessions: logs.filter((log: any) => log.type === 'page_access').length,
        activeUsers: 1, // Usuario actual
        blockedAttempts: failedAttempts,
        suspiciousEvents: logs.filter((log: any) => 
          log.type === 'suspicious_activity' || log.type === 'session_anomaly'
        ).length,
        lastCleanup: localStorage.getItem('atlas_last_cleanup') || 'Nunca'
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const loadSecurityLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('atlas_security_log') || '[]');
      setSecurityLogs(logs.slice(-20).reverse()); // Últimos 20 eventos, más recientes primero
    } catch (error) {
      console.error('Error cargando logs:', error);
    }
  };

  const saveConfig = () => {
    try {
      localStorage.setItem('atlas_security_config', JSON.stringify(config));
      alert('✅ Configuración guardada correctamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('❌ Error guardando la configuración');
    }
  };

  const resetConfig = () => {
    if (window.confirm('¿Estás seguro de que quieres restaurar la configuración predeterminada?')) {
      const defaultConfig: SecurityConfig = {
        maxLoginAttempts: 5,
        sessionTimeout: 8,
        lockoutDuration: 15,
        monitoringEnabled: true,
        devToolsDetection: true,
        suspiciousActivityThreshold: 10,
        logRetentionDays: 7
      };
      setConfig(defaultConfig);
    }
  };

  const clearLogs = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar todos los logs de seguridad?')) {
      localStorage.removeItem('atlas_security_log');
      localStorage.setItem('atlas_last_cleanup', new Date().toISOString());
      setSecurityLogs([]);
      loadSecurityStats();
      alert('✅ Logs limpiados correctamente');
    }
  };

  const exportLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('atlas_security_log') || '[]');
      const dataStr = JSON.stringify(logs, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `atlas-security-logs-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error exportando logs:', error);
      alert('❌ Error exportando los logs');
    }
  };

  const formatEventType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'page_access': '📖 Acceso a página',
      'unauthorized_attempt': '🚫 Intento no autorizado',
      'suspicious_activity': '🕵️ Actividad sospechosa',
      'session_anomaly': '⚠️ Anomalía de sesión'
    };
    return typeMap[type] || type;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>🛡️ Panel de Seguridad Atlas</h2>
          <button onClick={() => setIsVisible(false)} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div style={styles.content}>
          {/* Estadísticas */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>📊 Estadísticas de Seguridad</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.totalSessions}</span>
                <span style={styles.statLabel}>Total Sesiones</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.activeUsers}</span>
                <span style={styles.statLabel}>Usuarios Activos</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.blockedAttempts}</span>
                <span style={styles.statLabel}>Intentos Bloqueados</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.suspiciousEvents}</span>
                <span style={styles.statLabel}>Eventos Sospechosos</span>
              </div>
            </div>
          </section>

          {/* Configuración */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>⚙️ Configuración de Seguridad</h3>
            <div style={styles.configGrid}>
              <div style={styles.configItem}>
                <label style={styles.label}>Máximo intentos de login:</label>
                <input
                  type="number"
                  value={config.maxLoginAttempts}
                  onChange={(e) => setConfig({...config, maxLoginAttempts: parseInt(e.target.value)})}
                  style={styles.input}
                  min="1"
                  max="10"
                />
              </div>
              
              <div style={styles.configItem}>
                <label style={styles.label}>Timeout de sesión (horas):</label>
                <input
                  type="number"
                  value={config.sessionTimeout}
                  onChange={(e) => setConfig({...config, sessionTimeout: parseInt(e.target.value)})}
                  style={styles.input}
                  min="1"
                  max="24"
                />
              </div>

              <div style={styles.configItem}>
                <label style={styles.label}>Duración de bloqueo (minutos):</label>
                <input
                  type="number"
                  value={config.lockoutDuration}
                  onChange={(e) => setConfig({...config, lockoutDuration: parseInt(e.target.value)})}
                  style={styles.input}
                  min="1"
                  max="60"
                />
              </div>

              <div style={styles.configItem}>
                <label style={styles.label}>Umbral actividad sospechosa:</label>
                <input
                  type="number"
                  value={config.suspiciousActivityThreshold}
                  onChange={(e) => setConfig({...config, suspiciousActivityThreshold: parseInt(e.target.value)})}
                  style={styles.input}
                  min="5"
                  max="50"
                />
              </div>

              <div style={styles.configItem}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.monitoringEnabled}
                    onChange={(e) => setConfig({...config, monitoringEnabled: e.target.checked})}
                    style={styles.checkbox}
                  />
                  Monitoreo de seguridad habilitado
                </label>
              </div>

              <div style={styles.configItem}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={config.devToolsDetection}
                    onChange={(e) => setConfig({...config, devToolsDetection: e.target.checked})}
                    style={styles.checkbox}
                  />
                  Detectar herramientas de desarrollo
                </label>
              </div>
            </div>

            <div style={styles.buttonGroup}>
              <button onClick={saveConfig} style={styles.saveButton}>
                💾 Guardar Configuración
              </button>
              <button onClick={resetConfig} style={styles.resetButton}>
                🔄 Restaurar Predeterminada
              </button>
            </div>
          </section>

          {/* Logs de Seguridad */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>📝 Logs de Seguridad</h3>
              <div style={styles.logControls}>
                <button 
                  onClick={() => setShowLogs(!showLogs)} 
                  style={styles.toggleButton}
                >
                  {showLogs ? '🔼 Ocultar' : '🔽 Mostrar'} Logs
                </button>
                <button onClick={exportLogs} style={styles.exportButton}>
                  💾 Exportar
                </button>
                <button onClick={clearLogs} style={styles.clearButton}>
                  🗑️ Limpiar
                </button>
              </div>
            </div>

            {showLogs && (
              <div style={styles.logsContainer}>
                {securityLogs.length === 0 ? (
                  <p style={styles.noLogs}>No hay eventos de seguridad registrados.</p>
                ) : (
                  securityLogs.slice(0, 15).map((log, index) => (
                    <div key={index} style={styles.logEntry}>
                      <span style={styles.logTime}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span style={styles.logType}>
                        {formatEventType(log.type)}
                      </span>
                      <span style={styles.logDetails}>{log.details}</span>
                      {log.path && (
                        <span style={styles.logPath}>{log.path}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  hint: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '10px',
    borderRadius: '20px',
    fontSize: '12px',
    zIndex: 999
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000
  },
  panel: {
    backgroundColor: 'white',
    borderRadius: '15px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90%',
    overflow: 'auto',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#f8f9fa'
  },
  title: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '1.5em'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5em',
    cursor: 'pointer',
    color: '#7f8c8d',
    padding: '5px',
    borderRadius: '50%'
  },
  content: {
    padding: '20px'
  },
  section: {
    marginBottom: '30px',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#fafafa'
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    color: '#2c3e50',
    fontSize: '1.1em'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  statValue: {
    display: 'block',
    fontSize: '1.8em',
    fontWeight: 'bold',
    color: '#3498db'
  },
  statLabel: {
    display: 'block',
    fontSize: '0.9em',
    color: '#7f8c8d',
    marginTop: '5px'
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    marginBottom: '20px'
  },
  configItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontWeight: 'bold',
    color: '#34495e',
    fontSize: '0.9em'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#34495e',
    fontSize: '0.9em',
    cursor: 'pointer'
  },
  input: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1em'
  },
  checkbox: {
    transform: 'scale(1.2)'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  resetButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  logControls: {
    display: 'flex',
    gap: '10px'
  },
  toggleButton: {
    padding: '8px 12px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em'
  },
  exportButton: {
    padding: '8px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em'
  },
  clearButton: {
    padding: '8px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em'
  },
  logsContainer: {
    maxHeight: '300px',
    overflowY: 'auto',
    border: '1px solid #ddd',
    borderRadius: '5px',
    backgroundColor: 'white'
  },
  logEntry: {
    display: 'grid',
    gridTemplateColumns: '150px 200px 1fr 100px',
    gap: '10px',
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '0.85em'
  },
  logTime: {
    color: '#6c757d',
    fontFamily: 'monospace'
  },
  logType: {
    color: '#495057',
    fontWeight: 'bold'
  },
  logDetails: {
    color: '#212529'
  },
  logPath: {
    color: '#007bff',
    fontFamily: 'monospace',
    fontSize: '0.8em'
  },
  noLogs: {
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic',
    margin: '20px'
  }
};

export default SecurityConfigPanel;