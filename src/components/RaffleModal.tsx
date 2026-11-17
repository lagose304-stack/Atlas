import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Ticket, Sparkles, Gift } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import rifaImg from '../assets/imagenes/rifa.jpg';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import '../styles/raffleModal.css';

const WHATSAPP_PHONE = '50498742025';
const WHATSAPP_DEFAULT_MESSAGE = '¡Hola! Vengo del Atlas, me gustaría comprar un boleto para la rifa.';
const WHATSAPP_RAFFLE_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
export const CLOSE_ANIMATION_MS = 260;

interface RaffleModalProps {
  /** Callback opcional cuando se cierra el modal */
  onClose?: () => void;
}

export const RaffleModal: React.FC<RaffleModalProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      onClose?.();
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== undefined) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Foco inicial y trampa de Tab mientras el diálogo esté abierto
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    acquireAtlasScrollLock();
    dialogRef.current?.querySelector<HTMLButtonElement>('.home-raffle-close-btn')?.focus();

    return () => {
      releaseAtlasScrollLock();
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  const handleDialogKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialogRef.current?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // Copos de nieve discretos: pocos y sin sombras ni giros para no cargar la página
  const snowflakes = useMemo(() => [
    { id: 1, left: '12%', delay: '0s', duration: '9s', size: 12, opacity: 0.5, char: '❄' },
    { id: 2, left: '38%', delay: '2s', duration: '11s', size: 10, opacity: 0.4, char: '❅' },
    { id: 3, left: '64%', delay: '4s', duration: '10s', size: 13, opacity: 0.45, char: '❄' },
    { id: 4, left: '86%', delay: '1s', duration: '12s', size: 11, opacity: 0.4, char: '❅' },
  ], []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      className={`home-raffle-overlay ${isClosing ? 'home-raffle-overlay-closing' : 'home-raffle-overlay-entering'}`}
      onClick={handleClose}
      onKeyDown={handleDialogKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Gran Rifa Navideña"
    >
      <div className="home-raffle-snow-layer" aria-hidden="true">
        {snowflakes.map(flake => (
          <span
            key={flake.id}
            className="home-raffle-snowflake"
            style={{
              left: flake.left,
              animationDelay: flake.delay,
              animationDuration: flake.duration,
              fontSize: `${flake.size}px`,
              opacity: flake.opacity,
            }}
          >
            {flake.char}
          </span>
        ))}
      </div>

      <div
        className={`home-raffle-container ${isClosing ? 'home-raffle-card-closing' : 'home-raffle-card-entering'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="home-raffle-header-ribbon">
          <div className="home-raffle-badge">
            <Sparkles size={13} className="raffle-sparkle-icon" />
            <span>Gran Rifa Navideña</span>
            <Gift size={13} className="raffle-gift-icon" />
          </div>
        </div>

        <button
          type="button"
          className="home-raffle-close-btn"
          onClick={handleClose}
          aria-label="Cerrar ventana emergente"
          title="Cerrar (Esc)"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div className="home-raffle-image-wrapper">
          <img
            src={rifaImg}
            alt="Gran Rifa de Histología"
            className="home-raffle-image"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="home-raffle-footer">
          <a
            href={WHATSAPP_RAFFLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="home-raffle-cta-btn"
          >
            <Ticket size={19} strokeWidth={2.4} className="raffle-btn-ticket" />
            <span>Quiero un boleto</span>
            <FaWhatsapp size={20} className="home-raffle-cta-wa-icon" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default RaffleModal;
