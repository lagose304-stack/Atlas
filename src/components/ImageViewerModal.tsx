import React, { useState, useEffect, useRef } from 'react';
import { renderBoldText } from './BoldField';

interface ImageViewerModalProps {
  src: string;
  srcZoom?: string;
  onClose: () => void;
  temaNombre?: string;
  subtemaNombre?: string;
  aumento?: string | null;
  senalados?: string[] | null;
  comentario?: string | null;
  tincion?: string | null;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const SIDEBAR_BREAKPOINT = 900;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src,
  srcZoom,
  onClose,
  temaNombre,
  subtemaNombre,
  aumento,
  senalados,
  comentario,
  tincion,
}) => {
  const hasInfo = !!(
    (senalados && senalados.length > 0) ||
    comentario ||
    tincion
  );

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const isDesktop = windowWidth >= SIDEBAR_BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [useZoomSource, setUseZoomSource] = useState(false);

  const [zoomLevel, setZoomLevel]   = useState(1);
  const [position, setPosition]     = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  const containerRef   = useRef<HTMLDivElement>(null);
  const stateRef       = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const isDraggingRef  = useRef(false);
  const pinchRef       = useRef<{ dist: number } | null>(null);

  useEffect(() => { stateRef.current.zoom = zoomLevel; }, [zoomLevel]);
  useEffect(() => { stateRef.current.pos  = position;  }, [position]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    setUseZoomSource(false);
  }, [src, srcZoom]);

  useEffect(() => {
    if (srcZoom && zoomLevel > 1.01) {
      setUseZoomSource(true);
    }
  }, [zoomLevel, srcZoom]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    const el = containerRef.current;
    if (!el) return;

    const getPinchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
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
      e.preventDefault();
      if (e.touches.length === 2 && pinchRef.current) {
        const newDist = getPinchDist(e.touches);
        const scale   = newDist / pinchRef.current.dist;
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
      if (e.touches.length < 2) { pinchRef.current = null; setIsPinching(false); }
      if (e.touches.length === 0) { isDraggingRef.current = false; setIsDragging(false); }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  const handleZoomIn  = () => applyZoom(stateRef.current.zoom + 0.25);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - 0.25);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyZoom(stateRef.current.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
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

  const handleMouseUp = () => { isDraggingRef.current = false; setIsDragging(false); };

  const showSidebar = hasInfo && (isDesktop || sidebarOpen);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 1000, display: 'flex', flexDirection: 'row',
        background: 'rgba(15,23,42,0.55)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{
        flex: 1, position: 'relative', background: 'radial-gradient(ellipse at top, #dbeafe 0%, #f5f7fa 50%, #eef2ff 100%)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: '#fff', color: '#ef4444', border: '1.5px solid #fca5a5',
            borderRadius: '50%', width: '40px', height: '40px',
            fontSize: '1.1em', cursor: 'pointer', fontWeight: 'bold', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(239,68,68,0.18)',
          }}
        >✕</button>

        {hasInfo && !isDesktop && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              position: 'absolute', top: '16px', left: '16px',
              background: sidebarOpen
                ? 'linear-gradient(135deg, #818cf8, #6366f1)'
                : 'rgba(255,255,255,0.90)',
              color: sidebarOpen ? '#fff' : '#6366f1',
              border: sidebarOpen ? 'none' : '1.5px solid #c7d2fe',
              borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700,
              fontSize: '0.82em', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 10px rgba(99,102,241,0.20)',
              fontFamily: 'inherit',
            }}
          >
            {sidebarOpen ? '◀ Ocultar info' : '▶ Ver info'}
          </button>
        )}

        <div
          ref={containerRef}
          style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'none', padding: '20px', boxSizing: 'border-box',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={useZoomSource && srcZoom ? srcZoom : src}
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

        <div
          style={{
            position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
            background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(10px)',
            padding: '12px 20px', borderRadius: '14px',
            boxShadow: '0 4px 20px rgba(14,165,233,0.15)', zIndex: 5,
            border: '1px solid rgba(186,230,253,0.6)',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={handleZoomOut} style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }} title="Alejar">−</button>
            <span style={{ color: '#0f172a', fontWeight: 800, minWidth: '55px', textAlign: 'center', fontSize: '0.95em' }}>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={handleZoomIn} style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }} title="Acercar">+</button>
          </div>
          <span style={{ color: '#64748b', fontSize: '0.72em', textAlign: 'center' }}>
            {zoomLevel > 1 ? '✋ Arrastra para mover' : '🖱️ Rueda para zoom'}
          </span>
        </div>
      </div>

      {showSidebar && (
        <div style={{
          width: isDesktop ? '300px' : 'min(300px, 88vw)',
          position: isDesktop ? 'relative' : 'absolute',
          top: 0, right: 0, height: '100%',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderLeft: '1px solid rgba(186,230,253,0.7)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          zIndex: isDesktop ? 1 : 20,
          boxShadow: isDesktop ? '-4px 0 24px rgba(14,165,233,0.08)' : '-8px 0 40px rgba(15,23,42,0.18)',
        }}>
          {/* Cabecera */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '2px solid #e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '4px', height: '22px', borderRadius: '4px', background: 'linear-gradient(180deg, #38bdf8, #818cf8)' }} />
              <span style={{ color: '#475569', fontSize: '0.72em', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Info de la placa</span>
            </div>
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(false)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', borderRadius: '8px', padding: '5px 10px', fontSize: '0.82em', fontFamily: 'inherit', fontWeight: 600 }}>✕ Cerrar</button>
            )}
          </div>
          {/* Contenido */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            {temaNombre && (
              <div>
                <span style={labelStyle}>Tema</span>
                <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #bfdbfe, #e0e7ff)', color: '#1e40af', fontWeight: 700, fontSize: '0.88em', borderRadius: '8px', padding: '6px 12px', border: '1px solid #93c5fd' }}>{temaNombre}</span>
              </div>
            )}
            {subtemaNombre && (
              <div>
                <span style={labelStyle}>Subtema</span>
                <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #bae6fd, #e0f2fe)', color: '#0369a1', fontWeight: 700, fontSize: '0.88em', borderRadius: '8px', padding: '6px 12px', border: '1px solid #7dd3fc' }}>{subtemaNombre}</span>
              </div>
            )}
            {aumento && (
              <div>
                <span style={labelStyle}>🔬 Aumento</span>
                <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #bbf7d0, #d1fae5)', color: '#065f46', fontWeight: 800, fontSize: '1.05em', borderRadius: '20px', padding: '5px 18px', letterSpacing: '0.04em', border: '1px solid #6ee7b7' }}>{aumento}</span>
              </div>
            )}
            {tincion && (
              <div>
                <span style={labelStyle}>🧪 Tinción</span>
                <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #fef3c7, #fffbeb)', color: '#92400e', fontWeight: 700, fontSize: '0.92em', borderRadius: '20px', padding: '5px 18px', border: '1px solid #fde68a' }}>{renderBoldText(tincion)}</span>
              </div>
            )}
            {comentario && (
              <div>
                <span style={labelStyle}>💬 Comentario</span>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.88em', lineHeight: 1.65, background: '#f1f5f9', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>{renderBoldText(comentario)}</p>
              </div>
            )}
            {senalados && senalados.length > 0 && (
              <div>
                <span style={labelStyle}>📌 Señalados</span>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {senalados.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #6366f1)', color: '#fff', fontWeight: 700, fontSize: '0.72em', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ color: '#1e293b', fontSize: '0.88em', lineHeight: 1.55 }}>{renderBoldText(item)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#94a3b8', fontSize: '0.65em', fontWeight: 800,
  letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px',
};

export default ImageViewerModal;
