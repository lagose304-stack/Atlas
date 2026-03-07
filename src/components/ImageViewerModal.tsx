import React, { useState, useEffect, useRef } from 'react';

interface ImageViewerModalProps {
  src: string;
  onClose: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Refs para handlers táctiles no-pasivos (sin stale closures)
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const pinchRef = useRef<{ dist: number } | null>(null);

  // Mantener ref sincronizada con el estado
  useEffect(() => { stateRef.current.zoom = zoomLevel; }, [zoomLevel]);
  useEffect(() => { stateRef.current.pos = position; }, [position]);

  const applyZoom = (newZoom: number, newPos?: { x: number; y: number }) => {
    const z = clamp(newZoom, ZOOM_MIN, ZOOM_MAX);
    stateRef.current.zoom = z;
    setZoomLevel(z);
    if (z <= 1) {
      stateRef.current.pos = { x: 0, y: 0 };
      setPosition({ x: 0, y: 0 });
    } else if (newPos) {
      stateRef.current.pos = newPos;
      setPosition(newPos);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Handlers táctiles con { passive: false } para poder llamar preventDefault
  // y así bloquear el zoom nativo del navegador durante el pellizco
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getPinchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // evita que el navegador haga zoom nativo
      if (e.touches.length === 2) {
        pinchRef.current = { dist: getPinchDist(e.touches) };
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsPinching(true);
      } else if (e.touches.length === 1) {
        pinchRef.current = null;
        if (stateRef.current.zoom > 1) {
          isDraggingRef.current = true;
          setIsDragging(true);
          dragStartRef.current = {
            x: e.touches[0].clientX - stateRef.current.pos.x,
            y: e.touches[0].clientY - stateRef.current.pos.y,
          };
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // impide scroll y zoom del navegador
      if (e.touches.length === 2 && pinchRef.current) {
        const newDist = getPinchDist(e.touches);
        const scale = newDist / pinchRef.current.dist;
        pinchRef.current.dist = newDist;
        const newZoom = clamp(stateRef.current.zoom * scale, ZOOM_MIN, ZOOM_MAX);
        stateRef.current.zoom = newZoom;
        setZoomLevel(newZoom);
        if (newZoom <= 1) {
          stateRef.current.pos = { x: 0, y: 0 };
          setPosition({ x: 0, y: 0 });
        }
      } else if (e.touches.length === 1 && isDraggingRef.current && stateRef.current.zoom > 1) {
        const newPos = {
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        };
        stateRef.current.pos = newPos;
        setPosition(newPos);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) {
        pinchRef.current = null;
        setIsPinching(false);
      }
      if (e.touches.length === 0) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []); // sin deps — usa refs para todo

  const handleZoomIn = () => applyZoom(stateRef.current.zoom + 0.25);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - 0.25);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    applyZoom(stateRef.current.zoom + delta);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (stateRef.current.zoom > 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - stateRef.current.pos.x,
        y: e.clientY - stateRef.current.pos.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && stateRef.current.zoom > 1) {
      const newPos = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      stateRef.current.pos = newPos;
      setPosition(newPos);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, overflow: 'hidden',
        touchAction: 'none', // impide zoom/scroll nativo del navegador
      }}
      onClick={onClose}
    >
      {/* Botón cerrar */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: '20px', right: '20px',
          backgroundColor: '#e74c3c', color: 'white', border: 'none',
          borderRadius: '50%', width: '50px', height: '50px',
          fontSize: '1.5em', cursor: 'pointer', fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 1002,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Contenedor imagen — ref para listeners no-pasivos de touch */}
      <div
        ref={containerRef}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', padding: '20px',
          touchAction: 'none',
        }}
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt="Vista ampliada"
          draggable={false}
          style={{
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
            userSelect: 'none',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            transition: (isDragging || isPinching) ? 'none' : 'transform 0.3s ease',
          }}
        />
      </div>

      {/* Controles de zoom */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', gap: '10px',
          backgroundColor: 'rgba(0,0,0,0.8)', padding: '15px 25px',
          borderRadius: '15px', alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 1002,
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleZoomOut}
            style={{
              backgroundColor: '#3498db', color: 'white', border: 'none',
              borderRadius: '50%', width: '40px', height: '40px',
              fontSize: '1.3em', cursor: 'pointer', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Alejar"
          >−</button>
          <span style={{ color: 'white', fontSize: '1em', fontWeight: 'bold', minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            style={{
              backgroundColor: '#3498db', color: 'white', border: 'none',
              borderRadius: '50%', width: '40px', height: '40px',
              fontSize: '1.3em', cursor: 'pointer', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Acercar"
          >+</button>
        </div>
        <div style={{ color: '#95a5a6', fontSize: '0.75em', textAlign: 'center' }}>
          {zoomLevel > 1
            ? '✋ Arrastra • Pellizca o rueda para zoom'
            : '🖱️ Rueda para zoom • 📱 Pellizca la imagen'}
        </div>
      </div>
    </div>
  );
};

export default ImageViewerModal;
