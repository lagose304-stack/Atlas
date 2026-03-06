import React, { useState, useEffect } from 'react';

interface ImageViewerModalProps {
  src: string;
  onClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));

  const handleZoomOut = () => {
    const next = Math.max(zoomLevel - 0.25, 0.5);
    setZoomLevel(next);
    if (next <= 1) setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(prev + 0.1, 3));
    } else {
      const next = Math.max(zoomLevel - 0.1, 0.5);
      setZoomLevel(next);
      if (next <= 1) setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      const t = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: t.clientX - position.x, y: t.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      const t = e.touches[0];
      setPosition({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, overflow: 'hidden',
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
        }}
      >
        ✕
      </button>

      {/* Contenedor imagen */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', padding: '20px',
        }}
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
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
            transition: isDragging ? 'none' : 'transform 0.3s ease',
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
          {zoomLevel > 1 ? '🖱️ Arrastra para mover | Rueda para zoom' : '🖱️ Usa la rueda del mouse'}
        </div>
      </div>
    </div>
  );
};

export default ImageViewerModal;
