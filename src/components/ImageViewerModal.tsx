import React, { useId, useState, useEffect, useMemo, useRef } from 'react';
import { renderBoldText } from './BoldField';
import { IMAGE_VIEWER_VISIBILITY_EVENT, ImageViewerVisibilityDetail } from '../constants/uiEvents';

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
}

interface ImageViewerModalProps {
  src: string;
  srcZoom?: string;
  onClose: () => void;
  placaId?: number | string | null;
  temaNombre?: string;
  subtemaNombre?: string;
  aumento?: string | null;
  senalados?: string[] | null;
  senaladosMeta?: SenaladoMetaItem[] | null;
  comentario?: string | null;
  tincion?: string | null;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const MIN_DYNAMIC_MAX_ZOOM = 1.2;
const ZOOM_OVERSHOOT_FACTOR = 1.1;
const SIDEBAR_BREAKPOINT = 900;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
type PointerEdge = 'left' | 'right' | 'top' | 'bottom';
type MarkerVisualMode = 'pointer' | 'arrow';

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

const clampPointToNearestEdge = (x: number, y: number, width: number, height: number) => {
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

const getArrowPolygon = (
  tip: { x: number; y: number },
  ux: number,
  uy: number,
  tailDistance: number,
  tailHalfHeight: number,
  innerDistanceFromTip: number
) => {
  const nx = -uy;
  const ny = ux;
  const tailCenter = {
    x: tip.x - ux * tailDistance,
    y: tip.y - uy * tailDistance,
  };
  const inner = {
    x: tip.x - ux * innerDistanceFromTip,
    y: tip.y - uy * innerDistanceFromTip,
  };

  return [
    tip,
    { x: tailCenter.x + nx * tailHalfHeight, y: tailCenter.y + ny * tailHalfHeight },
    inner,
    { x: tailCenter.x - nx * tailHalfHeight, y: tailCenter.y - ny * tailHalfHeight },
  ] as const;
};

const polygonPoints = (points: ReadonlyArray<{ x: number; y: number }>) => (
  points.map(point => `${point.x},${point.y}`).join(' ')
);

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;
const ARROW_TAIL_DISTANCE_PX = 21;
const ARROW_TAIL_HALF_HEIGHT_PX = 16;
const ARROW_INNER_DISTANCE_PX = 23;
const ARROW_STROKE_WIDTH_PX = 2.1;
const MARKER_FADE_OUT_MS = 180;
const MARKER_FADE_IN_MS = 200;
const COMMENT_HINT_DURATION_MS = 5200;
const COMMENT_HINT_EXIT_MS = 420;

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

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src,
  srcZoom,
  onClose,
  placaId,
  temaNombre,
  subtemaNombre,
  aumento,
  senalados,
  senaladosMeta,
  comentario,
  tincion,
}) => {
  const senaladosItems = useMemo<SenaladoMetaItem[]>(() => {
    if (senaladosMeta && senaladosMeta.length > 0) {
      return senaladosMeta.map(item => ({
        label: item.label,
        x: item.x,
        y: item.y,
        startX: item.startX ?? null,
        startY: item.startY ?? null,
      }));
    }

    return (senalados ?? []).map(item => ({
      label: item,
      x: null,
      y: null,
      startX: null,
      startY: null,
    }));
  }, [senalados, senaladosMeta]);

  const hasInfo = !!(
    senaladosItems.length > 0 ||
    comentario ||
    tincion
  );

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const isDesktop = windowWidth >= SIDEBAR_BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [useZoomSource, setUseZoomSource] = useState(false);
  const [zoomSourceFailed, setZoomSourceFailed] = useState(false);

  const [zoomLevel, setZoomLevel]   = useState(1);
  const [position, setPosition]     = useState({ x: 0, y: 0 });
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null);
  const [markerRecenterRequest, setMarkerRecenterRequest] = useState(0);
  const [displayedMarkerIndex, setDisplayedMarkerIndex] = useState<number | null>(null);
  const [markerVisible, setMarkerVisible] = useState(false);
  const [showCommentHint, setShowCommentHint] = useState(false);
  const [isCommentHintExiting, setIsCommentHintExiting] = useState(false);
  const [hoveredMarkerIndex, setHoveredMarkerIndex] = useState<number | null>(null);
  const [focusedMarkerIndex, setFocusedMarkerIndex] = useState<number | null>(null);
  const [markerVisualMode, setMarkerVisualMode] = useState<MarkerVisualMode>('arrow');
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const pointerClipId = useId();

  const containerRef   = useRef<HTMLDivElement>(null);
  const imageRef       = useRef<HTMLImageElement>(null);
  const stateRef       = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const isDraggingRef  = useRef(false);
  const pinchRef       = useRef<{ dist: number } | null>(null);
  const markerSwapTimeoutRef = useRef<number | null>(null);
  const commentHintTimeoutRef = useRef<number | null>(null);
  const commentHintExitTimeoutRef = useRef<number | null>(null);

  useEffect(() => { stateRef.current.zoom = zoomLevel; }, [zoomLevel]);
  useEffect(() => { stateRef.current.pos  = position;  }, [position]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<ImageViewerVisibilityDetail>(IMAGE_VIEWER_VISIBILITY_EVENT, {
        detail: { delta: 1 },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent<ImageViewerVisibilityDetail>(IMAGE_VIEWER_VISIBILITY_EVENT, {
          detail: { delta: -1 },
        })
      );
    };
  }, []);

  useEffect(() => {
    setUseZoomSource(false);
    setZoomSourceFailed(false);
  }, [src, srcZoom]);

  useEffect(() => {
    if (srcZoom && zoomLevel > 1.01 && !zoomSourceFailed) {
      setUseZoomSource(true);
    }
  }, [zoomLevel, srcZoom, zoomSourceFailed]);

  useEffect(() => {
    setActiveMarkerIndex(null);
    setDisplayedMarkerIndex(null);
    setMarkerVisible(false);
    setHoveredMarkerIndex(null);
    setFocusedMarkerIndex(null);
  }, [src, senaladosMeta, senalados]);

  useEffect(() => {
    if (commentHintTimeoutRef.current !== null) {
      window.clearTimeout(commentHintTimeoutRef.current);
      commentHintTimeoutRef.current = null;
    }

    if (commentHintExitTimeoutRef.current !== null) {
      window.clearTimeout(commentHintExitTimeoutRef.current);
      commentHintExitTimeoutRef.current = null;
    }

    if (!comentario || comentario.trim().length === 0) {
      setShowCommentHint(false);
      setIsCommentHintExiting(false);
      return;
    }

    setShowCommentHint(true);
    setIsCommentHintExiting(false);
    const visibleBeforeExitMs = Math.max(500, COMMENT_HINT_DURATION_MS - COMMENT_HINT_EXIT_MS);
    commentHintTimeoutRef.current = window.setTimeout(() => {
      setIsCommentHintExiting(true);
      commentHintExitTimeoutRef.current = window.setTimeout(() => {
        setShowCommentHint(false);
        setIsCommentHintExiting(false);
        commentHintExitTimeoutRef.current = null;
      }, COMMENT_HINT_EXIT_MS);
      commentHintTimeoutRef.current = null;
    }, visibleBeforeExitMs);

    return () => {
      if (commentHintTimeoutRef.current !== null) {
        window.clearTimeout(commentHintTimeoutRef.current);
        commentHintTimeoutRef.current = null;
      }
      if (commentHintExitTimeoutRef.current !== null) {
        window.clearTimeout(commentHintExitTimeoutRef.current);
        commentHintExitTimeoutRef.current = null;
      }
    };
  }, [comentario, src]);

  useEffect(() => {
    const isZooming = Math.abs(zoomLevel - 1) > 0.001;
    if (!isZooming || !showCommentHint || isCommentHintExiting) return;

    if (commentHintTimeoutRef.current !== null) {
      window.clearTimeout(commentHintTimeoutRef.current);
      commentHintTimeoutRef.current = null;
    }

    if (commentHintExitTimeoutRef.current !== null) {
      window.clearTimeout(commentHintExitTimeoutRef.current);
      commentHintExitTimeoutRef.current = null;
    }

    setIsCommentHintExiting(true);
    commentHintExitTimeoutRef.current = window.setTimeout(() => {
      setShowCommentHint(false);
      setIsCommentHintExiting(false);
      commentHintExitTimeoutRef.current = null;
    }, COMMENT_HINT_EXIT_MS);
  }, [zoomLevel, showCommentHint, isCommentHintExiting]);

  useEffect(() => {
    if (markerSwapTimeoutRef.current !== null) {
      window.clearTimeout(markerSwapTimeoutRef.current);
      markerSwapTimeoutRef.current = null;
    }

    if (activeMarkerIndex === null) {
      setMarkerVisible(false);
      markerSwapTimeoutRef.current = window.setTimeout(() => {
        setDisplayedMarkerIndex(null);
      }, MARKER_FADE_OUT_MS);
      return;
    }

    if (displayedMarkerIndex === null) {
      setDisplayedMarkerIndex(activeMarkerIndex);
      requestAnimationFrame(() => setMarkerVisible(true));
      return;
    }

    if (displayedMarkerIndex === activeMarkerIndex) {
      setMarkerVisible(true);
      return;
    }

    setMarkerVisible(false);
    markerSwapTimeoutRef.current = window.setTimeout(() => {
      setDisplayedMarkerIndex(activeMarkerIndex);
      requestAnimationFrame(() => setMarkerVisible(true));
    }, MARKER_FADE_OUT_MS);

    return () => {
      if (markerSwapTimeoutRef.current !== null) {
        window.clearTimeout(markerSwapTimeoutRef.current);
        markerSwapTimeoutRef.current = null;
      }
    };
  }, [activeMarkerIndex, displayedMarkerIndex]);

  useEffect(() => {
    return () => {
      if (markerSwapTimeoutRef.current !== null) {
        window.clearTimeout(markerSwapTimeoutRef.current);
        markerSwapTimeoutRef.current = null;
      }
    };
  }, []);

  const updateImageSize = () => {
    const imageEl = imageRef.current;
    if (!imageEl) return;
    setImageSize({ width: imageEl.clientWidth, height: imageEl.clientHeight });
    setImageNaturalSize({ width: imageEl.naturalWidth, height: imageEl.naturalHeight });
  };

  const effectiveMaxZoom = useMemo(() => {
    return computeDynamicMaxZoom(imageSize, imageNaturalSize);
  }, [imageSize, imageNaturalSize]);

  const perceptualEnhanceLevel = useMemo(() => {
    if (zoomLevel <= 1.35) return 0;
    const span = Math.max(0.001, effectiveMaxZoom - 1.35);
    return clamp((zoomLevel - 1.35) / span, 0, 1);
  }, [zoomLevel, effectiveMaxZoom]);

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
  }, [src, useZoomSource, srcZoom]);

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
    const z = clamp(newZoom, ZOOM_MIN, effectiveMaxZoom);
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
        const newZoom = clamp(stateRef.current.zoom * scale, ZOOM_MIN, effectiveMaxZoom);
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
  }, [effectiveMaxZoom]);

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

  const clampPositionToViewport = (
    nextPos: { x: number; y: number },
    zoom: number,
    displayedSize: { width: number; height: number } | null,
    containerSize: { width: number; height: number }
  ) => {
    if (!displayedSize || zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const scaledWidth = displayedSize.width * zoom;
    const scaledHeight = displayedSize.height * zoom;
    const maxOffsetX = Math.max(0, (scaledWidth - containerSize.width) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - containerSize.height) / 2);

    return {
      x: clamp(nextPos.x, -maxOffsetX, maxOffsetX),
      y: clamp(nextPos.y, -maxOffsetY, maxOffsetY),
    };
  };

  useEffect(() => {
    if (activeMarkerIndex === null || zoomLevel <= 1 || !imageSize) return;

    const marker = senaladosItems[activeMarkerIndex];
    const containerEl = containerRef.current;
    if (!marker || marker.x == null || marker.y == null || !containerEl) return;

    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    // Intenta centrar el señalado y luego limita el pan para no mostrar bordes sin imagen.
    const targetCenteredPos = {
      x: -(marker.x * imageSize.width - imageSize.width / 2) * zoomLevel,
      y: -(marker.y * imageSize.height - imageSize.height / 2) * zoomLevel,
    };

    const nextPos = clampPositionToViewport(
      targetCenteredPos,
      zoomLevel,
      imageSize,
      { width: containerWidth, height: containerHeight }
    );

    if (
      Math.abs(nextPos.x - stateRef.current.pos.x) < 0.5 &&
      Math.abs(nextPos.y - stateRef.current.pos.y) < 0.5
    ) {
      return;
    }

    stateRef.current.pos = nextPos;
    setPosition(nextPos);
  }, [activeMarkerIndex, markerRecenterRequest, zoomLevel, imageSize, senaladosItems, sidebarOpen, windowWidth]);

  const commentHintPlacement = useMemo(() => {
    const fallbackTop = hasInfo && !isDesktop ? 64 : 16;
    const baseMaxWidth = isDesktop ? 360 : 320;
    const fallback = {
      top: `${fallbackTop}px`,
      left: '16px',
      maxWidth: `${baseMaxWidth}px`,
    };

    const containerEl = containerRef.current;
    if (!containerEl || !imageSize) return fallback;

    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return fallback;

    const scaledWidth = imageSize.width * zoomLevel;
    const scaledHeight = imageSize.height * zoomLevel;
    const centerX = containerWidth / 2 + position.x;
    const centerY = containerHeight / 2 + position.y;

    const imageLeft = centerX - scaledWidth / 2;
    const imageTop = centerY - scaledHeight / 2;
    const imageRight = centerX + scaledWidth / 2;
    const imageBottom = centerY + scaledHeight / 2;

    const visibleLeft = clamp(imageLeft, 0, containerWidth);
    const visibleTop = clamp(imageTop, 0, containerHeight);
    const visibleRight = clamp(imageRight, 0, containerWidth);
    const visibleBottom = clamp(imageBottom, 0, containerHeight);

    const visibleWidth = visibleRight - visibleLeft;
    const visibleHeight = visibleBottom - visibleTop;
    if (visibleWidth < 24 || visibleHeight < 24) return fallback;

    const minTop = hasInfo && !isDesktop ? 64 : 12;
    const desiredTop = visibleTop + 12;
    const desiredLeft = visibleLeft + 12;

    const top = Math.round(clamp(desiredTop, minTop, Math.max(minTop, containerHeight - 56)));
    const left = Math.round(clamp(desiredLeft, 12, Math.max(12, containerWidth - 180)));
    const maxWidthByVisible = Math.max(180, Math.floor(visibleRight - left - 12));
    const maxWidthByContainer = Math.max(180, Math.floor(containerWidth - left - 12));
    const maxWidth = Math.min(baseMaxWidth, maxWidthByVisible, maxWidthByContainer);

    return {
      top: `${top}px`,
      left: `${left}px`,
      maxWidth: `${maxWidth}px`,
    };
  }, [hasInfo, imageSize, isDesktop, position.x, position.y, zoomLevel]);

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
      <style>
        {`@keyframes senaladoCardIn {
          0% { opacity: 0; transform: translateY(6px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes senaladoBadgePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.28);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 5px rgba(59, 130, 246, 0);
            transform: scale(1.03);
          }
        }
        @keyframes commentHintIn {
          0% {
            opacity: 0;
            filter: blur(1.2px);
          }
          100% {
            opacity: 1;
            filter: blur(0);
          }
        }
        @keyframes commentHintOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-6px) scale(0.975);
            filter: blur(1.5px);
          }
        }
        @keyframes commentHintFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-1px);
          }
        }
        @keyframes commentHintBorderGlow {
          0%, 100% {
            box-shadow: 0 10px 24px rgba(76, 29, 149, 0.14), 0 0 0 0 rgba(56, 189, 248, 0.24);
          }
          50% {
            box-shadow: 0 12px 28px rgba(76, 29, 149, 0.16), 0 0 0 5px rgba(56, 189, 248, 0);
          }
        }
        @keyframes commentHintSheen {
          0% {
            transform: translateX(-140%) skewX(-18deg);
            opacity: 0;
          }
          18% {
            opacity: 0.3;
          }
          42% {
            opacity: 0.12;
          }
          100% {
            transform: translateX(160%) skewX(-18deg);
            opacity: 0;
          }
        }
        @keyframes commentHintTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.09); }
        }
        @keyframes commentHintIconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }`}
      </style>
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

        {showCommentHint && (
          <div
            style={{
              position: 'absolute',
              ...commentHintPlacement,
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'linear-gradient(115deg, rgba(245,238,255,0.52) 0%, rgba(236,246,255,0.48) 47%, rgba(255,235,246,0.5) 100%)',
              border: '1.3px solid rgba(125,211,252,0.72)',
              color: '#1e3a8a',
              fontSize: '0.8em',
              fontWeight: 600,
              lineHeight: 1.25,
              boxShadow: '0 10px 24px rgba(76, 29, 149, 0.14), inset 0 0 0 1px rgba(255,255,255,0.24), inset 0 8px 18px rgba(255,255,255,0.2)',
              zIndex: 10,
              backdropFilter: 'blur(13px) saturate(130%)',
              pointerEvents: 'none',
              overflow: 'hidden',
              willChange: 'transform, opacity, filter, box-shadow',
              animation: isCommentHintExiting
                ? `commentHintOut ${COMMENT_HINT_EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
                : 'commentHintIn 460ms cubic-bezier(0.22, 1, 0.36, 1) both, commentHintFloat 4.2s cubic-bezier(0.42, 0, 0.58, 1) 420ms infinite, commentHintBorderGlow 4.8s ease-in-out 420ms infinite',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-40%',
                bottom: '-40%',
                width: '34%',
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.58) 50%, rgba(255,255,255,0) 100%)',
                animation: isCommentHintExiting ? 'none' : 'commentHintSheen 4.6s cubic-bezier(0.4, 0, 0.2, 1) 520ms infinite',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '12px',
                left: isDesktop ? '72px' : '62px',
                width: '6px',
                height: '6px',
                borderRadius: '999px',
                background: '#dbeafe',
                boxShadow: '0 0 12px rgba(186,230,253,0.95)',
                animation: isCommentHintExiting ? 'none' : 'commentHintTwinkle 2.8s ease-in-out infinite',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '14px',
                left: isDesktop ? '66px' : '54px',
                width: '4px',
                height: '4px',
                borderRadius: '999px',
                background: '#bfdbfe',
                boxShadow: '0 0 10px rgba(125,211,252,0.9)',
                animation: isCommentHintExiting ? 'none' : 'commentHintTwinkle 3.4s ease-in-out 420ms infinite',
              }}
            />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span aria-hidden="true" style={{ position: 'relative', width: isDesktop ? '46px' : '40px', height: isDesktop ? '46px' : '40px', flexShrink: 0 }}>
                <span style={{ position: 'absolute', inset: '-8px', borderRadius: '999px', background: 'radial-gradient(circle, rgba(125,211,252,0.46) 0%, rgba(56,189,248,0) 72%)' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', border: '1.6px solid rgba(191,219,254,0.95)', background: 'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(219,234,254,0.75))', boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.75), 0 4px 14px rgba(37,99,235,0.28)' }} />
                <span style={{ position: 'absolute', inset: isDesktop ? '8px' : '7px', borderRadius: '999px', background: 'radial-gradient(circle at 30% 30%, #f0f9ff 0%, #93c5fd 42%, #1d4ed8 100%)', border: '1.2px solid rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: isDesktop ? '1em' : '0.9em', fontWeight: 900, textShadow: '0 2px 4px rgba(30,64,175,0.65)', animation: isCommentHintExiting ? 'none' : 'commentHintIconPulse 2.6s ease-in-out infinite' }}>
                  !
                </span>
              </span>

              <span style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ color: '#60a5fa', fontSize: '0.68em', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                  Tip rápido
                </span>
                <span style={{ color: '#0f1f63', fontWeight: 900, fontSize: isDesktop ? '1.02em' : '0.92em', letterSpacing: '-0.01em', lineHeight: 1.06 }}>
                  ¡Lee el comentario!
                </span>
                <span style={{ color: '#132866', fontWeight: 600, fontSize: isDesktop ? '0.82em' : '0.76em', maxWidth: '30ch' }}>
                  Revisa el comentario para aprender más sobre esta placa.
                </span>
              </span>
            </div>
          </div>
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
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
              cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              transition: (isDragging || isPinching) ? 'none' : 'transform 0.3s ease',
            }}
          >
            <img
              ref={imageRef}
              src={useZoomSource && srcZoom ? srcZoom : src}
              alt="Vista ampliada"
              draggable={false}
              onLoad={updateImageSize}
              onError={() => {
                if (useZoomSource) {
                  setUseZoomSource(false);
                  setZoomSourceFailed(true);
                }
              }}
              style={{
                maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                objectPosition: 'center center',
                userSelect: 'none', display: 'block',
                filter: imageFilterStyle,
              }}
            />

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

            {displayedMarkerIndex !== null && imageSize && (() => {
              const marker = senaladosItems[displayedMarkerIndex];
              if (!marker || marker.x == null || marker.y == null) return null;
              const endPx = {
                x: marker.x * imageSize.width,
                y: marker.y * imageSize.height,
              };
              const hasManualStart = marker.startX != null && marker.startY != null;
              const manualStart = hasManualStart
                ? clampPointToNearestEdge(
                  (marker.startX ?? 0) * imageSize.width,
                  (marker.startY ?? 0) * imageSize.height,
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
              const ux = (endPx.x - startPx.x) / directionLen;
              const uy = (endPx.y - startPx.y) / directionLen;
              const drawStartPx = {
                x: startPx.x - ux * POINTER_BASE_OUTSET_PX,
                y: startPx.y - uy * POINTER_BASE_OUTSET_PX,
              };
              const tipInsetPoint = {
                x: endPx.x - ux * POINTER_OUTLINE_TIP_BACKOFF_PX,
                y: endPx.y - uy * POINTER_OUTLINE_TIP_BACKOFF_PX,
              };
              const outline = getPointerPolygon(drawStartPx, tipInsetPoint, POINTER_OUTLINE_WIDTH_PX, POINTER_TAPER_PX);
              const core = getPointerPolygon(drawStartPx, endPx, POINTER_CORE_WIDTH_PX, POINTER_TAPER_PX);
              // SVG base: puntos fijos del SVG de referencia
              const svgPoints = [
                { x: 140, y: 80 },
                { x: 30, y: 20 },
                { x: 55, y: 80 },
                { x: 30, y: 140 }
              ];
              // Calcula la transformación para alinear la punta y la cola
              // Punta SVG: (140,80), Cola SVG: (30,80) (punto medio entre 30,20 y 30,140)
              const svgTip = { x: 140, y: 80 };
              const svgTail = { x: 30, y: 80 };
              const actualTip = endPx;
              const actualTail = {
                x: endPx.x - ux * Math.min(ARROW_TAIL_DISTANCE_PX, directionLen * 0.95),
                y: endPx.y - uy * Math.min(ARROW_TAIL_DISTANCE_PX, directionLen * 0.95)
              };
              // Vector SVG y real
              const vSvg = { x: svgTip.x - svgTail.x, y: svgTip.y - svgTail.y };
              const vReal = { x: actualTip.x - actualTail.x, y: actualTip.y - actualTail.y };
              const lenSvg = Math.hypot(vSvg.x, vSvg.y);
              const lenReal = Math.hypot(vReal.x, vReal.y);
              const scale = lenReal / lenSvg;
              const angleSvg = Math.atan2(vSvg.y, vSvg.x);
              const angleReal = Math.atan2(vReal.y, vReal.x);
              const rotation = angleReal - angleSvg;
              // Matriz de transformación SVG
              const cos = Math.cos(rotation);
              const sin = Math.sin(rotation);
              function transformPoint(pt) {
                // Trasladar al origen (cola SVG), rotar, escalar, trasladar a actualTail
                const x0 = pt.x - svgTail.x;
                const y0 = pt.y - svgTail.y;
                const xr = x0 * cos - y0 * sin;
                const yr = x0 * sin + y0 * cos;
                return {
                  x: actualTail.x + xr * scale,
                  y: actualTail.y + yr * scale
                };
              }
              const transformedPoints = svgPoints.map(transformPoint);
              const pointsStr = transformedPoints.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 4,
                    overflow: 'visible',
                    opacity: markerVisible ? 1 : 0,
                    transform: markerVisible ? 'translateY(0px) scale(1)' : 'translateY(2px) scale(0.992)',
                    transformOrigin: `${endPx.x}px ${endPx.y}px`,
                    filter: markerVisible ? 'blur(0px)' : 'blur(0.4px)',
                    transition: `opacity ${MARKER_FADE_IN_MS}ms ease, transform ${MARKER_FADE_IN_MS}ms ease, filter ${MARKER_FADE_IN_MS}ms ease`,
                  }}
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
                    {markerVisualMode === 'arrow' ? (
                      <>
                        <polygon
                          points={pointsStr}
                          fill="none"
                          stroke="white"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                          shapeRendering="geometricPrecision"
                        />
                        <polygon
                          points={pointsStr}
                          fill="black"
                          stroke="none"
                          shapeRendering="geometricPrecision"
                        />
                      </>
                    ) : (
                      <>
                        <polygon
                          points={polygonPoints(outline)}
                          fill="rgba(255,255,255,0.6)"
                          shapeRendering="geometricPrecision"
                        />
                        <polygon
                          points={polygonPoints(core)}
                          fill="#0a0a0a"
                          shapeRendering="geometricPrecision"
                        />
                      </>
                    )}
                  </g>
                </svg>
              );
            })()}
          </div>
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
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' }}>
                <span style={{ color: '#475569', fontSize: '0.72em', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Info de la placa</span>
                {placaId != null && (
                  <span style={{ color: '#94a3b8', fontSize: '0.64em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    - ID {placaId}
                  </span>
                )}
              </div>
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
            {senaladosItems.length > 0 && (
              <div>
                <span style={labelStyle}>📌 Señalados</span>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setMarkerVisualMode('arrow')}
                    style={{
                      flex: 1,
                      border: markerVisualMode === 'arrow' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                      background: markerVisualMode === 'arrow' ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)' : '#f8fafc',
                      color: markerVisualMode === 'arrow' ? '#1e3a8a' : '#475569',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.8em',
                    }}
                  >
                    Flecha
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerVisualMode('pointer')}
                    style={{
                      flex: 1,
                      border: markerVisualMode === 'pointer' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                      background: markerVisualMode === 'pointer' ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)' : '#f8fafc',
                      color: markerVisualMode === 'pointer' ? '#1e3a8a' : '#475569',
                      borderRadius: '10px',
                      padding: '7px 10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.8em',
                    }}
                  >
                    Señalador
                  </button>
                </div>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {senaladosItems.map((item, i) => {
                    const hasMarker = item.x != null && item.y != null;
                    const isActive = activeMarkerIndex === i;
                    const isHovered = hoveredMarkerIndex === i;
                    const isFocused = focusedMarkerIndex === i;
                    return (
                    <li key={i} style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: '10px',
                      background: isActive ? 'linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)' : '#f8fafc',
                      borderRadius: '12px',
                      padding: '8px 10px',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      boxShadow: isActive ? '0 8px 18px rgba(37,99,235,0.12)' : '0 1px 0 rgba(148,163,184,0.12)',
                      transition: 'all 0.2s ease',
                      animation: 'senaladoCardIn 320ms ease both',
                      animationDelay: `${i * 45}ms`,
                    }}>
                      <span style={{
                        minWidth: '24px',
                        height: '24px',
                        borderRadius: '999px',
                        background: isActive
                          ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                          : hasMarker
                            ? 'linear-gradient(135deg, #818cf8, #6366f1)'
                            : 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.72em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '6px',
                        boxShadow: isActive ? '0 4px 10px rgba(37,99,235,0.35)' : 'none',
                      }}>{i + 1}</span>
                      <button
                        type="button"
                        disabled={!hasMarker}
                        onClick={() => {
                          if (!hasMarker) return;
                          if (activeMarkerIndex === i) {
                            setMarkerRecenterRequest(prev => prev + 1);
                            return;
                          }
                          setActiveMarkerIndex(i);
                        }}
                        onMouseEnter={() => { if (hasMarker) setHoveredMarkerIndex(i); }}
                        onMouseLeave={() => setHoveredMarkerIndex(null)}
                        onFocus={() => setFocusedMarkerIndex(i)}
                        onBlur={() => setFocusedMarkerIndex(null)}
                        aria-pressed={isActive}
                        style={{
                          width: '100%',
                          border: isActive ? '1px solid #93c5fd' : isHovered ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                          background: isActive
                            ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
                            : isHovered
                              ? 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)'
                            : hasMarker
                              ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                              : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                          color: hasMarker ? '#1e3a8a' : '#64748b',
                          fontSize: '0.88em',
                          lineHeight: 1.4,
                          cursor: hasMarker ? 'pointer' : 'not-allowed',
                          fontWeight: isActive ? 700 : 600,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          textAlign: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.18s ease',
                          boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.16)' : isHovered ? '0 2px 10px rgba(14,165,233,0.12)' : 'none',
                          opacity: hasMarker ? 1 : 0.82,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transform: hasMarker && isHovered && !isActive ? 'translateY(-1px)' : 'none',
                          outline: isFocused ? '2px solid #38bdf8' : 'none',
                          outlineOffset: '1px',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, letterSpacing: '0.01em', textAlign: 'center' }}>{renderBoldText(item.label)}</span>
                        <span style={{
                          fontSize: '0.7em',
                          fontWeight: 700,
                          borderRadius: '999px',
                          padding: '3px 8px',
                          border: hasMarker
                            ? isActive
                              ? '1px solid #93c5fd'
                              : '1px solid #bae6fd'
                            : '1px solid #d1d5db',
                          background: hasMarker
                            ? isActive
                              ? '#dbeafe'
                              : '#ecfeff'
                            : '#f1f5f9',
                          color: hasMarker ? '#0c4a6e' : '#6b7280',
                          whiteSpace: 'nowrap',
                          animation: hasMarker && isActive ? 'senaladoBadgePulse 1.7s ease-in-out infinite' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '26px',
                          minHeight: '22px',
                        }}>
                          {hasMarker ? (
                            isActive ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 3l18 18" />
                                <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.1 3.8" />
                                <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7c1.9 0 3.6-.5 5-1.4" />
                                <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
                              </svg>
                            )
                          ) : 'Sin ubicacion'}
                        </span>
                      </button>
                    </li>
                  );})}
                </ol>
                <button
                  type="button"
                  onClick={() => setActiveMarkerIndex(null)}
                  style={{
                    marginTop: '10px',
                    border: '1px solid #bfdbfe',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                    color: '#1e3a8a',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.82em',
                    boxShadow: '0 2px 10px rgba(14,165,233,0.12)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  Ocultar señalador
                </button>
              </div>
            )}
            {comentario && (
              <div>
                <span style={labelStyle}>💬 Comentario</span>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.88em', lineHeight: 1.65, background: '#f1f5f9', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>{renderBoldText(comentario)}</p>
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
