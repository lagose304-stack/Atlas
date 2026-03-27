import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LoginFormProps {
  onClose: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const removeWhitespaces = (value: string) => value.replace(/\s+/g, '');

  // Validación básica del formulario
  const validateForm = (): string | null => {
    if (!username.trim()) {
      return 'El nombre de usuario es obligatorio';
    }
    if (!password.trim()) {
      return 'La contraseña es obligatoria';
    }
    if (/\s/.test(username)) {
      return 'El usuario no puede contener espacios en blanco';
    }
    if (/\s/.test(password)) {
      return 'La contraseña no puede contener espacios en blanco';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar formulario
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const success = await login(username.trim(), password);

      if (success) {
        // Login exitoso - cerrar modal y redirigir
        setUsername('');
        setPassword('');
        onClose();
        
        // Redirigir a la página de edición después del login
        navigate('/edicion');
      } else {
        setError('Acceso denegado: credenciales invalidas o acceso temporalmente bloqueado');
      }
    } catch (error) {
      console.error('Error durante el login:', error);
      setError('Error de conexión. Por favor, intenta de nuevo.');
    }

    setLoading(false);
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>🔐 Iniciar Sesión</h2>
          <button 
            onClick={handleClose}
            style={styles.closeButton}
            disabled={loading}
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Usuario:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(removeWhitespaces(e.target.value))}
              required
              style={styles.input}
              disabled={loading}
              placeholder="Ingresa tu usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Contraseña:</label>
            <div style={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(removeWhitespaces(e.target.value))}
                required
                style={{ ...styles.input, ...styles.passwordInput }}
                disabled={loading}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                style={styles.passwordToggle}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          
          {error && (
            <div style={styles.errorContainer}>
              <p style={styles.error}>❌ {error}</p>
            </div>
          )}
          
          <div style={styles.buttons}>
            <button 
              type="submit" 
              style={{
                ...styles.submitButton,
                backgroundColor: loading ? '#cccccc' : '#28a745',
                cursor: loading ? 'not-allowed' : 'pointer'
              }} 
              disabled={loading}
            >
              {loading ? '🔄 Verificando...' : '🚀 Ingresar'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={styles.cancelButton}
              disabled={loading}
            >
              📨 Cancelar
            </button>
          </div>
        </form>
        
        <div style={styles.footer}>
          <small style={styles.footerText}>
            🔒 Conexión segura
          </small>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)',
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '15px',
    minWidth: '400px',
    maxWidth: '500px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    border: '2px solid #e3f2fd',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #f0f0f0'
  },
  title: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '1.5em',
    fontWeight: 'bold'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.2em',
    cursor: 'pointer',
    color: '#7f8c8d',
    padding: '5px',
    borderRadius: '50%',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontWeight: 'bold',
    color: '#34495e',
    fontSize: '0.95em',
  },
  input: {
    padding: '0.8rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    transition: 'border-color 0.3s ease',
    outline: 'none',
  },
  passwordWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggle: {
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    borderRadius: '8px',
    padding: '0.58rem 0.8rem',
    fontSize: '0.86rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f1556c',
    borderRadius: '8px',
    padding: '0.8rem',
    margin: '0.5rem 0'
  },
  error: {
    color: '#721c24',
    fontSize: '0.9rem',
    margin: 0,
    textAlign: 'center',
    fontWeight: '500'
  },
  buttons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  submitButton: {
    flex: 1,
    padding: '0.9rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
    textTransform: 'uppercase'
  },
  cancelButton: {
    flex: 1,
    padding: '0.9rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s ease'
  },
  footer: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e0e0e0',
    textAlign: 'center'
  },
  footerText: {
    color: '#7f8c8d',
    fontSize: '0.8em'
  }
};

export default LoginForm;
