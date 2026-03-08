import React, { useState, useEffect } from 'react';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type LoadingToastType = 'saving' | 'deleting' | 'updating' | 'uploading';

interface LoadingToastProps {
  visible: boolean;
  type?: LoadingToastType;
  /** Texto personalizado, p. ej. "Creando tema". Se le añaden los puntos automáticamente. */
  message?: string;
}

// ── Configuración visual por tipo ────────────────────────────────────────────
const CONFIG: Record<
  LoadingToastType,
  { icon: string; color: string; bg: string; border: string; ring: string; defaultLabel: string }
> = {
  saving:   { icon: '💾', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', ring: '#22c55e', defaultLabel: 'Guardando'    },
  deleting: { icon: '🗑️', color: '#dc2626', bg: '#fff1f2', border: '#fca5a5', ring: '#ef4444', defaultLabel: 'Eliminando'   },
  updating: { icon: '✏️', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', ring: '#3b82f6', defaultLabel: 'Actualizando' },
  uploading:{ icon: '☁️', color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc', ring: '#0ea5e9', defaultLabel: 'Subiendo'     },
};

// ── Componente ───────────────────────────────────────────────────────────────
const LoadingToast: React.FC<LoadingToastProps> = ({ visible, type = 'saving', message }) => {
  // Puntos animados
  const [dots, setDots] = useState('');
  // Controla si el DOM node existe (para la animación de salida)
  const [mounted, setMounted] = useState(false);
  const [animClass, setAnimClass] = useState('loading-toast-enter');

  // Montar / desmontar con retraso para la animación
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setAnimClass('loading-toast-enter');
    } else {
      setAnimClass('loading-toast-exit');
      const t = setTimeout(() => setMounted(false), 380);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Reset puntos al aparecer
  useEffect(() => {
    if (visible) setDots('');
  }, [visible]);

  // Ciclo de puntos
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 420);
    return () => clearInterval(id);
  }, [visible]);

  if (!mounted) return null;

  const { icon, color, bg, border, ring, defaultLabel } = CONFIG[type];
  const label = message ?? defaultLabel;

  return (
    <div
      className={`loading-toast ${animClass}`}
      style={{
        position: 'fixed',
        bottom: '32px',
        right: '32px',
        zIndex: 99999,
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: '18px',
        padding: '18px 22px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: `0 12px 40px rgba(0,0,0,0.13), 0 0 0 4px ${ring}28`,
        minWidth: '230px',
        maxWidth: '300px',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* ── Icono con anillo pulsante ── */}
      <div style={{ position: 'relative', flexShrink: 0, width: '44px', height: '44px' }}>
        {/* Anillo exterior ping */}
        <div
          className="loading-toast-ring"
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '50%',
            border: `2.5px solid ${ring}`,
            opacity: 0,
          }}
        />
        {/* Círculo icono */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}18, ${color}38)`,
            border: `2px solid ${border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25em',
          }}
        >
          {icon}
        </div>
      </div>

      {/* ── Texto ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.7em',
            fontWeight: 700,
            color: color,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '4px',
            opacity: 0.85,
          }}
        >
          En progreso
        </div>
        <div
          style={{
            fontSize: '1em',
            fontWeight: 700,
            color: '#1e293b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
          <span
            style={{ display: 'inline-block', width: '1.6em', textAlign: 'left' }}
          >
            {dots}
          </span>
        </div>
      </div>

      {/* ── Barra de progreso inferior ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `${border}`,
          borderRadius: '0 0 16px 16px',
          overflow: 'hidden',
        }}
      >
        <div
          className="loading-toast-progress"
          style={{
            height: '100%',
            width: '50%',
            background: `linear-gradient(90deg, transparent, ${color}, ${ring}, transparent)`,
          }}
        />
      </div>
    </div>
  );
};

export default LoadingToast;
