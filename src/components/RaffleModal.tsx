import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { X, Ticket, Sparkles, Gift, Frown } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import rifaImg from '../assets/imagenes/rifa.jpg';
import '../styles/raffleModal.css';

const WHATSAPP_PHONE = '50498742025';
const WHATSAPP_DEFAULT_MESSAGE = '¡Hola! Vengo del Atlas, me gustaría comprar un boleto para la rifa.';
const WHATSAPP_RAFFLE_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;

interface RaffleModalProps {
  /** Callback opcional cuando se cierra el modal */
  onClose?: () => void;
}

export const RaffleModal: React.FC<RaffleModalProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showSadFace, setShowSadFace] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Desbloqueo seguro y completo del scroll
  const unlockScroll = useCallback(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  const handleClose = useCallback(() => {
    if (showSadFace || isClosing) return;
    setShowSadFace(true);

    // Muestra la carita triste animada durante 1.85s (1 segundo más) y luego desvanece la ventana
    setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        unlockScroll();
        setIsOpen(false);
        onClose?.();
      }, 220);
    }, 1850);
  }, [showSadFace, isClosing, unlockScroll, onClose]);

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

  // Bloquear y restaurar el scroll del fondo mientras el modal esté abierto
  useEffect(() => {
    if (!isOpen) {
      unlockScroll();
      return;
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      unlockScroll();
    };
  }, [isOpen, unlockScroll]);

  // Copos de nieve decorativos animados en el fondo
  const snowflakes = useMemo(() => [
    { id: 1, left: '6%', delay: '0s', duration: '7s', size: 14, opacity: 0.75, char: '❄' },
    { id: 2, left: '17%', delay: '2.5s', duration: '9s', size: 11, opacity: 0.55, char: '❅' },
    { id: 3, left: '28%', delay: '1.2s', duration: '8s', size: 16, opacity: 0.7, char: '❄' },
    { id: 4, left: '42%', delay: '3.6s', duration: '10s', size: 12, opacity: 0.6, char: '❅' },
    { id: 5, left: '55%', delay: '0.6s', duration: '7.5s', size: 15, opacity: 0.8, char: '❄' },
    { id: 6, left: '68%', delay: '2s', duration: '8.5s', size: 12, opacity: 0.6, char: '❅' },
    { id: 7, left: '79%', delay: '4s', duration: '9.5s', size: 14, opacity: 0.7, char: '❄' },
    { id: 8, left: '89%', delay: '1.5s', duration: '8s', size: 16, opacity: 0.75, char: '❅' },
    { id: 9, left: '96%', delay: '3s', duration: '8.8s', size: 11, opacity: 0.55, char: '❄' },
  ], []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`home-raffle-overlay ${isClosing ? 'home-raffle-overlay-closing' : 'home-raffle-overlay-entering'}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Gran Rifa Navideña"
    >
      {/* Capa de nieve cayendo en el fondo */}
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

      {/* Animación interactiva de carita triste al cerrar (visible tanto al pulsar la X como al pulsar afuera) */}
      {showSadFace && (
        <div
          className={`home-raffle-sad-overlay ${isClosing ? 'home-raffle-sad-overlay-closing' : ''}`}
          role="status"
          aria-live="polite"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="home-raffle-sad-card">
            <div className="home-raffle-sad-face-icon" aria-hidden="true">
              <Frown size={68} strokeWidth={2.4} />
              <span className="home-raffle-tear" />
            </div>
            <p className="home-raffle-sad-text">¡Esperamos verte en la rifa!</p>
            <span className="home-raffle-sad-subtext">¡Mucho éxito en tus clases!</span>
          </div>
        </div>
      )}

      <div
        className={`home-raffle-container ${isClosing ? 'home-raffle-card-closing' : 'home-raffle-card-entering'} ${showSadFace ? 'home-raffle-container-dimmed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Guirnalda de luces navideñas parpadeantes */}
        <div className="home-raffle-fairy-lights" aria-hidden="true">
          <span className="home-raffle-bulb bulb-red" />
          <span className="home-raffle-bulb bulb-gold" />
          <span className="home-raffle-bulb bulb-green" />
          <span className="home-raffle-bulb bulb-blue" />
          <span className="home-raffle-bulb bulb-gold" />
          <span className="home-raffle-bulb bulb-red" />
          <span className="home-raffle-bulb bulb-green" />
        </div>

        {/* Resplandores ambientales festivos */}
        <span className="home-raffle-ambient-glow glow-red" aria-hidden="true" />
        <span className="home-raffle-ambient-glow glow-green" aria-hidden="true" />

        {/* Encabezado festivo con insignia navideña */}
        <div className="home-raffle-header-ribbon">
          <div className="home-raffle-badge">
            <Sparkles size={13} className="raffle-sparkle-icon" />
            <span>Gran Rifa Navideña</span>
            <Gift size={13} className="raffle-gift-icon" />
          </div>
        </div>

        {/* Botón flotante superior para cerrar */}
        <button
          type="button"
          className="home-raffle-close-btn"
          onClick={handleClose}
          disabled={showSadFace}
          aria-label="Cerrar ventana emergente"
          title="Cerrar (Esc)"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        {/* Contenido con la imagen de la rifa */}
        <div className="home-raffle-image-wrapper">
          <img
            src={rifaImg}
            alt="Gran Rifa de Histología"
            className="home-raffle-image"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Barra inferior de acción con enlace festivo a WhatsApp */}
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
