import React, { useEffect, useRef, useState, useId, useMemo, useCallback } from 'react';
import { Eye, EyeOff, MessageSquare, Microscope, Plus, Minus, RotateCcw, RotateCw } from 'lucide-react';
import type { ComparadorPlacaItem } from './PlatePickerModal';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { renderBoldText } from '../BoldField';

interface DualPlateViewportProps {
  letter: 'A' | 'B';
  plate: ComparadorPlacaItem | null;
  onOpenPicker: () => void;
  zoom: number;
  pan: { x: number; y: number };
  onPanZoomChange: (zoom: number, pan: { x: number; y: number }) => void;
  showSignalings: boolean;
  onToggleSignalings: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const MIN_DYNAMIC_MAX_ZOOM = 1.2;
const ZOOM_OVERSHOOT_FACTOR = 1.1;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const computeDynamicMaxZoom = (
  displayedSize: { width: number; height: number } | null,
  naturalSize: { width: number; height: number } | null
) => {
  if (!displayedSize || !naturalSize || displayedSize.width <= 0 || displayedSize.height <= 0) {
    return ZOOM_MAX;
  }

  const ratioX = naturalSize.width / displayedSize.width;
  const ratioY = naturalSize.height / displayedSize.height;
  const nativeDetailRatio = Math.min(ratioX, ratioY);
  const recommendedMax = nativeDetailRatio * ZOOM_OVERSHOOT_FACTOR;
  return clamp(recommendedMax, MIN_DYNAMIC_MAX_ZOOM, ZOOM_MAX);
};

const clampPositionToViewport = (
  nextPos: { x: number; y: number },
  currentZoom: number,
  displayedSize: { width: number; height: number } | null,
  containerSize: { width: number; height: number }
) => {
  if (!displayedSize || currentZoom <= 1) {
    return { x: 0, y: 0 };
  }

  const scaledWidth = displayedSize.width * currentZoom;
  const scaledHeight = displayedSize.height * currentZoom;
  const maxOffsetX = Math.max(0, (scaledWidth - containerSize.width) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - containerSize.height) / 2);

  return {
    x: clamp(nextPos.x, -maxOffsetX, maxOffsetX),
    y: clamp(nextPos.y, -maxOffsetY, maxOffsetY),
  };
};

const rectanglesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap = 0
) => {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
};

const segmentIntersectsRect = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  gap = 0
) => {
  const minX = rect.x - gap;
  const maxX = rect.x + rect.width + gap;
  const minY = rect.y - gap;
  const maxY = rect.y + rect.height + gap;

  if (p1.x < minX && p2.x < minX) return false;
  if (p1.x > maxX && p2.x > maxX) return false;
  if (p1.y < minY && p2.y < minY) return false;
  if (p1.y > maxY && p2.y > maxY) return false;

  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const sx = p1.x + t * (p2.x - p1.x);
    const sy = p1.y + t * (p2.y - p1.y);
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
      return true;
    }
  }
  return false;
};

interface ProcessedMarker {
  label: string;
  x: number;
  y: number;
  startX: number | null;
  startY: number | null;
}

interface MarkerLayoutItem {
  marker: ProcessedMarker;
  index: number;
  arrowPointsStr: string;
  tailX: number;
  tailY: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  fontSize: number;
  labelText: string;
}

