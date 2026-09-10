import React from 'react';
import { IMAGE_VIEWER_VISIBILITY_EVENT, type ImageViewerVisibilityDetail } from '../constants/uiEvents';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, label = 'Regresar', style }) => {
  const [isHover, setIsHover] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isScrolledPastHeader, setIsScrolledPastHeader] = React.useState(false);
  const [floatingTopOffset, setFloatingTopOffset] = React.useState(62);
  const [floatingLeftOffset, setFloatingLeftOffset] = React.useState(14);
  const [openImageViewerCount, setOpenImageViewerCount] = React.useState(0);
  const [isBodyScrollLocked, setIsBodyScrollLocked] = React.useState(false);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const floatingButtonRef = React.useRef<HTMLButtonElement>(null);
  const isImageViewerOpen = openImageViewerCount > 0;

  React.useEffect(() => {
    const updateBodyScrollLockState = () => {
      const bodyStyles = window.getComputedStyle(document.body);
      const locked = bodyStyles.overflow === 'hidden' || bodyStyles.overflowY === 'hidden';
      setIsBodyScrollLocked((prev) => (prev === locked ? prev : locked));
    };

    updateBodyScrollLockState();

    const observer = new MutationObserver(() => {
      updateBodyScrollLockState();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    window.addEventListener('focus', updateBodyScrollLockState);
    window.addEventListener('resize', updateBodyScrollLockState);
    document.addEventListener('visibilitychange', updateBodyScrollLockState);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', updateBodyScrollLockState);
      window.removeEventListener('resize', updateBodyScrollLockState);
      document.removeEventListener('visibilitychange', updateBodyScrollLockState);
    };
  }, []);

  React.useEffect(() => {
    const handleImageViewerVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<ImageViewerVisibilityDetail>;
      const delta = customEvent.detail?.delta;
      if (delta !== 1 && delta !== -1) return;
      setOpenImageViewerCount((prev) => Math.max(0, prev + delta));
    };

    window.addEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, handleImageViewerVisibility as EventListener);
    return () => {
      window.removeEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, handleImageViewerVisibility as EventListener);
    };
  }, []);

  React.useEffect(() => {
    setIsHover(false);
    setIsPressed(false);
    setIsFocused(false);
  }, [isImageViewerOpen]);

  React.useEffect(() => {
    let rafId: number | null = null;

    const updateFloatingOffsets = () => {
      const defaultOffset = 14;
      let nextTopOffset = 62;
      let nextLeftOffset = defaultOffset;

      const anchorEl = anchorRef.current;
      if (anchorEl) {
        const anchorRect = anchorEl.getBoundingClientRect();
        if (anchorRect.left > 0) {
          nextLeftOffset = Math.max(defaultOffset, Math.round(anchorRect.left));
        } else if (anchorEl.parentElement) {
          const parentRect = anchorEl.parentElement.getBoundingClientRect();
          const parentPaddingLeft =
            Number.parseFloat(window.getComputedStyle(anchorEl.parentElement).paddingLeft) || 0;
          nextLeftOffset = Math.max(defaultOffset, Math.round(parentRect.left + parentPaddingLeft));
        }
      }

      const compactBarEl = document.querySelector('.atlas-compact-bar');
      const isCompactBarVisible =
        compactBarEl instanceof HTMLElement &&
        window.getComputedStyle(compactBarEl).visibility !== 'hidden' &&
        Number.parseFloat(window.getComputedStyle(compactBarEl).opacity || '1') > 0.05;

      const headerEl =
        document.querySelector('.atlas-header-wrapper') ||
        document.querySelector('.atlas-header-hero') ||
        document.querySelector('header');

      const isHeaderPast =
        isCompactBarVisible ||
        (headerEl instanceof HTMLElement ? headerEl.getBoundingClientRect().bottom <= 40 : window.scrollY > 150);

      setIsScrolledPastHeader((prev) => (prev === isHeaderPast ? prev : isHeaderPast));

      if (isCompactBarVisible && compactBarEl) {
        const compactBarRect = compactBarEl.getBoundingClientRect();
        if (compactBarRect.bottom > 0) {
          nextTopOffset = Math.round(compactBarRect.bottom + 10);
          nextLeftOffset = Math.max(nextLeftOffset, Math.round(compactBarRect.left + 14));
        }
      }

      if (floatingButtonRef.current) {
        floatingButtonRef.current.style.top = `calc(env(safe-area-inset-top, 0px) + ${nextTopOffset}px)`;
        floatingButtonRef.current.style.left = `${nextLeftOffset}px`;
      }

      setFloatingTopOffset((prev) => (prev === nextTopOffset ? prev : nextTopOffset));
      setFloatingLeftOffset((prev) => (prev === nextLeftOffset ? prev : nextLeftOffset));
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateFloatingOffsets();
      });
    };

    updateFloatingOffsets();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    minWidth: '40px',
    minHeight: '40px',
    padding: 0,
    margin: 0,
    borderRadius: '999px',
    border: '1.5px solid rgba(254, 202, 202, 0.45)',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
    color: '#ffffff',
    fontSize: '1.22em',
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(8px)',
    boxShadow:
      '0 6px 18px rgba(220, 38, 38, 0.38), 0 2px 6px rgba(185, 28, 28, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
    transition:
      'opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, filter 180ms ease',
    fontFamily: 'inherit',
    position: 'fixed',
    top: `calc(env(safe-area-inset-top, 0px) + ${floatingTopOffset}px)`,
    left: `${floatingLeftOffset}px`,
    zIndex: 1200,
  };

  const hoverStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)',
    borderColor: 'rgba(255, 255, 255, 0.75)',
    color: '#ffffff',
    transform: 'scale(1.1)',
    boxShadow:
      '0 10px 24px rgba(220, 38, 38, 0.5), 0 3px 8px rgba(185, 28, 28, 0.35), inset 0 1px 1.5px rgba(255, 255, 255, 0.65)',
  };

  const pressedStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    transform: 'scale(0.95)',
    boxShadow: '0 2px 8px rgba(185, 28, 28, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.2)',
  };

  const focusStyle: React.CSSProperties = {
    outline: 'none',
    boxShadow:
      '0 0 0 3px rgba(254, 202, 202, 0.65), 0 8px 22px rgba(220, 38, 38, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
  };

  const isFloatingVisible = isScrolledPastHeader && !isImageViewerOpen && !isBodyScrollLocked;

  const floatingVisibilityStyle: React.CSSProperties = {
    opacity: isFloatingVisible ? 1 : 0,
    transform: isFloatingVisible
      ? isHover
        ? 'scale(1.1)'
        : isPressed
          ? 'scale(0.95)'
          : 'scale(1)'
      : 'translateY(-10px) scale(0.9)',
    pointerEvents: isFloatingVisible ? 'auto' : 'none',
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
    border: isHover ? '1.5px solid rgba(255, 255, 255, 0.75)' : '1.5px solid rgba(254, 202, 202, 0.45)',
  };

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          margin: 0,
          padding: 0,
          border: 'none',
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      />

      <button
        ref={floatingButtonRef}
        type="button"
        onClick={onClick}
        title={label || 'Regresar'}
        aria-label={label || 'Regresar'}
        tabIndex={isFloatingVisible ? 0 : -1}
        aria-hidden={!isFloatingVisible}
        style={{
          ...baseStyle,
          ...style,
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
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            lineHeight: 1,
            marginTop: '-1px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
          }}
        >
          ←
        </span>
      </button>
    </>
  );
};

export default BackButton;
