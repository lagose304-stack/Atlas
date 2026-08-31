import React, { useState, useRef, useCallback, useEffect } from 'react';
import cajalDrawing from '../assets/imagenes/cajal_dibujo_historico.jpg';
import placaCerebelo from '../assets/imagenes/placa_817_cerebelo.webp';
import '../styles/cajal-comparator.css';

export const CajalHistoryComparator: React.FC = () => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAutoAnimating, setIsAutoAnimating] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserInteracted = useRef<boolean>(false);

  const stopAutoAnimation = useCallback(() => {
    if (!hasUserInteracted.current) {
      hasUserInteracted.current = true;
      setIsAutoAnimating(false);
    }
  }, []);

  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedPct = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(Math.round(clampedPct * 10) / 10);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopAutoAnimation();
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if already released
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    stopAutoAnimation();
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPos(prev => Math.max(5, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPos(prev => Math.min(95, prev + 5));
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Animación automática de deslizamiento continuo y alternado
  useEffect(() => {
    let timerId: number | undefined;
    let intervalId: number | undefined;

    // Ciclo de posiciones:
    // 15% (muestra la placa real casi por completo)
    // 85% (muestra el dibujo de Cajal casi por completo)
    // 50% (muestra la vista dividida)
    const targets = [15, 85, 50];
    let index = 0;

    timerId = window.setTimeout(() => {
      if (hasUserInteracted.current) return;
      setIsAutoAnimating(true);
      setSliderPos(targets[0]);

      intervalId = window.setInterval(() => {
        if (hasUserInteracted.current) {
          window.clearInterval(intervalId);
          setIsAutoAnimating(false);
          return;
        }
        index = (index + 1) % targets.length;
        setIsAutoAnimating(true);
        setSliderPos(targets[index]);
      }, 3400);
    }, 1200);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="cajal-comparator-container" aria-label="Comparador visual del dibujo histórico de Cajal frente a microfotografía real">
      {/* Visor interactivo con máscara comparativa */}
      <div
        ref={containerRef}
        className={`cajal-viewer is-slider-mode ${isDragging ? 'is-dragging' : ''} ${isAutoAnimating && !isDragging ? 'is-auto-animating' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuenow={sliderPos}
        aria-valuemin={5}
        aria-valuemax={95}
        aria-label="Deslizador para comparar dibujo de Cajal con microfotografía real"
      >
        {/* Capa Base: Microfotografía Real moderna (Placa #817 de Cerebelo) */}
        <div className="cajal-layer cajal-layer-microscopy" aria-hidden="true">
          <img
            src={placaCerebelo}
            alt="Placa histológica real de corteza cerebelosa con neurona de Purkinje (ID 817)"
            className="cajal-img"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Capa Superior Recortada: Dibujo histórico de Santiago Ramón y Cajal */}
        <div
          className="cajal-layer cajal-layer-drawing"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          aria-hidden="true"
        >
          <img
            src={cajalDrawing}
            alt="Dibujo histórico original de Santiago Ramón y Cajal en tinta china y sepia"
            className="cajal-img"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Tirador deslizable */}
        <div
          className="cajal-divider"
          style={{ left: `${sliderPos}%` }}
          aria-hidden="true"
        >
          <div className="cajal-divider-line" />
          <div className="cajal-divider-handle">
            <span className="cajal-handle-arrow left">‹</span>
            <span className="cajal-handle-dot" />
            <span className="cajal-handle-arrow right">›</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CajalHistoryComparator;
