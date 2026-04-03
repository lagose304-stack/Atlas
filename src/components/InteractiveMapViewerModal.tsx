import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { IMAGE_VIEWER_VISIBILITY_EVENT, type ImageViewerVisibilityDetail } from '../constants/uiEvents';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';

export interface InteractiveMapViewerSection {
  title: string;
  description: string;
  color: string;
  points: number[];
  sortOrder: number;
  coordinateSpace?: string;
}

interface InteractiveMapViewerModalProps {
  mapLabel: string;
  imageUrl: string;
  temaNombre?: string;
  subtemaNombre?: string;
  sections: InteractiveMapViewerSection[];
  onClose: () => void;
  onReturnToInfo?: () => void;
  returnToInfoLabel?: string;
}

interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point2D {
  x: number;
  y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const SECTION_AUTO_FOCUS_MARGIN = 20;
const SECTION_AUTO_FOCUS_ANIMATION_MS = 260;
const SECTION_AUTO_FOCUS_TARGET_TOLERANCE = 1.2;
const SECTION_AUTO_FOCUS_MIN_DELTA = 0.5;
const INTERACTIVE_MAP_COORDINATE_SPACE = 'image_uv_v1';
const NORMALIZED_COORD_EPSILON = 0.0005;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const isNormalizedCoordinateValue = (value: number): boolean => {
  return value >= -NORMALIZED_COORD_EPSILON && value <= 1 + NORMALIZED_COORD_EPSILON;
};

const areLikelyNormalizedFlatPoints = (points: number[]): boolean => {
  if (points.length < 6 || points.length % 2 !== 0) return false;
  return points.every((point) => isNormalizedCoordinateValue(point));
};

const getFlatPointsBounds = (points: number[]): RectBox | null => {
  if (points.length < 2 || points.length % 2 !== 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

const fitRect = (containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number): RectBox => {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = (containerWidth - width) / 2;
  const y = (containerHeight - height) / 2;
  return { x, y, width, height };
};

const isValidHexColor = (value: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(14,165,233,${alpha})`;
  }

  const int = Number.parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const darkenHexColor = (hex: string, amount: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return '#0f172a';
  }

  const int = Number.parseInt(expanded, 16);
  const ratio = Math.max(0, Math.min(1, 1 - amount));
  const r = Math.round(((int >> 16) & 255) * ratio);
  const g = Math.round(((int >> 8) & 255) * ratio);
  const b = Math.round((int & 255) * ratio);
  return `rgb(${r},${g},${b})`;
};

const normalizeSections = (sections: InteractiveMapViewerSection[]): InteractiveMapViewerSection[] => {
  return sections
    .filter((section) => Array.isArray(section.points) && section.points.length >= 6 && section.points.length % 2 === 0)
    .map((section, index) => {
      const coordinateSpace = typeof section.coordinateSpace === 'string' ? section.coordinateSpace : undefined;

      return {
        ...section,
        title: section.title?.trim() || `Zona ${index + 1}`,
        color: isValidHexColor(section.color) ? section.color : '#0ea5e9',
        description: section.description?.trim() || '',
        points: section.points.filter((point) => typeof point === 'number' && Number.isFinite(point)),
        coordinateSpace,
      };
    })
    .filter((section) => section.points.length >= 6 && section.points.length % 2 === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

const InteractiveMapViewerModal: React.FC<InteractiveMapViewerModalProps> = ({
  mapLabel,
  imageUrl,
  temaNombre,
  subtemaNombre,
  sections,
  onClose,
  onReturnToInfo,
  returnToInfoLabel = 'Ver info de la placa',
}) => {
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Point2D | null>(null);
  const isPinchingRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(MIN_ZOOM);
  const autoFocusAnimationFrameRef = useRef<number | null>(null);
  const autoFocusTargetRef = useRef<Point2D | null>(null);
  const panOffsetRef = useRef<Point2D>({ x: 0, y: 0 });
  const pendingAutoFocusSectionIndexRef = useRef<number | null>(null);

  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const [panOffset, setPanOffset] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isReturnToInfoCtaHovered, setIsReturnToInfoCtaHovered] = useState(false);
  const [hoveredSectionIndex, setHoveredSectionIndex] = useState<number | null>(null);
  const [focusedSectionIndex, setFocusedSectionIndex] = useState<number | null>(null);

  const normalizedSections = useMemo(() => normalizeSections(sections), [sections]);
  const isNarrowLayout = windowWidth < 980;

  useEffect(() => {
    setActiveSectionIndex(null);
    setHoveredSectionIndex(null);
    setFocusedSectionIndex(null);
  }, [normalizedSections]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  const toggleSectionSelection = (sectionIndex: number) => {
    setActiveSectionIndex((prev) => {
      const next = prev === sectionIndex ? null : sectionIndex;
      stopAutoFocusAnimation();
      pendingAutoFocusSectionIndexRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const handleResizeWindow = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResizeWindow);
    return () => window.removeEventListener('resize', handleResizeWindow);
  }, []);

  useEffect(() => {
    acquireAtlasScrollLock();
    return () => {
      releaseAtlasScrollLock();
    };
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
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImageElement(img);
      setZoomScale(MIN_ZOOM);
      setPanOffset({ x: 0, y: 0 });
    };
  }, [imageUrl]);

  useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const computed = window.getComputedStyle(frame);
      const paddingX =
        Number.parseFloat(computed.paddingLeft || '0') +
        Number.parseFloat(computed.paddingRight || '0');
      const paddingY =
        Number.parseFloat(computed.paddingTop || '0') +
        Number.parseFloat(computed.paddingBottom || '0');

      const contentWidth = frame.clientWidth - paddingX;
      const contentHeight = frame.clientHeight - paddingY;

      setWorkspaceSize({
        width: Math.max(1, Math.round(contentWidth)),
        height: Math.max(1, Math.round(contentHeight)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(frame);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const baseImageRect = useMemo<RectBox | null>(() => {
    if (!imageElement || workspaceSize.width <= 0 || workspaceSize.height <= 0) return null;
    return fitRect(workspaceSize.width, workspaceSize.height, imageElement.width, imageElement.height);
  }, [imageElement, workspaceSize]);

  const clampPanOffset = (nextPan: Point2D, scale: number): Point2D => {
    if (!baseImageRect || scale <= MIN_ZOOM) return { x: 0, y: 0 };

    const maxX = (baseImageRect.width * scale - baseImageRect.width) / 2;
    const maxY = (baseImageRect.height * scale - baseImageRect.height) / 2;

    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  };

  useEffect(() => {
    setPanOffset((prev) => {
      const next = clampPanOffset(prev, zoomScale);
      if (Math.abs(next.x - prev.x) < 0.01 && Math.abs(next.y - prev.y) < 0.01) {
        return prev;
      }
      return next;
    });
  }, [zoomScale, baseImageRect]);

  const imageRect = useMemo<RectBox | null>(() => {
    if (!baseImageRect) return null;

    const scaledWidth = baseImageRect.width * zoomScale;
    const scaledHeight = baseImageRect.height * zoomScale;
    const centerX = baseImageRect.x + baseImageRect.width / 2;
    const centerY = baseImageRect.y + baseImageRect.height / 2;

    return {
      x: centerX - scaledWidth / 2 + panOffset.x,
      y: centerY - scaledHeight / 2 + panOffset.y,
      width: scaledWidth,
      height: scaledHeight,
    };
  }, [baseImageRect, zoomScale, panOffset]);

  const stopAutoFocusAnimation = () => {
    if (autoFocusAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(autoFocusAnimationFrameRef.current);
      autoFocusAnimationFrameRef.current = null;
    }
    autoFocusTargetRef.current = null;
  };

  const animatePanOffsetTo = (targetPanRaw: Point2D) => {
    const targetPan = clampPanOffset(targetPanRaw, zoomScale);
    const startPan = panOffsetRef.current;
    const diffX = targetPan.x - startPan.x;
    const diffY = targetPan.y - startPan.y;

    if (Math.abs(diffX) < SECTION_AUTO_FOCUS_MIN_DELTA && Math.abs(diffY) < SECTION_AUTO_FOCUS_MIN_DELTA) {
      panOffsetRef.current = targetPan;
      setPanOffset(targetPan);
      return;
    }

    stopAutoFocusAnimation();
    autoFocusTargetRef.current = targetPan;

    const startTime = window.performance.now();
    const animate = (now: number) => {
      const t = clamp((now - startTime) / SECTION_AUTO_FOCUS_ANIMATION_MS, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      const nextRaw = {
        x: startPan.x + diffX * eased,
        y: startPan.y + diffY * eased,
      };
      const next = clampPanOffset(nextRaw, zoomScale);

      panOffsetRef.current = next;
      setPanOffset(next);

      if (t < 1) {
        autoFocusAnimationFrameRef.current = window.requestAnimationFrame(animate);
        return;
      }

      autoFocusAnimationFrameRef.current = null;
      autoFocusTargetRef.current = null;
      panOffsetRef.current = targetPan;
      setPanOffset(targetPan);
    };

    autoFocusAnimationFrameRef.current = window.requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      stopAutoFocusAnimation();
    };
  }, []);

  const transformedSections = useMemo(() => {
    if (!baseImageRect || !imageRect) return normalizedSections;

    const scaleX = imageRect.width / Math.max(1, baseImageRect.width);
    const scaleY = imageRect.height / Math.max(1, baseImageRect.height);

    return normalizedSections.map((section) => {
      const isNormalizedCoordinates =
        section.coordinateSpace === INTERACTIVE_MAP_COORDINATE_SPACE || areLikelyNormalizedFlatPoints(section.points);

      return {
        ...section,
        points: section.points.map((value, idx) => {
          if (isNormalizedCoordinates) {
            const normalizedValue = clamp(value, 0, 1);
            if (idx % 2 === 0) {
              return imageRect.x + normalizedValue * imageRect.width;
            }
            return imageRect.y + normalizedValue * imageRect.height;
          }

          if (idx % 2 === 0) {
            return imageRect.x + (value - baseImageRect.x) * scaleX;
          }
          return imageRect.y + (value - baseImageRect.y) * scaleY;
        }),
      };
    });
  }, [normalizedSections, baseImageRect, imageRect]);

  useEffect(() => {
    if (activeSectionIndex === null) return;
    if (pendingAutoFocusSectionIndexRef.current !== activeSectionIndex) return;

    pendingAutoFocusSectionIndexRef.current = null;
    if (zoomScale <= MIN_ZOOM + 0.001) return;

    const activeSection = transformedSections[activeSectionIndex];
    if (!activeSection) return;

    const bounds = getFlatPointsBounds(activeSection.points);
    if (!bounds) return;

    const viewportLeft = SECTION_AUTO_FOCUS_MARGIN;
    const viewportTop = SECTION_AUTO_FOCUS_MARGIN;
    const viewportRight = Math.max(viewportLeft + 1, workspaceSize.width - SECTION_AUTO_FOCUS_MARGIN);
    const viewportBottom = Math.max(viewportTop + 1, workspaceSize.height - SECTION_AUTO_FOCUS_MARGIN);
    const viewportWidth = viewportRight - viewportLeft;
    const viewportHeight = viewportBottom - viewportTop;

    const boundsRight = bounds.x + bounds.width;
    const boundsBottom = bounds.y + bounds.height;
    const isOutOfView =
      bounds.x < viewportLeft ||
      bounds.y < viewportTop ||
      boundsRight > viewportRight ||
      boundsBottom > viewportBottom;

    if (!isOutOfView) return;

    const boundsCenterX = bounds.x + bounds.width / 2;
    const boundsCenterY = bounds.y + bounds.height / 2;
    const viewportCenterX = viewportLeft + viewportWidth / 2;
    const viewportCenterY = viewportTop + viewportHeight / 2;

    let dx = 0;
    if (bounds.width >= viewportWidth * 0.95) {
      dx = viewportCenterX - boundsCenterX;
    } else if (bounds.x < viewportLeft) {
      dx = viewportLeft - bounds.x;
    } else if (boundsRight > viewportRight) {
      dx = viewportRight - boundsRight;
    }

    let dy = 0;
    if (bounds.height >= viewportHeight * 0.95) {
      dy = viewportCenterY - boundsCenterY;
    } else if (bounds.y < viewportTop) {
      dy = viewportTop - bounds.y;
    } else if (boundsBottom > viewportBottom) {
      dy = viewportBottom - boundsBottom;
    }

    const currentPan = panOffsetRef.current;
    const nextPan = clampPanOffset({ x: currentPan.x + dx, y: currentPan.y + dy }, zoomScale);

    if (
      Math.abs(nextPan.x - currentPan.x) < SECTION_AUTO_FOCUS_MIN_DELTA &&
      Math.abs(nextPan.y - currentPan.y) < SECTION_AUTO_FOCUS_MIN_DELTA
    ) {
      return;
    }

    const currentTarget = autoFocusTargetRef.current;
    if (
      currentTarget &&
      Math.abs(currentTarget.x - nextPan.x) < SECTION_AUTO_FOCUS_TARGET_TOLERANCE &&
      Math.abs(currentTarget.y - nextPan.y) < SECTION_AUTO_FOCUS_TARGET_TOLERANCE
    ) {
      return;
    }

    animatePanOffsetTo(nextPan);
  }, [activeSectionIndex, transformedSections, workspaceSize.width, workspaceSize.height, zoomScale]);

  const getTouchPointFromTouch = (touch: Touch): Point2D | null => {
    const stage = stageRef.current;
    const container = stage?.container?.();
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const getTouchDistance = (firstTouch: Touch, secondTouch: Touch): number => {
    const firstPoint = getTouchPointFromTouch(firstTouch);
    const secondPoint = getTouchPointFromTouch(secondTouch);
    if (!firstPoint || !secondPoint) return 0;
    return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
  };

  const stopPan = () => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    lastPanPointRef.current = null;
    setIsPanning(false);
  };

  const startPan = (point: Point2D) => {
    if (zoomScale <= MIN_ZOOM) return;
    pendingAutoFocusSectionIndexRef.current = null;
    stopAutoFocusAnimation();
    isPanningRef.current = true;
    lastPanPointRef.current = point;
    setIsPanning(true);
  };

  const continuePan = (point: Point2D) => {
    if (!isPanningRef.current || !lastPanPointRef.current) return;

    const dx = point.x - lastPanPointRef.current.x;
    const dy = point.y - lastPanPointRef.current.y;
    lastPanPointRef.current = point;

    setPanOffset((prev) => clampPanOffset({ x: prev.x + dx, y: prev.y + dy }, zoomScale));
  };

  const resetViewport = () => {
    pendingAutoFocusSectionIndexRef.current = null;
    stopAutoFocusAnimation();
    stopPan();
    isPinchingRef.current = false;
    pinchStartDistanceRef.current = 0;
    pinchStartScaleRef.current = MIN_ZOOM;
    setZoomScale(MIN_ZOOM);
    setPanOffset({ x: 0, y: 0 });
  };

  const applyZoomAtPoint = (nextScaleRaw: number, anchorPoint: Point2D) => {
    if (!baseImageRect || !imageRect) return;

    pendingAutoFocusSectionIndexRef.current = null;
    stopAutoFocusAnimation();

    const nextScale = clamp(nextScaleRaw, MIN_ZOOM, MAX_ZOOM);
    if (nextScale <= MIN_ZOOM) {
      setZoomScale(MIN_ZOOM);
      setPanOffset({ x: 0, y: 0 });
      return;
    }

    const u = clamp((anchorPoint.x - imageRect.x) / Math.max(1, imageRect.width), 0, 1);
    const v = clamp((anchorPoint.y - imageRect.y) / Math.max(1, imageRect.height), 0, 1);

    const nextWidth = baseImageRect.width * nextScale;
    const nextHeight = baseImageRect.height * nextScale;
    const centerX = baseImageRect.x + baseImageRect.width / 2;
    const centerY = baseImageRect.y + baseImageRect.height / 2;

    const nextX = anchorPoint.x - u * nextWidth;
    const nextY = anchorPoint.y - v * nextHeight;

    const rawPan = {
      x: nextX - (centerX - nextWidth / 2),
      y: nextY - (centerY - nextHeight / 2),
    };

    setZoomScale(nextScale);
    setPanOffset(clampPanOffset(rawPan, nextScale));
  };

  const handleStageWheel = (e: any) => {
    e?.evt?.preventDefault?.();

    pendingAutoFocusSectionIndexRef.current = null;
    stopAutoFocusAnimation();

    const pointer = stageRef.current?.getPointerPosition?.();
    if (!pointer) return;

    const deltaY = Number(e?.evt?.deltaY ?? 0);
    const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
    applyZoomAtPoint(zoomScale * zoomFactor, pointer);
  };

  const handleStageMouseDown = (e: any) => {
    if (Number(e?.evt?.button ?? 0) !== 0) return;
    if (zoomScale <= MIN_ZOOM) return;

    const pointer = stageRef.current?.getPointerPosition?.();
    if (!pointer) return;

    e?.evt?.preventDefault?.();
    startPan(pointer);
  };

  const handleStageMouseMove = () => {
    if (!isPanningRef.current) return;
    const pointer = stageRef.current?.getPointerPosition?.();
    if (!pointer) return;
    continuePan(pointer);
  };

  const handleStageTouchStart = (e: any) => {
    e?.evt?.preventDefault?.();

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (touchCount >= 2) {
      const firstTouch = touches[0] as Touch;
      const secondTouch = touches[1] as Touch;
      pinchStartDistanceRef.current = getTouchDistance(firstTouch, secondTouch);
      pinchStartScaleRef.current = zoomScale;
      isPinchingRef.current = pinchStartDistanceRef.current > 0;
      stopPan();
      return;
    }

    if (touchCount === 1 && zoomScale > MIN_ZOOM) {
      const point = getTouchPointFromTouch(touches[0] as Touch);
      if (!point) return;
      startPan(point);
    }
  };

  const handleStageTouchMove = (e: any) => {
    e?.evt?.preventDefault?.();

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (isPinchingRef.current && touchCount >= 2) {
      const firstTouch = touches[0] as Touch;
      const secondTouch = touches[1] as Touch;
      const distance = getTouchDistance(firstTouch, secondTouch);
      if (distance <= 0 || pinchStartDistanceRef.current <= 0) return;

      const firstPoint = getTouchPointFromTouch(firstTouch);
      const secondPoint = getTouchPointFromTouch(secondTouch);
      if (!firstPoint || !secondPoint) return;

      const centerPoint = {
        x: (firstPoint.x + secondPoint.x) / 2,
        y: (firstPoint.y + secondPoint.y) / 2,
      };

      const ratio = distance / pinchStartDistanceRef.current;
      applyZoomAtPoint(pinchStartScaleRef.current * ratio, centerPoint);
      return;
    }

    if (touchCount === 1 && isPanningRef.current) {
      const point = getTouchPointFromTouch(touches[0] as Touch);
      if (!point) return;
      continuePan(point);
    }
  };

  const handleStageTouchEnd = (e: any) => {
    e?.evt?.preventDefault?.();

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (touchCount < 2) {
      isPinchingRef.current = false;
      pinchStartDistanceRef.current = 0;
      pinchStartScaleRef.current = zoomScale;
    }

    if (touchCount === 0) {
      stopPan();
      return;
    }

    if (touchCount === 1 && zoomScale > MIN_ZOOM) {
      const point = getTouchPointFromTouch(touches[0] as Touch);
      if (!point) return;
      startPan(point);
    }
  };

  const handleZoomIn = () => {
    if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return;
    applyZoomAtPoint(zoomScale + 0.22, {
      x: workspaceSize.width / 2,
      y: workspaceSize.height / 2,
    });
  };

  const handleZoomOut = () => {
    if (workspaceSize.width <= 0 || workspaceSize.height <= 0) return;
    applyZoomAtPoint(zoomScale - 0.22, {
      x: workspaceSize.width / 2,
      y: workspaceSize.height / 2,
    });
  };

  const hasHighlightedSelection = activeSectionIndex !== null;
  const isResetDisabled = zoomScale <= MIN_ZOOM + 0.001 && Math.abs(panOffset.x) < 0.5 && Math.abs(panOffset.y) < 0.5;

  return (
    <>
      <style>
        {`@keyframes mapCtaGlow {
          0%, 100% {
            box-shadow: 0 7px 16px rgba(59,130,246,0.24), 0 0 0 0 rgba(59,130,246,0.24);
          }
          50% {
            box-shadow: 0 10px 22px rgba(59,130,246,0.34), 0 0 0 6px rgba(59,130,246,0);
          }
        }
        @keyframes mapCtaIconTap {
          0%, 100% {
            transform: translateX(0) scale(1);
          }
          50% {
            transform: translateX(2px) scale(1.16);
          }
        }`}
      </style>
      <div style={s.backdrop} onClick={onClose}>
        <div style={s.modal} onClick={(event) => event.stopPropagation()}>
          <div style={s.viewerPane}>
            <button type="button" onClick={onClose} style={s.floatingCloseBtn}>
              <span aria-hidden="true" style={s.floatingCloseIcon}>X</span>
              Cerrar
            </button>

            <div style={s.floatingMapLabel}>{mapLabel}</div>

            {isNarrowLayout && (
              <button
                type="button"
                style={s.floatingInfoBtn}
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                {sidebarOpen ? '◀ Ocultar info' : '▶ Ver info'}
              </button>
            )}

            <div
              ref={canvasFrameRef}
              style={{
                ...s.canvasArea,
                cursor: zoomScale > MIN_ZOOM ? (isPanning ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {imageElement && imageRect ? (
                <Stage
                  ref={stageRef}
                  width={workspaceSize.width}
                  height={workspaceSize.height}
                  onWheel={handleStageWheel}
                  onMouseDown={handleStageMouseDown}
                  onMouseMove={handleStageMouseMove}
                  onMouseUp={stopPan}
                  onMouseLeave={stopPan}
                  onTouchStart={handleStageTouchStart}
                  onTouchMove={handleStageTouchMove}
                  onTouchEnd={handleStageTouchEnd}
                  onTouchCancel={handleStageTouchEnd}
                >
                  <Layer>
                    <KonvaImage
                      image={imageElement}
                      x={imageRect.x}
                      y={imageRect.y}
                      width={imageRect.width}
                      height={imageRect.height}
                      listening={false}
                    />

                    {transformedSections.map((section, idx) => {
                      const isActive = idx === activeSectionIndex;
                      const shouldGrayOut = hasHighlightedSelection && !isActive;
                      const strokeColor = shouldGrayOut
                        ? '#64748b'
                        : (isActive ? darkenHexColor(section.color, 0.4) : darkenHexColor(section.color, 0.24));
                      const fillColor = shouldGrayOut
                        ? 'rgba(100,116,139,0.24)'
                        : (isActive ? hexToRgba(section.color, 0.44) : hexToRgba(section.color, 0.3));

                      return (
                        <Line
                          key={`viewer-section-${idx}`}
                          points={section.points}
                          closed
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isActive ? 1.55 : 1.05}
                          dash={[6, 4]}
                          lineCap="round"
                          lineJoin="round"
                          onClick={() => {
                            if (isPanningRef.current || isPinchingRef.current) return;
                            toggleSectionSelection(idx);
                          }}
                          onTap={() => {
                            if (isPanningRef.current || isPinchingRef.current) return;
                            toggleSectionSelection(idx);
                          }}
                        />
                      );
                    })}
                  </Layer>
                </Stage>
              ) : (
                <div style={s.loading}>Cargando mapa...</div>
              )}
            </div>

            <div style={s.zoomDock}>
              <div style={s.zoomRow}>
                <button type="button" onClick={handleZoomOut} style={s.zoomControlBtn} title="Alejar">−</button>
                <span style={s.zoomValueBadge}>{Math.round(zoomScale * 100)}%</span>
                <button type="button" onClick={handleZoomIn} style={s.zoomControlBtn} title="Acercar">+</button>
              </div>
              <div style={s.zoomMetaRow}>
                <button
                  type="button"
                  style={{
                    ...s.resetBtn,
                    ...(isResetDisabled ? s.resetBtnDisabled : {}),
                  }}
                  onClick={resetViewport}
                  disabled={isResetDisabled}
                >
                  Recentrar
                </button>
                {!isNarrowLayout && (
                  <button
                    type="button"
                    style={s.infoInlineBtn}
                    onClick={() => setSidebarOpen((prev) => !prev)}
                  >
                    {sidebarOpen ? 'Ocultar info' : 'Mostrar info'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <aside style={{ ...s.sidebar, ...(isNarrowLayout ? s.sidebarOverlay : s.sidebarDocked) }}>
              <div style={s.sidebarHeader}>
                <div style={s.sidebarHeaderTitleWrap}>
                  <div style={s.sidebarAccent} />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' }}>
                    <span style={s.sidebarInfoLabel}>Info del mapa</span>
                    <span style={s.sidebarMapLabel}>- {mapLabel}</span>
                  </div>
                </div>
                {isNarrowLayout && (
                  <button type="button" onClick={() => setSidebarOpen(false)} style={s.sidebarCloseBtn}>✕ Cerrar</button>
                )}
              </div>

              <div style={s.sidebarContent}>
                {onReturnToInfo && (
                  <div style={s.sidebarInfoCard}>
                    <button
                      type="button"
                      onClick={onReturnToInfo}
                      onMouseEnter={() => setIsReturnToInfoCtaHovered(true)}
                      onMouseLeave={() => setIsReturnToInfoCtaHovered(false)}
                      onFocus={() => setIsReturnToInfoCtaHovered(true)}
                      onBlur={() => setIsReturnToInfoCtaHovered(false)}
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        borderRadius: '10px',
                        border: isReturnToInfoCtaHovered ? '1px solid #93c5fd' : '1px solid #bfdbfe',
                        background: isReturnToInfoCtaHovered
                          ? 'linear-gradient(135deg, #dbeafe 0%, #c7ddff 100%)'
                          : 'linear-gradient(135deg, #e8f0ff 0%, #dbeafe 100%)',
                        color: '#1e3a8a',
                        fontWeight: 800,
                        fontSize: '0.82em',
                        letterSpacing: '0.01em',
                        fontFamily: 'inherit',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        boxShadow: isReturnToInfoCtaHovered
                          ? '0 7px 16px rgba(59,130,246,0.24)'
                          : '0 4px 12px rgba(59,130,246,0.18)',
                        transform: isReturnToInfoCtaHovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                        filter: isReturnToInfoCtaHovered ? 'saturate(1.06)' : 'none',
                        animation: isReturnToInfoCtaHovered ? 'mapCtaGlow 0.9s ease-in-out infinite' : 'none',
                        transition: 'all 0.22s ease',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'translateX(0) scale(1)',
                          animation: isReturnToInfoCtaHovered ? 'mapCtaIconTap 0.62s cubic-bezier(0.22, 1, 0.36, 1) infinite' : 'none',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <MousePointerClick size={16} strokeWidth={2.2} />
                      </span>
                      {returnToInfoLabel}
                    </button>
                  </div>
                )}

                {(temaNombre || subtemaNombre) && (
                  <div style={s.metaGrid}>
                    {temaNombre && (
                      <div style={s.metaCard}>
                        <span style={s.metaLabel}>Tema</span>
                        <span style={s.metaValueTema} title={temaNombre}>{temaNombre}</span>
                      </div>
                    )}
                    {subtemaNombre && (
                      <div style={s.metaCard}>
                        <span style={s.metaLabel}>Subtema</span>
                        <span style={s.metaValueSubtema} title={subtemaNombre}>{subtemaNombre}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={s.selectionsCard}>
                  <span style={s.selectionsLabel}>Selecciones ({normalizedSections.length})</span>

                  {normalizedSections.length === 0 ? (
                    <p style={s.emptyText}>Este mapa no tiene selecciones guardadas.</p>
                  ) : (
                    <ol style={s.sectionList}>
                      {normalizedSections.map((section, idx) => {
                        const isActive = idx === activeSectionIndex;
                        const isHovered = hoveredSectionIndex === idx;
                        const isFocused = focusedSectionIndex === idx;

                        return (
                          <li
                            key={`section-info-${idx}`}
                            style={{
                              ...s.sectionCardItem,
                              ...(isActive ? s.sectionCardItemActive : {}),
                            }}
                          >
                            <span
                              style={{
                                ...s.sectionNumberBadge,
                                background: section.color,
                                boxShadow: isActive ? `0 4px 10px ${hexToRgba(section.color, 0.35)}` : 'none',
                              }}
                            >
                              {idx + 1}
                            </span>

                            <button
                              type="button"
                              onClick={() => toggleSectionSelection(idx)}
                              onMouseEnter={() => setHoveredSectionIndex(idx)}
                              onMouseLeave={() => setHoveredSectionIndex(null)}
                              onFocus={() => setFocusedSectionIndex(idx)}
                              onBlur={() => setFocusedSectionIndex(null)}
                              aria-expanded={isActive}
                              aria-controls={`section-panel-${idx}`}
                              style={{
                                ...s.sectionActionButton,
                                border: isActive ? '1px solid #93c5fd' : isHovered ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                background: isActive
                                  ? '#e8f0ff'
                                  : isHovered
                                    ? '#f0f7ff'
                                    : '#ffffff',
                                fontWeight: isActive ? 700 : 600,
                                boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.16)' : isHovered ? '0 2px 10px rgba(14,165,233,0.12)' : 'none',
                                transform: isHovered && !isActive ? 'translateY(-1px)' : 'none',
                                outline: isFocused ? '2px solid #38bdf8' : 'none',
                                outlineOffset: '1px',
                              }}
                            >
                              <span style={s.sectionActionTitle} title={section.title}>{section.title}</span>

                              <span
                                style={{
                                  ...s.sectionStateBadge,
                                  border: isActive ? '1px solid #93c5fd' : '1px solid #bae6fd',
                                  background: isActive ? '#dbeafe' : '#ecfeff',
                                  color: '#0c4a6e',
                                }}
                              >
                                {isActive ? (
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
                                )}
                              </span>
                            </button>

                            {isActive && (
                              <div id={`section-panel-${idx}`} style={s.sectionDescriptionCard}>
                                {section.description ? (
                                  <p style={s.sectionDescription}>{section.description}</p>
                                ) : (
                                  <p style={s.sectionDescriptionMuted}>Sin descripcion registrada.</p>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.78)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
    padding: 0,
    boxSizing: 'border-box',
  },
  modal: {
    width: '100%',
    height: '100%',
    position: 'relative',
    background: 'transparent',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  viewerPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    background: 'radial-gradient(ellipse at top, #334155 0%, #0f172a 58%, #020617 100%)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCloseBtn: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    background: 'linear-gradient(135deg, rgba(255,250,250,0.98) 0%, rgba(254,226,226,0.95) 100%)',
    color: '#991b1b',
    border: '1.5px solid rgba(248,113,113,0.8)',
    borderRadius: '10px',
    height: '40px',
    padding: '0 13px 0 10px',
    minWidth: '100px',
    fontSize: '0.79em',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 800,
    zIndex: 11,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(7px) saturate(120%)',
    boxShadow: '0 7px 18px rgba(220,38,38,0.26), inset 0 1px 0 rgba(255,255,255,0.86)',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
    gap: '8px',
  },
  floatingCloseIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8em',
    fontWeight: 900,
    lineHeight: 1,
    boxShadow: '0 2px 6px rgba(185,28,28,0.45)',
  },
  sidebarInfoCard: {
    background: '#ffffff',
    border: '1px solid #d8e1ec',
    borderRadius: '10px',
    padding: '12px',
    boxShadow: '0 3px 9px rgba(15,23,42,0.06)',
  },
  floatingMapLabel: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255,255,255,0.9)',
    color: '#1e293b',
    border: '1px solid rgba(148,163,184,0.42)',
    borderRadius: '999px',
    padding: '7px 14px',
    fontSize: '0.8em',
    fontWeight: 800,
    letterSpacing: '0.02em',
    boxShadow: '0 4px 14px rgba(15,23,42,0.18)',
    backdropFilter: 'blur(8px)',
    zIndex: 9,
    maxWidth: '70%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  floatingInfoBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.82em',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 10px rgba(99,102,241,0.2)',
    fontFamily: 'inherit',
  },
  canvasArea: {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    touchAction: 'none',
    padding: '20px',
    boxSizing: 'border-box',
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e2e8f0',
    fontWeight: 700,
  },
  zoomDock: {
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    padding: '12px 16px',
    borderRadius: '14px',
    boxShadow: '0 4px 20px rgba(14,165,233,0.15)',
    zIndex: 6,
    border: '1px solid rgba(186,230,253,0.6)',
  },
  zoomRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  zoomControlBtn: {
    background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    fontSize: '1.2em',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
    fontFamily: 'inherit',
    lineHeight: 1,
  },
  zoomValueBadge: {
    color: '#0f172a',
    fontWeight: 800,
    minWidth: '55px',
    textAlign: 'center',
    fontSize: '0.95em',
  },
  zoomMetaRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  resetBtn: {
    borderRadius: '9px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '7px 11px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 2px 6px rgba(15,23,42,0.08)',
    fontSize: '0.78em',
  },
  resetBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  infoInlineBtn: {
    borderRadius: '9px',
    border: '1px solid #c7d2fe',
    background: '#eef2ff',
    color: '#4338ca',
    padding: '7px 11px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.78em',
    boxShadow: '0 2px 6px rgba(99,102,241,0.16)',
  },
  sidebar: {
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    background: 'linear-gradient(180deg, #f7fafd 0%, #edf2f7 100%)',
    borderLeft: '1px solid #c7d2e2',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 20,
    fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
    boxShadow: '-12px 0 32px rgba(15,23,42,0.18), inset 1px 0 0 rgba(255,255,255,0.62)',
  },
  sidebarDocked: {
    position: 'relative',
    width: '320px',
    minWidth: '320px',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 'min(320px, 90vw)',
    boxShadow: '-12px 0 34px rgba(15,23,42,0.26)',
  },
  sidebarHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    padding: '14px 15px 12px',
    borderBottom: '1px solid #d4dde8',
    background: 'linear-gradient(180deg, rgba(247,250,253,0.98) 0%, rgba(239,244,250,0.95) 100%)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  sidebarHeaderTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sidebarAccent: {
    width: '4px',
    height: '24px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #2563eb, #1e293b)',
  },
  sidebarInfoLabel: {
    color: '#1e293b',
    fontSize: '0.71em',
    fontWeight: 800,
    letterSpacing: '0.11em',
    textTransform: 'uppercase',
  },
  sidebarMapLabel: {
    color: '#475569',
    fontSize: '0.63em',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  sidebarCloseBtn: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#1e293b',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: '6px 11px',
    fontSize: '0.77em',
    fontFamily: 'inherit',
    fontWeight: 700,
    boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
  },
  sidebarContent: {
    padding: '12px 10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
    boxSizing: 'border-box',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
  },
  metaCard: {
    borderRadius: '10px',
    border: '1px solid #dbe3ef',
    background: '#ffffff',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: 0,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: '0.68em',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaValueTema: {
    background: '#eef2ff',
    color: '#1e3a8a',
    fontWeight: 700,
    fontSize: '0.84em',
    borderRadius: '8px',
    padding: '7px 8px',
    border: '1px solid #c7d7fe',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metaValueSubtema: {
    background: '#ecfeff',
    color: '#0c4a6e',
    fontWeight: 700,
    fontSize: '0.84em',
    borderRadius: '8px',
    padding: '7px 8px',
    border: '1px solid #bae6fd',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  selectionsCard: {
    background: '#ffffff',
    border: '1px solid #d8e1ec',
    borderRadius: '10px',
    padding: '12px',
    boxShadow: '0 3px 9px rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
    flex: 1,
  },
  selectionsLabel: {
    display: 'block',
    color: '#475569',
    fontSize: '0.64em',
    fontWeight: 800,
    letterSpacing: '0.125em',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  sectionList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    paddingRight: '2px',
    minHeight: 0,
  },
  sectionCardItem: {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    columnGap: '10px',
    rowGap: '8px',
    alignItems: 'start',
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 0 rgba(148,163,184,0.12)',
    transition: 'all 0.2s ease',
  },
  sectionCardItemActive: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    boxShadow: '0 8px 18px rgba(37,99,235,0.12)',
  },
  sectionNumberBadge: {
    minWidth: '24px',
    height: '24px',
    borderRadius: '999px',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.68em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '6px',
  },
  sectionActionButton: {
    width: '100%',
    cursor: 'pointer',
    color: '#111111',
    fontSize: '0.72em',
    lineHeight: 1.35,
    borderRadius: '10px',
    padding: '7px 10px',
    textAlign: 'center',
    fontFamily: 'inherit',
    transition: 'all 0.18s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    minWidth: 0,
  },
  sectionActionTitle: {
    flex: 1,
    minWidth: 0,
    letterSpacing: '0.01em',
    textAlign: 'center',
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  sectionStateBadge: {
    fontSize: '0.66em',
    fontWeight: 700,
    borderRadius: '999px',
    padding: '3px 8px',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '26px',
    minHeight: '22px',
    flexShrink: 0,
    alignSelf: 'center',
  },
  sectionDescriptionCard: {
    gridColumn: '1 / -1',
    margin: 0,
    padding: '8px 10px',
    border: '1px solid #dbeafe',
    borderRadius: '10px',
    background: '#ffffff',
  },
  sectionDescription: {
    margin: 0,
    color: '#334155',
    fontSize: '0.76em',
    lineHeight: 1.45,
    fontWeight: 500,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  sectionDescriptionMuted: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.74em',
    lineHeight: 1.4,
    fontStyle: 'italic',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.82em',
    lineHeight: 1.4,
  },
};

export default InteractiveMapViewerModal;
