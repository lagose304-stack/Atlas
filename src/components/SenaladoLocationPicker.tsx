import React, { useEffect, useId, useRef, useState } from 'react';

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
}

interface SenaladoLocationPickerProps {
  imageSrc: string;
  senaladoLabel: string;
  initialLocation?: MarkerLocation | null;
  required?: boolean;
  onCancel: () => void;
  onSave: (location: MarkerLocation | null) => void;
  onRemove?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
type PointerEdge = 'left' | 'right' | 'top' | 'bottom';
type PointerStartPoint = { x: number; y: number; edge: PointerEdge };

const getPointerStartPx = (x: number, y: number, width: number, height: number) => {
  const distances = [
    { edge: 'left', value: x },
    { edge: 'right', value: width - x },
    { edge: 'top', value: y },
    { edge: 'bottom', value: height - y },
  ] as const;

  const nearest = distances.reduce((prev, curr) => (curr.value < prev.value ? curr : prev));

  switch (nearest.edge) {
    case 'left':
      return { x: 0, y, edge: 'left' as PointerEdge };
    case 'right':
      return { x: width, y, edge: 'right' as PointerEdge };
    case 'top':
      return { x, y: 0, edge: 'top' as PointerEdge };
    default:
      return { x, y: height, edge: 'bottom' as PointerEdge };
  }
};

const clampPointToNearestEdge = (x: number, y: number, width: number, height: number): PointerStartPoint => {
  const clampedX = clamp(x, 0, width);
  const clampedY = clamp(y, 0, height);
  return getPointerStartPx(clampedX, clampedY, width, height);
};

const enforceMinimumInclination = (
  start: { x: number; y: number; edge: PointerEdge },
  end: { x: number; y: number },
  width: number,
  height: number,
  minAngleDeg: number
) => {
  const tanMin = Math.tan((minAngleDeg * Math.PI) / 180);

  if (start.edge === 'left' || start.edge === 'right') {
    const dx = Math.abs(end.x - start.x);
    const currentDy = Math.abs(end.y - start.y);
    const minDy = dx * tanMin;
    if (currentDy < minDy) {
      const sign = end.y < height / 2 ? 1 : -1;
      return { ...start, y: clamp(end.y - sign * minDy, 0, height) };
    }
    return start;
  }

  const dy = Math.abs(end.y - start.y);
  const currentDx = Math.abs(end.x - start.x);
  const minDx = dy * tanMin;
  if (currentDx < minDx) {
    const sign = end.x < width / 2 ? 1 : -1;
    return { ...start, x: clamp(end.x - sign * minDx, 0, width) };
  }
  return start;
};

const getPointerPolygon = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  bodyWidth: number,
  taperDistance: number
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -dy / len;
  const ny = dx / len;
  const half = bodyWidth / 2;
  const taper = Math.min(taperDistance, len * 0.6);
  const neck = {
    x: end.x - ux * taper,
    y: end.y - uy * taper,
  };

  return [
    { x: start.x + nx * half, y: start.y + ny * half },
    { x: start.x - nx * half, y: start.y - ny * half },
    { x: neck.x - nx * half, y: neck.y - ny * half },
    end,
    { x: neck.x + nx * half, y: neck.y + ny * half },
  ];
};

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;

