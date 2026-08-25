import React, { useId, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Pencil, X, Hand, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Shield } from 'lucide-react';
import { renderBoldText } from './BoldField';
import { IMAGE_VIEWER_VISIBILITY_EVENT, ImageViewerVisibilityDetail } from '../constants/uiEvents';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { InteractiveMapViewerSection } from './InteractiveMapViewerModal';
import laboratoryLogo from '../assets/logos/laboratorio.png';

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
  onPreviousPlate?: () => void;
  onNextPlate?: () => void;
  platePosition?: number;
  plateCount?: number;
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
const ZOOM_MAX = 6;
const MIN_DYNAMIC_MAX_ZOOM = 1.2;
const ZOOM_OVERSHOOT_FACTOR = 1.15;
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

interface RegionCalloutLayout {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  anchorX: number;
  anchorY: number;
  connectorX: number;
  connectorY: number;
  fontSize: number;
}

const closestPointOnRegion = (points: Array<{ x: number; y: number }>, target: { x: number; y: number }) => {
  let closest = points[0] ?? target;
  let closestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((target.x - point.x) * dx + (target.y - point.y) * dy) / lengthSquared, 0, 1);
    const candidate = { x: point.x + t * dx, y: point.y + t * dy };
    const distance = Math.hypot(candidate.x - target.x, candidate.y - target.y);
    if (distance < closestDistance) { closest = candidate; closestDistance = distance; }
  });
  return closest;
};

const rectanglesOverlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, gap = 0) => (
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
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
  onPreviousPlate,
  onNextPlate,
  platePosition,
  plateCount,
}) => {
  const { user } = useAuth();
  const sharpenFilterId = useId();
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

      const existing = groups.get(label);
      if (!existing) {
        groups.set(label, {
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

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [useZoomSource, setUseZoomSource] = useState(false);
  const [zoomSourceFailed, setZoomSourceFailed] = useState(false);
  const [isPlateImageLoading, setIsPlateImageLoading] = useState(false);

  const [zoomLevel, setZoomLevel]   = useState(1);
  const [position, setPosition]     = useState({ x: 0, y: 0 });
  const [rotation, setRotation]     = useState(0);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<'laser' | 'hand' | null>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const laserTrailRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const laserCurrentPosRef = useRef<{ x: number; y: number } | null>(null);
  const laserStabilizedPosRef = useRef<{ x: number; y: number } | null>(null);
  const laserPinchRef = useRef<{
    dist: number;
    startZoom: number;
    midX: number;
    midY: number;
    startPos: { x: number; y: number };
  } | null>(null);
  const normalPinchRef = useRef<{
    dist: number;
    startZoom: number;
    midX: number;
    midY: number;
    startPos: { x: number; y: number };
  } | null>(null);
  const lastPinchEndedAtRef = useRef(0);
  const pinchTouchStartAtRef = useRef(0);
  const isSpacePressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const laserAnimFrameRef = useRef<number | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const isMinimapDraggingRef = useRef(false);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(resolvedInitialMarkerIndex);
  const [markerRecenterRequest, setMarkerRecenterRequest] = useState(0);
  const [showCommentHint, setShowCommentHint] = useState(false);
  const [isCommentHintExiting, setIsCommentHintExiting] = useState(false);
  const [hoveredMarkerIndex, setHoveredMarkerIndex] = useState<number | null>(null);
  const [focusedMarkerIndex, setFocusedMarkerIndex] = useState<number | null>(null);
  const [hoveredNavigationId, setHoveredNavigationId] = useState<string | null>(null);
  const [pressedNavigationId, setPressedNavigationId] = useState<string | null>(null);
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Error al alternar pantalla completa:', err);
    }
  };

  const exitFullscreenSafely = () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error al salir de pantalla completa:', err);
    }
  };

  const handleCloseViewer = () => {
    exitFullscreenSafely();
    onClose();
  };

  useEffect(() => {
    return () => {
      exitFullscreenSafely();
    };
  }, []);
  const [viewerMode, setViewerMode] = useState<ViewerMode>(() => initialMarkerVisualMode);
  const [announcement, setAnnouncement] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pointerClipId = useId();
  const hasPlateNavigation = (plateCount ?? 0) > 1;
  const hasInfo = hasPlateDetails || hasInteractiveMapHint === true || loadingInteractiveMap || interactiveMapData !== null || hasPlateNavigation;

  const getNavigationButtonInteractionStyle = (id: string): React.CSSProperties => {
    const isHovered = hoveredNavigationId === id;
    const isPressed = pressedNavigationId === id;

    return {
      borderColor: isPressed ? '#5abbd8' : isHovered ? '#79cde5' : '#a8d9e9',
      boxShadow: isPressed
        ? '0 1px 4px rgba(15, 105, 135, 0.16)'
        : isHovered
          ? '0 7px 15px rgba(15, 105, 135, 0.2)'
          : '0 3px 9px rgba(15, 105, 135, 0.1)',
      transform: isPressed ? 'translateY(0) scale(0.96)' : isHovered ? 'translateY(-2px)' : 'none',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
    };
  };

  const activeMarkerIndices = useMemo(() => {
    if (activeMarkerIndex === null) return [];

    const activeMarker = senaladosItems[activeMarkerIndex];
    if (!activeMarker || !activeMarker.label.trim()) return [activeMarkerIndex];

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

  const regionCalloutLayouts = useMemo(() => {
    const layouts = new Map<number, RegionCalloutLayout>();
    if (!imageSize) return layouts;
    const margin = 8 / zoomLevel;
    const gap = 13 / zoomLevel;
    const placedBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    const regions = activeMarkerIndices.map(markerIndex => {
      const marker = senaladosItems[markerIndex];
      const points = marker?.regionPoints && marker.regionPoints.length >= 6
        ? Array.from({ length: marker.regionPoints.length / 2 }, (_, index) => ({
            x: marker.regionPoints![index * 2] * imageSize.width,
            y: marker.regionPoints![index * 2 + 1] * imageSize.height,
          }))
        : [];
      const xs = points.map(point => point.x);
      const ys = points.map(point => point.y);
      return { markerIndex, marker, points, bounds: points.length ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) } : null };
    }).filter(region => region.bounds && region.marker);

    regions.forEach(region => {
      const { markerIndex, marker, points, bounds } = region;
      if (!marker || !bounds) return;
      const boxHeight = 32 / zoomLevel;
      const boxWidth = Math.min(Math.max(112, 54 + marker.label.length * 6.2) / zoomLevel, Math.max(80 / zoomLevel, imageSize.width - margin * 2));
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const rawCandidates = [
        { x: centerX - boxWidth / 2, y: bounds.minY - boxHeight - gap },
        { x: centerX - boxWidth / 2, y: bounds.maxY + gap },
        { x: bounds.maxX + gap, y: centerY - boxHeight / 2 },
        { x: bounds.minX - boxWidth - gap, y: centerY - boxHeight / 2 },
        { x: centerX - boxWidth / 2, y: bounds.minY - boxHeight - gap - boxHeight },
        { x: centerX - boxWidth / 2, y: bounds.maxY + gap + boxHeight },
      ];
      const candidates = rawCandidates.map(candidate => ({
        x: clamp(candidate.x, margin, Math.max(margin, imageSize.width - boxWidth - margin)),
        y: clamp(candidate.y, margin, Math.max(margin, imageSize.height - boxHeight - margin)),
        width: boxWidth,
        height: boxHeight,
      }));
      const scored = candidates.map((candidate, order) => {
        const labelCollisions = placedBoxes.filter(box => rectanglesOverlap(candidate, box, 5 / zoomLevel)).length;
        const regionCollisions = regions.filter(other => other.markerIndex !== markerIndex && other.bounds && rectanglesOverlap(candidate, {
          x: other.bounds.minX, y: other.bounds.minY, width: other.bounds.maxX - other.bounds.minX, height: other.bounds.maxY - other.bounds.minY,
        }, 2 / zoomLevel)).length;
        const ownCollision = rectanglesOverlap(candidate, { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY });
        return { candidate, score: labelCollisions * 10000 + regionCollisions * 1000 + (ownCollision ? 500 : 0) + order };
      }).sort((a, b) => a.score - b.score);
      const box = scored[0].candidate;
      placedBoxes.push(box);
      const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const connector = closestPointOnRegion(points, boxCenter);
      const dx = connector.x - boxCenter.x;
      const dy = connector.y - boxCenter.y;
      const anchor = Math.abs(dx) > Math.abs(dy)
        ? { x: dx > 0 ? box.x + box.width : box.x, y: clamp(connector.y, box.y + 6 / zoomLevel, box.y + box.height - 6 / zoomLevel) }
        : { x: clamp(connector.x, box.x + 12 / zoomLevel, box.x + box.width - 12 / zoomLevel), y: dy > 0 ? box.y + box.height : box.y };
      layouts.set(markerIndex, {
        boxX: box.x, boxY: box.y, boxWidth: box.width, boxHeight: box.height,
        anchorX: anchor.x, anchorY: anchor.y, connectorX: connector.x, connectorY: connector.y,
        fontSize: clamp(((box.width * zoomLevel - 18) / Math.max(1, marker.label.length * 0.62)), 8, 12) / zoomLevel,
      });
    });
    return layouts;
  }, [activeMarkerIndices, imageSize, senaladosItems, zoomLevel]);

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
  const touchGestureRef = useRef<{ x: number; y: number; startedAt: number } | null>(null);
  const lastTapAtRef = useRef(0);
  const commentHintTimeoutRef = useRef<number | null>(null);
  const commentHintExitTimeoutRef = useRef<number | null>(null);
  const handledMapFocusRequestRef = useRef(0);

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
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
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

  const handlePlateNavigation = (navigate?: () => void) => {
    if (!navigate || isPlateImageLoading) return;
    setIsPlateImageLoading(true);
    setImageSize(null);
    setImageNaturalSize(null);
    navigate();
  };

  const effectiveMaxZoom = useMemo(() => {
    return computeDynamicMaxZoom(imageSize, imageNaturalSize);
  }, [imageSize, imageNaturalSize]);

  // Perceptual enhancement calculations (Atlas Microscope Optical Standard)
  const perceptualEnhanceLevel = useMemo(() => {
    if (zoomLevel <= 1.25) return 0;
    const span = Math.max(0.001, effectiveMaxZoom - 1.25);
    return clamp((zoomLevel - 1.25) / span, 0, 1);
  }, [zoomLevel, effectiveMaxZoom]);

  const sharpenK = useMemo(() => {
    if (zoomLevel <= 1.25) return 0;
    const factor = clamp((zoomLevel - 1.25) / 3.0, 0, 1);
    return 0.08 + Math.pow(factor, 0.9) * 0.24;
  }, [zoomLevel]);

  const imageFilterStyle = useMemo(() => {
    if (perceptualEnhanceLevel <= 0) return 'none';
    const boosted = Math.pow(perceptualEnhanceLevel, 1.25);
    const contrast = 1 + boosted * 0.14;
    const saturate = 1 + boosted * 0.06;
    const brightness = 1 + boosted * 0.018;
    const svgFilter = sharpenK > 0 ? `url(#${CSS.escape ? CSS.escape(sharpenFilterId) : sharpenFilterId})` : '';
    return `${svgFilter} contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)}) drop-shadow(0 0 0.35px rgba(0,0,0,0.45))`.trim();
  }, [perceptualEnhanceLevel, sharpenK, sharpenFilterId]);

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

  const addLaserPoint = (rawX: number, rawY: number) => {
    const now = performance.now();
    const trail = laserTrailRef.current;

    // Estabilizador Streamline de pulso (amortiguador de temblor)
    const prevStable = laserStabilizedPosRef.current ?? { x: rawX, y: rawY };
    const smoothFactor = 0.38;
    const sx = prevStable.x + (rawX - prevStable.x) * smoothFactor;
    const sy = prevStable.y + (rawY - prevStable.y) * smoothFactor;
    laserStabilizedPosRef.current = { x: sx, y: sy };
    laserCurrentPosRef.current = { x: sx, y: sy };

    const lastPoint = trail.length > 0 ? trail[trail.length - 1] : null;

    if (lastPoint) {
      const dx = sx - lastPoint.x;
      const dy = sy - lastPoint.y;
      const dist = Math.hypot(dx, dy);

      // Si el cursor se mueve muy poco, evitamos acumulación
      if (dist < 4) {
        return;
      }

      // Si el movimiento es rápido, interpolamos para mantener densidad homogénea
      if (dist > 14) {
        const steps = Math.min(5, Math.floor(dist / 7));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          trail.push({
            x: lastPoint.x + dx * t,
            y: lastPoint.y + dy * t,
            time: lastPoint.time + (now - lastPoint.time) * t,
          });
        }
      }
    }

    trail.push({ x: sx, y: sy, time: now });
  };

  useEffect(() => {
    const canvas = laserCanvasRef.current;
    if (!canvas) return;

    let running = true;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Duración de la estela (~1750ms)
    const TRAIL_LIFETIME = 1750;

    const render = () => {
      if (!running) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const now = performance.now();
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        laserTrailRef.current = laserTrailRef.current.filter(p => now - p.time < TRAIL_LIFETIME);
        const rawPoints = laserTrailRef.current;

        if (rawPoints.length >= 2) {
          // Generador de Curva Spline Catmull-Rom continua (tensión = 0.5)
          // Elimina cualquier quiebre angular o irregularidad por falta de pulso
          const generateSmoothSpline = (pts: typeof rawPoints, stepsPerSeg = 5): typeof rawPoints => {
            if (pts.length < 3) return pts;
            const res: typeof rawPoints = [];
            const ext = [pts[0], ...pts, pts[pts.length - 1]];

            for (let i = 1; i < ext.length - 2; i++) {
              const p0 = ext[i - 1];
              const p1 = ext[i];
              const p2 = ext[i + 1];
              const p3 = ext[i + 2];

              for (let s = 0; s < stepsPerSeg; s++) {
                const t = s / stepsPerSeg;
                const t2 = t * t;
                const t3 = t2 * t;

                const f1 = -0.5 * t3 + t2 - 0.5 * t;
                const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
                const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
                const f4 = 0.5 * t3 - 0.5 * t2;

                const cx = p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4;
                const cy = p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4;
                const ctime = p1.time + (p2.time - p1.time) * t;

                res.push({ x: cx, y: cy, time: ctime });
              }
            }

            res.push(pts[pts.length - 1]);
            return res;
          };

          const points = generateSmoothSpline(rawPoints, 5);

          const drawLaserRibbon = (
            baseWidth: number,
            r: number,
            g: number,
            b: number,
            baseAlpha: number
          ) => {
            const n = points.length;
            if (n < 2) return;

            const rawNormals: Array<{ nx: number; ny: number }> = [];
            const alphas: number[] = [];

            for (let i = 0; i < n; i++) {
              const p = points[i];
              const age = now - p.time;
              const progress = Math.max(0, Math.min(1, age / TRAIL_LIFETIME));
              const alpha = Math.pow(1 - progress, 1.25);
              alphas.push(alpha);

              let tx = 0;
              let ty = 0;
              if (i === 0) {
                tx = points[1].x - p.x;
                ty = points[1].y - p.y;
              } else if (i === n - 1) {
                tx = p.x - points[n - 2].x;
                ty = p.y - points[n - 2].y;
              } else {
                tx = points[i + 1].x - points[i - 1].x;
                ty = points[i + 1].y - points[i - 1].y;
              }

              const len = Math.hypot(tx, ty);
              if (len > 0.0001) {
                rawNormals.push({ nx: -ty / len, ny: tx / len });
              } else {
                rawNormals.push(i > 0 ? rawNormals[i - 1] : { nx: 0, ny: 1 });
              }
            }

            // Suavizado de normales para mantener grosor homogéneo
            const smoothNormals = rawNormals.map((norm, i, arr) => {
              if (i === 0 || i === arr.length - 1) return norm;
              const prev = arr[i - 1];
              const next = arr[i + 1];
              const sx = 0.25 * prev.nx + 0.5 * norm.nx + 0.25 * next.nx;
              const sy = 0.25 * prev.ny + 0.5 * norm.ny + 0.25 * next.ny;
              const sLen = Math.hypot(sx, sy);
              return sLen > 0.0001 ? { nx: sx / sLen, ny: sy / sLen } : norm;
            });

            const lefts: Array<{ x: number; y: number }> = [];
            const rights: Array<{ x: number; y: number }> = [];

            for (let i = 0; i < n; i++) {
              const p = points[i];
              const norm = smoothNormals[i];
              const alpha = alphas[i];
              const halfW = (baseWidth * alpha + 0.4) / 2;
              lefts.push({ x: p.x + norm.nx * halfW, y: p.y + norm.ny * halfW });
              rights.push({ x: p.x - norm.nx * halfW, y: p.y - norm.ny * halfW });
            }

            for (let i = 1; i < n; i++) {
              const a0 = alphas[i - 1];
              const a1 = alphas[i];
              const avgAlpha = (a0 + a1) / 2;
              if (avgAlpha <= 0.01) continue;

              const L0 = lefts[i - 1];
              const L1 = lefts[i];
              const R1 = rights[i];
              const R0 = rights[i - 1];

              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(avgAlpha * baseAlpha).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(L0.x, L0.y);
              ctx.lineTo(L1.x, L1.y);
              ctx.lineTo(R1.x, R1.y);
              ctx.lineTo(R0.x, R0.y);
              ctx.closePath();
              ctx.fill();
            }

            const tailAlpha = alphas[0];
            if (tailAlpha > 0.02) {
              const tailW = (baseWidth * tailAlpha + 0.4) / 2;
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(tailAlpha * baseAlpha).toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(points[0].x, points[0].y, tailW, 0, Math.PI * 2);
              ctx.fill();
            }
          };

          // Capa 1: Halo exterior amplio neón carmesí
          drawLaserRibbon(16, 255, 15, 65, 0.28);
          // Capa 2: Resplandor medio rojo neón eléctrico
          drawLaserRibbon(7.5, 255, 30, 75, 0.68);
          // Capa 3: Haz de luz de alta intensidad
          drawLaserRibbon(3.4, 255, 110, 140, 0.88);
          // Capa 4: Núcleo blanco-rosado incandescente
          drawLaserRibbon(1.5, 255, 255, 255, 0.98);
        }

        if (isAnnotationMode && annotationTool === 'laser' && laserCurrentPosRef.current) {
          const { x, y } = laserCurrentPosRef.current;
          const gradient = ctx.createRadialGradient(x, y, 1, x, y, 14);
          gradient.addColorStop(0, 'rgba(255, 20, 65, 0.95)');
          gradient.addColorStop(0.35, 'rgba(255, 35, 80, 0.55)');
          gradient.addColorStop(1, 'rgba(255, 35, 80, 0)');

          ctx.beginPath();
          ctx.arc(x, y, 14, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x, y, 4.2, 0, Math.PI * 2);
          ctx.fillStyle = '#ff0f3f';
          ctx.shadowColor = '#ff003b';
          ctx.shadowBlur = 9;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x, y, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 3;
          ctx.fill();
        }

        ctx.restore();
      }

      laserAnimFrameRef.current = requestAnimationFrame(render);
    };

    laserAnimFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      window.removeEventListener('resize', resizeCanvas);
      if (laserAnimFrameRef.current !== null) {
        cancelAnimationFrame(laserAnimFrameRef.current);
      }
    };
  }, [isAnnotationMode, annotationTool]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = laserCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getTouchCoords = (touch: React.Touch) => {
    const canvas = laserCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

    const clampPositionToViewport = (
    nextPos: { x: number; y: number },
    zoom: number,
    displayedSize: { width: number; height: number } | null,
    containerSize: { width: number; height: number }
  ) => {
    if (!displayedSize || zoom <= 1.001) {
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

const panBy = (dx: number, dy: number) => {
    const containerEl = containerRef.current;
    const containerSize = containerEl ? { width: containerEl.clientWidth, height: containerEl.clientHeight } : { width: 800, height: 600 };
    const targetPos = {
      x: stateRef.current.pos.x + dx,
      y: stateRef.current.pos.y + dy,
    };
    const clamped = clampPositionToViewport(targetPos, stateRef.current.zoom, imageSize, containerSize);
    stateRef.current.zoom = stateRef.current.zoom;
    stateRef.current.pos = clamped;
    setPosition(clamped);
  };

  const panToMinimapCoord = (clientX: number, clientY: number) => {
    const miniEl = minimapRef.current;
    const frame = containerRef.current;
    if (!miniEl || !imageSize || stateRef.current.zoom <= 1.02) return;

    const rect = miniEl.getBoundingClientRect();
    const mx = clamp(clientX - rect.left, 0, rect.width);
    const my = clamp(clientY - rect.top, 0, rect.height);

    const targetImgX = (mx / rect.width) * imageSize.width;
    const targetImgY = (my / rect.height) * imageSize.height;

    const targetPos = {
      x: (imageSize.width / 2 - targetImgX) * stateRef.current.zoom,
      y: (imageSize.height / 2 - targetImgY) * stateRef.current.zoom,
    };

    const containerSize = frame
      ? { width: frame.clientWidth, height: frame.clientHeight }
      : { width: 800, height: 600 };

    const clamped = clampPositionToViewport(targetPos, stateRef.current.zoom, imageSize, containerSize);
    stateRef.current.pos = clamped;
    setPosition(clamped);
  };

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isMinimapDraggingRef.current = true;
    isDraggingRef.current = true;
    setIsDragging(true);
    panToMinimapCoord(e.clientX, e.clientY);
  };

  const handleMinimapTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    isMinimapDraggingRef.current = true;
    isDraggingRef.current = true;
    setIsDragging(true);
    panToMinimapCoord(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotationMode) return;

    // Clic derecho (button === 2), clic de rueda central (button === 1), modo mano activo con clic izquierdo o barra espaciadora
    const isHandLeftClick = annotationTool === 'hand' && e.button === 0;
    const shouldPan = e.button === 2 || e.button === 1 || isHandLeftClick || isSpacePressedRef.current;

    if (shouldPan) {
      if (stateRef.current.zoom > 1) {
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX - stateRef.current.pos.x,
          y: e.clientY - stateRef.current.pos.y,
        };
      }
      laserCurrentPosRef.current = null;
      return;
    }

    if (annotationTool === 'laser' && e.button === 0) {
      const { x, y } = getCanvasCoords(e);
      laserStabilizedPosRef.current = { x, y };
      addLaserPoint(x, y);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotationMode) return;

    // Si no hay ningún botón de ratón presionado, asegurar que se desactive el arrastre
    if (e.buttons === 0 && isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }

    // Arrastre con ratón para mover la placa (clic derecho, rueda, mano o espacio)
    if (isDraggingRef.current && stateRef.current.zoom > 1) {
      if (e.buttons === 0) {
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      const newPos = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      stateRef.current.pos = newPos;
      setPosition(newPos);
      laserCurrentPosRef.current = null;
      return;
    }

    if (annotationTool === 'laser' && !isSpacePressedRef.current) {
      const { x, y } = getCanvasCoords(e);
      addLaserPoint(x, y);
    }
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleCanvasMouseEnter = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotationMode) return;
    if (annotationTool === 'laser' && !isSpacePressedRef.current) {
      const { x, y } = getCanvasCoords(e);
      laserStabilizedPosRef.current = { x, y };
      laserCurrentPosRef.current = { x, y };
    }
  };

  const handleCanvasMouseLeave = () => {
    laserCurrentPosRef.current = null;
    laserStabilizedPosRef.current = null;
  };

  const getTouchDistance = (t0: { clientX: number; clientY: number }, t1: { clientX: number; clientY: number }) => {
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  };

  const calculatePinchTransform = (
    t0: { clientX: number; clientY: number },
    t1: { clientX: number; clientY: number },
    pinchData: {
      dist: number;
      startZoom: number;
      midX: number;
      midY: number;
      startPos: { x: number; y: number };
    },
    containerEl: HTMLElement | null,
    displayedImageSize: { width: number; height: number } | null,
    maxZoom: number
  ) => {
    const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    if (pinchData.dist <= 0 || newDist <= 0) return null;

    const scale = newDist / pinchData.dist;
    const targetZoom = clamp(pinchData.startZoom * scale, ZOOM_MIN, maxZoom);

    const currentMidX = (t0.clientX + t1.clientX) / 2;
    const currentMidY = (t0.clientY + t1.clientY) / 2;

    const containerRect = containerEl?.getBoundingClientRect();
    const containerWidth = containerEl?.clientWidth ?? 800;
    const containerHeight = containerEl?.clientHeight ?? 600;
    const containerLeft = containerRect?.left ?? 0;
    const containerTop = containerRect?.top ?? 0;

    const containerCenterX = containerLeft + containerWidth / 2;
    const containerCenterY = containerTop + containerHeight / 2;

    const pRel0X = pinchData.midX - containerCenterX;
    const pRel0Y = pinchData.midY - containerCenterY;

    const pRelCurrX = currentMidX - containerCenterX;
    const pRelCurrY = currentMidY - containerCenterY;

    const zoomRatio = pinchData.startZoom > 0 ? targetZoom / pinchData.startZoom : 1;

    const rawX = pRelCurrX - (pRel0X - pinchData.startPos.x) * zoomRatio;
    const rawY = pRelCurrY - (pRel0Y - pinchData.startPos.y) * zoomRatio;

    const clampedPos = clampPositionToViewport(
      { x: rawX, y: rawY },
      targetZoom,
      displayedImageSize,
      { width: containerWidth, height: containerHeight }
    );

    return { targetZoom, clampedPos };
  };

  const handleLaserTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isAnnotationMode || !annotationTool || e.touches.length === 0) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      laserPinchRef.current = null;
      setIsPinching(false);
      pinchTouchStartAtRef.current = Date.now();

      if (Date.now() - lastPinchEndedAtRef.current < 160) {
        return;
      }

      const touch = e.touches[0];
      if (annotationTool === 'laser') {
        const { x, y } = getTouchCoords(touch);
        laserStabilizedPosRef.current = { x, y };
        addLaserPoint(x, y);
      } else if (annotationTool === 'hand') {
        if (stateRef.current.zoom > 1) {
          isDraggingRef.current = true;
          setIsDragging(true);
          dragStartRef.current = {
            x: touch.clientX - stateRef.current.pos.x,
            y: touch.clientY - stateRef.current.pos.y,
          };
        }
      }
    } else if (e.touches.length >= 2) {
      // 2 dedos en tablet: Zoom & Navegación / Pan ultra-fluido sin tirones CSS
      laserCurrentPosRef.current = null;
      laserStabilizedPosRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsPinching(true);

      // Si el primer dedo dejó un punto accidental en los últimos 120ms antes de que cayera el 2do dedo, limpiarlo
      if (Date.now() - pinchTouchStartAtRef.current < 120 && laserTrailRef.current.length > 0) {
        laserTrailRef.current = laserTrailRef.current.slice(0, -1);
      }

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = getTouchDistance(t0, t1);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;

      laserPinchRef.current = {
        dist,
        startZoom: stateRef.current.zoom,
        midX,
        midY,
        startPos: { ...stateRef.current.pos },
      };
    }
  };

  const handleLaserTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isAnnotationMode || !annotationTool || e.touches.length === 0) return;
    e.preventDefault();

    if (e.touches.length === 1 && !laserPinchRef.current) {
      if (Date.now() - lastPinchEndedAtRef.current < 160) {
        return;
      }

      const touch = e.touches[0];
      if (annotationTool === 'laser') {
        const { x, y } = getTouchCoords(touch);
        addLaserPoint(x, y);
      } else if (annotationTool === 'hand' && isDraggingRef.current && stateRef.current.zoom > 1) {
        const containerEl = containerRef.current;
        const containerSize = containerEl ? { width: containerEl.clientWidth, height: containerEl.clientHeight } : { width: 800, height: 600 };
        const rawNextPos = {
          x: touch.clientX - dragStartRef.current.x,
          y: touch.clientY - dragStartRef.current.y,
        };
        const clampedPos = clampPositionToViewport(rawNextPos, stateRef.current.zoom, imageSize, containerSize);
        stateRef.current.pos = clampedPos;
        setPosition(clampedPos);
      }
    } else if (e.touches.length >= 2 && laserPinchRef.current) {
      laserCurrentPosRef.current = null;
      laserStabilizedPosRef.current = null;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const pinchResult = calculatePinchTransform(
        t0,
        t1,
        laserPinchRef.current,
        containerRef.current,
        imageSize,
        effectiveMaxZoom
      );

      if (pinchResult) {
        stateRef.current.zoom = pinchResult.targetZoom;
        stateRef.current.pos = pinchResult.clampedPos;
        setZoomLevel(pinchResult.targetZoom);
        setPosition(pinchResult.clampedPos);
      }
    }
  };

  const handleLaserTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      if (laserPinchRef.current) {
        lastPinchEndedAtRef.current = Date.now();
      }
      laserPinchRef.current = null;
      setIsPinching(false);
    }
    if (e.touches.length === 0) {
      laserCurrentPosRef.current = null;
      laserStabilizedPosRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsPinching(false);
    }
  };

  useEffect(() => {
    const handleGlobalRelease = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
      if (isMinimapDraggingRef.current) {
        isMinimapDraggingRef.current = false;
      }
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('blur', handleGlobalRelease);
    window.addEventListener('contextmenu', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('blur', handleGlobalRelease);
      window.removeEventListener('contextmenu', handleGlobalRelease);
    };
  }, []);

  useEffect(() => {
    const handleGlobalMinimapMove = (e: MouseEvent) => {
      if (isMinimapDraggingRef.current) {
        panToMinimapCoord(e.clientX, e.clientY);
      }
    };
    const handleGlobalMinimapTouchMove = (e: TouchEvent) => {
      if (isMinimapDraggingRef.current && e.touches.length > 0) {
        panToMinimapCoord(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleGlobalMinimapUp = () => {
      if (isMinimapDraggingRef.current) {
        isMinimapDraggingRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMinimapMove);
    window.addEventListener('touchmove', handleGlobalMinimapTouchMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMinimapUp);
    window.addEventListener('touchend', handleGlobalMinimapUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMinimapMove);
      window.removeEventListener('touchmove', handleGlobalMinimapTouchMove);
      window.removeEventListener('mouseup', handleGlobalMinimapUp);
      window.removeEventListener('touchend', handleGlobalMinimapUp);
    };
  }, [imageSize]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragging(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C')) {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
        }
      }
      if (e.key === 'Escape') {
        if (isAnnotationMode) {
          setIsAnnotationMode(false);
          setAnnotationTool(null);
        } else {
          handleCloseViewer();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isAnnotationMode]);

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

    const applyZoom = (newZoom: number, newPos?: { x: number; y: number }, focalPoint?: { clientX: number; clientY: number }) => {
    const oldZoom = stateRef.current.zoom;
    const z = clamp(newZoom, ZOOM_MIN, effectiveMaxZoom);
    stateRef.current.zoom = z;
    setZoomLevel(z);

    const frame = containerRef.current;
    const containerSize = frame ? { width: frame.clientWidth, height: frame.clientHeight } : { width: 800, height: 600 };

    if (z <= 1.001) {
      stateRef.current.pos = { x: 0, y: 0 };
      setPosition({ x: 0, y: 0 });
      return;
    }

    let rawNextPos: { x: number; y: number };

    if (newPos) {
      rawNextPos = newPos;
    } else if (focalPoint && frame) {
      const rect = frame.getBoundingClientRect();
      const cursorX = focalPoint.clientX - (rect.left + rect.width / 2);
      const cursorY = focalPoint.clientY - (rect.top + rect.height / 2);
      const scaleFactor = oldZoom > 0 ? z / oldZoom : 1;
      rawNextPos = {
        x: cursorX - (cursorX - stateRef.current.pos.x) * scaleFactor,
        y: cursorY - (cursorY - stateRef.current.pos.y) * scaleFactor,
      };
    } else {
      const scaleFactor = oldZoom > 0 ? z / oldZoom : 1;
      rawNextPos = {
        x: stateRef.current.pos.x * scaleFactor,
        y: stateRef.current.pos.y * scaleFactor,
      };
    }

    const clampedPos = clampPositionToViewport(rawNextPos, z, imageSize, containerSize);
    stateRef.current.pos = clampedPos;
    setPosition(clampedPos);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractive = target?.closest('button, a, input, textarea, select, [role="button"]');
      if (!isInteractive) {
        e.preventDefault();
      }

      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;

        normalPinchRef.current = {
          dist,
          startZoom: stateRef.current.zoom,
          midX,
          midY,
          startPos: { ...stateRef.current.pos },
        };
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsPinching(true);
      } else if (e.touches.length === 1) {
        normalPinchRef.current = null;
        setIsPinching(false);
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
      const target = e.target as HTMLElement | null;
      const isInteractive = target?.closest('button, a, input, textarea, select, [role="button"]');
      if (!isInteractive) {
        e.preventDefault();
      }

      if (e.touches.length === 2 && normalPinchRef.current) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const pinchResult = calculatePinchTransform(
          t0,
          t1,
          normalPinchRef.current,
          containerRef.current,
          imageSize,
          effectiveMaxZoom
        );

        if (pinchResult) {
          stateRef.current.zoom = pinchResult.targetZoom;
          stateRef.current.pos = pinchResult.clampedPos;
          setZoomLevel(pinchResult.targetZoom);
          setPosition(pinchResult.clampedPos);
        }
      } else if (e.touches.length === 1 && isDraggingRef.current && stateRef.current.zoom > 1) {
        const containerEl = containerRef.current;
        const containerSize = containerEl ? { width: containerEl.clientWidth, height: containerEl.clientHeight } : { width: 800, height: 600 };
        const rawNextPos = {
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        };
        const clampedPos = clampPositionToViewport(rawNextPos, stateRef.current.zoom, imageSize, containerSize);
        stateRef.current.pos = clampedPos;
        setPosition(clampedPos);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (normalPinchRef.current) {
          lastPinchEndedAtRef.current = Date.now();
        }
        normalPinchRef.current = null;
        setIsPinching(false);
      }
      if (e.touches.length === 0) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsPinching(false);
        const gesture = touchGestureRef.current;
        const changedTouch = e.changedTouches[0];
        touchGestureRef.current = null;
        if (!gesture || !changedTouch) return;
        if (Date.now() - lastPinchEndedAtRef.current < 200) return;

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
  }, [effectiveMaxZoom, viewerMode, interactiveMapData, activeMapSectionIndex, activeMarkerIndex, groupedSenaladosItems, imageSize]);

  const handleZoomIn  = () => applyZoom(stateRef.current.zoom + 0.25);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - 0.25);
  const handleRotateCw = () => setRotation(r => (r + 90) % 360);
  const handleRotateCcw = () => setRotation(r => (r - 90 + 360) % 360);
  const handleResetViewport = () => {
    stateRef.current.zoom = 1;
    stateRef.current.pos = { x: 0, y: 0 };
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyZoom(stateRef.current.zoom + (e.deltaY < 0 ? 0.15 : -0.15), undefined, { clientX: e.clientX, clientY: e.clientY });
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
    if (e.buttons === 0 && isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      return;
    }
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
    const explicitFocusRequested = mapFocusRequest !== handledMapFocusRequestRef.current;
    handledMapFocusRequestRef.current = mapFocusRequest;

    const currentZoom = stateRef.current.zoom;
    const currentPosition = stateRef.current.pos;
    const screenLeft = containerWidth / 2 + currentPosition.x + (bounds.minX - imageSize.width / 2) * currentZoom;
    const screenRight = containerWidth / 2 + currentPosition.x + (bounds.maxX - imageSize.width / 2) * currentZoom;
    const screenTop = containerHeight / 2 + currentPosition.y + (bounds.minY - imageSize.height / 2) * currentZoom;
    const screenBottom = containerHeight / 2 + currentPosition.y + (bounds.maxY - imageSize.height / 2) * currentZoom;
    const zoneIsVisible = screenRight >= 20
      && screenLeft <= containerWidth - 20
      && screenBottom >= 20
      && screenTop <= containerHeight - 20;

    if (!explicitFocusRequested && zoneIsVisible) return;

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
      right: '16px',
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
    const desiredRight = containerWidth - visibleRight + 12;

    const top = Math.round(clamp(desiredTop, minTop, Math.max(minTop, containerHeight - 56)));
    const right = Math.round(clamp(desiredRight, 12, Math.max(12, containerWidth - 180)));
    const maxWidthByVisible = Math.max(180, Math.floor(visibleRight - visibleLeft - 24));
    const maxWidthByContainer = Math.max(180, Math.floor(containerWidth - right - 12));
    const maxWidth = Math.min(baseMaxWidth, maxWidthByVisible, maxWidthByContainer);

    return {
      top: `${top}px`,
      right: `${right}px`,
      maxWidth: `${maxWidth}px`,
    };
  }, [hasInfo, imageSize, isDesktop, position.x, position.y, zoomLevel]);

  const showSidebar = !hideSidebar && hasInfo && sidebarOpen;
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
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
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
        {`img, svg, canvas {
          -webkit-user-drag: none !important;
          -khtml-user-drag: none !important;
          -moz-user-drag: none !important;
          -o-user-drag: none !important;
          user-drag: none !important;
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        @keyframes senaladoCardIn {
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
            transform: translate3d(10px, -4px, 0) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes commentHintOut {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(8px, -4px, 0) scale(0.98);
          }
        }
        @keyframes commentHintProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
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
        }
        @keyframes specialBarIn {
          0% { opacity: 0; transform: translate3d(-50%, 14px, 0) scale(0.95); }
          100% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
        }`}
      </style>
      <div style={{
        flex: 1, position: 'relative', background: 'radial-gradient(ellipse at top, #334155 0%, #0f172a 58%, #020617 100%)',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Canvas de estela de luz / Puntero Láser y Paneo */}
        <canvas
          ref={laserCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: isAnnotationMode ? 'auto' : 'none',
            zIndex: 10,
            cursor: isSpacePressed || isDragging
              ? (isDragging ? 'grabbing' : 'grab')
              : (annotationTool === 'hand' ? (isDragging ? 'grabbing' : 'grab') : (annotationTool === 'laser' ? 'none' : 'default')),
            touchAction: 'none',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseEnter={handleCanvasMouseEnter}
          onMouseLeave={handleCanvasMouseLeave}
          onTouchStart={handleLaserTouchStart}
          onTouchMove={handleLaserTouchMove}
          onTouchEnd={handleLaserTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={handleWheel}
        />

        <button
          onClick={handleCloseViewer}
          title="Cerrar visor"
          aria-label="Cerrar visor"
          style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'linear-gradient(135deg, rgba(255,250,250,0.98) 0%, rgba(254,226,226,0.95) 100%)',
            color: '#991b1b', border: '1.5px solid rgba(248,113,113,0.8)',
            borderRadius: '10px', height: '40px', padding: '0 13px 0 10px', minWidth: '100px',
            fontSize: '0.79em', letterSpacing: '0.03em', textTransform: 'uppercase',
            cursor: 'pointer', fontWeight: 800, zIndex: 25,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(7px) saturate(120%)',
            boxShadow: '0 7px 18px rgba(220,38,38,0.26), inset 0 1px 0 rgba(255,255,255,0.86)',
            fontFamily: 'inherit',
            transition: 'all 0.18s ease',
            gap: '8px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
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

        {!hideSidebar && hasInfo && !showSidebar && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="Mostrar barra lateral"
            aria-label="Mostrar barra lateral"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(239, 246, 255, 0.92) 100%)',
              color: '#0284c7',
              border: '1.5px solid rgba(186, 230, 253, 0.9)',
              borderRadius: '10px',
              width: '40px',
              height: '40px',
              minWidth: '40px',
              minHeight: '40px',
              cursor: 'pointer',
              zIndex: 25,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(12px) saturate(140%)',
              boxShadow: '0 8px 24px rgba(15, 75, 105, 0.2), inset 0 1px 0 rgba(255,255,255,0.92)',
              transition: 'all 0.18s ease, transform 0.12s ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.06)';
              e.currentTarget.style.borderColor = '#38bdf8';
              e.currentTarget.style.color = '#0369a1';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(14, 165, 233, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'rgba(186, 230, 253, 0.9)';
              e.currentTarget.style.color = '#0284c7';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 75, 105, 0.2), inset 0 1px 0 rgba(255,255,255,0.92)';
            }}
          >
            <PanelRightOpen size={19} strokeWidth={2.4} />
          </button>
        )}

        {showCommentHint && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              ...commentHintPlacement,
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr)',
              alignItems: 'center',
              gap: '11px',
              padding: isDesktop ? '12px 14px' : '10px 12px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.97), rgba(240,249,255,0.95))',
              border: '1px solid rgba(125,211,252,0.72)',
              color: '#0f172a',
              boxShadow: '0 14px 32px rgba(14,116,144,0.16), inset 0 1px 0 rgba(255,255,255,0.92)',
              zIndex: 10,
              backdropFilter: 'blur(14px) saturate(120%)',
              pointerEvents: 'none',
              overflow: 'hidden',
              willChange: 'transform, opacity',
              animation: isCommentHintExiting
                ? `commentHintOut ${COMMENT_HINT_EXIT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`
                : 'commentHintIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: isDesktop ? '38px' : '34px', height: isDesktop ? '38px' : '34px', borderRadius: '12px', color: '#ffffff', background: 'linear-gradient(145deg,#38bdf8,#2563eb)', boxShadow: '0 6px 16px rgba(37,99,235,.22)', fontSize: isDesktop ? '1.05em' : '.95em', fontWeight: 950 }}>i</span>
            <span style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
              <span style={{ color: '#0284c7', fontSize: '0.65em', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tip rápido</span>
              <span style={{ color: '#0f172a', fontWeight: 850, fontSize: isDesktop ? '0.94em' : '0.86em', lineHeight: 1.15 }}>Revisa el comentario</span>
              <span style={{ color: '#475569', fontWeight: 550, fontSize: isDesktop ? '0.76em' : '0.71em', lineHeight: 1.3 }}>Encontrarás información útil sobre esta placa.</span>
            </span>
            <span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, left: 0, height: '3px', background: 'rgba(14,165,233,.12)' }}>
              <span style={{ display: 'block', width: '100%', height: '100%', transformOrigin: 'left', background: 'linear-gradient(90deg,#38bdf8,#22d3ee)', animation: prefersReducedMotion || isCommentHintExiting ? 'none' : `commentHintProgress ${COMMENT_HINT_DURATION_MS - COMMENT_HINT_EXIT_MS}ms linear forwards` }} />
            </span>
          </div>
        )}

        {isPlateImageLoading && (
          <div
            className="plate-navigation-loading"
            role="status"
            aria-live="polite"
            aria-label="Cargando la placa seleccionada"
          >
            <div className="plate-navigation-loading__card">
              <div className="atlas-loading-logo-wrap" aria-hidden="true">
                <span className="atlas-loading-orbit"><i /></span>
                <img className="atlas-loading-logo" src={laboratoryLogo} alt="" />
              </div>
              <div className="atlas-loading-copy">
                <strong>Cargando placa</strong>
                <span>Preparando la imagen...</span>
              </div>
              <span className="atlas-loading-progress" aria-hidden="true"><i /></span>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
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
          {/* SVG Filter Definitions for Optical Sharpening */}
          <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
            <defs>
              <filter id={sharpenFilterId} x="-10%" y="-10%" width="120%" height="120%">
                <feConvolveMatrix
                  order="3"
                  kernelMatrix={`0 -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} ${(1 + 4 * sharpenK).toFixed(3)} -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} 0`}
                  preserveAlpha="true"
                />
              </filter>
            </defs>
          </svg>

          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              transition: (isDragging || isPinching || prefersReducedMotion) ? 'none' : 'transform 0.3s ease',
            }}
          >
            <img
              ref={imageRef}
              src={useZoomSource && srcZoom ? srcZoom : src}
              alt="Vista ampliada"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              onLoad={() => {
                updateImageSize();
                setIsPlateImageLoading(false);
              }}
              onError={() => {
                setIsPlateImageLoading(false);
                if (useZoomSource) {
                  setUseZoomSource(false);
                  setZoomSourceFailed(true);
                }
              }}
              style={{
                maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                objectPosition: 'center center',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                WebkitTouchCallout: 'none',
                pointerEvents: 'none',
                display: 'block',
                filter: imageFilterStyle,
                imageRendering: zoomLevel > 1.2 ? ('-webkit-optimize-contrast' as any) : 'auto',
                willChange: 'transform',
              } as React.CSSProperties}
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
                          strokeDasharray="6 4"
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
                          {regionPixelPoints.length < 3 && (markerVisualMode === 'arrow' ? (
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
                          ))}
                          {false && regionPixelPoints.length >= 3 && (
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
                    {activeMarkerIndices.map(markerIndex => {
                      const marker = senaladosItems[markerIndex];
                      const layout = regionCalloutLayouts.get(markerIndex);
                      if (!marker || !layout) return null;
                      return (
                        <g key={`region-callout-${markerIndex}`} pointerEvents="none" style={{ animation: prefersReducedMotion ? 'none' : 'mapCalloutIn 280ms cubic-bezier(0.22,1,0.36,1) both' }}>
                          <line x1={layout.anchorX} y1={layout.anchorY} x2={layout.connectorX} y2={layout.connectorY} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                          <line x1={layout.anchorX} y1={layout.anchorY} x2={layout.connectorX} y2={layout.connectorY} stroke={marker.regionColor ?? '#22c55e'} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                          <rect x={layout.boxX + 2 / zoomLevel} y={layout.boxY + 3 / zoomLevel} width={layout.boxWidth} height={layout.boxHeight} rx={9 / zoomLevel} fill="rgba(15,23,42,0.25)" />
                          <rect x={layout.boxX} y={layout.boxY} width={layout.boxWidth} height={layout.boxHeight} rx={9 / zoomLevel} fill="rgba(255,255,255,0.98)" stroke={marker.regionColor ?? '#22c55e'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                          <text x={layout.boxX + layout.boxWidth / 2} y={layout.boxY + layout.boxHeight / 2 + 0.5 / zoomLevel} fill="#111827" fontSize={layout.fontSize} fontWeight="750" fontFamily="Montserrat, Segoe UI, sans-serif" textAnchor="middle" dominantBaseline="middle">{marker.label}</text>
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
          const miniWidth = isDesktop ? 136 : 108;
          const miniHeight = Math.max(58, Math.min(108, (miniWidth * imageSize.height) / imageSize.width));
          const frameWidth = frame?.clientWidth ?? imageSize.width;
          const frameHeight = frame?.clientHeight ?? imageSize.height;
          const visibleWidth = Math.min(imageSize.width, frameWidth / zoomLevel);
          const visibleHeight = Math.min(imageSize.height, frameHeight / zoomLevel);
          const visibleLeft = clamp(imageSize.width / 2 + (-frameWidth / 2 - position.x) / zoomLevel, 0, Math.max(0, imageSize.width - visibleWidth));
          const visibleTop = clamp(imageSize.height / 2 + (-frameHeight / 2 - position.y) / zoomLevel, 0, Math.max(0, imageSize.height - visibleHeight));

          return (
            <div
              ref={minimapRef}
              role="region"
              aria-label="Minimapa de navegación interactivo"
              title="Clic o arrastra para moverte rápidamente por la placa"
              onMouseDown={handleMinimapMouseDown}
              onTouchStart={handleMinimapTouchStart}
              style={{
                position: 'absolute',
                left: '16px',
                bottom: '18px',
                width: `${miniWidth}px`,
                height: `${miniHeight}px`,
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid rgba(255, 255, 255, 0.92)',
                background: '#0f172a',
                boxShadow: '0 8px 24px rgba(2, 6, 23, 0.4), 0 0 12px rgba(56, 189, 248, 0.25)',
                zIndex: 14,
                cursor: 'crosshair',
                touchAction: 'none',
                userSelect: 'none',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(2, 6, 23, 0.5), 0 0 16px rgba(56, 189, 248, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.92)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(2, 6, 23, 0.4), 0 0 12px rgba(56, 189, 248, 0.25)';
              }}
            >
              <img
                src={src}
                alt="Minimapa de la placa"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  opacity: 0.82,
                  pointerEvents: 'none',
                  display: 'block',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: `${(visibleLeft / imageSize.width) * miniWidth}px`,
                  top: `${(visibleTop / imageSize.height) * miniHeight}px`,
                  width: `${(visibleWidth / imageSize.width) * miniWidth}px`,
                  height: `${(visibleHeight / imageSize.height) * miniHeight}px`,
                  border: '2px solid #38bdf8',
                  background: 'rgba(56, 189, 248, 0.22)',
                  boxSizing: 'border-box',
                  borderRadius: '3px',
                  boxShadow: '0 0 8px rgba(56, 189, 248, 0.6), inset 0 0 4px rgba(56, 189, 248, 0.3)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          );
        })()}

        {/* Barra de herramientas vertical fija al lado de la barra lateral (Modo normal) */}
        {!isAnnotationMode && (
          <div
            role="toolbar"
            aria-label="Controles de zoom y visualización"
            style={{
              position: 'absolute',
              top: '50%',
              right: isDesktop ? '16px' : '12px',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px) saturate(140%)',
              padding: '10px 5px',
              borderRadius: '24px',
              boxShadow: '0 8px 26px rgba(15, 75, 105, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(186, 230, 253, 0.85)',
              zIndex: 20,
              userSelect: 'none',
              width: '46px',
              boxSizing: 'border-box',
              flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            {/* Botón Zoom In */}
            <button
              type="button"
              onClick={handleZoomIn}
              title="Acercar imagen (+)"
              aria-label="Acercar imagen"
              style={{
                background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <ZoomIn size={16} strokeWidth={2.4} />
            </button>

            {/* Indicador de porcentaje con clic para 100% */}
            <button
              type="button"
              onClick={handleResetViewport}
              title="Clic para volver al 100%"
              aria-label={`Zoom actual ${Math.round(zoomLevel * 100)}%. Clic para 100%`}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f172a',
                fontWeight: 800,
                textAlign: 'center',
                fontSize: '0.74em',
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: '2px 0',
                lineHeight: 1.1,
                width: '36px',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            {/* Botón Zoom Out */}
            <button
              type="button"
              onClick={handleZoomOut}
              title="Alejar imagen (-)"
              aria-label="Alejar imagen"
              style={{
                background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <ZoomOut size={16} strokeWidth={2.4} />
            </button>

            <div style={{ width: '26px', height: '1px', background: 'rgba(186, 230, 253, 0.85)', margin: '2px 0', flexShrink: 0 }} />

            {/* Presets rápidos */}
            <button
              type="button"
              onClick={() => applyZoom(1)}
              title="Ajustar al 100%"
              style={{
                border: Math.abs(zoomLevel - 1) < 0.05 ? '1px solid #38bdf8' : '1px solid #e2e8f0',
                background: Math.abs(zoomLevel - 1) < 0.05 ? '#e0f2fe' : '#ffffff',
                color: Math.abs(zoomLevel - 1) < 0.05 ? '#0369a1' : '#475569',
                borderRadius: '7px',
                padding: '2px 0',
                width: '34px',
                height: '24px',
                fontWeight: 800,
                fontSize: '0.72em',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              1x
            </button>
            <button
              type="button"
              onClick={() => applyZoom(Math.min(2, effectiveMaxZoom))}
              title="Zoom 2x"
              style={{
                border: Math.abs(zoomLevel - 2) < 0.1 ? '1px solid #38bdf8' : '1px solid #e2e8f0',
                background: Math.abs(zoomLevel - 2) < 0.1 ? '#e0f2fe' : '#ffffff',
                color: Math.abs(zoomLevel - 2) < 0.1 ? '#0369a1' : '#475569',
                borderRadius: '7px',
                padding: '2px 0',
                width: '34px',
                height: '24px',
                fontWeight: 800,
                fontSize: '0.72em',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              2x
            </button>

            <div style={{ width: '26px', height: '1px', background: 'rgba(186, 230, 253, 0.85)', margin: '2px 0', flexShrink: 0 }} />

            {/* Botón Rotar 90° Horario */}
            <button
              type="button"
              onClick={handleRotateCw}
              title={`Rotar 90° a la derecha (actual: ${rotation}°)`}
              aria-label="Rotar 90° a la derecha"
              style={{
                border: rotation !== 0 ? '1px solid #38bdf8' : '1px solid #bae6fd',
                background: rotation !== 0 ? '#f0f9ff' : '#ffffff',
                color: rotation !== 0 ? '#0284c7' : '#0369a1',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px rgba(15, 75, 105, 0.08)',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = rotation !== 0 ? '#38bdf8' : '#bae6fd';
              }}
            >
              <RotateCw size={15} strokeWidth={2.4} />
            </button>

            {/* Botón Rotar 90° Antihorario */}
            <button
              type="button"
              onClick={handleRotateCcw}
              title={`Rotar 90° a la izquierda (actual: ${rotation}°)`}
              aria-label="Rotar 90° a la izquierda"
              style={{
                border: rotation !== 0 ? '1px solid #38bdf8' : '1px solid #bae6fd',
                background: rotation !== 0 ? '#f0f9ff' : '#ffffff',
                color: rotation !== 0 ? '#0284c7' : '#0369a1',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px rgba(15, 75, 105, 0.08)',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = rotation !== 0 ? '#38bdf8' : '#bae6fd';
              }}
            >
              <RotateCcw size={15} strokeWidth={2.4} />
            </button>

            <div style={{ width: '26px', height: '1px', background: 'rgba(186, 230, 253, 0.85)', margin: '2px 0', flexShrink: 0 }} />

            {/* Botón Recentrar */}
            <button
              type="button"
              onClick={handleResetViewport}
              disabled={zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5 && rotation === 0}
              title="Recentrar vista y orientación"
              aria-label="Recentrar vista"
              style={{
                border: '1px solid #bae6fd',
                background: '#ffffff',
                color: '#0369a1',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5 && rotation === 0 ? 'not-allowed' : 'pointer',
                opacity: zoomLevel <= 1 && Math.abs(position.x) < 0.5 && Math.abs(position.y) < 0.5 && rotation === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 4px rgba(15, 75, 105, 0.08)',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <RotateCcw size={15} strokeWidth={2.4} />
            </button>

            <div style={{ width: '26px', height: '1px', background: 'rgba(186, 230, 253, 0.85)', margin: '2px 0', flexShrink: 0 }} />

            {/* Botón Lápiz (Abre modo especial) */}
            <button
              type="button"
              onClick={() => {
                setIsAnnotationMode(true);
                setAnnotationTool('laser');
              }}
              title="Abrir herramientas de anotación y puntero láser"
              aria-label="Abrir herramientas de anotación"
              style={{
                border: '1px solid #bae6fd',
                background: '#ffffff',
                color: '#0369a1',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease, transform 0.12s ease',
                boxShadow: '0 2px 4px rgba(15, 75, 105, 0.08)',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.color = '#0284c7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#bae6fd';
                e.currentTarget.style.color = '#0369a1';
              }}
            >
              <Pencil size={15} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Barra de herramientas horizontal para Modo Especial / Anotaciones */}
        {isAnnotationMode && (
          <div
            role="toolbar"
            aria-label="Herramientas de anotación y presentación"
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(20px) saturate(160%)',
              padding: '6px 12px',
              borderRadius: '999px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              zIndex: 25,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              animation: prefersReducedMotion ? 'none' : 'specialBarIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
              userSelect: 'none',
              maxWidth: '94vw',
              overflowX: 'auto',
              touchAction: 'manipulation',
            }}
          >
            {/* Opción 1: Puntero Láser Rojo */}
            <button
              type="button"
              onClick={() => setAnnotationTool(annotationTool === 'laser' ? null : 'laser')}
              title="Puntero Láser Rojo (deja una estela de luz que se disipa sola)"
              aria-label="Puntero Láser Rojo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: annotationTool === 'laser'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.38), rgba(185, 28, 28, 0.55))'
                  : 'rgba(30, 41, 59, 0.75)',
                border: annotationTool === 'laser' ? '1.5px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '999px',
                padding: '6px 13px',
                color: annotationTool === 'laser' ? '#ffffff' : '#cbd5e1',
                cursor: 'pointer',
                fontWeight: 750,
                fontSize: '0.82em',
                fontFamily: 'inherit',
                boxShadow: annotationTool === 'laser' ? '0 0 16px rgba(239, 68, 68, 0.48)' : 'none',
                transition: 'all 0.18s ease',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px #ef4444, 0 0 12px #ef4444',
                  display: 'inline-block',
                }}
              />
              <span>Láser</span>
            </button>

            {/* Opción 2: Mover Placa (Herramienta Mano) */}
            <button
              type="button"
              onClick={() => setAnnotationTool(annotationTool === 'hand' ? null : 'hand')}
              title="Mover Placa (arrastrar con clic izquierdo para navegar la imagen)"
              aria-label="Mover Placa"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: annotationTool === 'hand'
                  ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.38), rgba(2, 132, 199, 0.55))'
                  : 'rgba(30, 41, 59, 0.75)',
                border: annotationTool === 'hand' ? '1.5px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '999px',
                padding: '6px 13px',
                color: annotationTool === 'hand' ? '#ffffff' : '#cbd5e1',
                cursor: 'pointer',
                fontWeight: 750,
                fontSize: '0.82em',
                fontFamily: 'inherit',
                boxShadow: annotationTool === 'hand' ? '0 0 16px rgba(56, 189, 248, 0.48)' : 'none',
                transition: 'all 0.18s ease',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Hand size={15} strokeWidth={2.4} color={annotationTool === 'hand' ? '#38bdf8' : '#94a3b8'} />
              <span>Mover</span>
            </button>

            {/* Separador */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(148, 163, 184, 0.35)', margin: '0 2px', flexShrink: 0 }} />

            {/* Controles de Navegación Direccional (◄ ▲ ▼ ►) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(30, 41, 59, 0.65)',
                padding: '2px 4px',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => panBy(120, 0)}
                title="Mover vista a la izquierda"
                aria-label="Mover a la izquierda"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ChevronLeft size={16} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={() => panBy(0, 120)}
                title="Mover vista hacia arriba"
                aria-label="Mover hacia arriba"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ChevronUp size={16} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={() => panBy(0, -120)}
                title="Mover vista hacia abajo"
                aria-label="Mover hacia abajo"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ChevronDown size={16} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={() => panBy(-120, 0)}
                title="Mover vista a la derecha"
                aria-label="Mover a la derecha"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ChevronRight size={16} strokeWidth={2.4} />
              </button>
            </div>

            {/* Controles de Zoom rápidos */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(30, 41, 59, 0.65)',
                padding: '2px 4px',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                title="Alejar imagen (-)"
                aria-label="Alejar imagen"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ZoomOut size={14} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={handleResetViewport}
                title="Clic para volver al 100%"
                aria-label="Volver al 100%"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.74em',
                  fontWeight: 800,
                  padding: '0 3px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                title="Acercar imagen (+)"
                aria-label="Acercar imagen"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
              >
                <ZoomIn size={14} strokeWidth={2.4} />
              </button>
            </div>

            {/* Separador */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(148, 163, 184, 0.35)', margin: '0 2px', flexShrink: 0 }} />

            {/* Botón Salir / Volver */}
            <button
              type="button"
              onClick={() => {
                setIsAnnotationMode(false);
                setAnnotationTool(null);
              }}
              title="Cerrar modo especial y volver a la barra de zoom"
              aria-label="Volver a controles de zoom"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                borderRadius: '999px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.78em',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#fca5a5';
              }}
            >
              <X size={14} strokeWidth={2.4} />
              <span>Salir</span>
            </button>
          </div>
        )}
      </div>

      {showSidebar && (
        <div style={{
          width: isDesktop ? '320px' : 'min(320px, 90vw)',
          position: isDesktop ? 'relative' : 'absolute',
          top: 0, right: 0, height: '100%',
          background: 'linear-gradient(180deg, #f5fbfd 0%, #e8f4f8 52%, #f7fbfc 100%)',
          backdropFilter: isDesktop ? 'none' : 'blur(6px) saturate(112%)',
          borderLeft: '1px solid #b9dbe8',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
          zIndex: isDesktop ? 1 : 30,
          fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
          boxShadow: isDesktop
            ? '-14px 0 34px rgba(15, 75, 105, 0.17), inset 1px 0 0 rgba(255,255,255,0.82)'
            : '-12px 0 34px rgba(15, 75, 105, 0.24)',
        }}>
          {/* Cabecera */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            padding: '15px 15px 14px',
            borderBottom: '1px solid rgba(14, 116, 144, 0.24)',
            background: 'linear-gradient(135deg, #0f4c67 0%, #176a85 58%, #2181a6 100%)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '4px', height: '26px', borderRadius: '999px', background: 'linear-gradient(180deg, #b8ecfa, #e8fbff)', boxShadow: '0 0 12px rgba(186, 230, 253, 0.58)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ffffff', fontSize: '0.71em', fontWeight: 850, letterSpacing: '0.11em', textTransform: 'uppercase' }}>Info de la placa</span>
                {placaId != null && (
                  <span style={{ color: 'rgba(232, 251, 255, 0.82)', fontSize: '0.63em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    - ID {placaId}
                  </span>
                )}
                {/* Botón Pantalla Completa a un lado del ID (solo ícono) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                  aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    background: isFullscreen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                    border: isFullscreen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.28)',
                    color: isFullscreen ? '#bae6fd' : '#ffffff',
                    borderRadius: '6px',
                    padding: 0,
                    cursor: 'pointer',
                    marginLeft: '4px',
                    transition: 'all 0.15s ease',
                    boxShadow: isFullscreen ? '0 0 8px rgba(56, 189, 248, 0.35)' : 'none',
                    flexShrink: 0,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isFullscreen ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.28)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isFullscreen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = isFullscreen ? '#bae6fd' : '#ffffff';
                  }}
                >
                  {isFullscreen ? <Minimize2 size={13} strokeWidth={2.4} /> : <Maximize2 size={13} strokeWidth={2.4} />}
                </button>
                {/* Botón Ocultar Barra Lateral (solo ícono) */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  title="Ocultar barra lateral"
                  aria-label="Ocultar barra lateral"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: 0,
                    cursor: 'pointer',
                    marginLeft: '3px',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                >
                  <PanelRightClose size={13} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
          {/* Contenido */}
          <div style={{ padding: '14px 12px 18px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
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
              <div style={{ ...sidebarSectionStyle, order: 3, background: 'linear-gradient(145deg, rgba(255,255,255,0.99), rgba(232,247,252,0.94))', borderColor: 'rgba(125, 211, 235, 0.56)' }}>
                <span style={{ ...labelStyle, marginBottom: '12px', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(125, 211, 235, 0.48)', background: 'linear-gradient(135deg, #e9f8fc, #f8fdff)', color: '#0f526d', fontWeight: 900, textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)' }}>Señalados</span>
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
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
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
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
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
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
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
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
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
                      background: isActive ? '#dff3f9' : 'rgba(243, 251, 253, 0.9)',
                      borderRadius: '14px',
                      padding: '7px',
                      border: isActive ? '1px solid #72c9e6' : '1px solid #cce8f1',
                      boxShadow: isActive ? '0 8px 18px rgba(14,116,144,0.15)' : '0 2px 7px rgba(15,75,105,0.05)',
                      transition: 'all 0.2s ease',
                      animation: prefersReducedMotion ? 'none' : 'senaladoCardIn 320ms ease both',
                      animationDelay: `${group.firstIndex * 45}ms`,
                    }}>
                      <span style={{
                        minWidth: '28px',
                        height: '28px',
                        borderRadius: '9px',
                        background: isActive
                          ? 'linear-gradient(135deg, #0f6f91, #1683aa)'
                          : hasMarker
                            ? 'linear-gradient(135deg, #4aa7c4, #217c9d)'
                            : 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.68em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '5px',
                        boxShadow: isActive ? '0 4px 10px rgba(14,116,144,0.3)' : 'none',
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
                          border: isActive ? '1px solid #72c9e6' : isHovered ? '1px solid #9ed9eb' : '1px solid #c5e4ee',
                          background: isActive
                            ? 'linear-gradient(135deg, #f5fdff, #ddf3f9)'
                            : isHovered
                              ? '#f0fbfe'
                              : hasMarker
                                ? '#ffffff'
                                : '#f1f5f9',
                          color: '#12445b',
                          fontSize: '0.72em',
                          lineHeight: 1.35,
                          cursor: hasMarker ? 'pointer' : 'not-allowed',
                          fontWeight: isActive ? 700 : 600,
                          borderRadius: '11px',
                          padding: '8px 10px',
                          textAlign: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.18s ease',
                          boxShadow: isActive ? '0 4px 12px rgba(14,116,144,0.14)' : isHovered ? '0 2px 10px rgba(14,165,233,0.1)' : 'none',
                          opacity: hasMarker ? 1 : 0.82,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transform: hasMarker && isHovered && !isActive ? 'translateY(-1px)' : 'none',
                          outline: isFocused ? '2px solid #4ab8d8' : 'none',
                          outlineOffset: '1px',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
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
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
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
                                touchAction: 'manipulation',
                                WebkitTapHighlightColor: 'transparent',
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
                                  <button type="button" onClick={() => setMapFocusRequest(value => value + 1)} style={{ border: '1px solid #bae6fd', background: '#fff', color: '#0369a1', borderRadius: '7px', padding: '4px 7px', fontSize: '0.68em', fontWeight: 750, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>Centrar</button>
                                  <button type="button" onClick={() => setActiveMapSectionIndex(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#475569', borderRadius: '7px', padding: '4px 7px', fontSize: '0.68em', fontWeight: 750, cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>Ver todas</button>
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
                  <div style={{ marginTop: '13px', paddingTop: '12px', borderTop: '1px solid #cce7f0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => navigateActiveItem(-1)}
                      onMouseEnter={() => setHoveredNavigationId('senalados-previous')}
                      onMouseLeave={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                      onMouseDown={() => setPressedNavigationId('senalados-previous')}
                      onMouseUp={() => setPressedNavigationId(null)}
                      onFocus={() => setHoveredNavigationId('senalados-previous')}
                      onBlur={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                      aria-label="Elemento anterior"
                      style={{ ...compactNavigationButtonStyle, ...getNavigationButtonInteractionStyle('senalados-previous'), justifyContent: 'flex-start' }}
                    >
                      <span style={compactNavigationIconStyle} aria-hidden="true">←</span>
                      <span>Anterior</span>
                    </button>
                    <span style={compactNavigationCounterStyle}>{activeNavigationPosition || '—'} / {activeNavigationCount}</span>
                    <button
                      type="button"
                      onClick={() => navigateActiveItem(1)}
                      onMouseEnter={() => setHoveredNavigationId('senalados-next')}
                      onMouseLeave={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                      onMouseDown={() => setPressedNavigationId('senalados-next')}
                      onMouseUp={() => setPressedNavigationId(null)}
                      onFocus={() => setHoveredNavigationId('senalados-next')}
                      onBlur={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                      aria-label="Elemento siguiente"
                      style={{ ...compactNavigationButtonStyle, ...getNavigationButtonInteractionStyle('senalados-next'), justifyContent: 'flex-end' }}
                    >
                      <span>Siguiente</span>
                      <span style={compactNavigationIconStyle} aria-hidden="true">→</span>
                    </button>
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
            {hasPlateNavigation && (
              <nav aria-label="Navegación entre placas del subtema" style={{ ...sidebarSectionStyle, order: 5, margin: 'auto -12px -18px', flexShrink: 0, borderRadius: '14px 14px 0 0', borderInline: 0, borderBottom: 0, background: 'linear-gradient(135deg, rgba(231, 247, 252, 0.98), rgba(255, 255, 255, 0.98))', boxShadow: '0 -8px 22px rgba(15, 75, 105, 0.09)', backdropFilter: 'blur(8px)' }}>
                <span style={{ ...labelStyle, textAlign: 'center' }}>Placas del subtema</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handlePlateNavigation(onPreviousPlate)}
                    onMouseEnter={() => setHoveredNavigationId('plates-previous')}
                    onMouseLeave={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                    onMouseDown={() => setPressedNavigationId('plates-previous')}
                    onMouseUp={() => setPressedNavigationId(null)}
                    onFocus={() => setHoveredNavigationId('plates-previous')}
                    onBlur={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                    disabled={!onPreviousPlate || isPlateImageLoading}
                    aria-label="Ver placa anterior"
                    style={{ ...compactNavigationButtonStyle, ...getNavigationButtonInteractionStyle('plates-previous'), justifyContent: 'flex-start', opacity: onPreviousPlate && !isPlateImageLoading ? 1 : 0.56, cursor: onPreviousPlate && !isPlateImageLoading ? 'pointer' : 'not-allowed' }}
                  >
                    <span style={compactNavigationIconStyle} aria-hidden="true">←</span>
                    <span>Anterior</span>
                  </button>
                  <span style={compactNavigationCounterStyle}>{platePosition ?? '—'} / {plateCount}</span>
                  <button
                    type="button"
                    onClick={() => handlePlateNavigation(onNextPlate)}
                    onMouseEnter={() => setHoveredNavigationId('plates-next')}
                    onMouseLeave={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                    onMouseDown={() => setPressedNavigationId('plates-next')}
                    onMouseUp={() => setPressedNavigationId(null)}
                    onFocus={() => setHoveredNavigationId('plates-next')}
                    onBlur={() => { setHoveredNavigationId(null); setPressedNavigationId(null); }}
                    disabled={!onNextPlate || isPlateImageLoading}
                    aria-label="Ver placa siguiente"
                    style={{ ...compactNavigationButtonStyle, ...getNavigationButtonInteractionStyle('plates-next'), justifyContent: 'flex-end', opacity: onNextPlate && !isPlateImageLoading ? 1 : 0.56, cursor: onNextPlate && !isPlateImageLoading ? 'pointer' : 'not-allowed' }}
                  >
                    <span>Siguiente</span>
                    <span style={compactNavigationIconStyle} aria-hidden="true">→</span>
                  </button>
                </div>
              </nav>
            )}
            {user?.rol === 'Administrador' && placaId && (
              <div style={{ ...sidebarSectionStyle, order: 6, background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', borderColor: '#7dd3fc', marginTop: '8px' }}>
                <a
                  href={`/historial?scope=placa&placaId=${encodeURIComponent(String(placaId))}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '0.78em',
                    fontWeight: 750,
                    textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    boxSizing: 'border-box',
                  }}
                  title="Ver historial de cambios, clasificaciones y ediciones de esta placa en una nueva pestaña"
                >
                  <Shield size={14} />
                  <span>Ver Historial de esta Placa (#{placaId})</span>
                </a>
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
  background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(243,250,252,0.96))',
  border: '1px solid rgba(166, 211, 228, 0.72)',
  borderRadius: '14px',
  padding: '12px',
  boxShadow: '0 6px 16px rgba(15, 75, 105, 0.07), inset 0 1px 0 rgba(255,255,255,0.92)',
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
  display: 'block', color: '#39708a', fontSize: '0.64em', fontWeight: 850,
  letterSpacing: '0.125em', textTransform: 'uppercase', marginBottom: '7px',
};

const compactNavigationButtonStyle: React.CSSProperties = {
  minHeight: '36px',
  border: '1px solid #a8d9e9',
  background: 'linear-gradient(135deg, #f7fdff, #dff3f9)',
  color: '#13516a',
  borderRadius: '10px',
  padding: '6px 7px',
  fontFamily: 'inherit',
  fontSize: '0.69em',
  fontWeight: 850,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  boxShadow: '0 3px 9px rgba(15, 105, 135, 0.1)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  willChange: 'transform',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

const compactNavigationIconStyle: React.CSSProperties = {
  width: '21px',
  height: '21px',
  borderRadius: '7px',
  color: '#ffffff',
  background: 'linear-gradient(135deg, #177898, #279bbd)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1em',
  lineHeight: 1,
  boxShadow: '0 2px 5px rgba(15, 105, 135, 0.2)',
};

const compactNavigationCounterStyle: React.CSSProperties = {
  minWidth: '38px',
  padding: '5px 6px',
  border: '1px solid #c6e6ef',
  borderRadius: '999px',
  background: '#ffffff',
  color: '#39708a',
  fontSize: '0.66em',
  fontWeight: 850,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
};

export default ImageViewerModal;
