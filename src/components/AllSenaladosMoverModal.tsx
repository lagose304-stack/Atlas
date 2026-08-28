import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Minus, RotateCcw, Check, X } from 'lucide-react';
import { getImageCandidateUrls } from '../services/cloudinaryImages';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';

export interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

const getPolygonPathD = (
  outerPoints: number[],
  holes: number[][] | null | undefined,
  width: number,
  height: number
): string => {
  if (outerPoints.length < 6) return '';
  let d = '';

  for (let i = 0; i < outerPoints.length; i += 2) {
    const x = outerPoints[i] * width;
    const y = outerPoints[i + 1] * height;
    d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  d += ' Z';

  if (holes && holes.length > 0) {
    for (const hole of holes) {
      if (hole.length >= 6) {
        for (let i = 0; i < hole.length; i += 2) {
          const x = hole[i] * width;
          const y = hole[i + 1] * height;
          d += (i === 0 ? ` M ${x} ${y}` : ` L ${x} ${y}`);
        }
        d += ' Z';
      }
    }
  }

  return d;
};

interface AllSenaladosMoverModalProps {
  isOpen: boolean;
  imageSrc: string;
  imageAlt?: string;
  senalados: string[];
  senaladosPos: Array<MarkerLocation | null>;
  onClose: () => void;
  onSave: (updatedPos: Array<MarkerLocation | null>) => void;
}

type PointerEdge = 'left' | 'right' | 'top' | 'bottom';
type PointerStartPoint = { x: number; y: number; edge: PointerEdge };

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;

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

export const AllSenaladosMoverModal: React.FC<AllSenaladosMoverModalProps> = ({
  isOpen,
  imageSrc,
  imageAlt,
  senalados,
  senaladosPos,
  onClose,
  onSave,
}) => {
  const [currentPositions, setCurrentPositions] = useState<Array<MarkerLocation | null>>([]);
  const [stepPx, setStepPx] = useState<1 | 5 | 20>(5);
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imgUrlIndex, setImgUrlIndex] = useState(0);

  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragSnapshotRef = useRef<Array<MarkerLocation | null> | null>(null);
  const pointerClipId = useId();

  const candidateUrls = useMemo(() => {
    return getImageCandidateUrls(imageSrc, 'zoom');
  }, [imageSrc]);

  useEffect(() => {
    setImgUrlIndex(0);
  }, [imageSrc]);

  useEffect(() => {
    if (isOpen) {
      setCurrentPositions(
        senaladosPos.map(pos => (pos ? {
          ...pos,
          regionPoints: pos.regionPoints ? [...pos.regionPoints] : null,
          regionHoles: pos.regionHoles ? pos.regionHoles.map(h => [...h]) : null,
        } : null))
      );
      acquireAtlasScrollLock();
    }
    return () => {
      releaseAtlasScrollLock();
    };
  }, [isOpen, senaladosPos]);

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
  }, [isOpen, imgUrlIndex]);

  if (!isOpen) return null;

  const currentImgSrc = candidateUrls[imgUrlIndex] || imageSrc;

  const handleImageError = () => {
    if (imgUrlIndex < candidateUrls.length - 1) {
      setImgUrlIndex(prev => prev + 1);
    }
  };

  const nudgeAll = (deltaNormalizedX: number, deltaNormalizedY: number) => {
    setCurrentPositions(prev =>
      prev.map(pos => {
        if (!pos) return null;

        const nextX = clamp(pos.x + deltaNormalizedX, 0, 1);
        const nextY = clamp(pos.y + deltaNormalizedY, 0, 1);
        const nextStartX = pos.startX != null ? clamp(pos.startX + deltaNormalizedX, 0, 1) : null;
        const nextStartY = pos.startY != null ? clamp(pos.startY + deltaNormalizedY, 0, 1) : null;
        const nextRegionPoints = pos.regionPoints
          ? pos.regionPoints.map((val, idx) =>
              idx % 2 === 0 ? clamp(val + deltaNormalizedX, 0, 1) : clamp(val + deltaNormalizedY, 0, 1)
            )
          : null;
        const nextRegionHoles = pos.regionHoles
          ? pos.regionHoles.map(hole =>
              hole.map((val, idx) =>
                idx % 2 === 0 ? clamp(val + deltaNormalizedX, 0, 1) : clamp(val + deltaNormalizedY, 0, 1)
              )
            )
          : null;

        return {
          ...pos,
          x: nextX,
          y: nextY,
          startX: nextStartX,
          startY: nextStartY,
          regionPoints: nextRegionPoints,
          regionHoles: nextRegionHoles,
        };
      })
    );
  };

  const nudgeByPx = (dxPx: number, dyPx: number) => {
    const width = imageSize?.width || 800;
    const height = imageSize?.height || 600;
    nudgeAll(dxPx / width, dyPx / height);
  };

  const scaleAll = (factor: number) => {
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    let count = 0;

    currentPositions.forEach(pos => {
      if (!pos) return;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
      count += 1;

      if (pos.regionPoints) {
        for (let i = 0; i < pos.regionPoints.length; i += 2) {
          minX = Math.min(minX, pos.regionPoints[i]);
          maxX = Math.max(maxX, pos.regionPoints[i]);
          minY = Math.min(minY, pos.regionPoints[i + 1]);
          maxY = Math.max(maxY, pos.regionPoints[i + 1]);
        }
      }
    });

    if (count === 0) return;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setCurrentPositions(prev =>
      prev.map(pos => {
        if (!pos) return null;

        const nextX = clamp(centerX + (pos.x - centerX) * factor, 0, 1);
        const nextY = clamp(centerY + (pos.y - centerY) * factor, 0, 1);
        const nextStartX =
          pos.startX != null ? clamp(centerX + (pos.startX - centerX) * factor, 0, 1) : null;
        const nextStartY =
          pos.startY != null ? clamp(centerY + (pos.startY - centerY) * factor, 0, 1) : null;
        const nextRegionPoints = pos.regionPoints
          ? pos.regionPoints.map((val, idx) =>
              idx % 2 === 0
                ? clamp(centerX + (val - centerX) * factor, 0, 1)
                : clamp(centerY + (val - centerY) * factor, 0, 1)
            )
          : null;
        const nextRegionHoles = pos.regionHoles
          ? pos.regionHoles.map(hole =>
              hole.map((val, idx) =>
                idx % 2 === 0
                  ? clamp(centerX + (val - centerX) * factor, 0, 1)
                  : clamp(centerY + (val - centerY) * factor, 0, 1)
              )
            )
          : null;

        return {
          ...pos,
          x: nextX,
          y: nextY,
          startX: nextStartX,
          startY: nextStartY,
          regionPoints: nextRegionPoints,
          regionHoles: nextRegionHoles,
        };
      })
    );
  };

  const resetToInitial = () => {
    setCurrentPositions(
      senaladosPos.map(pos => (pos ? {
        ...pos,
        regionPoints: pos.regionPoints ? [...pos.regionPoints] : null,
        regionHoles: pos.regionHoles ? pos.regionHoles.map(h => [...h]) : null,
      } : null))
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) return;
    e.preventDefault();
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    dragSnapshotRef.current = currentPositions.map(pos =>
      pos ? {
        ...pos,
        regionPoints: pos.regionPoints ? [...pos.regionPoints] : null,
        regionHoles: pos.regionHoles ? pos.regionHoles.map(h => [...h]) : null,
      } : null
    );
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !dragSnapshotRef.current || !imageSize) return;
    e.preventDefault();

    const deltaX = (e.clientX - dragStartRef.current.clientX) / imageSize.width;
    const deltaY = (e.clientY - dragStartRef.current.clientY) / imageSize.height;

    const baseSnapshot = dragSnapshotRef.current;
    setCurrentPositions(
      baseSnapshot.map(pos => {
        if (!pos) return null;

        const nextX = clamp(pos.x + deltaX, 0, 1);
        const nextY = clamp(pos.y + deltaY, 0, 1);
        const nextStartX = pos.startX != null ? clamp(pos.startX + deltaX, 0, 1) : null;
        const nextStartY = pos.startY != null ? clamp(pos.startY + deltaY, 0, 1) : null;
        const nextRegionPoints = pos.regionPoints
          ? pos.regionPoints.map((val, idx) =>
              idx % 2 === 0 ? clamp(val + deltaX, 0, 1) : clamp(val + deltaY, 0, 1)
            )
          : null;
        const nextRegionHoles = pos.regionHoles
          ? pos.regionHoles.map(hole =>
              hole.map((val, idx) =>
                idx % 2 === 0 ? clamp(val + deltaX, 0, 1) : clamp(val + deltaY, 0, 1)
              )
            )
          : null;

        return {
          ...pos,
          x: nextX,
          y: nextY,
          startX: nextStartX,
          startY: nextStartY,
          regionPoints: nextRegionPoints,
          regionHoles: nextRegionHoles,
        };
      })
    );
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      dragSnapshotRef.current = null;
    }
  };

  const activeCount = currentPositions.filter(p => p !== null).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'stretch',
      }}
      onPointerUp={handlePointerUp}
    >
      {/* Barra superior */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: '#0f172a',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          color: '#ffffff',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
            }}
          >
            <Move size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05em', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Mover todos los señalados
            </h2>
            <p style={{ margin: 0, fontSize: '0.78em', color: '#94a3b8' }}>
              {activeCount} {activeCount === 1 ? 'señalado activo' : 'señalados activos'} · Arrastra la imagen o usa los controles
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={resetToInitial}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82em',
              fontFamily: 'inherit',
            }}
            title="Restablecer a posiciones iniciales"
          >
            <RotateCcw size={14} /> Restablecer
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82em',
              fontFamily: 'inherit',
            }}
          >
            <X size={15} /> Cancelar
          </button>

          <button
            type="button"
            onClick={() => onSave(currentPositions)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid #86efac',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.86em',
              fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
            }}
          >
            <Check size={16} /> Guardar alineación
          </button>
        </div>
      </header>

      {/* Área central con lienzo y controles flotantes */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: '#090d16',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Contenedor de la imagen + SVG */}
        <div
          style={{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <img
            ref={imageRef}
            src={currentImgSrc}
            alt={imageAlt ?? 'Placa histológica'}
            onError={handleImageError}
            style={{
              maxWidth: 'calc(100vw - 220px)',
              maxHeight: 'calc(100vh - 130px)',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
            }}
          />

          {imageSize && imageSize.width > 0 && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: imageSize.width,
                height: imageSize.height,
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            >
              <defs>
                <clipPath id={pointerClipId}>
                  <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                </clipPath>
              </defs>

              {/* Render de polígonos de bordes de todos los señalados */}
              <g clipPath={`url(#${pointerClipId})`}>
                {currentPositions.map((pos, index) => {
                  if (!pos || !pos.regionPoints || pos.regionPoints.length < 4) return null;
                  const pathD = getPolygonPathD(pos.regionPoints, pos.regionHoles, imageSize.width, imageSize.height);

                  return (
                    <path
                      key={`region-${index}`}
                      d={pathD}
                      fill={pos.regionColor || '#22c55e'}
                      fillOpacity={pos.regionOpacity || 0.28}
                      fillRule="evenodd"
                      stroke={pos.regionColor || '#22c55e'}
                      strokeWidth={2.5}
                      strokeDasharray="8 6"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </g>

              {/* Render de punteros (flechas) y etiquetas de todos los señalados */}
              {currentPositions.map((pos, index) => {
                if (!pos) return null;
                const label = senalados[index] || `Señalado ${index + 1}`;

                // Si es solo región sin puntero específico
                if (pos.regionPoints && pos.regionPoints.length >= 6) {
                  return null;
                }

                const endPx = {
                  x: pos.x * imageSize.width,
                  y: pos.y * imageSize.height,
                };
                const manualStart =
                  pos.startX != null && pos.startY != null
                    ? clampPointToNearestEdge(
                        pos.startX * imageSize.width,
                        pos.startY * imageSize.height,
                        imageSize.width,
                        imageSize.height
                      )
                    : null;
                const autoStart = getPointerStartPx(endPx.x, endPx.y, imageSize.width, imageSize.height);
                const startPx =
                  manualStart ??
                  enforceMinimumInclination(
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
                  <g key={`pointer-${index}`}>
                    <polygon
                      points={`${outline[0].x},${outline[0].y} ${outline[1].x},${outline[1].y} ${outline[2].x},${outline[2].y} ${outline[3].x},${outline[3].y} ${outline[4].x},${outline[4].y}`}
                      fill="rgba(255,255,255,0.75)"
                      shapeRendering="geometricPrecision"
                    />
                    <polygon
                      points={`${core[0].x},${core[0].y} ${core[1].x},${core[1].y} ${core[2].x},${core[2].y} ${core[3].x},${core[3].y} ${core[4].x},${core[4].y}`}
                      fill="#0f172a"
                      shapeRendering="geometricPrecision"
                    />

                    {/* Insignia con número y nombre del señalado */}
                    <g transform={`translate(${endPx.x}, ${endPx.y - 14})`}>
                      <rect
                        x={-12}
                        y={-14}
                        width={Math.max(24, label.length * 6.5 + 16)}
                        height={20}
                        rx={10}
                        fill="#0f172a"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.5))"
                      />
                      <text
                        x={-4}
                        y={0}
                        fill="#ffffff"
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="start"
                        fontFamily="system-ui, sans-serif"
                      >
                        {index + 1}. {label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Panel lateral derecho flotante con controles de ajuste fino */}
        <aside
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '14px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
            width: '180px',
            boxSizing: 'border-box',
            color: '#ffffff',
            zIndex: 20,
          }}
        >
          <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.82em', fontWeight: 800, color: '#38bdf8' }}>Pad de precisión</span>
          </div>

          {/* Selector de paso */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#94a3b8' }}>Paso:</span>
            {([1, 5, 20] as const).map(stepVal => (
              <button
                key={stepVal}
                type="button"
                style={{
                  padding: '3px 7px',
                  borderRadius: '6px',
                  border: stepPx === stepVal ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                  background: stepPx === stepVal ? '#0284c7' : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  fontSize: '0.72em',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onClick={() => setStepPx(stepVal)}
              >
                {stepVal}px
              </button>
            ))}
          </div>

          {/* Pad de flechas */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px',
              alignItems: 'center',
              justifyItems: 'center',
              margin: '4px 0',
            }}
          >
            <div />
            <button
              type="button"
              style={arrowBtnStyle}
              onClick={() => nudgeByPx(0, -stepPx)}
              title="Mover todos arriba"
            >
              <ArrowUp size={16} />
            </button>
            <div />

            <button
              type="button"
              style={arrowBtnStyle}
              onClick={() => nudgeByPx(-stepPx, 0)}
              title="Mover todos a la izquierda"
            >
              <ArrowLeft size={16} />
            </button>
            <div
              style={{
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                color: '#38bdf8',
              }}
            >
              <Move size={14} />
            </div>
            <button
              type="button"
              style={arrowBtnStyle}
              onClick={() => nudgeByPx(stepPx, 0)}
              title="Mover todos a la derecha"
            >
              <ArrowRight size={16} />
            </button>

            <div />
            <button
              type="button"
              style={arrowBtnStyle}
              onClick={() => nudgeByPx(0, stepPx)}
              title="Mover todos abajo"
            >
              <ArrowDown size={16} />
            </button>
            <div />
          </div>

          {/* Escala */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#94a3b8' }}>Escala global:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                style={scaleBtnStyle}
                onClick={() => scaleAll(0.98)}
                title="Reducir escala de todos (-2%)"
              >
                <Minus size={13} style={{ marginRight: '2px' }} /> 2%
              </button>
              <button
                type="button"
                style={scaleBtnStyle}
                onClick={() => scaleAll(1.02)}
                title="Aumentar escala de todos (+2%)"
              >
                <Plus size={13} style={{ marginRight: '2px' }} /> 2%
              </button>
            </div>
          </div>

          <p style={{ margin: '4px 0 0', fontSize: '0.66em', color: '#94a3b8', lineHeight: 1.3, textAlign: 'center' }}>
            Arrastra el lienzo o usa las flechas para desplazar todo a la vez.
          </p>
        </aside>
      </div>
    </div>
  );
};

const arrowBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.12)',
  color: '#ffffff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  transition: 'background 0.15s ease, transform 0.1s ease',
};

const scaleBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 8px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#ffffff',
  fontSize: '0.72em',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default AllSenaladosMoverModal;
