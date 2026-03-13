import React, { useState } from 'react';
import { useActiveVisitorsCount } from '../hooks/useActiveVisitorsCount';

const FloatingVisitorsIndicator: React.FC = () => {
  const count = useActiveVisitorsCount();
  const [showHint, setShowHint] = useState(false);

  const handleClick = () => {
    setShowHint(true);
    window.setTimeout(() => setShowHint(false), 2800);
  };

  return (
    <>
      <style>{`
        @keyframes atlas-eye-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          94%, 96% { transform: scaleY(0.15); }
        }
        @keyframes atlas-pill-pulse {
          0%, 100% { box-shadow: 0 10px 24px rgba(2,6,23,0.35); }
          50% { box-shadow: 0 14px 30px rgba(15,23,42,0.45); }
        }
      `}</style>

      <div
        style={s.wrap}
        title="Usuarios activos en el sitio"
        onClick={handleClick}
      >
        <span style={s.eye}>👁</span>
        <strong style={s.count}>{count}</strong>

        {showHint && (
          <div style={s.hintBubble}>
            Este numero representa visitantes activos recientes en cualquier pagina del sitio.
          </div>
        )}
      </div>
    </>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(15,23,42,0.84)',
    color: '#e2e8f0',
    border: '1px solid rgba(148,163,184,0.35)',
    borderRadius: '999px',
    padding: '8px 12px',
    boxShadow: '0 10px 24px rgba(2,6,23,0.35)',
    animation: 'atlas-pill-pulse 2.8s ease-in-out infinite',
    backdropFilter: 'blur(6px)',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    userSelect: 'none',
    cursor: 'pointer',
  },
  eye: {
    fontSize: '1rem',
    lineHeight: 1,
    display: 'inline-block',
    transformOrigin: 'center',
    animation: 'atlas-eye-blink 4.6s ease-in-out infinite',
  },
  count: {
    fontSize: '0.92rem',
    color: '#ffffff',
    minWidth: '18px',
    textAlign: 'right',
  },
  hintBubble: {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 10px)',
    width: '260px',
    padding: '9px 11px',
    borderRadius: '10px',
    background: 'rgba(15,23,42,0.95)',
    border: '1px solid rgba(148,163,184,0.4)',
    color: '#e2e8f0',
    fontSize: '0.76rem',
    lineHeight: 1.35,
    boxShadow: '0 8px 20px rgba(2,6,23,0.35)',
  },
};

export default FloatingVisitorsIndicator;
