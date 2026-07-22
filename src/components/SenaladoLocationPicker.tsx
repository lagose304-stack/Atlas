import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

interface SenaladoLocationPickerProps {
  imageSrc: string;
  senaladoLabel: string;
  initialLocation?: MarkerLocation | null;
  initialBatchLocations?: MarkerLocation[];
  required?: boolean;
  batchMode?: boolean;
  batchSaveLabel?: string;
  borderMode?: boolean;
  onCancel: () => void;
  onSave: (location: MarkerLocation | null) => void;
  onBatchSave?: (locations: MarkerLocation[]) => void;
  onRemove?: () => void;
}

type PointerEdge = 'left' | 'right' | 'top' | 'bottom';
type PointerStartPoint = { x: number; y: number; edge: PointerEdge };

const EMPTY_BATCH_LOCATIONS: MarkerLocation[] = [];
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.4;
const ZOOM_STEP = 0.1;

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;
const POINTER_BATCH_RADIUS_PX = 7.5;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPointerStartPx = (x: number, y: number, width: number, height: number): PointerStartPoint => {
  const distances = [
    { edge: 'left' as const, value: x },
    { edge: 'right' as const, value: width - x },
    { edge: 'top' as const, value: y },
    { edge: 'bottom' as const, value: height - y },
  ];

  const nearest = distances.reduce((previous, current) => (current.value < previous.value ? current : previous));

  switch (nearest.edge) {
    case 'left':
      return { x: 0, y, edge: 'left' };
    case 'right':
      return { x: width, y, edge: 'right' };
    case 'top':
      return { x, y: 0, edge: 'top' };
    default:
      return { x, y: height, edge: 'bottom' };
  }
};

const clampPointToNearestEdge = (x: number, y: number, width: number, height: number): PointerStartPoint => {
  return getPointerStartPx(clamp(x, 0, width), clamp(y, 0, height), width, height);
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
) => {
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
  ] as const;
};