const SenaladoLocationPicker: React.FC<SenaladoLocationPickerProps> = ({
  imageSrc,
  senaladoLabel,
  initialLocation = null,
  required = false,
  onCancel,
  onSave,
  onRemove,
}) => {
  const [location, setLocation] = useState<MarkerLocation | null>(initialLocation);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [draggingPointerStart, setDraggingPointerStart] = useState(false);
  const pointerClipId = useId();

  const updateImageSize = () => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    setImageSize({ width: imageEl.clientWidth, height: imageEl.clientHeight });
  };

  useEffect(() => {
    updateImageSize();
    const imageEl = imageRef.current;
    if (!imageEl) return;

    const observer = new ResizeObserver(() => updateImageSize());
    observer.observe(imageEl);

    window.addEventListener('resize', updateImageSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateImageSize);
    };
  }, [imageSrc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !required) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const updatePointerTipFromClient = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    setLocation(prev => ({
      x,
      y,
      startX: prev?.startX ?? null,
      startY: prev?.startY ?? null,
    }));
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    updatePointerTipFromClient(event.clientX, event.clientY);
  };

  const updatePointerStartFromClient = (clientX: number, clientY: number) => {
    if (!imageRef.current || !imageSize) return;

    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const startPx = clampPointToNearestEdge(
      relX * imageSize.width,
      relY * imageSize.height,
      imageSize.width,
      imageSize.height
    );

    setLocation(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        startX: startPx.x / imageSize.width,
        startY: startPx.y / imageSize.height,
      };
    });
  };

  useEffect(() => {
    if (!draggingPointerStart) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updatePointerStartFromClient(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      setDraggingPointerStart(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingPointerStart, imageSize]);

  const handlePointerStartDown = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!location) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingPointerStart(true);
    updatePointerStartFromClient(event.clientX, event.clientY);
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.tagName.toLowerCase() === 'circle') return;
    event.preventDefault();
    updatePointerTipFromClient(event.clientX, event.clientY);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1600,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={required ? undefined : onCancel}
    >
      <div
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '94vh',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#0f172a', fontWeight: 800, fontSize: '0.98em' }}>
              Ubicar señalado
            </p>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.86em' }}>
              Haz clic sobre la imagen para ubicar: <strong>{senaladoLabel || 'Señalado'}</strong>
            </p>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8em' }}>
              Arrastra el punto azul del borde para cambiar la dirección del puntero.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={required}
            style={{
              border: '1px solid #cbd5e1',
              background: required ? '#f1f5f9' : '#f8fafc',
              color: required ? '#94a3b8' : '#475569',
              borderRadius: '8px',
              padding: '6px 10px',
              fontWeight: 700,
              cursor: required ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cerrar
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: '280px',
            background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Seleccionar ubicación"
              onClick={handleImageClick}
              onLoad={updateImageSize}
              style={{
                display: 'block',
                maxWidth: 'min(920px, 100%)',
                maxHeight: '66vh',
                objectFit: 'contain',
                objectPosition: 'center center',
                borderRadius: '10px',
                cursor: 'crosshair',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
              }}
            />
            {location && imageSize && (
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'auto',
                  overflow: 'visible',
                  cursor: 'crosshair',
                }}
                onPointerDown={handleOverlayPointerDown}
                width={imageSize.width}
                height={imageSize.height}
                viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              >
                {(() => {
                  const endPx = {
                    x: location.x * imageSize.width,
                    y: location.y * imageSize.height,
                  };
                  const hasManualStart = location.startX != null && location.startY != null;
                  const manualStart = hasManualStart
                    ? clampPointToNearestEdge(
                      (location.startX ?? 0) * imageSize.width,
                      (location.startY ?? 0) * imageSize.height,
                      imageSize.width,
                      imageSize.height
                    )
                    : null;
                  const autoStart = getPointerStartPx(endPx.x, endPx.y, imageSize.width, imageSize.height);
                  const startPx = manualStart
                    ? manualStart
                    : enforceMinimumInclination(
                      autoStart,
                      endPx,
                      imageSize.width,
                      imageSize.height,
                      POINTER_MIN_ANGLE_DEG
                    );
                  const directionLen = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
                  const drawStartPx = {
                    x: startPx.x - ((endPx.x - startPx.x) / directionLen) * POINTER_BASE_OUTSET_PX,
                    y: startPx.y - ((endPx.y - startPx.y) / directionLen) * POINTER_BASE_OUTSET_PX,
                  };
                  const tipInsetPoint = {
                    x: endPx.x - ((endPx.x - startPx.x) / directionLen) * POINTER_OUTLINE_TIP_BACKOFF_PX,
                    y: endPx.y - ((endPx.y - startPx.y) / directionLen) * POINTER_OUTLINE_TIP_BACKOFF_PX,
                  };
                  const outline = getPointerPolygon(drawStartPx, tipInsetPoint, POINTER_OUTLINE_WIDTH_PX, POINTER_TAPER_PX);
                  const core = getPointerPolygon(drawStartPx, endPx, POINTER_CORE_WIDTH_PX, POINTER_TAPER_PX);
                  return (
                    <>
                      <defs>
                        <clipPath id={pointerClipId}>
                          <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                        </clipPath>
                      </defs>
                      <g clipPath={`url(#${pointerClipId})`}>
                        <polygon
                          points={`${outline[0].x},${outline[0].y} ${outline[1].x},${outline[1].y} ${outline[2].x},${outline[2].y} ${outline[3].x},${outline[3].y} ${outline[4].x},${outline[4].y}`}
                          fill="rgba(255,255,255,0.6)"
                          pointerEvents="none"
                          shapeRendering="geometricPrecision"
                        />
                        <polygon
                          points={`${core[0].x},${core[0].y} ${core[1].x},${core[1].y} ${core[2].x},${core[2].y} ${core[3].x},${core[3].y} ${core[4].x},${core[4].y}`}
                          fill="#0a0a0a"
                          pointerEvents="none"
                          shapeRendering="geometricPrecision"
                        />
                      </g>
                      <circle
                        cx={startPx.x}
                        cy={startPx.y}
                        r={8}
                        fill={draggingPointerStart ? '#2563eb' : '#0ea5e9'}
                        stroke="#ffffff"
                        strokeWidth={2}
                        onPointerDown={handlePointerStartDown}
                        style={{ cursor: draggingPointerStart ? 'grabbing' : 'grab' }}
                      />
                    </>
                  );
                })()}
              </svg>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              style={{
                border: '1px solid #fecaca',
                background: '#fff1f2',
                color: '#be123c',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Quitar señalado
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLocation(null)}
              style={{
                border: '1px solid #fecaca',
                background: '#fff1f2',
                color: '#be123c',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Quitar ubicación
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={required}
              style={{
                border: '1px solid #cbd5e1',
                background: required ? '#f1f5f9' : '#fff',
                color: required ? '#94a3b8' : '#475569',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: required ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(location)}
              style={{
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Guardar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SenaladoLocationPicker;
