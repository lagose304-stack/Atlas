import React, { useId, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { renderBoldText } from './BoldField';
import { IMAGE_VIEWER_VISIBILITY_EVENT, ImageViewerVisibilityDetail } from '../constants/uiEvents';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { supabase } from '../services/supabase';
import type { InteractiveMapViewerSection } from './InteractiveMapViewerModal';

interface SenaladoMetaItem {
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

interface ImageViewerModalProps {
  src: string;
  srcZoom?: string;
  onClose: () => void;
  placaId?: number | string | null;
  hasInteractiveMapHint?: boolean;
  hideSidebar?: boolean;
  initialMarkerVisualMode?: 'pointer' | 'arrow';
  temaNombre?: string;
  subtemaNombre?: string;
  aumento?: string | null;
  senalados?: string[] | null;
  senaladosMeta?: SenaladoMetaItem[] | null;
  comentario?: string | null;
  tincion?: string | null;
}

interface InteractiveMapRawSection {
  title?: string | null;
  color?: string | null;
  description?: string | null;
  points?: unknown;
  sort_order?: number | null;
  coordinate_space?: string | null;
}

interface InteractiveMapRow {
  map_number: number;
  sections: InteractiveMapRawSection[] | null;
}

type ViewerMode = 'arrow' | 'pointer' | 'map';
type InteractiveMapData = { mapNumber: number; sections: InteractiveMapViewerSection[] };

const interactiveMapViewerCache = new Map<number, InteractiveMapData>();
const VIEWER_MODE_SESSION_KEY = 'atlas_public_viewer_mode';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const MIN_DYNAMIC_MAX_ZOOM = 1.2;
const ZOOM_OVERSHOOT_FACTOR = 1.1;
const SIDEBAR_BREAKPOINT = 900;
const MOBILE_BREAKPOINT = 640;
const MOBILE_ARROW_SCALE = 0.6;
const getReadableTextColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map(char => `${char}${char}`).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return '#ffffff';
  const value = Number.parseInt(expanded, 16);
  const luminance = (((value >> 16) & 255) * 0.299 + ((value >> 8) & 255) * 0.587 + (value & 255) * 0.114) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
};
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const mapSectionCoordinates = (section: InteractiveMapViewerSection, width: number, height: number) => {
  const normalized = section.coordinateSpace === 'image_uv_v1' || section.points.every(value => value >= -0.001 && value <= 1.001);
  return section.points.map((value, index) => normalized ? value * (index % 2 === 0 ? width : height) : value);
};
const polygonArea = (points: number[]) => {
  let area = 0;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    area += points[index] * points[next + 1] - points[next] * points[index + 1];
  }
  return Math.abs(area) / 2;
};
const pointInPolygon = (x: number, y: number, points: number[]) => {
  let inside = false;
  for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
    const xi = points[index];
    const yi = points[index + 1];
    const xj = points[previous];
    const yj = points[previous + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
  }
  return inside;
};
const polygonPath = (points: number[]) => points.length >= 6
  ? `M ${points[0]} ${points[1]} ${points.slice(2).reduce((path, value, index) => path + (index % 2 === 0 ? ` L ${value}` : ` ${value}`), '')} Z`
  : '';
const polygonBounds = (points: number[]) => {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};
type PointerEdge = 'left' | 'right' | 'top' | 'bottom';
type MarkerVisualMode = 'pointer' | 'arrow';
type MarkerColorKey = 'black' | 'white' | 'red' | 'lime';

interface MarkerColorOption {
  key: MarkerColorKey;
  label: string;
  fill: string;
  edge: string;
}

const MARKER_COLOR_OPTIONS: MarkerColorOption[] = [
  { key: 'black', label: 'Negro', fill: '#0a0a0a', edge: '#ffffff' },
  { key: 'white', label: 'Blanco', fill: '#ffffff', edge: '#0f172a' },
  { key: 'red', label: 'Rojo', fill: '#dc2626', edge: '#ffffff' },
  { key: 'lime', label: 'Verde lima', fill: '#84cc16', edge: '#0f172a' },
];

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

const sanitizeInteractiveMapColor = (value: string | null | undefined): string => {
  if (typeof value !== 'string') return '#0ea5e9';
  const color = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
  return '#0ea5e9';
};

const normalizeInteractiveMapPoints = (rawPoints: unknown): number[] => {
  if (!Array.isArray(rawPoints)) return [];
  const clean = rawPoints.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (clean.length < 6 || clean.length % 2 !== 0) return [];
  return clean;
};

