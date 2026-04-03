import React from 'react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, label = 'Regresar', style }) => {
  const [isHover, setIsHover] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [showFloatingButton, setShowFloatingButton] = React.useState(false);
  const [floatingTopOffset, setFloatingTopOffset] = React.useState(12);
  const [floatingLeftOffset, setFloatingLeftOffset] = React.useState(12);
  const inlineButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const buttonEl = inlineButtonRef.current;
    if (!buttonEl) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const shouldFloat = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          setShowFloatingButton(shouldFloat);
        },
        { threshold: 0.05 }
      );

      observer.observe(buttonEl);
      return () => observer.disconnect();
    }

    const updateFloatingVisibility = () => {
      const rect = buttonEl.getBoundingClientRect();
      setShowFloatingButton(rect.bottom < 0);
    };

    updateFloatingVisibility();
    window.addEventListener('scroll', updateFloatingVisibility, { passive: true });
    window.addEventListener('resize', updateFloatingVisibility);

    return () => {
      window.removeEventListener('scroll', updateFloatingVisibility);
      window.removeEventListener('resize', updateFloatingVisibility);
    };
  }, []);

  React.useEffect(() => {
    setIsHover(false);
    setIsPressed(false);
    setIsFocused(false);
  }, [showFloatingButton]);

  React.useEffect(() => {
    const updateFloatingOffsets = () => {
      const defaultOffset = 12;
      let nextTopOffset = defaultOffset;
      let nextLeftOffset = defaultOffset;

      const inlineButtonRect = inlineButtonRef.current?.getBoundingClientRect();
      if (inlineButtonRect) {
        nextLeftOffset = Math.max(defaultOffset, Math.round(inlineButtonRect.left));
      }

      const compactBarEl = document.querySelector('.atlas-compact-bar');
      if (compactBarEl instanceof HTMLElement) {
        const computed = window.getComputedStyle(compactBarEl);
        const compactBarVisible =
          computed.visibility !== 'hidden' && Number.parseFloat(computed.opacity || '1') > 0.05;

        if (compactBarVisible) {
          const compactBarRect = compactBarEl.getBoundingClientRect();
          if (compactBarRect.bottom > 0) {
            nextTopOffset = Math.max(defaultOffset, Math.round(compactBarRect.bottom + 10));
            nextLeftOffset = Math.max(nextLeftOffset, Math.round(compactBarRect.left + 12));
          }
        }
      }

      setFloatingTopOffset((prev) => (prev === nextTopOffset ? prev : nextTopOffset));
      setFloatingLeftOffset((prev) => (prev === nextLeftOffset ? prev : nextLeftOffset));
    };

    updateFloatingOffsets();
    window.addEventListener('scroll', updateFloatingOffsets, { passive: true });
    window.addEventListener('resize', updateFloatingOffsets);

    return () => {
      window.removeEventListener('scroll', updateFloatingOffsets);
      window.removeEventListener('resize', updateFloatingOffsets);
    };
  }, [showFloatingButton]);

  const baseStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '9px',
    marginBottom: '12px',
    padding: '8px 14px',
    borderRadius: '11px',
    border: '1px solid #fecaca',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(254,242,242,0.94) 100%)',
    color: '#1e293b',
    fontSize: '0.84em',
    fontWeight: 700,
    letterSpacing: '0.02em',
    lineHeight: 1,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    MozAppearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 8px rgba(248, 113, 113, 0.16), inset 0 1px 0 rgba(255,255,255,0.86)',
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
  };

  const hoverStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.99) 0%, rgba(254,226,226,0.95) 100%)',
    borderColor: '#fca5a5',
    color: '#7f1d1d',
    transform: 'translateY(-1px)',
    boxShadow: '0 7px 15px rgba(248, 113, 113, 0.26), inset 0 1px 0 rgba(255,255,255,0.9)',
  };

  const pressedStyle: React.CSSProperties = {
    transform: 'translateY(0)',
    boxShadow: '0 2px 6px rgba(248, 113, 113, 0.2), inset 0 1px 0 rgba(255,255,255,0.78)',
  };

  const focusStyle: React.CSSProperties = {
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(251, 113, 133, 0.34), 0 4px 12px rgba(248, 113, 113, 0.2), inset 0 1px 0 rgba(255,255,255,0.88)',
  };

  const iconStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '999px',
    background: isHover
      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
      : 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.88em',
    fontWeight: 800,
    lineHeight: 1,
    boxShadow: '0 2px 7px rgba(185, 28, 28, 0.42)',
  };

  const floatingStyle: React.CSSProperties = {
    position: 'fixed',
    top: `calc(env(safe-area-inset-top, 0px) + ${floatingTopOffset}px)`,
    left: `${floatingLeftOffset}px`,
    marginBottom: 0,
    zIndex: 1200,
    transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease',
  };

  const floatingVisibilityStyle: React.CSSProperties = {
    opacity: showFloatingButton ? 1 : 0,
    transform: showFloatingButton ? 'translateY(0)' : 'translateY(-8px)',
    pointerEvents: showFloatingButton ? 'auto' : 'none',
  };

  const handleMouseEnter = () => setIsHover(true);
  const handleMouseLeave = () => {
    setIsHover(false);
    setIsPressed(false);
  };
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    setIsFocused(event.currentTarget.matches(':focus-visible'));
  };
  const handleBlur = () => {
    setIsFocused(false);
    setIsPressed(false);
  };

  const interactiveStyle: React.CSSProperties = {
    ...(isHover ? hoverStyle : {}),
    ...(isPressed ? pressedStyle : {}),
    ...(isFocused ? focusStyle : {}),
    border: isHover ? '1px solid #fca5a5' : '1px solid #fecaca',
  };

  return (
    <>
      <button
        ref={inlineButtonRef}
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          ...style,
          ...interactiveStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span style={iconStyle}>←</span>
        <span>{label}</span>
      </button>

      <button
        type="button"
        onClick={onClick}
        tabIndex={showFloatingButton ? 0 : -1}
        aria-hidden={!showFloatingButton}
        style={{
          ...baseStyle,
          ...floatingStyle,
          ...floatingVisibilityStyle,
          ...interactiveStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span style={iconStyle}>←</span>
        <span>{label}</span>
      </button>
    </>
  );
};

export default BackButton;
