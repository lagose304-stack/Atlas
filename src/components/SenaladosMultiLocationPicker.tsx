import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
}

interface SenaladosMultiLocationPickerProps {
  imageSrc: string;
  senaladoLabel: string;
  initialLocations?: MarkerLocation[];
  onCancel: () => void;
  onSave: (locations: MarkerLocation[]) => void;
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

const SenaladosMultiLocationPicker: React.FC<SenaladosMultiLocationPickerProps> = ({
  imageSrc,
  senaladoLabel,
  initialLocations = [],
  onCancel,
  onSave,
}) => {
  const [locations, setLocations] = useState<MarkerLocation[]>(initialLocations);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [draggingPointerStart, setDraggingPointerStart] = useState(false);
  const pointerClipId = useId();

  const commonStart = useMemo(() => {
    if (!locations.length) return null;
    const first = locations[0];
    if (first.startX == null || first.startY == null) return null;
    return { startX: first.startX, startY: first.startY };
  }, [locations]);

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
    if (!imageSize) return;
    if (locations.length === 0) return;
    const first = locations[0];
    const hasStart = first.startX != null && first.startY != null;
    if (hasStart) return;

    const startPx = getPointerStartPx(first.x * imageSize.width, first.y * imageSize.height, imageSize.width, imageSize.height);
    setLocations(prev => prev.map(item => ({
      ...item,
      startX: startPx.x / imageSize.width,
      startY: startPx.y / imageSize.height,
    })));
  }, [imageSize, locations]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const updateAllPointerStartsFromClient = (clientX: number, clientY: number) => {
    if (!imageRef.current || !imageSize) return;

    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const startPx = clampPointToNearestEdge(relX * imageSize.width, relY * imageSize.height, imageSize.width, imageSize.height);

    setLocations(prev => prev.map(item => ({
      ...item,
      startX: startPx.x / imageSize.width,
      startY: startPx.y / imageSize.height,
    })));
  };

  const addLocationFromClient = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl) return;

    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

    const x = clamp(relX, 0, 1);
    const y = clamp(relY, 0, 1);

    setLocations(prev => {
      const next: MarkerLocation[] = [...prev];

      let startX: number | null = null;
      let startY: number | null = null;

      const existingStart = prev[0]?.startX != null && prev[0]?.startY != null
        ? { startX: prev[0]?.startX ?? null, startY: prev[0]?.startY ?? null }
        : null;

      if (existingStart) {
        startX = existingStart.startX;
        startY = existingStart.startY;
      } else if (imageSize) {
        const startPx = getPointerStartPx(x * imageSize.width, y * imageSize.height, imageSize.width, imageSize.height);
        startX = startPx.x / imageSize.width;
        startY = startPx.y / imageSize.height;
      }

      next.push({ x, y, startX, startY });
      return next;
    });
  };

  useEffect(() => {
    if (!draggingPointerStart) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateAllPointerStartsFromClient(event.clientX, event.clientY);
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
    if (!locations.length) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingPointerStart(true);
    updateAllPointerStartsFromClient(event.clientX, event.clientY);
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.tagName.toLowerCase() === 'circle') return;
    event.preventDefault();
    addLocationFromClient(event.clientX, event.clientY);
  };

  const computedStartCircle = useMemo(() => {
    if (!commonStart || !imageSize) return null;

    const startPx = clampPointToNearestEdge(
      (commonStart.startX ?? 0) * imageSize.width,
      (commonStart.startY ?? 0) * imageSize.height,
      imageSize.width,
      imageSize.height
    );

    return startPx;
  }, [commonStart, imageSize]);

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
      onClick={onCancel}
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
              Ubicar señalados múltiples
            </p>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.86em' }}>
              Haz clic para añadir puntos del señalado: <strong>{senaladoLabel || 'Señalado'}</strong>
            </p>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8em' }}>
              Arrastra el punto azul del borde para mover el origen común del nombre.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#475569',
              borderRadius: '8px',
              padding: '6px 10px',
              fontWeight: 700,
              cursor: 'pointer',
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
              alt="Seleccionar ubicaciones"
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

            {imageSize && (
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
                <defs>
                  <clipPath id={pointerClipId}>
                    <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                  </clipPath>
                </defs>

                <g clipPath={`url(#${pointerClipId})`}>
                  {locations.map((location, idx) => {
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
                      : enforceMinimumInclination(autoStart, endPx, imageSize.width, imageSize.height, POINTER_MIN_ANGLE_DEG);

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

                    const outlinePoints = `${outline[0].x},${outline[0].y} ${outline[1].x},${outline[1].y} ${outline[2].x},${outline[2].y} ${outline[3].x},${outline[3].y} ${outline[4].x},${outline[4].y}`;
                    const corePoints = `${core[0].x},${core[0].y} ${core[1].x},${core[1].y} ${core[2].x},${core[2].y} ${core[3].x},${core[3].y} ${core[4].x},${core[4].y}`;

                    return (
                      <g key={idx} pointerEvents="none">
                        <polygon points={outlinePoints} fill="rgba(255,255,255,0.6)" shapeRendering="geometricPrecision" />
                        <polygon points={corePoints} fill="#0a0a0a" shapeRendering="geometricPrecision" />
                      </g>
                    );
                  })}
                </g>

                {computedStartCircle && (
                  <g>
                    <circle
                      cx={computedStartCircle.x}
                      cy={computedStartCircle.y}
                      r={8}
                      fill={draggingPointerStart ? '#2563eb' : '#0ea5e9'}
                      stroke="#ffffff"
                      strokeWidth={2}
                      onPointerDown={handlePointerStartDown}
                      style={{ cursor: draggingPointerStart ? 'grabbing' : 'grab' }}
                    />
                    <foreignObject
                      x={computedStartCircle.x + 10}
                      y={computedStartCircle.y - 16}
                      width={260}
                      height={40}
                      pointerEvents="none"
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'rgba(255,255,255,0.92)',
                          border: '1px solid rgba(186,230,253,0.9)',
                          borderRadius: '999px',
                          padding: '6px 10px',
                          fontWeight: 800,
                          color: '#0f172a',
                          fontFamily: 'inherit',
                          fontSize: '12px',
                          boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
                          maxWidth: '240px',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                        title={senaladoLabel}
                      >
                        <span style={{ color: '#0284c7' }}>📌</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{senaladoLabel || 'Señalado'}</span>
                      </div>
                    </foreignObject>
                  </g>
                )}
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setLocations(prev => prev.slice(0, -1))}
              disabled={locations.length === 0}
              style={{
                border: '1px solid #fecaca',
                background: locations.length === 0 ? '#f1f5f9' : '#fff1f2',
                color: locations.length === 0 ? '#94a3b8' : '#be123c',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: locations.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Quitar último
            </button>
            <span style={{ color: '#475569', fontWeight: 800, fontSize: '0.85em' }}>
              Puntos: {locations.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                borderRadius: '8px',
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(locations)}
              disabled={locations.length === 0}
              style={{
                border: 'none',
                background: locations.length === 0
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 800,
                cursor: locations.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: locations.length === 0 ? 0.75 : 1,
              }}
            >
              Guardar señalados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SenaladosMultiLocationPicker;
export type { MarkerLocation };
