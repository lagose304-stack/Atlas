import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, label = 'Regresar', style }) => {
  const [isHover, setIsHover] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    padding: '7px 14px',
    borderRadius: '999px',
    border: '1px solid #dbe3ee',
    background: 'rgba(255, 255, 255, 0.72)',
    color: '#334155',
    fontSize: '0.88em',
    fontWeight: 600,
    letterSpacing: '0.01em',
    lineHeight: 1,
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
  };

  const hoverStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#cbd5e1',
    color: '#0f172a',
    transform: 'translateY(-1px)',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.10)',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...baseStyle, ...(isHover ? hoverStyle : {}), ...style }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <span style={{ fontSize: '1.05em' }}>←</span>
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