export const DualPlateViewport: React.FC<DualPlateViewportProps> = ({
  letter,
  plate,
  onOpenPicker,
  zoom,
  pan,
  onPanZoomChange,
  showSignalings,
  onToggleSignalings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stateRef = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number } | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [useZoomSource, setUseZoomSource] = useState(false);
  const [zoomSourceFailed, setZoomSourceFailed] = useState(false);
  const pointerClipId = useId();

  // Sync state ref
  useEffect(() => {
    stateRef.current.zoom = zoom;
  }, [zoom]);

  useEffect(() => {
    stateRef.current.pos = pan;
  }, [pan]);

  const srcView = useMemo(
    () => (plate?.photo_url ? getCloudinaryImageUrl(plate.photo_url, 'view') : ''),
    [plate?.photo_url]
  );
  const srcZoom = useMemo(
    () => (plate?.photo_url ? getCloudinaryImageUrl(plate.photo_url, 'zoom') : ''),
    [plate?.photo_url]
  );

  // Update client rendered image dimensions and natural dimensions
  const updateImageSize = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    if (img.clientWidth > 0 && img.clientHeight > 0) {
      setImageSize({ width: img.clientWidth, height: img.clientHeight });
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    }
  }, []);

  // Calculate dynamic maximum zoom based on image resolution vs screen size
  const effectiveMaxZoom = useMemo(() => {
    return computeDynamicMaxZoom(imageSize, imageNaturalSize);
  }, [imageSize, imageNaturalSize]);

  // Preload ultra-high resolution 3200px zoom image in background
  useEffect(() => {
    setImageLoaded(false);
    setImageSize(null);
    setImageNaturalSize(null);
    setShowComment(false);
    setUseZoomSource(false);
    setZoomSourceFailed(false);

    if (!srcZoom) return;

    let isMounted = true;
    const preload = new Image();
    preload.onload = () => {
      if (isMounted) {
        setUseZoomSource(true);
      }
    };
    preload.onerror = () => {
      if (isMounted) {
        setZoomSourceFailed(true);
      }
    };
    preload.src = srcZoom;

    return () => {
      isMounted = false;
    };
  }, [srcZoom, plate?.id]);

  // Activate zoom source as soon as zoom level increases
  useEffect(() => {
    if (srcZoom && zoom > 1.01 && !zoomSourceFailed) {
      setUseZoomSource(true);
    }
  }, [zoom, srcZoom, zoomSourceFailed]);

  // Observe resize of the image
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    updateImageSize();
    const observer = new ResizeObserver(() => updateImageSize());
    observer.observe(img);

    window.addEventListener('resize', updateImageSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateImageSize);
    };
  }, [updateImageSize, srcView, srcZoom, useZoomSource]);

  // Perceptual enhancement calculations (Atlas Microscope Standard)
  const perceptualEnhanceLevel = useMemo(() => {
    if (zoom <= 1.35) return 0;
    const span = Math.max(0.001, effectiveMaxZoom - 1.35);
    return clamp((zoom - 1.35) / span, 0, 1);
  }, [zoom, effectiveMaxZoom]);

  const imageFilterStyle = useMemo(() => {
    if (perceptualEnhanceLevel <= 0) return 'none';
    const boosted = Math.pow(perceptualEnhanceLevel, 1.25);
    const contrast = 1 + boosted * 0.14;
    const saturate = 1 + boosted * 0.06;
    const brightness = 1 + boosted * 0.018;
    return `contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)}) drop-shadow(0 0 0.35px rgba(0,0,0,0.45))`;
  }, [perceptualEnhanceLevel]);

  const grainOpacity = useMemo(() => {
    if (perceptualEnhanceLevel <= 0) return 0;
    const boosted = Math.pow(perceptualEnhanceLevel, 1.2);
    return 0.018 + boosted * 0.034;
  }, [perceptualEnhanceLevel]);

  // Active high-definition image source
  const currentImageSrc = useZoomSource && srcZoom && !zoomSourceFailed ? srcZoom : srcView;

  // Apply zoom with dynamic max cap and viewport bounding
  const applyZoom = useCallback((targetZoom: number, targetPos?: { x: number; y: number }) => {
    const newZoom = clamp(targetZoom, ZOOM_MIN, effectiveMaxZoom);
    const containerEl = containerRef.current;
    const containerSize = containerEl
      ? { width: containerEl.clientWidth, height: containerEl.clientHeight }
      : { width: 800, height: 600 };

    if (newZoom <= 1) {
      onPanZoomChange(1, { x: 0, y: 0 });
    } else {
      const currentPos = targetPos || stateRef.current.pos;
      const clampedPos = clampPositionToViewport(currentPos, newZoom, imageSize, containerSize);
      onPanZoomChange(newZoom, clampedPos);
    }
  }, [effectiveMaxZoom, imageSize, onPanZoomChange]);

  const handleZoomIn = () => applyZoom(stateRef.current.zoom + 0.25);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - 0.25);
  const handleReset = () => {
    onPanZoomChange(1, { x: 0, y: 0 });
    setRotation(0);
  };

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90) % 360);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  useEffect(() => {
    setRotation(0);
  }, [plate?.id]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    applyZoom(stateRef.current.zoom + (e.deltaY < 0 ? 0.12 : -0.12));
  };

  // Mouse drag pan with boundary clamping
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || stateRef.current.zoom <= 1) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - stateRef.current.pos.x,
      y: e.clientY - stateRef.current.pos.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || stateRef.current.zoom <= 1) return;
    const containerEl = containerRef.current;
    const containerSize = containerEl
      ? { width: containerEl.clientWidth, height: containerEl.clientHeight }
      : { width: 800, height: 600 };

    const rawPos = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };

    const clampedPos = clampPositionToViewport(rawPos, stateRef.current.zoom, imageSize, containerSize);
    onPanZoomChange(stateRef.current.zoom, clampedPos);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch gestures (Pinch to zoom and Touch drag)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && stateRef.current.zoom > 1) {
      const touch = e.touches[0];
      if (!touch) return;
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: touch.clientX - stateRef.current.pos.x,
        y: touch.clientY - stateRef.current.pos.y,
      };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (!t1 || !t2) return;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchRef.current = { dist };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDraggingRef.current && stateRef.current.zoom > 1) {
      const touch = e.touches[0];
      if (!touch) return;
      const containerEl = containerRef.current;
      const containerSize = containerEl
        ? { width: containerEl.clientWidth, height: containerEl.clientHeight }
        : { width: 800, height: 600 };

      const rawPos = {
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      };
      const clampedPos = clampPositionToViewport(rawPos, stateRef.current.zoom, imageSize, containerSize);
      onPanZoomChange(stateRef.current.zoom, clampedPos);
    } else if (e.touches.length === 2 && pinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (!t1 || !t2) return;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scale = dist / pinchRef.current.dist;
      pinchRef.current.dist = dist;
      applyZoom(stateRef.current.zoom * scale);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchRef.current = null;
  };

  // Process & normalize signalings items (strictly point arrows, excluding region/zone polygons)
  const processedMarkers = useMemo<ProcessedMarker[]>(() => {
    if (!plate) return [];

    const metaItems = plate.senalados_meta || [];
    if (metaItems.length > 0) {
      return metaItems
        .map((item) => {
          const rawX = item.x != null ? Number(item.x) : null;
          const rawY = item.y != null ? Number(item.y) : null;
          const rawStartX = item.startX != null ? Number(item.startX) : null;
          const rawStartY = item.startY != null ? Number(item.startY) : null;

          // Normalizing coordinates: if stored as 0..100%, convert to 0..1
          const normX = rawX != null && Number.isFinite(rawX) ? (rawX > 1 ? rawX / 100 : rawX) : null;
          const normY = rawY != null && Number.isFinite(rawY) ? (rawY > 1 ? rawY / 100 : rawY) : null;
          const normStartX = rawStartX != null && Number.isFinite(rawStartX) ? (rawStartX > 1 ? rawStartX / 100 : rawStartX) : null;
          const normStartY = rawStartY != null && Number.isFinite(rawStartY) ? (rawStartY > 1 ? rawStartY / 100 : rawStartY) : null;

          return {
            label: (item.label || '').trim(),
            x: normX,
            y: normY,
            startX: normStartX,
            startY: normStartY,
          };
        })
        .filter((m): m is ProcessedMarker => m.label.length > 0 && m.x != null && m.y != null);
    }

    return [];
  }, [plate]);

  // Dynamic Collision-Free Marker Layout (Adapts to zoom level so labels/arrows remain constant screen size and never overlap)
  const markerLayouts = useMemo<MarkerLayoutItem[]>(() => {
    if (!imageSize || processedMarkers.length === 0) return [];

    const placedBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Screen-invariant dimensions (scaled inversely by zoom)
    const effectiveZoom = Math.max(0.5, zoom);
    const fontSize = 11.5 / effectiveZoom;
    const paddingH = 7.5 / effectiveZoom;
    const paddingV = 3.5 / effectiveZoom;
    const boxHeight = fontSize + paddingV * 2;
    const arrowLength = Math.max(14 / effectiveZoom, Math.min(24 / effectiveZoom, 28 / effectiveZoom));
    const gap = 6 / effectiveZoom;
    const margin = 6 / effectiveZoom;

    const results: MarkerLayoutItem[] = [];

    processedMarkers.forEach((marker, index) => {
      const endX = marker.x * imageSize.width;
      const endY = marker.y * imageSize.height;

      const defaultStartX = endX < imageSize.width * 0.5 ? 0.05 * imageSize.width : 0.95 * imageSize.width;
      const startX = marker.startX != null ? marker.startX * imageSize.width : defaultStartX;
      const startY = marker.startY != null ? marker.startY * imageSize.height : endY;

      // Vector from start towards target tip
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      const actualArrowLen = Math.min(arrowLength, len * 0.85);
      const tailX = endX - ux * actualArrowLen;
      const tailY = endY - uy * actualArrowLen;

      // Canonical Atlas Arrow Polygon Transformation
      const svgPoints = [
        { x: 140, y: 80 },
        { x: 30, y: 20 },
        { x: 55, y: 80 },
        { x: 30, y: 140 },
      ];
      const svgTip = { x: 140, y: 80 };
      const svgTail = { x: 30, y: 80 };

      const vSvg = { x: svgTip.x - svgTail.x, y: svgTip.y - svgTail.y };
      const vReal = { x: endX - tailX, y: endY - tailY };
      const lenSvg = Math.hypot(vSvg.x, vSvg.y) || 1;
      const lenReal = Math.hypot(vReal.x, vReal.y) || 1;
      const scale = lenReal / lenSvg;

      const angleSvg = Math.atan2(vSvg.y, vSvg.x);
      const angleReal = Math.atan2(vReal.y, vReal.x);
      const rotation = angleReal - angleSvg;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);

      const transformed = svgPoints.map((pt) => {
        const x0 = pt.x - svgTail.x;
        const y0 = pt.y - svgTail.y;
        const xr = x0 * cos - y0 * sin;
        const yr = x0 * sin + y0 * cos;
        return {
          x: tailX + xr * scale,
          y: tailY + yr * scale,
        };
      });
      const arrowPointsStr = transformed.map((p) => `${p.x},${p.y}`).join(' ');

      // Label Box Dimensions
      const labelText = marker.label;
      const charWidth = fontSize * 0.62;
      const boxWidth = Math.min(
        labelText.length * charWidth + paddingH * 2,
        Math.max(60 / effectiveZoom, imageSize.width - margin * 2)
      );

      // Vector calculations for non-overlapping placement
      const nx = -uy;
      const ny = ux;
      const halfDiag = Math.hypot(boxWidth / 2, boxHeight / 2) + gap;

      // Candidate Placements strictly around/behind the Arrow Tail
      const rawCandidates = [
        // 1. Strictly behind tail along arrow direction
        { x: tailX - ux * halfDiag - boxWidth / 2, y: tailY - uy * halfDiag - boxHeight / 2 },
        // 2. Farther behind tail along arrow direction
        { x: tailX - ux * (halfDiag + 14 / effectiveZoom) - boxWidth / 2, y: tailY - uy * (halfDiag + 14 / effectiveZoom) - boxHeight / 2 },
        // 3. Perpendicular Left of tail
        { x: tailX - ux * (boxWidth / 2 + gap) + nx * (boxHeight / 2 + gap + 4 / effectiveZoom) - boxWidth / 2, y: tailY - uy * (boxHeight / 2 + gap) + ny * (boxHeight / 2 + gap + 4 / effectiveZoom) - boxHeight / 2 },
        // 4. Perpendicular Right of tail
        { x: tailX - ux * (boxWidth / 2 + gap) - nx * (boxHeight / 2 + gap + 4 / effectiveZoom) - boxWidth / 2, y: tailY - uy * (boxHeight / 2 + gap) - ny * (boxHeight / 2 + gap + 4 / effectiveZoom) - boxHeight / 2 },
        // 5. Above tail with safe clearance
        { x: tailX - boxWidth / 2, y: tailY - (uy > 0 ? boxHeight + gap + 8 / effectiveZoom : boxHeight + gap) },
        // 6. Below tail with safe clearance
        { x: tailX - boxWidth / 2, y: tailY + (uy < 0 ? gap + 8 / effectiveZoom : gap) },
        // 7. Left of tail with safe clearance
        { x: tailX - (ux > 0 ? boxWidth + gap + 8 / effectiveZoom : boxWidth + gap), y: tailY - boxHeight / 2 },
        // 8. Right of tail with safe clearance
        { x: tailX + (ux < 0 ? gap + 8 / effectiveZoom : gap), y: tailY - boxHeight / 2 },
        // 9. Diagonal offsets
        { x: tailX - boxWidth - gap, y: tailY - boxHeight - gap },
        { x: tailX + gap, y: tailY - boxHeight - gap },
        { x: tailX - boxWidth - gap, y: tailY + gap },
        { x: tailX + gap, y: tailY + gap },
      ];

      const candidates = rawCandidates.map((c) => ({
        x: clamp(c.x, margin, Math.max(margin, imageSize.width - boxWidth - margin)),
        y: clamp(c.y, margin, Math.max(margin, imageSize.height - boxHeight - margin)),
        width: boxWidth,
        height: boxHeight,
      }));

      // Evaluate best candidate without overlapping own or other arrows
      const scored = candidates
        .map((cand, orderIndex) => {
          // 1. Strict penalty for covering ITS OWN arrow:
          const ownArrowIntersect = segmentIntersectsRect(
            { x: tailX, y: tailY },
            { x: endX, y: endY },
            cand,
            2 / effectiveZoom
          );

          // 2. Penalty for covering ANY other arrow:
          let otherArrowIntersects = 0;
          for (let j = 0; j < processedMarkers.length; j++) {
            if (j !== index) {
              const other = processedMarkers[j];
              if (other.x != null && other.y != null) {
                const otherEndX = other.x * imageSize.width;
                const otherEndY = other.y * imageSize.height;
                const otherStartX = (other.startX != null ? other.startX : (otherEndX < imageSize.width * 0.5 ? 0.05 : 0.95)) * imageSize.width;
                const otherStartY = (other.startY != null ? other.startY : otherEndY / imageSize.height) * imageSize.height;
                const otherDx = otherEndX - otherStartX;
                const otherDy = otherEndY - otherStartY;
                const otherLen = Math.hypot(otherDx, otherDy) || 1;
                const otherUx = otherDx / otherLen;
                const otherUy = otherDy / otherLen;
                const otherTailX = otherEndX - otherUx * Math.min(arrowLength, otherLen * 0.85);
                const otherTailY = otherEndY - otherUy * Math.min(arrowLength, otherLen * 0.85);

                if (segmentIntersectsRect({ x: otherTailX, y: otherTailY }, { x: otherEndX, y: otherEndY }, cand, 2 / effectiveZoom)) {
                  otherArrowIntersects += 1;
                }
              }
            }
          }

          // 3. Label collisions
          let labelCollisions = 0;
          for (const placed of placedBoxes) {
            if (rectanglesOverlap(cand, placed, 4 / effectiveZoom)) {
              labelCollisions += 1;
            }
          }

          const score =
            (ownArrowIntersect ? 1000000 : 0) +
            labelCollisions * 10000 +
            otherArrowIntersects * 5000 +
            orderIndex;

          return { candidate: cand, score };
        })
        .sort((a, b) => a.score - b.score);

      const bestBox = scored[0].candidate;
      placedBoxes.push(bestBox);

      results.push({
        marker,
        index,
        arrowPointsStr,
        tailX,
        tailY,
        boxX: bestBox.x,
        boxY: bestBox.y,
        boxWidth: bestBox.width,
        boxHeight: bestBox.height,
        fontSize,
        labelText,
      });
    });

    return results;
  }, [imageSize, processedMarkers, zoom]);

  const hasSignalings = processedMarkers.length > 0 || (plate?.senalados && plate.senalados.length > 0);

  // If no plate is selected
  if (!plate) {
    return (
      <div className="comparador-pane">
        <div className="comparador-empty-pane">
          <div className="comparador-empty-icon-card">
            <Microscope size={38} />
          </div>
          <h3 className="comparador-empty-title">Placa {letter} sin seleccionar</h3>
          <p className="comparador-empty-desc">
            Elige una placa histológica para comenzar la comparación simultánea.
          </p>
          <button
            type="button"
            className="comparador-btn"
            style={{
              padding: '10px 20px',
              fontSize: '0.86rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
            }}
            onClick={onOpenPicker}
          >
            <Plus size={17} />
            <span>Seleccionar Placa {letter}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="comparador-pane">
      {/* Pane Floating Header */}
      <div className="comparador-pane-header">
        <div className="comparador-plate-badge-group">
          <span
            className={`comparador-plate-letter ${
              letter === 'A' ? 'comparador-plate-letter-a' : 'comparador-plate-letter-b'
            }`}
          >
            {letter}
          </span>
          <span
            className="comparador-plate-name"
            title={`${plate.tema_nombre} - ${plate.subtema_nombre}`}
          >
            {plate.subtema_nombre}
          </span>
          {plate.aumento && (
            <span className="comparador-tag comparador-tag-aumento">{plate.aumento}</span>
          )}
          {plate.tincion && (
            <span className="comparador-tag comparador-tag-tincion">{plate.tincion}</span>
          )}
        </div>

        <div className="comparador-pane-actions">
          {hasSignalings && (
            <button
              type="button"
              className={`comparador-pane-btn ${showSignalings ? 'is-active' : ''}`}
              onClick={onToggleSignalings}
              title={showSignalings ? 'Ocultar flechas y señalados' : 'Mostrar flechas y señalados'}
              aria-label={showSignalings ? 'Ocultar flechas y señalados' : 'Mostrar flechas y señalados'}
            >
              {showSignalings ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
          )}

          {plate.comentario && (
            <button
              type="button"
              className={`comparador-pane-btn ${showComment ? 'is-active' : ''}`}
              onClick={() => setShowComment(prev => !prev)}
              title="Ver comentario histológico"
              aria-label="Ver comentario histológico"
            >
              <MessageSquare size={16} />
            </button>
          )}

          {/* Botones de Rotación de Placa (90° a la izquierda y derecha) */}
          <button
            type="button"
            className="comparador-pane-btn"
            onClick={handleRotateLeft}
            title="Rotar 90° a la izquierda"
            aria-label="Rotar 90° a la izquierda"
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            className="comparador-pane-btn"
            onClick={handleRotateRight}
            title="Rotar 90° a la derecha"
            aria-label="Rotar 90° a la derecha"
          >
            <RotateCw size={15} />
          </button>

          <button
            type="button"
            className="comparador-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.76rem',
              borderRadius: '9px',
              border: '1px solid #bae6fd',
              background: 'linear-gradient(135deg, #ffffff, #f0f9ff)',
              color: '#0369a1',
              boxShadow: '0 2px 8px rgba(15, 75, 105, 0.08)',
            }}
            onClick={onOpenPicker}
            title="Cambiar esta placa"
          >
            Cambiar
          </button>
        </div>
      </div>

      {/* Stage (Interactive Viewport) */}
      <div
        ref={containerRef}
        className="comparador-stage"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            cursor: zoom > 1 ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'default',
            transition: isDraggingRef.current ? 'none' : 'transform 0.25s ease',
          }}
        >
          <img
            ref={imageRef}
            src={currentImageSrc}
            alt={plate.subtema_nombre}
            draggable={false}
            onLoad={updateImageSize}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'center center',
              userSelect: 'none',
              display: 'block',
              filter: imageFilterStyle,
              boxShadow: '0 10px 30px rgba(15, 75, 105, 0.16)',
              borderRadius: '4px',
            }}
          />

          {/* Microscope Optical Texture Grain (High Zoom Fidelity) */}
          {grainOpacity > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2,
                mixBlendMode: 'soft-light',
                opacity: grainOpacity,
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28) 0 1px, rgba(0,0,0,0) 1px), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.22) 0 1px, rgba(0,0,0,0) 1px), radial-gradient(circle at 40% 80%, rgba(255,255,255,0.2) 0 1px, rgba(0,0,0,0) 1px)',
                backgroundSize: '3px 3px, 4px 4px, 5px 5px',
              }}
            />
          )}

          {/* Signalings / Arrows SVG Layer */}
          {showSignalings && imageLoaded && imageSize && markerLayouts.length > 0 && (
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 4,
                overflow: 'visible',
              }}
              width={imageSize.width}
              height={imageSize.height}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              shapeRendering="geometricPrecision"
              textRendering="geometricPrecision"
            >
              <defs>
                <clipPath id={pointerClipId}>
                  <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                </clipPath>
                <filter id={`shadow-${pointerClipId}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
                </filter>
              </defs>

              <g clipPath={`url(#${pointerClipId})`}>
                {markerLayouts.map((item) => {
                  if (!item) return null;

                  const {
                    index,
                    arrowPointsStr,
                    tailX,
                    tailY,
                    boxX,
                    boxY,
                    boxWidth,
                    boxHeight,
                    fontSize,
                    labelText,
                  } = item;

                  return (
                    <g key={`marker-arrow-${index}`} filter={`url(#shadow-${pointerClipId})`}>
                      {/* Connecting guide dashed line between label and arrow tail */}
                      <line
                        x1={boxX + boxWidth / 2}
                        y1={boxY + boxHeight / 2}
                        x2={tailX}
                        y2={tailY}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        vectorEffect="non-scaling-stroke"
                      />

                      {/* Outer Arrow Outline for maximum contrast */}
                      <polygon
                        points={arrowPointsStr}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth={2.8}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        shapeRendering="geometricPrecision"
                      />

                      {/* Inner Arrow Fill (Vibrant Sky Blue / Cyan) */}
                      <polygon
                        points={arrowPointsStr}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth={1.2}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        shapeRendering="geometricPrecision"
                      />

                      {/* Label Pill Background */}
                      <rect
                        x={boxX}
                        y={boxY}
                        width={boxWidth}
                        height={boxHeight}
                        rx={Math.max(3, 6 / zoom)}
                        fill="rgba(15, 23, 42, 0.94)"
                        stroke="#38bdf8"
                        strokeWidth={1.4}
                        vectorEffect="non-scaling-stroke"
                      />

                      {/* Label Text */}
                      <text
                        x={boxX + boxWidth / 2}
                        y={boxY + boxHeight / 2}
                        fill="#ffffff"
                        fontSize={fontSize}
                        fontWeight="800"
                        fontFamily="Montserrat, Segoe UI, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Floating Zoom Controls */}
        <div className="comparador-zoom-controls">
          <button
            type="button"
            className="comparador-zoom-btn"
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_MIN}
            title="Alejar"
            aria-label="Alejar"
          >
            <Minus size={15} />
          </button>
          <span className="comparador-zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="comparador-zoom-btn"
            onClick={handleZoomIn}
            disabled={zoom >= effectiveMaxZoom}
            title="Acercar"
            aria-label="Acercar"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="comparador-zoom-btn"
            onClick={handleReset}
            title="Restablecer posición"
            aria-label="Restablecer posición"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Comment Drawer */}
        {showComment && plate.comentario && (
          <div className="comparador-comment-drawer">
            <div className="comparador-comment-header">
              <span className="comparador-comment-title">Comentario Histológico</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}
                onClick={() => setShowComment(false)}
                aria-label="Cerrar comentario"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: 0, color: '#334155', fontSize: '0.85rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {renderBoldText(plate.comentario)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DualPlateViewport;