const normalizeInteractiveMapSections = (
  sectionsRaw: InteractiveMapRawSection[] | null | undefined
): InteractiveMapViewerSection[] => {
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) return [];

  const sections: InteractiveMapViewerSection[] = [];

  sectionsRaw.forEach((section, index) => {
    const points = normalizeInteractiveMapPoints(section?.points);
    if (points.length < 6) return;

    const title = typeof section?.title === 'string' && section.title.trim().length > 0
      ? section.title.trim()
      : `Zona ${index + 1}`;
    const description = typeof section?.description === 'string' ? section.description.trim() : '';
    const color = sanitizeInteractiveMapColor(section?.color);
    const sortOrder = typeof section?.sort_order === 'number' ? section.sort_order : index;
    const coordinateSpace = typeof section?.coordinate_space === 'string'
      ? section.coordinate_space
      : undefined;

    const normalizedSection: InteractiveMapViewerSection = {
      title,
      description,
      color,
      points,
      sortOrder,
      ...(coordinateSpace ? { coordinateSpace } : {}),
    };

    sections.push(normalizedSection);
  });

  sections.sort((a, b) => a.sortOrder - b.sortOrder);
  return sections;
};

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src,
  srcZoom,
  onClose,
  placaId,
  hasInteractiveMapHint,
  hideSidebar = false,
  initialMarkerVisualMode = 'arrow',
  temaNombre,
  subtemaNombre,
  aumento,
  senalados,
  senaladosMeta,
  comentario,
  tincion,
}) => {
  const resolvedInitialMarkerVisualMode: MarkerVisualMode = hideSidebar ? 'pointer' : initialMarkerVisualMode;
  const resolvedInitialMarkerIndex = hideSidebar && ((senaladosMeta?.length ?? senalados?.length ?? 0) > 0) ? 0 : null;

  const senaladosItems = useMemo<SenaladoMetaItem[]>(() => {
    if (senaladosMeta && senaladosMeta.length > 0) {
      return senaladosMeta.map(item => ({
        label: item.label,
        x: item.x,
        y: item.y,
        startX: item.startX ?? null,
        startY: item.startY ?? null,
        regionPoints: Array.isArray(item.regionPoints) ? item.regionPoints : null,
        regionColor: item.regionColor ?? null,
        regionOpacity: item.regionOpacity ?? null,
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

  const groupedSenaladosItems = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; firstIndex: number; representativeIndex: number; representative: SenaladoMetaItem }>();

    senaladosItems.forEach((item, index) => {
      const label = item.label.trim();
      if (!label) return;

      const groupKey = item.regionPoints?.length ? `${label}::border::${index}` : label;
      const existing = groups.get(groupKey);
      if (!existing) {
        groups.set(groupKey, {
          label,
          count: 1,
          firstIndex: index,
          representativeIndex: index,
          representative: item,
        });
        return;
      }

      existing.count += 1;
      if (existing.representative.x == null && item.x != null && item.y != null) {
        existing.representativeIndex = index;
        existing.representative = item;
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.firstIndex - b.firstIndex);
  }, [senaladosItems]);

  const hasPlateDetails = !!(
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
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(resolvedInitialMarkerIndex);
  const [markerRecenterRequest, setMarkerRecenterRequest] = useState(0);
  const [showCommentHint, setShowCommentHint] = useState(false);
  const [isCommentHintExiting, setIsCommentHintExiting] = useState(false);
  const [hoveredMarkerIndex, setHoveredMarkerIndex] = useState<number | null>(null);
  const [focusedMarkerIndex, setFocusedMarkerIndex] = useState<number | null>(null);
  const [markerVisualMode, setMarkerVisualMode] = useState<MarkerVisualMode>(resolvedInitialMarkerVisualMode);
  const [markerColorKey, setMarkerColorKey] = useState<MarkerColorKey>('black');
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [interactiveMapData, setInteractiveMapData] = useState<InteractiveMapData | null>(null);
  const [loadingInteractiveMap, setLoadingInteractiveMap] = useState<boolean>(() => hasInteractiveMapHint === true);
  const [isInteractiveMapVisible, setIsInteractiveMapVisible] = useState(true);
  const [activeMapSectionIndex, setActiveMapSectionIndex] = useState<number | null>(null);
  const [hoveredMapSectionIndex, setHoveredMapSectionIndex] = useState<number | null>(null);
  const [focusedMapSectionIndex, setFocusedMapSectionIndex] = useState<number | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const [interactiveMapError, setInteractiveMapError] = useState<string | null>(null);
  const [interactiveMapReloadTick, setInteractiveMapReloadTick] = useState(0);
  const [viewerMode, setViewerMode] = useState<ViewerMode>(() => initialMarkerVisualMode);
  const [announcement, setAnnouncement] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pointerClipId = useId();
  const hasInfo = hasPlateDetails || hasInteractiveMapHint === true || loadingInteractiveMap || interactiveMapData !== null;

  const activeMarkerIndices = useMemo(() => {
    if (activeMarkerIndex === null) return [];

    const activeMarker = senaladosItems[activeMarkerIndex];
    if (!activeMarker || !activeMarker.label.trim()) return [activeMarkerIndex];
    if (activeMarker.regionPoints?.length) return [activeMarkerIndex];

    const activeLabel = activeMarker.label.trim();
    return senaladosItems
      .map((item, index) => {
        if (item.label.trim() !== activeLabel) return null;
        if (item.x == null || item.y == null) return null;
        return index;
      })
      .filter((index): index is number => index !== null);
  }, [activeMarkerIndex, senaladosItems]);

  const activeMarkerColor = useMemo(() => {
    return MARKER_COLOR_OPTIONS.find(option => option.key === markerColorKey) ?? MARKER_COLOR_OPTIONS[0];
  }, [markerColorKey]);

  const mapGeometry = useMemo(() => {
    if (!interactiveMapData || !imageSize) return null;
    const coordinates = interactiveMapData.sections.map(section => mapSectionCoordinates(section, imageSize.width, imageSize.height));
    const areas = coordinates.map(polygonArea);
    const children = coordinates.map(() => [] as number[]);

    coordinates.forEach((inner, innerIndex) => {
      let closestParent: number | null = null;
      let closestParentArea = Number.POSITIVE_INFINITY;
      coordinates.forEach((outer, outerIndex) => {
        if (innerIndex === outerIndex || areas[outerIndex] <= areas[innerIndex]) return;
        const contained = inner.every((_, pointIndex) => pointIndex % 2 !== 0 || pointInPolygon(inner[pointIndex], inner[pointIndex + 1], outer));
        if (contained && areas[outerIndex] < closestParentArea) {
          closestParent = outerIndex;
          closestParentArea = areas[outerIndex];
        }
      });
      if (closestParent !== null) children[closestParent].push(innerIndex);
    });

    const paths = coordinates.map((points, index) => [polygonPath(points), ...children[index].map(childIndex => polygonPath(coordinates[childIndex]))].join(' '));
    const renderOrder = coordinates.map((_, index) => index).sort((a, b) => areas[b] - areas[a]);
    return { coordinates, areas, children, paths, renderOrder };
  }, [interactiveMapData, imageSize]);

  const containerRef   = useRef<HTMLDivElement>(null);
  const imageRef       = useRef<HTMLImageElement>(null);
  const stateRef       = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const isDraggingRef  = useRef(false);
  const pinchRef       = useRef<{ dist: number } | null>(null);
  const touchGestureRef = useRef<{ x: number; y: number; startedAt: number } | null>(null);
  const lastTapAtRef = useRef(0);
  const commentHintTimeoutRef = useRef<number | null>(null);
  const commentHintExitTimeoutRef = useRef<number | null>(null);

  const vibrateSelection = () => {
    if ('vibrate' in navigator) navigator.vibrate(12);
  };

  useEffect(() => { stateRef.current.zoom = zoomLevel; }, [zoomLevel]);
  useEffect(() => { stateRef.current.pos  = position;  }, [position]);

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
    setHoveredMarkerIndex(null);
    setFocusedMarkerIndex(null);
    setMarkerColorKey('black');
    setMarkerVisualMode(resolvedInitialMarkerVisualMode);
    setActiveMarkerIndex(resolvedInitialMarkerIndex);
  }, [src, senaladosMeta, senalados, resolvedInitialMarkerVisualMode, resolvedInitialMarkerIndex]);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!srcZoom) return;
    const preload = new Image();
    preload.src = srcZoom;
  }, [srcZoom]);

  useEffect(() => {
    let cancelled = false;

    if (hasInteractiveMapHint === false) {
      setInteractiveMapData(null);
      setLoadingInteractiveMap(false);
      setActiveMapSectionIndex(null);
      setViewerMode(resolvedInitialMarkerVisualMode);
      setMarkerVisualMode(resolvedInitialMarkerVisualMode);
      setIsInteractiveMapVisible(false);
      return;
    }

    const plateIdNumber = typeof placaId === 'number' ? placaId : Number(placaId);

    if (!Number.isFinite(plateIdNumber)) {
      setInteractiveMapData(null);
      setLoadingInteractiveMap(false);
      setActiveMapSectionIndex(null);
      setViewerMode(resolvedInitialMarkerVisualMode);
      setMarkerVisualMode(resolvedInitialMarkerVisualMode);
      setIsInteractiveMapVisible(false);
      return;
    }

    const fetchInteractiveMapByPlaca = async () => {
      setLoadingInteractiveMap(true);
      setInteractiveMapError(null);
      setInteractiveMapData(null);
      setActiveMapSectionIndex(null);
      setHoveredMapSectionIndex(null);
      setFocusedMapSectionIndex(null);

      const resolveAvailableMode = (): ViewerMode => {
        const savedMode = sessionStorage.getItem(VIEWER_MODE_SESSION_KEY);
        if (groupedSenaladosItems.length === 0) return 'map';
        return savedMode === 'arrow' || savedMode === 'pointer' || savedMode === 'map' ? savedMode : 'map';
      };

      if (interactiveMapViewerCache.has(plateIdNumber)) {
        const cached = interactiveMapViewerCache.get(plateIdNumber) ?? null;
        if (!cancelled) {
          setInteractiveMapData(cached);
          setLoadingInteractiveMap(false);
          if (cached) {
            const nextMode = resolveAvailableMode();
            setViewerMode(nextMode);
            setMarkerVisualMode(nextMode === 'pointer' ? 'pointer' : 'arrow');
            setIsInteractiveMapVisible(nextMode === 'map');
          } else {
            setViewerMode(resolvedInitialMarkerVisualMode);
            setMarkerVisualMode(resolvedInitialMarkerVisualMode);
            setIsInteractiveMapVisible(false);
          }
        }
        return;
      }

      const { data, error } = await supabase
        .from('interactive_maps')
        .select('map_number, sections')
        .eq('placa_id', plateIdNumber)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('Error al consultar mapa interactivo por placa en viewer:', error);
        setInteractiveMapData(null);
        setInteractiveMapError('No se pudo cargar el mapa interactivo.');
        setLoadingInteractiveMap(false);
        setViewerMode(resolvedInitialMarkerVisualMode);
        setMarkerVisualMode(resolvedInitialMarkerVisualMode);
        setIsInteractiveMapVisible(false);
        return;
      }

      const mapRow = (data ?? null) as InteractiveMapRow | null;
      if (!mapRow) {
        setInteractiveMapData(null);
        setLoadingInteractiveMap(false);
        setViewerMode(resolvedInitialMarkerVisualMode);
        setMarkerVisualMode(resolvedInitialMarkerVisualMode);
        setIsInteractiveMapVisible(false);
        return;
      }

      const sections = normalizeInteractiveMapSections(mapRow.sections);
      if (sections.length === 0) {
        setInteractiveMapData(null);
        setLoadingInteractiveMap(false);
        setViewerMode(resolvedInitialMarkerVisualMode);
        setMarkerVisualMode(resolvedInitialMarkerVisualMode);
        setIsInteractiveMapVisible(false);
        return;
      }

      const nextMapData = {
        mapNumber: mapRow.map_number,
        sections,
      };
      interactiveMapViewerCache.set(plateIdNumber, nextMapData);
      setInteractiveMapData(nextMapData);
      const nextMode = resolveAvailableMode();
      setViewerMode(nextMode);
      setMarkerVisualMode(nextMode === 'pointer' ? 'pointer' : 'arrow');
      setIsInteractiveMapVisible(nextMode === 'map');
      setActiveMapSectionIndex(null);
      setLoadingInteractiveMap(false);
    };

    void fetchInteractiveMapByPlaca();

    return () => {
      cancelled = true;
    };
  }, [placaId, hasInteractiveMapHint, interactiveMapReloadTick, groupedSenaladosItems.length, resolvedInitialMarkerVisualMode]);

  const selectViewerMode = (mode: ViewerMode) => {
    if (mode === 'map' && !interactiveMapData) return;
    setViewerMode(mode);
    sessionStorage.setItem(VIEWER_MODE_SESSION_KEY, mode);
    setIsInteractiveMapVisible(mode === 'map');
    if (mode !== 'map') {
      setMarkerVisualMode(mode);
      setActiveMapSectionIndex(null);
    } else {
      setActiveMarkerIndex(null);
    }
    setAnnouncement(mode === 'map' ? 'Modo mapa interactivo' : mode === 'arrow' ? 'Modo flechas' : 'Modo señaladores');
    vibrateSelection();
  };

  const navigateActiveItem = (direction: -1 | 1) => {
    if (viewerMode === 'map' && interactiveMapData) {
      const count = interactiveMapData.sections.length;
      if (count === 0) return;
      const next = activeMapSectionIndex === null ? (direction > 0 ? 0 : count - 1) : (activeMapSectionIndex + direction + count) % count;
      setActiveMapSectionIndex(next);
      setMapFocusRequest(request => request + 1);
      setAnnouncement(`Zona ${next + 1} de ${count}: ${interactiveMapData.sections[next].title}`);
      vibrateSelection();
      return;
    }

    const count = groupedSenaladosItems.length;
    if (count === 0) return;
    const currentGroupIndex = groupedSenaladosItems.findIndex(group => group.representativeIndex === activeMarkerIndex);
    const next = currentGroupIndex < 0 ? (direction > 0 ? 0 : count - 1) : (currentGroupIndex + direction + count) % count;
    setActiveMarkerIndex(groupedSenaladosItems[next].representativeIndex);
    setMarkerRecenterRequest(request => request + 1);
    setAnnouncement(`Señalado ${next + 1} de ${count}: ${groupedSenaladosItems[next].label}`);
    vibrateSelection();
  };

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
        touchGestureRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, startedAt: Date.now() };
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
      if (e.touches.length === 0) {
        isDraggingRef.current = false;
        setIsDragging(false);
        const gesture = touchGestureRef.current;
        const changedTouch = e.changedTouches[0];
        touchGestureRef.current = null;
        if (!gesture || !changedTouch) return;
        const deltaX = changedTouch.clientX - gesture.x;
        const deltaY = changedTouch.clientY - gesture.y;
        const elapsed = Date.now() - gesture.startedAt;
        if (stateRef.current.zoom <= 1.02 && elapsed < 650 && Math.abs(deltaX) > 58 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
          navigateActiveItem(deltaX < 0 ? 1 : -1);
          return;
        }
        if (elapsed < 280 && Math.hypot(deltaX, deltaY) < 18) {
          const now = Date.now();
          if (now - lastTapAtRef.current < 330) {
            if (stateRef.current.zoom > 1.05) handleResetViewport();
            else applyZoom(Math.min(2, effectiveMaxZoom));
            lastTapAtRef.current = 0;
          } else {
            lastTapAtRef.current = now;
          }
        }
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
  }, [effectiveMaxZoom, viewerMode, interactiveMapData, activeMapSectionIndex, activeMarkerIndex, groupedSenaladosItems]);

  const handleZoomIn  = () => applyZoom(stateRef.current.zoom + 0.25);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - 0.25);
  const handleResetViewport = () => {
    stateRef.current.zoom = 1;
    stateRef.current.pos = { x: 0, y: 0 };
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

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
    if (activeMapSectionIndex === null || !mapGeometry || !imageSize) return;
    const points = mapGeometry.coordinates[activeMapSectionIndex];
    const containerEl = containerRef.current;
    if (!points || points.length < 6 || !containerEl) return;

    const bounds = polygonBounds(points);
    const sectionWidth = Math.max(1, bounds.maxX - bounds.minX);
    const sectionHeight = Math.max(1, bounds.maxY - bounds.minY);
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    const fitZoom = Math.min(containerWidth / (sectionWidth * 1.8), containerHeight / (sectionHeight * 1.8));
    const targetZoom = clamp(Math.max(1.25, Math.min(fitZoom, 2.15)), ZOOM_MIN, effectiveMaxZoom);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const targetPosition = clampPositionToViewport(
      {
        x: -(centerX - imageSize.width / 2) * targetZoom,
        y: -(centerY - imageSize.height / 2) * targetZoom,
      },
      targetZoom,
      imageSize,
      { width: containerWidth, height: containerHeight }
    );

    stateRef.current.zoom = targetZoom;
    stateRef.current.pos = targetPosition;
    setZoomLevel(targetZoom);
    setPosition(targetPosition);
  }, [activeMapSectionIndex, mapFocusRequest, mapGeometry, imageSize, effectiveMaxZoom, sidebarOpen, windowWidth]);

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

  const showSidebar = !hideSidebar && hasInfo && (isDesktop || sidebarOpen);
  const isImagePointVisible = (x: number, y: number) => {
    const container = containerRef.current;
    if (!container || !imageSize) return true;
    const screenX = container.clientWidth / 2 + position.x + (x - imageSize.width / 2) * zoomLevel;
    const screenY = container.clientHeight / 2 + position.y + (y - imageSize.height / 2) * zoomLevel;
    return screenX >= 20 && screenX <= container.clientWidth - 20 && screenY >= 20 && screenY <= container.clientHeight - 20;
  };
  const activeNavigationCount = viewerMode === 'map' ? interactiveMapData?.sections.length ?? 0 : groupedSenaladosItems.length;
  const activeNavigationPosition = viewerMode === 'map'
    ? activeMapSectionIndex === null ? 0 : activeMapSectionIndex + 1
    : Math.max(0, groupedSenaladosItems.findIndex(group => group.representativeIndex === activeMarkerIndex) + 1);
  const availableViewerModeCount = (groupedSenaladosItems.length > 0 ? 2 : 0) + (interactiveMapData || loadingInteractiveMap ? 1 : 0);

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 1000, display: 'flex', flexDirection: 'row',
        background: 'rgba(2,6,23,0.78)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        {announcement}
      </div>
      <style>
        {`@keyframes senaladoCardIn {
          0% { opacity: 0; transform: translateY(6px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mapGrayIn {
          0% { opacity: 0; }
          100% { opacity: 0.88; }
        }
        @keyframes mapCalloutIn {
          0% { opacity: 0; transform: translateY(5px) scale(0.96); }
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
        }
        @keyframes mapCtaGlow {
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
      <div style={{
        flex: 1, position: 'relative', background: 'radial-gradient(ellipse at top, #334155 0%, #0f172a 58%, #020617 100%)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button
          onClick={onClose}
          title="Cerrar visor"
          aria-label="Cerrar visor"
          style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'linear-gradient(135deg, rgba(255,250,250,0.98) 0%, rgba(254,226,226,0.95) 100%)',
            color: '#991b1b', border: '1.5px solid rgba(248,113,113,0.8)',
            borderRadius: '10px', height: '40px', padding: '0 13px 0 10px', minWidth: '100px',
            fontSize: '0.79em', letterSpacing: '0.03em', textTransform: 'uppercase',
            cursor: 'pointer', fontWeight: 800, zIndex: 11,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(7px) saturate(120%)',
            boxShadow: '0 7px 18px rgba(220,38,38,0.26), inset 0 1px 0 rgba(255,255,255,0.86)',
            fontFamily: 'inherit',
            transition: 'all 0.18s ease',
            gap: '8px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
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
            }}
          >
            X
          </span>
          Cerrar
        </button>

        {!hideSidebar && hasInfo && !isDesktop && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              position: 'absolute', top: '16px', right: '16px',
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
              transition: (isDragging || isPinching || prefersReducedMotion) ? 'none' : 'transform 0.3s ease',
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

            {(activeMarkerIndices.length > 0 || (isInteractiveMapVisible && interactiveMapData)) && imageSize && (() => {
              const activeMapSection = activeMapSectionIndex === null
                ? null
                : interactiveMapData?.sections[activeMapSectionIndex] ?? null;
              const activeMapSectionCoordinates = activeMapSectionIndex === null ? [] : mapGeometry?.coordinates[activeMapSectionIndex] ?? [];
              const activeMapSectionPath = activeMapSectionIndex === null ? '' : mapGeometry?.paths[activeMapSectionIndex] ?? '';
              let activeZoneCenter = activeMapSectionCoordinates.length >= 6
                ? activeMapSectionCoordinates.reduce((center, value, coordinateIndex) => {
                    if (coordinateIndex % 2 === 0) center.x += value;
                    else center.y += value;
                    return center;
                  }, { x: 0, y: 0 })
                : null;
              const activeZonePointCount = activeMapSectionCoordinates.length / 2;
              if (activeZoneCenter && activeZonePointCount > 0) {
                activeZoneCenter.x /= activeZonePointCount;
                activeZoneCenter.y /= activeZonePointCount;
              }
              const activeChildPolygons = activeMapSectionIndex === null || !mapGeometry
                ? []
                : mapGeometry.children[activeMapSectionIndex].map(childIndex => mapGeometry.coordinates[childIndex]);
              if (activeZoneCenter && activeChildPolygons.some(points => pointInPolygon(activeZoneCenter!.x, activeZoneCenter!.y, points))) {
                const bounds = polygonBounds(activeMapSectionCoordinates);
                let bestCandidate: { x: number; y: number; distance: number } | null = null;
                for (let gx = 1; gx < 10; gx += 1) {
                  for (let gy = 1; gy < 10; gy += 1) {
                    const x = bounds.minX + ((bounds.maxX - bounds.minX) * gx) / 10;
                    const y = bounds.minY + ((bounds.maxY - bounds.minY) * gy) / 10;
                    if (!pointInPolygon(x, y, activeMapSectionCoordinates)) continue;
                    if (activeChildPolygons.some(points => pointInPolygon(x, y, points))) continue;
                    const distance = Math.hypot(x - activeZoneCenter.x, y - activeZoneCenter.y);
                    if (!bestCandidate || distance < bestCandidate.distance) bestCandidate = { x, y, distance };
                  }
                }
                if (bestCandidate) activeZoneCenter = { x: bestCandidate.x, y: bestCandidate.y };
              }
              const calloutTitle = activeMapSection?.title ?? '';
              const containerWidth = containerRef.current?.clientWidth ?? imageSize.width;
              const containerHeight = containerRef.current?.clientHeight ?? imageSize.height;
              const visibleLeft = clamp(imageSize.width / 2 + (-containerWidth / 2 - position.x) / zoomLevel, 0, imageSize.width);
              const visibleRight = clamp(imageSize.width / 2 + (containerWidth / 2 - position.x) / zoomLevel, 0, imageSize.width);
              const visibleTop = clamp(imageSize.height / 2 + (-containerHeight / 2 - position.y) / zoomLevel, 0, imageSize.height);
              const visibleBottom = clamp(imageSize.height / 2 + (containerHeight / 2 - position.y) / zoomLevel, 0, imageSize.height);
              const calloutMargin = 10 / zoomLevel;
              const calloutOffset = 34 / zoomLevel;
              const availableCalloutWidth = Math.max(60 / zoomLevel, visibleRight - visibleLeft - calloutMargin * 2);
              const desiredCalloutScreenWidth = clamp(82 + calloutTitle.length * 5.2, 116, 230);
              const calloutWidth = Math.min(desiredCalloutScreenWidth / zoomLevel, availableCalloutWidth);
              const calloutHeight = 34 / zoomLevel;
              const maxTitleCharacters = Math.max(8, Math.floor((calloutWidth * zoomLevel - 38) / 5.2));
              const calloutDisplayTitle = calloutTitle.length > maxTitleCharacters
                ? `${calloutTitle.slice(0, Math.max(5, maxTitleCharacters - 3))}...`
                : calloutTitle;
              const calloutX = activeZoneCenter
                ? clamp(
                    activeZoneCenter.x > (visibleLeft + visibleRight) / 2
                      ? activeZoneCenter.x - calloutWidth - calloutOffset
                      : activeZoneCenter.x + calloutOffset,
                    visibleLeft + calloutMargin,
                    Math.max(visibleLeft + calloutMargin, visibleRight - calloutWidth - calloutMargin)
                  )
                : 0;
              const calloutY = activeZoneCenter
                ? clamp(
                    activeZoneCenter.y - calloutHeight - 22 / zoomLevel,
                    visibleTop + calloutMargin,
                    Math.max(visibleTop + calloutMargin, visibleBottom - calloutHeight - calloutMargin)
                  )
                : 0;
              const calloutAnchorX = activeZoneCenter
                ? (calloutX > activeZoneCenter.x ? calloutX : calloutX + calloutWidth)
                : 0;
              const calloutAnchorY = calloutY + calloutHeight / 2;
              const grayscaleFilterId = `${pointerClipId}-map-grayscale`;
              const selectedZoneMaskId = `${pointerClipId}-selected-zone-mask`;

              return (
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
                >
                  <defs>
                    <clipPath id={pointerClipId}>
                      <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                    </clipPath>
                    <filter id={grayscaleFilterId} colorInterpolationFilters="sRGB">
                      <feColorMatrix type="saturate" values="0" />
                    </filter>
                    {activeMapSectionPath && (
                      <mask id={selectedZoneMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={imageSize.width} height={imageSize.height}>
                        <rect x="0" y="0" width={imageSize.width} height={imageSize.height} fill="white" />
                        <path d={activeMapSectionPath} fill="black" fillRule="evenodd" />
                      </mask>
                    )}
                  </defs>
                  <g clipPath={`url(#${pointerClipId})`}>
                    {isInteractiveMapVisible && activeMapSectionPath && (
                      <image
                        href={useZoomSource && srcZoom ? srcZoom : src}
                        x="0"
                        y="0"
                        width={imageSize.width}
                        height={imageSize.height}
                        preserveAspectRatio="none"
                        filter={`url(#${grayscaleFilterId})`}
                        mask={`url(#${selectedZoneMaskId})`}
                        opacity="0.88"
                        pointerEvents="none"
                        style={{ animation: prefersReducedMotion ? 'none' : 'mapGrayIn 280ms ease both' }}
                      />
                    )}
                    {isInteractiveMapVisible && mapGeometry?.renderOrder.map(sectionIndex => {
                      const section = interactiveMapData!.sections[sectionIndex];
                      const isActiveSection = activeMapSectionIndex === sectionIndex;
                      if (activeMapSectionIndex !== null && !isActiveSection) return null;
                      const isHoveredSection = hoveredMapSectionIndex === sectionIndex;
                      const isFocusedSection = focusedMapSectionIndex === sectionIndex;
                      const sectionPath = mapGeometry.paths[sectionIndex];

                      return (
                        <path
                          key={`interactive-map-section-${sectionIndex}`}
                          d={sectionPath}
                          fill={section.color}
                          fillRule="evenodd"
                          fillOpacity={isActiveSection ? 0.12 : isHoveredSection || isFocusedSection ? 0.36 : 0.24}
                          stroke={section.color}
                          strokeWidth={isActiveSection ? 2.4 : isHoveredSection || isFocusedSection ? 2.2 : 1.5}
                          strokeDasharray={isActiveSection ? '0' : '6 4'}
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="visiblePainted"
                          tabIndex={0}
                          role="button"
                          aria-label={`Seleccionar zona ${section.title}`}
                          style={{ cursor: 'pointer', transition: 'fill-opacity 0.18s ease, stroke-width 0.18s ease', outline: 'none' }}
                          onClick={event => {
                            event.stopPropagation();
                            setActiveMapSectionIndex(current => current === sectionIndex ? null : sectionIndex);
                            vibrateSelection();
                          }}
                          onKeyDown={event => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            setActiveMapSectionIndex(current => current === sectionIndex ? null : sectionIndex);
                            vibrateSelection();
                          }}
                          onMouseEnter={() => setHoveredMapSectionIndex(sectionIndex)}
                          onMouseLeave={() => setHoveredMapSectionIndex(null)}
                          onFocus={() => setFocusedMapSectionIndex(sectionIndex)}
                          onBlur={() => setFocusedMapSectionIndex(null)}
                          onMouseDown={event => event.stopPropagation()}
                          onTouchStart={event => event.stopPropagation()}
                        >
                          <title>{section.title}</title>
                        </path>
                      );
                    })}
                    {isInteractiveMapVisible && activeMapSection && activeZoneCenter && (
                      <g pointerEvents="none" style={{ animation: prefersReducedMotion ? 'none' : 'mapCalloutIn 320ms cubic-bezier(0.22,1,0.36,1) both' }}>
                        <line
                          x1={activeZoneCenter.x}
                          y1={activeZoneCenter.y}
                          x2={calloutAnchorX}
                          y2={calloutAnchorY}
                          stroke="#ffffff"
                          strokeWidth="3.4"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                        <line
                          x1={activeZoneCenter.x}
                          y1={activeZoneCenter.y}
                          x2={calloutAnchorX}
                          y2={calloutAnchorY}
                          stroke={activeMapSection.color}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={activeZoneCenter.x} cy={activeZoneCenter.y} r={5.5 / zoomLevel} fill="#ffffff" stroke={activeMapSection.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                        <rect x={calloutX + 2 / zoomLevel} y={calloutY + 3 / zoomLevel} width={calloutWidth} height={calloutHeight} rx={9 / zoomLevel} fill="rgba(15,23,42,0.24)" />
                        <rect x={calloutX} y={calloutY} width={calloutWidth} height={calloutHeight} rx={9 / zoomLevel} fill="rgba(255,255,255,0.97)" stroke="rgba(15,23,42,0.36)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <rect x={calloutX + 6 / zoomLevel} y={calloutY + 6 / zoomLevel} width={4 / zoomLevel} height={calloutHeight - 12 / zoomLevel} rx={2 / zoomLevel} fill={activeMapSection.color} />
                        <text
                          x={calloutX + 18 / zoomLevel}
                          y={calloutY + calloutHeight / 2 + 0.5 / zoomLevel}
                          fill="#111827"
                          fontSize={12 / zoomLevel}
                          fontWeight="700"
                          fontFamily="Montserrat, Segoe UI, sans-serif"
                          dominantBaseline="middle"
                        >
                          {calloutDisplayTitle}
                        </text>
                      </g>
                    )}
                    {activeMarkerIndices.map((markerIndex) => {
                      const marker = senaladosItems[markerIndex];
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
                      const svgPoints = [
                        { x: 140, y: 80 },
                        { x: 30, y: 20 },
                        { x: 55, y: 80 },
                        { x: 30, y: 140 }
                      ];
                      const svgTip = { x: 140, y: 80 };
                      const svgTail = { x: 30, y: 80 };
                      const actualTip = endPx;
                      const arrowScale = windowWidth <= MOBILE_BREAKPOINT ? MOBILE_ARROW_SCALE : 1;
                      const actualTail = {
                        x: endPx.x - ux * Math.min(ARROW_TAIL_DISTANCE_PX * arrowScale, directionLen * 0.95),
                        y: endPx.y - uy * Math.min(ARROW_TAIL_DISTANCE_PX * arrowScale, directionLen * 0.95)
                      };
                      const vSvg = { x: svgTip.x - svgTail.x, y: svgTip.y - svgTail.y };
                      const vReal = { x: actualTip.x - actualTail.x, y: actualTip.y - actualTail.y };
                      const lenSvg = Math.hypot(vSvg.x, vSvg.y);
                      const lenReal = Math.hypot(vReal.x, vReal.y);
                      const scale = lenReal / lenSvg;
                      const angleSvg = Math.atan2(vSvg.y, vSvg.x);
                      const angleReal = Math.atan2(vReal.y, vReal.x);
                      const rotation = angleReal - angleSvg;
                      const cos = Math.cos(rotation);
                      const sin = Math.sin(rotation);
                      function transformPoint(pt: { x: number; y: number }) {
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

                      const selectedFill = activeMarkerColor.fill;
                      const selectedEdge = activeMarkerColor.edge;
                      const regionPixelPoints = marker.regionPoints && marker.regionPoints.length >= 6
                        ? Array.from({ length: marker.regionPoints.length / 2 }, (_, index) => ({
                            x: marker.regionPoints![index * 2] * imageSize.width,
                            y: marker.regionPoints![index * 2 + 1] * imageSize.height,
                          }))
                        : [];
                      const regionMinX = regionPixelPoints.length ? Math.min(...regionPixelPoints.map(point => point.x)) : 0;
                      const regionMaxX = regionPixelPoints.length ? Math.max(...regionPixelPoints.map(point => point.x)) : 0;
                      const regionMinY = regionPixelPoints.length ? Math.min(...regionPixelPoints.map(point => point.y)) : 0;
                      const regionMaxY = regionPixelPoints.length ? Math.max(...regionPixelPoints.map(point => point.y)) : 0;
                      const regionLabelHeight = 32 / zoomLevel;
                      const regionLabelWidth = Math.min(
                        Math.max(112, 54 + marker.label.length * 6.2) / zoomLevel,
                        Math.max(80 / zoomLevel, imageSize.width - 16 / zoomLevel)
                      );
                      const regionLabelX = clamp(
                        (regionMinX + regionMaxX) / 2 - regionLabelWidth / 2,
                        8 / zoomLevel,
                        Math.max(8 / zoomLevel, imageSize.width - regionLabelWidth - 8 / zoomLevel)
                      );
                      const regionHasRoomAbove = regionMinY >= regionLabelHeight + 21 / zoomLevel;
                      const regionLabelY = regionHasRoomAbove
                        ? regionMinY - regionLabelHeight - 13 / zoomLevel
                        : Math.min(imageSize.height - regionLabelHeight - 8 / zoomLevel, regionMaxY + 13 / zoomLevel);
                      const regionAnchorX = clamp((regionMinX + regionMaxX) / 2, regionLabelX + 12 / zoomLevel, regionLabelX + regionLabelWidth - 12 / zoomLevel);
                      const regionConnectorY = regionHasRoomAbove ? regionMinY : regionMaxY;
                      const regionLabelEdgeY = regionHasRoomAbove ? regionLabelY + regionLabelHeight : regionLabelY;
                      const regionLabelFontSize = clamp(
                        ((regionLabelWidth * zoomLevel - 18) / Math.max(1, marker.label.length * 0.62)),
                        8,
                        12
                      ) / zoomLevel;

                      return (
                        <g key={markerIndex}>
                          {marker.regionPoints && marker.regionPoints.length >= 6 && (
                            <polygon
                              points={Array.from({ length: marker.regionPoints.length / 2 }, (_, index) => `${marker.regionPoints![index * 2] * imageSize.width},${marker.regionPoints![index * 2 + 1] * imageSize.height}`).join(' ')}
                              fill={marker.regionColor ?? '#22c55e'}
                              fillOpacity={marker.regionOpacity ?? 0.28}
                              stroke={marker.regionColor ?? '#22c55e'}
                              strokeWidth={2.5}
                              strokeDasharray="10 7"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                              style={{ transition: prefersReducedMotion ? 'none' : 'opacity 220ms ease' }}
                            />
                          )}
                          {markerVisualMode === 'arrow' ? (
                            <>
                              <polygon
                                points={pointsStr}
                                fill="none"
                                stroke={selectedEdge}
                                strokeWidth={1.2}
                                strokeLinejoin="round"
                                shapeRendering="geometricPrecision"
                              />
                              <polygon
                                points={pointsStr}
                                fill={selectedFill}
                                stroke="none"
                                shapeRendering="geometricPrecision"
                              />
                            </>
                          ) : (
                            <>
                              <polygon
                                points={polygonPoints(outline)}
                                fill={selectedEdge}
                                opacity={selectedFill === '#ffffff' ? 0.85 : 0.55}
                                shapeRendering="geometricPrecision"
                              />
                              <polygon
                                points={polygonPoints(core)}
                                fill={selectedFill}
                                shapeRendering="geometricPrecision"
                              />
                            </>
                          )}
                          {regionPixelPoints.length >= 3 && (
                            <g pointerEvents="none" style={{ animation: prefersReducedMotion ? 'none' : 'mapCalloutIn 280ms cubic-bezier(0.22,1,0.36,1) both' }}>
                              <line
                                x1={regionAnchorX}
                                y1={regionLabelEdgeY}
                                x2={(regionMinX + regionMaxX) / 2}
                                y2={regionConnectorY}
                                stroke="#ffffff"
                                strokeWidth="4"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                              />
                              <line
                                x1={regionAnchorX}
                                y1={regionLabelEdgeY}
                                x2={(regionMinX + regionMaxX) / 2}
                                y2={regionConnectorY}
                                stroke={marker.regionColor ?? '#22c55e'}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                              />
                              <rect
                                x={regionLabelX}
                                y={regionLabelY}
                                width={regionLabelWidth}
                                height={regionLabelHeight}
                                rx={9 / zoomLevel}
                                fill="rgba(255,255,255,0.97)"
                                stroke={marker.regionColor ?? '#22c55e'}
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                              />
                              <text
                                x={regionLabelX + regionLabelWidth / 2}
                                y={regionLabelY + regionLabelHeight / 2 + 0.5 / zoomLevel}
                                fill="#111827"
                                fontSize={regionLabelFontSize}
                                fontWeight="750"
                                fontFamily="Montserrat, Segoe UI, sans-serif"
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                {marker.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              );
            })()}
          </div>
        </div>

        {zoomLevel > 1.05 && imageSize && (() => {
          const frame = containerRef.current;
          const miniWidth = isDesktop ? 132 : 104;
          const miniHeight = Math.max(58, Math.min(104, miniWidth * imageSize.height / imageSize.width));
          const frameWidth = frame?.clientWidth ?? imageSize.width;
          const frameHeight = frame?.clientHeight ?? imageSize.height;
          const visibleWidth = Math.min(imageSize.width, frameWidth / zoomLevel);
          const visibleHeight = Math.min(imageSize.height, frameHeight / zoomLevel);
          const visibleLeft = clamp(imageSize.width / 2 + (-frameWidth / 2 - position.x) / zoomLevel, 0, Math.max(0, imageSize.width - visibleWidth));
          const visibleTop = clamp(imageSize.height / 2 + (-frameHeight / 2 - position.y) / zoomLevel, 0, Math.max(0, imageSize.height - visibleHeight));
          return (
            <div aria-label="Minimapa de navegación" style={{ position: 'absolute', left: '16px', bottom: '18px', width: `${miniWidth}px`, height: `${miniHeight}px`, borderRadius: '10px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.88)', background: '#0f172a', boxShadow: '0 8px 24px rgba(2,6,23,0.35)', zIndex: 6, pointerEvents: 'none' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: 0.82 }} />
              <span style={{ position: 'absolute', left: `${visibleLeft / imageSize.width * miniWidth}px`, top: `${visibleTop / imageSize.height * miniHeight}px`, width: `${visibleWidth / imageSize.width * miniWidth}px`, height: `${visibleHeight / imageSize.height * miniHeight}px`, border: '2px solid #38bdf8', background: 'rgba(56,189,248,0.14)', boxSizing: 'border-box', borderRadius: '3px' }} />
            </div>
          );
        })()}

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
          <button
            type="button"
            onClick={handleResetViewport}
            disabled={zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5}
            style={{
              border: '1px solid #bae6fd',
              background: '#ffffff',
              color: '#0369a1',
              borderRadius: '9px',
              padding: '6px 12px',
              fontWeight: 750,
              fontSize: '0.72em',
              fontFamily: 'inherit',
              cursor: zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5 ? 'not-allowed' : 'pointer',
              opacity: zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5 ? 0.5 : 1,
            }}
          >
            Recentrar
          </button>
          <span style={{ color: '#64748b', fontSize: '0.72em', textAlign: 'center' }}>
            {zoomLevel > 1 ? '✋ Arrastra para mover' : '🖱️ Rueda para zoom'}
          </span>
        </div>
      </div>

      {showSidebar && (
        <div style={{
          width: isDesktop ? '320px' : 'min(320px, 90vw)',
          position: isDesktop ? 'relative' : 'absolute',
          top: 0, right: 0, height: '100%',
          background: 'linear-gradient(180deg, #f7fafd 0%, #edf2f7 100%)',
          backdropFilter: isDesktop ? 'none' : 'blur(6px) saturate(112%)',
          borderLeft: '1px solid #c7d2e2',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          zIndex: isDesktop ? 1 : 20,
          fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
          boxShadow: isDesktop
            ? '-12px 0 32px rgba(15,23,42,0.18), inset 1px 0 0 rgba(255,255,255,0.62)'
            : '-12px 0 34px rgba(15,23,42,0.26)',
        }}>
          {/* Cabecera */}
          <div style={{
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
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '4px', height: '24px', borderRadius: '999px', background: 'linear-gradient(180deg, #2563eb, #1e293b)' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap' }}>
                <span style={{ color: '#1e293b', fontSize: '0.71em', fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase' }}>Info de la placa</span>
                {placaId != null && (
                  <span style={{ color: '#475569', fontSize: '0.63em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    - ID {placaId}
                  </span>
                )}
              </div>
            </div>
            {!isDesktop && (
              <button onClick={() => setSidebarOpen(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', cursor: 'pointer', borderRadius: '8px', padding: '6px 11px', fontSize: '0.77em', fontFamily: 'inherit', fontWeight: 700, boxShadow: '0 2px 6px rgba(15,23,42,0.06)' }}>✕ Cerrar</button>
            )}
          </div>
          {/* Contenido */}
          <div style={{ padding: '12px 10px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {(temaNombre || subtemaNombre) && (
              <div
                style={{
                  ...sidebarGridStyle,
                  order: 1,
                  gridTemplateColumns: temaNombre && subtemaNombre ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                }}
              >
                {temaNombre && (
                  <div style={compactSidebarSectionStyle}>
                    <span style={labelStyle}>Tema</span>
                    <span
                      title={temaNombre}
                      style={{
                        ...singleLineEllipsisStyle,
                        background: '#eef2ff',
                        color: '#1e3a8a',
                        fontWeight: 700,
                        fontSize: '0.84em',
                        borderRadius: '8px',
                        padding: '7px 8px',
                        border: '1px solid #c7d7fe',
                      }}
                    >
                      {temaNombre}
                    </span>
                  </div>
                )}
                {subtemaNombre && (
                  <div style={compactSidebarSectionStyle}>
                    <span style={labelStyle}>Subtema</span>
                    <span
                      title={subtemaNombre}
                      style={{
                        ...singleLineEllipsisStyle,
                        background: '#ecfeff',
                        color: '#0c4a6e',
                        fontWeight: 700,
                        fontSize: '0.84em',
                        borderRadius: '8px',
                        padding: '7px 8px',
                        border: '1px solid #bae6fd',
                      }}
                    >
                      {subtemaNombre}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(aumento || tincion) && (
              <div
                style={{
                  ...sidebarGridStyle,
                  order: 1,
                  gridTemplateColumns: aumento && tincion ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                }}
              >
                {aumento && (
                  <div style={compactSidebarSectionStyle}>
                    <span style={labelStyle}>Aumento</span>
                    <span
                      title={aumento}
                      style={{
                        ...singleLineEllipsisStyle,
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: 800,
                        fontSize: '0.9em',
                        borderRadius: '999px',
                        padding: '7px 9px',
                        border: '1px solid #9fe9b9',
                        textAlign: 'center',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {aumento}
                    </span>
                  </div>
                )}
                {tincion && (
                  <div style={compactSidebarSectionStyle}>
                    <span style={labelStyle}>Tinción</span>
                    <span
                      title={tincion}
                      style={{
                        ...singleLineEllipsisStyle,
                        background: '#fff7ed',
                        color: '#92400e',
                        fontWeight: 700,
                        fontSize: '0.84em',
                        borderRadius: '999px',
                        padding: '7px 9px',
                        border: '1px solid #f8d88c',
                        textAlign: 'center',
                      }}
                    >
                      {renderBoldText(tincion)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(groupedSenaladosItems.length > 0 || interactiveMapData || loadingInteractiveMap || interactiveMapError) && (
              <div style={{ ...sidebarSectionStyle, order: 3 }}>
                <span style={labelStyle}>Visualización</span>
                {groupedSenaladosItems.length > 0 && viewerMode !== 'map' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72em', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Color</span>
                    {MARKER_COLOR_OPTIONS.map(option => {
                      const isActiveColor = markerColorKey === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setMarkerColorKey(option.key)}
                          title={option.label}
                          aria-label={`Cambiar color a ${option.label}`}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: isActiveColor ? `2px solid ${option.edge}` : '1px solid #cbd5e1',
                            background: option.fill,
                            boxShadow: isActiveColor ? '0 0 0 3px rgba(96,165,250,0.18)' : 'none',
                            cursor: 'pointer',
                            padding: 0,
                            outline: 'none',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                            transform: isActiveColor ? 'scale(1.08)' : 'scale(1)',
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, availableViewerModeCount)}, minmax(0, 1fr))`, gap: '7px', marginBottom: '10px' }}>
                  {groupedSenaladosItems.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={viewerMode === 'arrow'}
                    onClick={() => selectViewerMode('arrow')}
                    style={{
                      border: viewerMode === 'arrow' ? '1px solid #93c5fd' : '1px solid #d1d9e6',
                      background: viewerMode === 'arrow' ? '#e9f1ff' : '#ffffff',
                      color: viewerMode === 'arrow' ? '#1e3a8a' : '#334155',
                      borderRadius: '11px',
                      padding: '8px 6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.7em',
                      boxShadow: viewerMode === 'arrow' ? '0 4px 12px rgba(37,99,235,0.14)' : 'none',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    Flechas
                  </button>
                  )}
                  {groupedSenaladosItems.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={viewerMode === 'pointer'}
                    onClick={() => selectViewerMode('pointer')}
                    style={{
                      border: viewerMode === 'pointer' ? '1px solid #93c5fd' : '1px solid #d1d9e6',
                      background: viewerMode === 'pointer' ? '#e9f1ff' : '#ffffff',
                      color: viewerMode === 'pointer' ? '#1e3a8a' : '#334155',
                      borderRadius: '11px',
                      padding: '8px 6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.7em',
                      boxShadow: viewerMode === 'pointer' ? '0 4px 12px rgba(37,99,235,0.14)' : 'none',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    Señalador
                  </button>
                  )}
                  {(interactiveMapData || loadingInteractiveMap) && (
                  <button
                    type="button"
                    aria-pressed={viewerMode === 'map'}
                    disabled={!interactiveMapData}
                    onClick={() => selectViewerMode('map')}
                    style={{
                      border: viewerMode === 'map' && interactiveMapData ? '1px solid #86efac' : '1px solid #cbd5e1',
                      background: viewerMode === 'map' && interactiveMapData ? '#ecfdf5' : '#ffffff',
                      color: viewerMode === 'map' && interactiveMapData ? '#166534' : '#475569',
                      borderRadius: '11px',
                      padding: '8px 6px',
                      fontWeight: 800,
                      cursor: interactiveMapData ? 'pointer' : 'wait',
                      fontFamily: 'inherit',
                      fontSize: '0.7em',
                      boxShadow: viewerMode === 'map' && interactiveMapData ? '0 4px 12px rgba(22,163,74,0.13)' : 'none',
                      opacity: interactiveMapData ? 1 : 0.72,
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {!interactiveMapData ? 'Cargando...' : 'Mapa'}
                  </button>
                  )}
                </div>
                {interactiveMapError && (
                  <div style={{ marginBottom: '10px', padding: '9px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.74em', lineHeight: 1.4 }}>
                    {interactiveMapError}
                    <button type="button" onClick={() => setInteractiveMapReloadTick(value => value + 1)} style={{ marginLeft: '8px', border: '1px solid #fca5a5', borderRadius: '7px', background: '#fff', color: '#991b1b', padding: '4px 7px', fontWeight: 750, cursor: 'pointer' }}>Reintentar</button>
                  </div>
                )}
                {groupedSenaladosItems.length > 0 && viewerMode !== 'map' && (
                  <>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupedSenaladosItems.map((group, groupIndex) => {
                    const item = group.representative;
                    const hasMarker = item.x != null && item.y != null;
                    const indexToUse = group.representativeIndex;
                    const isActive = activeMarkerIndex === indexToUse;
                    const isHovered = hoveredMarkerIndex === indexToUse;
                    const isFocused = focusedMarkerIndex === indexToUse;
                    const isOffscreen = Boolean(hasMarker && imageSize && !isImagePointVisible((item.x ?? 0) * imageSize.width, (item.y ?? 0) * imageSize.height));
                    return (
                    <li key={`${group.label}-${groupIndex}`} style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: '10px',
                      background: isActive ? '#eff6ff' : '#f8fafc',
                      borderRadius: '12px',
                      padding: '8px 10px',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      boxShadow: isActive ? '0 8px 18px rgba(37,99,235,0.12)' : '0 1px 0 rgba(148,163,184,0.12)',
                      transition: 'all 0.2s ease',
                      animation: prefersReducedMotion ? 'none' : 'senaladoCardIn 320ms ease both',
                      animationDelay: `${group.firstIndex * 45}ms`,
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
                        fontSize: '0.68em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '6px',
                        boxShadow: isActive ? '0 4px 10px rgba(37,99,235,0.35)' : 'none',
                      }}>{groupIndex + 1}</span>
                      <button
                        type="button"
                        disabled={!hasMarker}
                        onClick={() => {
                          if (!hasMarker) return;
                          if (activeMarkerIndex === indexToUse) {
                            setMarkerRecenterRequest(prev => prev + 1);
                            return;
                          }
                          setActiveMarkerIndex(indexToUse);
                        }}
                        onMouseEnter={() => { if (hasMarker) setHoveredMarkerIndex(indexToUse); }}
                        onMouseLeave={() => setHoveredMarkerIndex(null)}
                        onFocus={() => setFocusedMarkerIndex(indexToUse)}
                        onBlur={() => setFocusedMarkerIndex(null)}
                        aria-pressed={isActive}
                        title={isOffscreen ? 'Fuera de la vista; pulsa para centrar' : undefined}
                        style={{
                          width: '100%',
                          border: isActive ? '1px solid #93c5fd' : isHovered ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                          background: isActive
                            ? '#e8f0ff'
                            : isHovered
                              ? '#f0f7ff'
                            : hasMarker
                              ? '#ffffff'
                              : '#f1f5f9',
                          color: '#111111',
                          fontSize: '0.72em',
                          lineHeight: 1.35,
                          cursor: hasMarker ? 'pointer' : 'not-allowed',
                          fontWeight: isActive ? 700 : 600,
                          borderRadius: '10px',
                          padding: '7px 10px',
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
                        <span style={{ flex: 1, minWidth: 0, letterSpacing: '0.01em', textAlign: 'center' }}>
                          {renderBoldText(item.label)}
                          {group.count > 1 ? ` (${group.count})` : ''}
                        </span>
                        <span style={{
                          fontSize: '0.66em',
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
                          {isOffscreen ? '↗' : hasMarker ? (
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
                    width: '100%',
                    border: '1px solid #bfdbfe',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                    color: '#1e3a8a',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.77em',
                    boxShadow: '0 2px 10px rgba(14,165,233,0.12)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  Ocultar señalador
                </button>
                  </>
                )}
                {interactiveMapData && viewerMode === 'map' && (
                  <div style={{ marginTop: groupedSenaladosItems.length > 0 ? '12px' : 0 }}>
                    <span style={labelStyle}>Zonas del mapa {interactiveMapData.mapNumber}</span>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {interactiveMapData.sections.map((section, sectionIndex) => {
                        const isActive = activeMapSectionIndex === sectionIndex;
                        const isHovered = hoveredMapSectionIndex === sectionIndex;
                        const isFocused = focusedMapSectionIndex === sectionIndex;
                        const sectionCoordinates = mapGeometry?.coordinates[sectionIndex] ?? [];
                        const sectionBounds = sectionCoordinates.length >= 6 ? polygonBounds(sectionCoordinates) : null;
                        const isOffscreen = Boolean(sectionBounds && !isImagePointVisible((sectionBounds.minX + sectionBounds.maxX) / 2, (sectionBounds.minY + sectionBounds.maxY) / 2));
                        return (
                          <li
                            key={`map-section-control-${sectionIndex}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '24px minmax(0, 1fr)',
                              alignItems: 'start',
                              gap: '8px 10px',
                              background: isActive ? '#eff6ff' : isHovered || isFocused ? '#f0f9ff' : '#f8fafc',
                              borderRadius: '12px',
                              padding: '8px 10px',
                              border: isActive || isHovered || isFocused ? `1px solid ${section.color}` : '1px solid #e2e8f0',
                              boxShadow: isActive ? '0 8px 18px rgba(37,99,235,0.12)' : isHovered || isFocused ? `0 5px 14px ${section.color}20` : '0 1px 0 rgba(148,163,184,0.12)',
                              transform: isHovered && !isActive ? 'translateY(-1px)' : 'none',
                              transition: 'all 0.2s ease',
                              animation: prefersReducedMotion ? 'none' : 'senaladoCardIn 320ms ease both',
                              animationDelay: `${sectionIndex * 45}ms`,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: '24px',
                                height: '24px',
                                marginTop: '6px',
                                borderRadius: '999px',
                                background: section.color,
                                color: getReadableTextColor(section.color),
                                fontWeight: 850,
                                fontSize: '0.68em',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isActive ? `0 4px 10px ${section.color}66` : `0 2px 6px ${section.color}38`,
                              }}
                            >
                              {sectionIndex + 1}
                            </span>
                            <button
                              type="button"
                              disabled={!isInteractiveMapVisible}
                              onClick={() => {
                                setActiveMapSectionIndex(current => current === sectionIndex ? null : sectionIndex);
                                vibrateSelection();
                              }}
                              onMouseEnter={() => setHoveredMapSectionIndex(sectionIndex)}
                              onMouseLeave={() => setHoveredMapSectionIndex(null)}
                              onFocus={() => setFocusedMapSectionIndex(sectionIndex)}
                              onBlur={() => setFocusedMapSectionIndex(null)}
                              style={{
                                width: '100%',
                                minHeight: '38px',
                                border: isActive || isHovered || isFocused ? `1px solid ${section.color}` : '1px solid #cbd5e1',
                                background: isActive ? '#ffffff' : isHovered || isFocused ? '#f8fbff' : '#ffffff',
                                color: '#111111',
                                borderRadius: '10px',
                                padding: '7px 9px 7px 11px',
                                fontFamily: 'inherit',
                                fontSize: '0.72em',
                                lineHeight: 1.35,
                                fontWeight: isActive ? 750 : 600,
                                cursor: isInteractiveMapVisible ? 'pointer' : 'not-allowed',
                                opacity: isInteractiveMapVisible ? 1 : 0.55,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                boxShadow: isActive ? `0 4px 12px ${section.color}2b` : isHovered || isFocused ? `0 3px 10px ${section.color}1f` : 'none',
                                outline: isFocused ? `2px solid ${section.color}55` : 'none',
                                outlineOffset: '1px',
                                transition: 'all 0.18s ease',
                              }}
                            >
                              <span style={{ flex: 1, minWidth: 0, textAlign: 'center', letterSpacing: '0.01em' }}>
                                {section.title}
                              </span>
                              <span style={{
                                minWidth: '31px',
                                minHeight: '22px',
                                padding: '3px 7px',
                                borderRadius: '999px',
                                border: `1px solid ${section.color}66`,
                                background: isActive ? `${section.color}24` : `${section.color}12`,
                                color: '#334155',
                                fontSize: '0.68em',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                              }}>
                                {isActive ? 'Activa' : isOffscreen ? 'Centrar' : 'Ver'}
                              </span>
                            </button>
                            {isActive && section.description && (
                              <p style={{ gridColumn: '2', margin: 0, padding: '8px 10px', borderRadius: '9px', border: `1px solid ${section.color}38`, background: '#ffffff', color: '#475569', fontSize: '0.73em', lineHeight: 1.48 }}>
                                {section.description}
                              </p>
                            )}
                            {isActive && (
                              <div style={{ gridColumn: '2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.68em', color: '#64748b', fontWeight: 700 }}>Zona {sectionIndex + 1} · <span style={{ color: section.color }}>●</span> {section.color}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button type="button" onClick={() => setMapFocusRequest(value => value + 1)} style={{ border: '1px solid #bae6fd', background: '#fff', color: '#0369a1', borderRadius: '7px', padding: '4px 7px', fontSize: '0.68em', fontWeight: 750, cursor: 'pointer' }}>Centrar</button>
                                  <button type="button" onClick={() => setActiveMapSectionIndex(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', borderRadius: '7px', padding: '4px 7px', fontSize: '0.68em', fontWeight: 750, cursor: 'pointer' }}>Ver todas</button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
                {activeNavigationCount > 1 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '7px' }}>
                    <button type="button" onClick={() => navigateActiveItem(-1)} aria-label="Elemento anterior" style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: '9px', padding: '7px', fontWeight: 800, cursor: 'pointer' }}>← Anterior</button>
                    <span style={{ color: '#64748b', fontSize: '0.68em', fontWeight: 800, whiteSpace: 'nowrap' }}>{activeNavigationPosition || '—'} / {activeNavigationCount}</span>
                    <button type="button" onClick={() => navigateActiveItem(1)} aria-label="Elemento siguiente" style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: '9px', padding: '7px', fontWeight: 800, cursor: 'pointer' }}>Siguiente →</button>
                  </div>
                )}
              </div>
            )}
            {comentario && (
              <div style={{ ...sidebarSectionStyle, order: 4 }}>
                <span style={labelStyle}>Comentario</span>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.87em', lineHeight: 1.62, background: '#f8fafc', borderRadius: '10px', padding: '10px 14px', border: '1px solid #dbe3ee' }}>{renderBoldText(comentario)}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};

const sidebarSectionStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d8e1ec',
  borderRadius: '10px',
  padding: '12px',
  boxShadow: '0 3px 9px rgba(15,23,42,0.06)',
};

const compactSidebarSectionStyle: React.CSSProperties = {
  ...sidebarSectionStyle,
  padding: '10px',
  minWidth: 0,
};

const sidebarGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
};

const singleLineEllipsisStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#475569', fontSize: '0.64em', fontWeight: 800,
  letterSpacing: '0.125em', textTransform: 'uppercase', marginBottom: '7px',
};

export default ImageViewerModal;
