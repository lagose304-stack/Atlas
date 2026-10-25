import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Clock, Gift, Snowflake, Sparkles, Star, TreePine, Bell } from 'lucide-react';
import '../styles/christmasCountdown.css';

export interface ChristmasCountdownProps {
  className?: string;
  badgeLabel?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isChristmas: boolean;
  targetDate: Date;
}

const calculateTimeRemaining = (now: Date = new Date()): TimeRemaining => {
  const currentYear = now.getFullYear();
  let target = new Date(currentYear, 11, 25, 0, 0, 0, 0);

  const isChristmasDay = now.getMonth() === 11 && now.getDate() === 25;

  if (now > new Date(currentYear, 11, 25, 23, 59, 59, 999)) {
    target = new Date(currentYear + 1, 11, 25, 0, 0, 0, 0);
  }

  const diffMs = target.getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isChristmas: isChristmasDay,
    targetDate: target,
  };
};

export const ChristmasCountdown: React.FC<ChristmasCountdownProps> = ({
  className = '',
  badgeLabel = 'Cuenta Regresiva Navideña',
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() => calculateTimeRemaining(new Date()));

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      setCurrentDate(now);
      setTimeRemaining(calculateTimeRemaining(now));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const formattedCurrentTime = useMemo(() => {
    return currentDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [currentDate]);

  const formattedCurrentDate = useMemo(() => {
    return currentDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [currentDate]);

  const formattedTargetDate = useMemo(() => {
    return `25 de diciembre de ${timeRemaining.targetDate.getFullYear()}`;
  }, [timeRemaining.targetDate]);

  const pad = (num: number): string => String(num).padStart(2, '0');

  return (
    <section
      className={`christmas-countdown-card ${className}`}
      aria-label="Contador regresivo para Navidad"
    >
      {/* Guirnalda de lucecitas festivas en borde superior */}
      <div className="christmas-fairy-lights" aria-hidden="true">
        <span className="christmas-fairy-bulb bulb-red" />
        <span className="christmas-fairy-bulb bulb-gold" />
        <span className="christmas-fairy-bulb bulb-green" />
        <span className="christmas-fairy-bulb bulb-blue" />
        <span className="christmas-fairy-bulb bulb-purple" />
        <span className="christmas-fairy-bulb bulb-red" />
        <span className="christmas-fairy-bulb bulb-gold" />
        <span className="christmas-fairy-bulb bulb-green" />
        <span className="christmas-fairy-bulb bulb-blue" />
        <span className="christmas-fairy-bulb bulb-purple" />
      </div>

      {/* Resplandores ambientales y copos decorativos */}
      <span className="christmas-ambient-glow christmas-glow-red" aria-hidden="true" />
      <span className="christmas-ambient-glow christmas-glow-green" aria-hidden="true" />
      <span className="christmas-ambient-glow christmas-glow-gold" aria-hidden="true" />

      <div className="christmas-snowflakes" aria-hidden="true">
        <Snowflake className="christmas-snowflake christmas-snowflake-1" size={20} />
        <Snowflake className="christmas-snowflake christmas-snowflake-2" size={16} />
        <Star className="christmas-snowflake christmas-snowflake-3" size={13} />
      </div>

      {timeRemaining.isChristmas ? (
        <div className="christmas-celebration">
          <Gift size={40} color="#dc2626" />
          <h2 className="christmas-celebration-title">¡Feliz Navidad! 🎄✨</h2>
          <p className="christmas-celebration-text">
            ¡Llegó el día tan esperado! Desde el equipo de Histología te deseamos unas fiestas llenas de paz,
            alegría y momentos memorables junto a tu familia y seres queridos.
          </p>
        </div>
      ) : (
        <>
          {/* Fila principal compacta: Información a la izquierda y contadores a la derecha */}
          <div className="christmas-main-row">
            <div className="christmas-info-col">
              <div className="christmas-badge-row">
                <span className="christmas-badge">
                  <TreePine size={13} className="christmas-badge-icon" />
                  <span>{badgeLabel}</span>
                </span>
                <span className="christmas-sub-badge">
                  <Sparkles size={11} />
                  <span>Espíritu Navideño</span>
                </span>
                <span className="christmas-live-badge" title="Reloj sincronizado en tiempo real">
                  <span className="christmas-live-dot" aria-hidden="true" />
                  <span>En vivo</span>
                </span>
              </div>

              <h2 className="christmas-main-title">
                <TreePine size={20} className="christmas-tree-icon" aria-hidden="true" />
                {timeRemaining.days === 1 ? (
                  <>
                    Falta <span className="christmas-title-highlight">1 día</span> para Navidad
                  </>
                ) : (
                  <>
                    Faltan <span className="christmas-title-highlight">{timeRemaining.days} días</span> para Navidad
                  </>
                )}
              </h2>
            </div>

            {/* Contadores compactos en píldoras horizontales */}
            <div className="christmas-counter-grid" role="timer" aria-live="polite">
              <div className="christmas-counter-card christmas-counter-days">
                <div className="christmas-card-mini-chip" title="Días restantes">
                  <TreePine size={12} />
                </div>
                <span className="christmas-digit" data-testid="countdown-days">
                  {timeRemaining.days}
                </span>
                <span className="christmas-label">Días</span>
              </div>

              <div className="christmas-counter-card christmas-counter-hours">
                <div className="christmas-card-mini-chip" title="Horas restantes">
                  <Bell size={12} />
                </div>
                <span className="christmas-digit" data-testid="countdown-hours">
                  {pad(timeRemaining.hours)}
                </span>
                <span className="christmas-label">Horas</span>
              </div>

              <div className="christmas-counter-card christmas-counter-minutes">
                <div className="christmas-card-mini-chip" title="Minutos restantes">
                  <Gift size={12} />
                </div>
                <span className="christmas-digit" data-testid="countdown-minutes">
                  {pad(timeRemaining.minutes)}
                </span>
                <span className="christmas-label">Min</span>
              </div>

              <div className="christmas-counter-card christmas-counter-seconds">
                <div className="christmas-card-mini-chip" title="Segundos restantes">
                  <Sparkles size={12} />
                </div>
                <span className="christmas-digit" data-testid="countdown-seconds">
                  {pad(timeRemaining.seconds)}
                </span>
                <span className="christmas-label">Seg</span>
              </div>
            </div>
          </div>

          {/* Barra inferior delgada y estilizada con meta y hora en vivo */}
          <footer className="christmas-compact-footer">
            <div className="christmas-meta-target-item">
              <Calendar size={13} className="christmas-meta-icon" aria-hidden="true" />
              <span>
                Meta: <strong>{formattedTargetDate} (00:00 hrs)</strong>
              </span>
            </div>

            <div className="christmas-meta-clock">
              <Clock size={12} className="christmas-meta-icon" aria-hidden="true" />
              <span>
                Hoy: <strong>{formattedCurrentDate}</strong> · <strong>{formattedCurrentTime}</strong>
              </span>
            </div>
          </footer>
        </>
      )}
    </section>
  );
};

export default ChristmasCountdown;