const SenaladoLocationPicker: React.FC<SenaladoLocationPickerProps> = ({
  imageSrc,
  senaladoLabel,
  initialLocation = null,
  initialBatchLocations,
  required = false,
  batchMode = false,
  batchSaveLabel = 'Guardar todos',
  borderMode = false,
  onCancel,
  onSave,
  onBatchSave,
  onRemove,
}) => {
  const [location, setLocation] = useState<MarkerLocation | null>(initialLocation);
  const stableInitialBatchLocations = initialBatchLocations ?? EMPTY_BATCH_LOCATIONS;
  const [batchLocations, setBatchLocations] = useState<MarkerLocation[]>(stableInitialBatchLocations);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [draggingPointerStart, setDraggingPointerStart] = useState(false);
  const [draggingBatchPointerStartIndex, setDraggingBatchPointerStartIndex] = useState<number | null>(null);
  const [regionPoints, setRegionPoints] = useState<number[]>(initialLocation?.regionPoints ?? []);
  const [regionColor, setRegionColor] = useState(initialLocation?.regionColor ?? '#22c55e');
  const [regionOpacity, setRegionOpacity] = useState(initialLocation?.regionOpacity ?? 0.28);
  const [regionComplete, setRegionComplete] = useState((initialLocation?.regionPoints?.length ?? 0) >= 6);
  const [draggingRegionPointIndex, setDraggingRegionPointIndex] = useState<number | null>(null);
  const [selectedRegionPointIndex, setSelectedRegionPointIndex] = useState<number | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const lastDirectPointerAtRef = useRef(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerClipId = useId();

  useEffect(() => {
    const media = window.matchMedia?.('(pointer: coarse)');
    if (!media) return;
    const update = () => setIsCoarsePointer(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const zoomIn = () => setZoomLevel(prev => clamp(Number((prev + ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
  const zoomOut = () => setZoomLevel(prev => clamp(Number((prev - ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
  const resetZoom = () => setZoomLevel(1);

  const updateImageSize = () => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    setImageSize({ width: imageEl.clientWidth, height: imageEl.clientHeight });
  };

  useEffect(() => {
    if (batchMode) {
      setBatchLocations(stableInitialBatchLocations);
      setLocation(null);
    }
  }, [batchMode, imageSrc, senaladoLabel, stableInitialBatchLocations]);

  useEffect(() => {
    setZoomLevel(1);
  }, [imageSrc]);

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
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setZoomLevel(prev => clamp(Number((prev + direction * 0.08).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
    };

    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewportEl.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !required) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, required]);

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

  const updatePointerStartFromClient = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl || !imageSize) return;

    const rect = imageEl.getBoundingClientRect();
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

  const updateBatchPointerStartFromClient = (index: number, clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl || !imageSize) return;

    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const startPx = clampPointToNearestEdge(
      relX * imageSize.width,
      relY * imageSize.height,
      imageSize.width,
      imageSize.height
    );

    setBatchLocations(prev => prev.map((item, currentIndex) => {
      if (currentIndex !== index) return item;
      return {
        ...item,
        startX: startPx.x / imageSize.width,
        startY: startPx.y / imageSize.height,
      };
    }));
  };

  useEffect(() => {
    if (!draggingPointerStart) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updatePointerStartFromClient(event.clientX, event.clientY);
    };

    const handlePointerUp = () => setDraggingPointerStart(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingPointerStart, imageSize]);

  useEffect(() => {
    if (draggingBatchPointerStartIndex == null) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateBatchPointerStartFromClient(draggingBatchPointerStartIndex, event.clientX, event.clientY);
    };

    const handlePointerUp = () => setDraggingBatchPointerStartIndex(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingBatchPointerStartIndex, imageSize]);

  const applyRegionPoints = (next: number[]) => {
    setRegionPoints(next);
    if (next.length < 2) {
      setLocation(null);
      return;
    }
    const pointCount = next.length / 2;
    let sumX = 0;
    let sumY = 0;
    for (let index = 0; index < next.length; index += 2) {
      sumX += next[index];
      sumY += next[index + 1];
    }
    setLocation(previous => ({
      x: sumX / pointCount,
      y: sumY / pointCount,
      startX: previous?.startX ?? null,
      startY: previous?.startY ?? null,
    }));
  };

  const addRegionPoint = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const next = [
      ...regionPoints,
      clamp((clientX - rect.left) / rect.width, 0, 1),
      clamp((clientY - rect.top) / rect.height, 0, 1),
    ];
    applyRegionPoints(next);
  };

  const updateRegionPointFromClient = (pointIndex: number, clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const next = [...regionPoints];
    next[pointIndex * 2] = clamp((clientX - rect.left) / rect.width, 0, 1);
    next[pointIndex * 2 + 1] = clamp((clientY - rect.top) / rect.height, 0, 1);
    applyRegionPoints(next);
  };

  const insertRegionPointFromClient = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl || regionPoints.length < 6) return;
    const rect = imageEl.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    let closestSegment = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    const count = regionPoints.length / 2;
    for (let index = 0; index < count; index += 1) {
      const nextIndex = (index + 1) % count;
      const ax = regionPoints[index * 2];
      const ay = regionPoints[index * 2 + 1];
      const bx = regionPoints[nextIndex * 2];
      const by = regionPoints[nextIndex * 2 + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / lengthSquared, 0, 1);
      const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestSegment = index;
      }
    }
    const next = [...regionPoints];
    next.splice((closestSegment + 1) * 2, 0, x, y);
    applyRegionPoints(next);
    setSelectedRegionPointIndex(closestSegment + 1);
  };

  useEffect(() => {
    if (draggingRegionPointIndex == null) return;
    const move = (event: PointerEvent) => {
      event.preventDefault();
      updateRegionPointFromClient(draggingRegionPointIndex, event.clientX, event.clientY);
    };
    const stop = () => setDraggingRegionPointIndex(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [draggingRegionPointIndex, regionPoints]);

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (Date.now() - lastDirectPointerAtRef.current < 450) return;
    if (batchMode) {
      const imageEl = imageRef.current;
      if (!imageEl) return;

      const rect = imageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      setBatchLocations(prev => [...prev, { x, y, startX: null, startY: null }]);
      return;
    }

    if (borderMode && !regionComplete) {
      addRegionPoint(event.clientX, event.clientY);
      return;
    }
    updatePointerTipFromClient(event.clientX, event.clientY);
  };

  const handleImagePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    lastDirectPointerAtRef.current = Date.now();
    if (batchMode) {
      const imageEl = imageRef.current;
      if (!imageEl) return;
      const rect = imageEl.getBoundingClientRect();
      setBatchLocations(previous => [...previous, {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        startX: null,
        startY: null,
      }]);
      return;
    }
    if (borderMode && !regionComplete) {
      addRegionPoint(event.clientX, event.clientY);
      return;
    }
    if (!borderMode) updatePointerTipFromClient(event.clientX, event.clientY);
  };

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

    if (borderMode) {
      if (!regionComplete) addRegionPoint(event.clientX, event.clientY);
      return;
    }

    if (batchMode) {
      const imageEl = imageRef.current;
      if (!imageEl) return;

      const rect = imageEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      setBatchLocations(prev => [...prev, { x, y, startX: null, startY: null }]);
      return;
    }

    updatePointerTipFromClient(event.clientX, event.clientY);
  };

  const contentSize = useMemo(() => {
    if (!imageSize) return null;
    return {
      width: imageSize.width,
      height: imageSize.height,
    };
  }, [imageSize]);

  const resolvePointerGeometry = (locationItem: MarkerLocation) => {
    if (!contentSize) return null;

    const endPx = {
      x: locationItem.x * contentSize.width,
      y: locationItem.y * contentSize.height,
    };
    const manualStart =
      locationItem.startX != null && locationItem.startY != null
        ? clampPointToNearestEdge(
            (locationItem.startX ?? 0) * contentSize.width,
            (locationItem.startY ?? 0) * contentSize.height,
            contentSize.width,
            contentSize.height
          )
        : null;
    const autoStart = getPointerStartPx(endPx.x, endPx.y, contentSize.width, contentSize.height);
    const startPx = manualStart ?? enforceMinimumInclination(autoStart, endPx, contentSize.width, contentSize.height, POINTER_MIN_ANGLE_DEG);
    const directionLen = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
    const drawStartPx = {
      x: startPx.x - ((endPx.x - startPx.x) / directionLen) * POINTER_BASE_OUTSET_PX,
      y: startPx.y - ((endPx.y - startPx.y) / directionLen) * POINTER_BASE_OUTSET_PX,
    };
    const tipInsetPoint = {
      x: endPx.x - ((endPx.x - startPx.x) / directionLen) * POINTER_OUTLINE_TIP_BACKOFF_PX,
      y: endPx.y - ((endPx.y - startPx.y) / directionLen) * POINTER_OUTLINE_TIP_BACKOFF_PX,
    };

    return {
      startPx,
      endPx,
      outline: getPointerPolygon(drawStartPx, tipInsetPoint, POINTER_OUTLINE_WIDTH_PX, POINTER_TAPER_PX),
      core: getPointerPolygon(drawStartPx, endPx, POINTER_CORE_WIDTH_PX, POINTER_TAPER_PX),
    };
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1700,
        background: 'rgba(15, 23, 42, 0.72)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
      }}
      onClick={required ? undefined : onCancel}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#fff',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ margin: 0, color: '#0f172a', fontWeight: 800, fontSize: '0.98em' }}>{borderMode ? 'Dibujar señalado con borde' : 'Ubicar señalado'}</p>
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.86em' }}>
              {borderMode ? 'Marca al menos 3 puntos alrededor de la zona' : 'Haz clic sobre la imagen para ubicar'}: <strong>{senaladoLabel || 'Señalado'}</strong>
            </p>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8em' }}>
              {borderMode
                ? (!regionComplete
                    ? 'Cuando termines el contorno, pulsa “Finalizar borde”.'
                    : 'Arrastra los puntos blancos para corregir el contorno o pulsa una línea para añadir otro punto.')
                : 'Arrastra el punto azul del borde para cambiar la dirección del puntero.'}
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
            flex: 1,
            minHeight: 0,
            background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            padding: '14px',
            overflow: 'auto',
          }}
        >
          <div ref={viewportRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', width: '100%' }}>
            <div style={{ position: 'relative', display: 'inline-block', transform: `scale(${zoomLevel})`, transformOrigin: 'center center', maxWidth: '100%' }}>
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Seleccionar ubicación"
                onClick={handleImageClick}
                onPointerDown={handleImagePointerDown}
                onLoad={updateImageSize}
                style={{
                  display: 'block',
                  maxWidth: 'min(1100px, 100%)',
                  maxHeight: 'calc(100vh - 220px)',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  borderRadius: '10px',
                  cursor: 'crosshair',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
                  touchAction: 'none',
                }}
              />

              {!batchMode && location && contentSize && (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'auto',
                    overflow: 'visible',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                  onPointerDown={handleOverlayPointerDown}
                  width={contentSize.width}
                  height={contentSize.height}
                  viewBox={`0 0 ${contentSize.width} ${contentSize.height}`}
                >
                  {(() => {
                    const endPx = {
                      x: location.x * contentSize.width,
                      y: location.y * contentSize.height,
                    };
                    const manualStart =
                      location.startX != null && location.startY != null
                        ? clampPointToNearestEdge(
                            (location.startX ?? 0) * contentSize.width,
                            (location.startY ?? 0) * contentSize.height,
                            contentSize.width,
                            contentSize.height
                          )
                        : null;
                    const autoStart = getPointerStartPx(endPx.x, endPx.y, contentSize.width, contentSize.height);
                    const startPx = manualStart ?? enforceMinimumInclination(autoStart, endPx, contentSize.width, contentSize.height, POINTER_MIN_ANGLE_DEG);
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
                            <rect x="0" y="0" width={contentSize.width} height={contentSize.height} />
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#${pointerClipId})`}>
                          {borderMode && regionPoints.length >= 4 && (
                            <polygon
                              points={Array.from({ length: regionPoints.length / 2 }, (_, index) => `${regionPoints[index * 2] * contentSize.width},${regionPoints[index * 2 + 1] * contentSize.height}`).join(' ')}
                              fill={regionColor}
                              fillOpacity={regionOpacity}
                              stroke={regionColor}
                              strokeWidth={3}
                              strokeDasharray="10 7"
                              strokeLinejoin="round"
                              pointerEvents="none"
                            />
                          )}
                          {!borderMode && (
                            <>
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
                            </>
                          )}
                        </g>
                        {!borderMode && (
                          <circle
                            cx={startPx.x}
                            cy={startPx.y}
                            r={isCoarsePointer ? 12 : 8}
                            fill={draggingPointerStart ? '#2563eb' : '#0ea5e9'}
                            stroke="#ffffff"
                            strokeWidth={2}
                            onPointerDown={handlePointerStartDown}
                            style={{ cursor: draggingPointerStart ? 'grabbing' : 'grab' }}
                          />
                        )}
                        {borderMode && regionComplete && (
                          <polygon
                            points={Array.from({ length: regionPoints.length / 2 }, (_, index) => `${regionPoints[index * 2] * contentSize.width},${regionPoints[index * 2 + 1] * contentSize.height}`).join(' ')}
                            fill="none"
                            stroke="rgba(0,0,0,0.001)"
                            strokeWidth={18}
                            strokeLinejoin="round"
                            pointerEvents="stroke"
                            onPointerDown={event => event.stopPropagation()}
                            onClick={event => {
                              event.stopPropagation();
                              insertRegionPointFromClient(event.clientX, event.clientY);
                            }}
                            style={{ cursor: 'copy' }}
                          />
                        )}
                        {borderMode && regionPoints.map((_, flatIndex) => {
                          if (flatIndex % 2 !== 0) return null;
                          const pointIndex = flatIndex / 2;
                          return (
                            <circle
                              key={`region-point-${pointIndex}`}
                              cx={regionPoints[flatIndex] * contentSize.width}
                              cy={regionPoints[flatIndex + 1] * contentSize.height}
                              r={selectedRegionPointIndex === pointIndex ? (isCoarsePointer ? 12 : 7) : (isCoarsePointer ? 9 : 5.5)}
                              fill={selectedRegionPointIndex === pointIndex ? '#f59e0b' : '#ffffff'}
                              stroke={regionColor}
                              strokeWidth={2.5}
                              onPointerDown={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSelectedRegionPointIndex(pointIndex);
                                setDraggingRegionPointIndex(pointIndex);
                              }}
                              style={{ cursor: draggingRegionPointIndex === pointIndex ? 'grabbing' : 'grab' }}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}

              {batchMode && contentSize && batchLocations.length > 0 && (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'auto',
                    overflow: 'visible',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                  onPointerDown={handleOverlayPointerDown}
                  width={contentSize.width}
                  height={contentSize.height}
                  viewBox={`0 0 ${contentSize.width} ${contentSize.height}`}
                >
                  {batchLocations.map((item, index) => {
                    const geometry = resolvePointerGeometry(item);
                    if (!geometry) return null;

                    return (
                      <g key={`${index}-${item.x}-${item.y}`}>
                        <defs>
                          <clipPath id={`${pointerClipId}-batch-${index}`}>
                            <rect x="0" y="0" width={contentSize.width} height={contentSize.height} />
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#${pointerClipId}-batch-${index})`}>
                          <polygon
                            points={geometry.outline.map(point => `${point.x},${point.y}`).join(' ')}
                            fill="rgba(255,255,255,0.6)"
                            pointerEvents="none"
                            shapeRendering="geometricPrecision"
                          />
                          <polygon
                            points={geometry.core.map(point => `${point.x},${point.y}`).join(' ')}
                            fill={index === batchLocations.length - 1 ? '#111827' : '#0f172a'}
                            pointerEvents="none"
                            shapeRendering="geometricPrecision"
                          />
                        </g>
                        <circle
                          cx={geometry.startPx.x}
                          cy={geometry.startPx.y}
                          r={isCoarsePointer ? 12 : POINTER_BATCH_RADIUS_PX}
                          fill={draggingBatchPointerStartIndex === index ? '#2563eb' : '#0ea5e9'}
                          stroke="#ffffff"
                          strokeWidth={2}
                          style={{ cursor: draggingBatchPointerStartIndex === index ? 'grabbing' : 'grab' }}
                          onPointerDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDraggingBatchPointerStartIndex(index);
                            updateBatchPointerStartFromClient(index, event.clientX, event.clientY);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
            {borderMode && (
              <>
                <input type="color" value={regionColor} onChange={event => setRegionColor(event.target.value)} title="Color del borde" aria-label="Color del borde" style={{ width: 42, height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: 3 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: '0.8em', fontWeight: 700 }}>
                  Transparencia
                  <input type="range" min="0.1" max="0.7" step="0.05" value={regionOpacity} onChange={event => setRegionOpacity(Number(event.target.value))} />
                </label>
                {!regionComplete ? (
                  <>
                    <button type="button" disabled={regionPoints.length === 0} onClick={() => applyRegionPoints(regionPoints.slice(0, -2))} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', fontWeight: 700, background: '#fff', color: '#475569', cursor: regionPoints.length === 0 ? 'not-allowed' : 'pointer' }}>Deshacer punto</button>
                    <button type="button" disabled={regionPoints.length < 6} onClick={() => setRegionComplete(true)} style={{ border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 800, background: regionPoints.length < 6 ? '#cbd5e1' : '#16a34a', color: '#fff', cursor: regionPoints.length < 6 ? 'not-allowed' : 'pointer' }}>Finalizar borde</button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={selectedRegionPointIndex == null || regionPoints.length <= 6}
                      onClick={() => {
                        if (selectedRegionPointIndex == null || regionPoints.length <= 6) return;
                        const next = [...regionPoints];
                        next.splice(selectedRegionPointIndex * 2, 2);
                        applyRegionPoints(next);
                        setSelectedRegionPointIndex(null);
                      }}
                      style={{ border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', fontWeight: 700, background: '#fff7ed', color: '#c2410c', cursor: selectedRegionPointIndex == null || regionPoints.length <= 6 ? 'not-allowed' : 'pointer' }}
                    >Eliminar punto</button>
                    <button type="button" onClick={() => { setRegionPoints([]); setLocation(null); setSelectedRegionPointIndex(null); setRegionComplete(false); }} style={{ border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontWeight: 700, background: '#fff1f2', color: '#be123c', cursor: 'pointer' }}>Redibujar</button>
                  </>
                )}
              </>
            )}
            {batchMode ? (
              <button
                type="button"
                onClick={() => setBatchLocations(prev => prev.slice(0, -1))}
                disabled={batchLocations.length === 0}
                style={{
                  border: '1px solid #fecaca',
                  background: batchLocations.length === 0 ? '#f8fafc' : '#fff1f2',
                  color: batchLocations.length === 0 ? '#94a3b8' : '#be123c',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: batchLocations.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Quitar último ({batchLocations.length})
              </button>
            ) : onRemove ? (
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
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(191,219,254,0.75)', borderRadius: '999px', padding: '10px 14px', boxShadow: '0 4px 16px rgba(14,165,233,0.14)' }}>
              <button onClick={zoomOut} type="button" style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }} title="Alejar">−</button>
              <span style={{ color: '#0f172a', fontWeight: 800, minWidth: '55px', textAlign: 'center', fontSize: '0.95em' }}>{Math.round(zoomLevel * 100)}%</span>
              <button onClick={zoomIn} type="button" style={{ background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2em', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }} title="Acercar">+</button>
              <button onClick={resetZoom} type="button" style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', borderRadius: '999px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82em' }} title="Restablecer zoom">1:1</button>
            </div>
          </div>

          <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end', gap: '8px', minWidth: 0 }}>
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
              disabled={borderMode && regionPoints.length < 6}
              onClick={() => {
                if (batchMode) {
                  onBatchSave?.(batchLocations);
                  return;
                }

                if (borderMode && regionPoints.length < 6) return;
                if (borderMode) {
                  const pointCount = regionPoints.length / 2;
                  let sumX = 0;
                  let sumY = 0;
                  for (let index = 0; index < regionPoints.length; index += 2) {
                    sumX += regionPoints[index];
                    sumY += regionPoints[index + 1];
                  }
                  onSave({
                    x: sumX / pointCount,
                    y: sumY / pointCount,
                    startX: null,
                    startY: null,
                    regionPoints: [...regionPoints],
                    regionColor,
                    regionOpacity,
                  });
                  return;
                }
                onSave(location);
              }}
              style={{
                border: 'none',
                background: borderMode && regionPoints.length < 6
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 800,
                cursor: borderMode && regionPoints.length < 6 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {batchMode ? batchSaveLabel : borderMode ? 'Guardar borde' : 'Guardar ubicación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SenaladoLocationPicker;
