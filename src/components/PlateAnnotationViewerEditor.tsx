import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  PanelRightClose,
  PanelRightOpen,
  Move,
  Hand,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Undo,
  MousePointer,
  Layers,
  Sparkles,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  PenTool,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import BoldField, { renderBoldText } from './BoldField';
import { acquireAtlasScrollLock, releaseAtlasScrollLock } from '../constants/scrollLock';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import AllSenaladosMoverModal from './AllSenaladosMoverModal';

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

export interface PlateAnnotationViewerEditorProps {
  imageSrc: string;
  imageAlt?: string;
  highResImageSrc?: string;
  // Placa metadata
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  temaNombre?: string | null;
  subtemaNombre?: string | null;
  // Initial list of markers
  initialSenalados?: string[];
  initialSenaladosPos?: Array<MarkerLocation | null>;
  // Single/Batch picker compatibility
  singlePickerMode?: boolean;
  batchPickerMode?: boolean;
  borderPickerMode?: boolean;
  initialLocation?: MarkerLocation | null;
  initialBatchLocations?: MarkerLocation[];
  targetLabel?: string;
  required?: boolean;
  // Handlers
  onSaveAll?: (senalados: string[], senaladosPos: Array<MarkerLocation | null>) => void;
  onSaveSingle?: (location: MarkerLocation | null, label?: string) => void;
  onSaveBatch?: (locations: MarkerLocation[], label?: string) => void;
  onCancel: () => void;
}

type EditorTool = 'pointer' | 'batch' | 'border' | 'batch-border' | 'pan';
type MarkerVisualMode = 'pointer' | 'arrow';
type MarkerColorKey = 'black' | 'white' | 'red' | 'lime';
type PointerEdge = 'left' | 'right' | 'top' | 'bottom';

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

export const REGION_PALETTE_COLORS = [
  { name: 'Esmeralda', hex: '#22c55e' },
  { name: 'Cielo', hex: '#0ea5e9' },
  { name: 'Púrpura', hex: '#a855f7' },
  { name: 'Rosa (Eosina)', hex: '#f43f5e' },
  { name: 'Ámbar', hex: '#f59e0b' },
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Cian', hex: '#06b6d4' },
  { name: 'Naranja', hex: '#f97316' },
];

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.15;
const SIDEBAR_BREAKPOINT = 900;

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;
const ARROW_TAIL_DISTANCE_PX = 21;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Ramer-Douglas-Peucker algorithm for silky smooth, lightweight freehand polygons
const perpendicularDistance = (pt: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
};

const ramerDouglasPeucker = (points: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> => {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
};

const simplifyPoints = (flatPoints: number[], epsilon = 0.0015): number[] => {
  if (flatPoints.length < 6) return flatPoints;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push({ x: flatPoints[i], y: flatPoints[i + 1] });
  }
  const simplified = ramerDouglasPeucker(pts, epsilon);
  if (simplified.length < 3) return flatPoints;
  const result: number[] = [];
  simplified.forEach(p => result.push(p.x, p.y));
  return result;
};

const getPointerStartPx = (x: number, y: number, width: number, height: number): { x: number; y: number; edge: PointerEdge } => {
  const distances = [
    { edge: 'left' as const, value: x },
    { edge: 'right' as const, value: width - x },
    { edge: 'top' as const, value: y },
    { edge: 'bottom' as const, value: height - y },
  ];

  const nearest = distances.reduce((prev, curr) => (curr.value < prev.value ? curr : prev));

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

const clampPointToNearestEdge = (x: number, y: number, width: number, height: number): { x: number; y: number; edge: PointerEdge } => {
  const cx = clamp(x, 0, width);
  const cy = clamp(y, 0, height);
  const dLeft = Math.abs(cx - 0);
  const dRight = Math.abs(cx - width);
  const dTop = Math.abs(cy - 0);
  const dBottom = Math.abs(cy - height);
  const min = Math.min(dLeft, dRight, dTop, dBottom);

  if (min === dLeft) return { x: 0, y: cy, edge: 'left' };
  if (min === dRight) return { x: width, y: cy, edge: 'right' };
  if (min === dTop) return { x: cx, y: 0, edge: 'top' };
  return { x: cx, y: height, edge: 'bottom' };
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

const polygonPointsStr = (points: ReadonlyArray<{ x: number; y: number }>) => (
  points.map(point => `${point.x},${point.y}`).join(' ')
);

// Comprueba si un punto (x, y) normalizado se encuentra dentro de un polígono
const pointInPolygon = (x: number, y: number, flatPoints: number[]): boolean => {
  let inside = false;
  const len = flatPoints.length;
  for (let i = 0, j = len - 2; i < len; i += 2) {
    const xi = flatPoints[i];
    const yi = flatPoints[i + 1];
    const xj = flatPoints[j];
    const yj = flatPoints[j + 1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
};

// Genera el path SVG ('d') con regla evenodd para soportar polígonos complejos con zonas de exclusión (huecos/donas)
const getPolygonPathD = (
  outerPoints: number[],
  holes: number[][] | null | undefined,
  width: number,
  height: number
): string => {
  if (outerPoints.length < 6) return '';
  let d = '';

  // Anillo exterior
  for (let i = 0; i < outerPoints.length; i += 2) {
    const x = outerPoints[i] * width;
    const y = outerPoints[i + 1] * height;
    d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  d += ' Z';

  // Anillos interiores (zonas de exclusión / huecos)
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

// Calcula el área neta de un polígono/señalado (restando zonas de exclusión/huecos).
const getMarkerArea = (marker: { regionPoints?: number[] | null; regionHoles?: number[][] | null }): number => {
  if (marker.regionPoints && marker.regionPoints.length >= 6) {
    let area = 0;
    const pts = marker.regionPoints;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const x1 = pts[i * 2];
      const y1 = pts[i * 2 + 1];
      const nextIdx = (i + 1) % n;
      const x2 = pts[nextIdx * 2];
      const y2 = pts[nextIdx * 2 + 1];
      area += x1 * y2 - x2 * y1;
    }
    let totalArea = Math.abs(area) / 2;

    if (marker.regionHoles && marker.regionHoles.length > 0) {
      for (const hole of marker.regionHoles) {
        if (hole.length >= 6) {
          let holeArea = 0;
          const hn = hole.length / 2;
          for (let i = 0; i < hn; i++) {
            const x1 = hole[i * 2];
            const y1 = hole[i * 2 + 1];
            const nextIdx = (i + 1) % hn;
            const x2 = hole[nextIdx * 2];
            const y2 = hole[nextIdx * 2 + 1];
            holeArea += x1 * y2 - x2 * y1;
          }
          totalArea = Math.max(0, totalArea - Math.abs(holeArea) / 2);
        }
      }
    }
    return totalArea;
  }
  return 0;
};

interface InternalMarkerItem {
  id: string;
  label: string;
  x: number | null;
  y: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
}

const PlateAnnotationViewerEditor: React.FC<PlateAnnotationViewerEditorProps> = ({
  imageSrc,
  imageAlt,
  highResImageSrc,
  aumento,
  tincion,
  comentario,
  temaNombre,
  subtemaNombre,
  initialSenalados = [],
  initialSenaladosPos = [],
  singlePickerMode = false,
  batchPickerMode = false,
  borderPickerMode = false,
  initialLocation = null,
  initialBatchLocations = [],
  targetLabel = '',
  required = false,
  onSaveAll,
  onSaveSingle,
  onSaveBatch,
  onCancel,
}) => {
  // Resolve true high-definition image URL (avoiding _thumb)
  const resolvedImageSrc = useMemo(() => {
    if (highResImageSrc) return highResImageSrc;
    if (!imageSrc) return '';
    if (imageSrc.includes('r2.dev') || imageSrc.includes('cloudinary.com') || imageSrc.includes('_thumb')) {
      const full = getCloudinaryImageUrl(imageSrc, 'view');
      return full || imageSrc.replace(/_thumb\.webp$/i, '.webp');
    }
    return imageSrc;
  }, [highResImageSrc, imageSrc]);

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const isDesktop = windowWidth >= SIDEBAR_BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize marker items
  const [markers, setMarkers] = useState<InternalMarkerItem[]>(() => {
    if (singlePickerMode) {
      if (initialLocation && initialLocation.x != null) {
        return [{
          id: `marker-${Date.now()}-0`,
          label: targetLabel || 'Señalado',
          x: initialLocation.x,
          y: initialLocation.y,
          startX: initialLocation.startX ?? null,
          startY: initialLocation.startY ?? null,
          regionPoints: initialLocation.regionPoints ?? null,
          regionHoles: initialLocation.regionHoles ?? null,
          regionColor: initialLocation.regionColor ?? '#22c55e',
          regionOpacity: initialLocation.regionOpacity ?? 0.28,
        }];
      }
      return [{
        id: `marker-${Date.now()}-0`,
        label: targetLabel || 'Señalado',
        x: null,
        y: null,
        startX: null,
        startY: null,
        regionPoints: borderPickerMode ? [] : null,
        regionHoles: null,
        regionColor: '#22c55e',
        regionOpacity: 0.28,
      }];
    }

    if (batchPickerMode && initialBatchLocations.length > 0) {
      return initialBatchLocations.map((loc, idx) => ({
        id: `marker-${Date.now()}-${idx}`,
        label: targetLabel || `Señalado ${idx + 1}`,
        x: loc.x,
        y: loc.y,
        startX: loc.startX ?? null,
        startY: loc.startY ?? null,
        regionPoints: loc.regionPoints ?? null,
        regionHoles: loc.regionHoles ?? null,
        regionColor: loc.regionColor ?? '#22c55e',
        regionOpacity: loc.regionOpacity ?? 0.28,
      }));
    }

    if (initialSenalados.length > 0) {
      return initialSenalados.map((label, idx) => {
        const pos = initialSenaladosPos[idx] ?? null;
        return {
          id: `marker-${Date.now()}-${idx}`,
          label: label || '',
          x: pos?.x ?? null,
          y: pos?.y ?? null,
          startX: pos?.startX ?? null,
          startY: pos?.startY ?? null,
          regionPoints: pos?.regionPoints ?? null,
          regionHoles: pos?.regionHoles ?? null,
          regionColor: pos?.regionColor ?? '#22c55e',
          regionOpacity: pos?.regionOpacity ?? 0.28,
        };
      });
    }

    return [];
  });

  // Current active tool mode (Mano / Paneo por defecto)
  const [activeTool, setActiveTool] = useState<EditorTool>('pan');

  // Freehand continuous drawing state
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false);

  // Reassign tip on next click state
  const [reassigningTipMarkerId, setReassigningTipMarkerId] = useState<string | null>(null);

  // Visual mode & color
  const [markerVisualMode, setMarkerVisualMode] = useState<MarkerVisualMode>('pointer');
  const [markerColorKey, setMarkerColorKey] = useState<MarkerColorKey>('black');
  const activeMarkerColor = useMemo(
    () => MARKER_COLOR_OPTIONS.find(c => c.key === markerColorKey) ?? MARKER_COLOR_OPTIONS[0],
    [markerColorKey]
  );

  // Active selected marker (inicia en null si hay múltiples señalados para ver la lista completa)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(() => {
    if (singlePickerMode) return markers[0]?.id ?? null;
    return null;
  });

  // Active drawing polygon buffer
  const [drawingPolygonPoints, setDrawingPolygonPoints] = useState<number[]>([]);
  const [drawingPolygonColor, setDrawingPolygonColor] = useState('#22c55e');
  const [drawingPolygonOpacity, setDrawingPolygonOpacity] = useState(0.28);
  const [cursorImagePos, setCursorImagePos] = useState<{ x: number; y: number } | null>(null);

  // Selected polygon vertex (on outer contour or inside an exclusion zone hole)
  const [selectedVertex, setSelectedVertex] = useState<{
    vertexIndex: number;
    holeIndex?: number;
  } | null>(null);

  // Selected exclusion zone (hole / cutout) index
  const [selectedHoleIndex, setSelectedHoleIndex] = useState<number | null>(null);

  // Reset hole and vertex selection when active marker changes
  useEffect(() => {
    setSelectedHoleIndex(null);
    setSelectedVertex(null);
  }, [selectedMarkerId]);

  // Active label for current placement (inicia vacío en modo general para no arrastrar nombres previos)
  const [currentCreationLabel, setCurrentCreationLabel] = useState<string>(() => (singlePickerMode && targetLabel) ? targetLabel : '');

  // IDs of markers placed during the currently active tool session
  const [sessionMarkerIds, setSessionMarkerIds] = useState<string[]>([]);

  // Tool switcher with clean session reset
  const handleSelectTool = useCallback((newTool: EditorTool) => {
    // Si había elementos en la sesión actual con un nombre escrito, asegurar que lo conserven
    if (sessionMarkerIds.length > 0 && currentCreationLabel.trim()) {
      const trimmed = currentCreationLabel.trim();
      setMarkers(prev => prev.map(m => sessionMarkerIds.includes(m.id) ? { ...m, label: trimmed } : m));
    }

    setReassigningTipMarkerId(null);
    setDrawingPolygonPoints([]);
    setIsDrawingFreehand(false);

    if (newTool === 'pan') {
      setActiveTool('pan');
      setSessionMarkerIds([]);
      setCurrentCreationLabel('');
      setSelectedMarkerId(null);
      return;
    }

    // Al seleccionar cualquier herramienta de dibujo/creación:
    setActiveTool(newTool);
    setCurrentCreationLabel(singlePickerMode && targetLabel ? targetLabel : '');
    setSessionMarkerIds([]);
    setSelectedMarkerId(null);
    setSidebarOpen(true);
  }, [currentCreationLabel, sessionMarkerIds, singlePickerMode, targetLabel]);

  // Canvas zoom, pan, rotation
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  // Visibility toggle
  const [showAllMarkers, setShowAllMarkers] = useState(true);

  // Modal / Confirmations
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showMoveAllModal, setShowMoveAllModal] = useState(false);
  const [hasUnsavedModifications, setHasUnsavedModifications] = useState(false);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  // Saving states & notifications
  const [isSavingLocally, setIsSavingLocally] = useState(false);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dragging states
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number } | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle dragging
  const [draggingHandle, setDraggingHandle] = useState<{
    markerId: string;
    type: 'tip' | 'start' | 'vertex';
    vertexIndex?: number;
    holeIndex?: number;
  } | null>(null);

  // Minimap & Container refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);

  // Touch pinch ref
  const pinchRef = useRef<{
    dist: number;
    startZoom: number;
    midX: number;
    midY: number;
    startPos: { x: number; y: number };
  } | null>(null);

  // History for Undo
  const [historyStack, setHistoryStack] = useState<InternalMarkerItem[][]>([]);

  const pushHistory = useCallback((currentMarkers: InternalMarkerItem[]) => {
    setHistoryStack(prev => [
      ...prev.slice(-15),
      currentMarkers.map(m => ({
        ...m,
        regionPoints: m.regionPoints ? [...m.regionPoints] : null,
        regionHoles: m.regionHoles ? m.regionHoles.map(h => [...h]) : null,
      }))
    ]);
    setHasUnsavedModifications(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (drawingPolygonPoints.length > 0) {
      setDrawingPolygonPoints(prev => prev.slice(0, -2));
      return;
    }
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setMarkers(previous);
  }, [drawingPolygonPoints.length, historyStack]);

  // Lock body scroll
  useEffect(() => {
    acquireAtlasScrollLock();
    return () => {
      releaseAtlasScrollLock();
    };
  }, []);

  // Window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Elimina una zona de exclusión (hueco) específica de un marcador
  const handleDeleteHole = useCallback((markerId: string, holeIndex: number) => {
    pushHistory(markers);
    setMarkers(prev => prev.map(m => {
      if (m.id !== markerId || !m.regionHoles) return m;
      const updated = m.regionHoles.filter((_, i) => i !== holeIndex);
      return { ...m, regionHoles: updated.length ? updated : null };
    }));
    setSelectedHoleIndex(null);
    setSelectedVertex(null);
    setHasUnsavedModifications(true);
  }, [markers, pushHistory]);

  // Elimina todas las zonas de exclusión (huecos) de un marcador
  const handleDeleteAllHoles = useCallback((markerId: string) => {
    pushHistory(markers);
    setMarkers(prev => prev.map(m => {
      if (m.id !== markerId) return m;
      return { ...m, regionHoles: null };
    }));
    setSelectedHoleIndex(null);
    setSelectedVertex(null);
    setHasUnsavedModifications(true);
  }, [markers, pushHistory]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMarkerId) {
        if (selectedVertex !== null) {
          e.preventDefault();
          pushHistory(markers);
          setMarkers(prev => prev.map(m => {
            if (m.id !== selectedMarkerId) return m;

            if (selectedVertex.holeIndex != null && m.regionHoles && m.regionHoles[selectedVertex.holeIndex]) {
              const hIdx = selectedVertex.holeIndex;
              const hole = m.regionHoles[hIdx];
              if (hole.length <= 6) {
                const filtered = m.regionHoles.filter((_, i) => i !== hIdx);
                return { ...m, regionHoles: filtered.length ? filtered : null };
              }
              const nextHole = [...hole];
              nextHole.splice(selectedVertex.vertexIndex * 2, 2);
              const newHoles = m.regionHoles.map((h, i) => i === hIdx ? nextHole : h);
              return { ...m, regionHoles: newHoles };
            }

            if (!m.regionPoints || m.regionPoints.length <= 6) return m;
            const nextPts = [...m.regionPoints];
            nextPts.splice(selectedVertex.vertexIndex * 2, 2);
            return { ...m, regionPoints: nextPts };
          }));
          setSelectedVertex(null);
          setHasUnsavedModifications(true);
          return;
        }

        if (selectedHoleIndex !== null) {
          e.preventDefault();
          handleDeleteHole(selectedMarkerId, selectedHoleIndex);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 'Escape') {
        if (reassigningTipMarkerId) {
          setReassigningTipMarkerId(null);
        } else if (drawingPolygonPoints.length > 0) {
          setDrawingPolygonPoints([]);
          setIsDrawingFreehand(false);
        } else if (selectedVertex !== null) {
          setSelectedVertex(null);
        } else if (selectedHoleIndex !== null) {
          setSelectedHoleIndex(null);
        } else if (!required) {
          handleRequestClose();
        }
      }
      if (e.key === '+' || e.key === '=') {
        setZoomLevel(z => clamp(Number((z + ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
      }
      if (e.key === '-' || e.key === '_') {
        setZoomLevel(z => clamp(Number((z - ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
      }
      if (e.key === '0') {
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [drawingPolygonPoints.length, handleDeleteHole, handleUndo, markers, pushHistory, reassigningTipMarkerId, required, selectedHoleIndex, selectedMarkerId, selectedVertex]);

  // Update image size
  const updateImageDimensions = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImageSize({ width: img.clientWidth, height: img.clientHeight });
  }, []);

  useEffect(() => {
    updateImageDimensions();
    const img = imageRef.current;
    if (!img) return;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateImageDimensions());
      observer.observe(img);
    }
    window.addEventListener('resize', updateImageDimensions);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateImageDimensions);
    };
  }, [resolvedImageSrc, updateImageDimensions]);

  // Non-passive touch listener to prevent default browser pinch/scroll behaviors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    return () => {
      container.removeEventListener('touchmove', preventDefaultTouch);
    };
  }, []);

  // Wheel zoom around cursor
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container || !imageSize) return;

    const rect = container.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - rect.width / 2;
    const cursorY = event.clientY - rect.top - rect.height / 2;

    const direction = event.deltaY < 0 ? 1 : -1;
    const zoomFactor = direction > 0 ? 1.15 : 1 / 1.15;
    const nextZoom = clamp(Number((zoomLevel * zoomFactor).toFixed(2)), ZOOM_MIN, ZOOM_MAX);

    if (nextZoom === zoomLevel) return;

    const scaleChange = nextZoom / zoomLevel;
    const nextPosX = cursorX - (cursorX - position.x) * scaleChange;
    const nextPosY = cursorY - (cursorY - position.y) * scaleChange;

    setZoomLevel(nextZoom);
    setPosition({ x: nextPosX, y: nextPosY });
  };

  // Convert client coordinates to normalized image coords (0..1)
  const clientToImageCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const img = imageRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }, []);

  // Active selected marker object
  const activeSelectedMarker = useMemo(() => {
    if (!selectedMarkerId) return null;
    return markers.find(m => m.id === selectedMarkerId) ?? null;
  }, [markers, selectedMarkerId]);

  // Marcadores ordenados para el renderizado SVG (Z-Index visual e interactivo):
  // 1. Las regiones/bordes más grandes y envolventes se renderizan primero (al fondo).
  // 2. Las regiones/bordes más pequeños y contenidos se renderizan después (encima).
  // 3. Los punteros (agujas/flechas) se renderizan sobre cualquier región.
  // 4. El señalado actualmente seleccionado (y sus controles de edición) se renderiza en la capa superior absoluta.
  const sortedMarkersForRendering = useMemo(() => {
    return [...markers].sort((a, b) => {
      const aSelected = a.id === selectedMarkerId;
      const bSelected = b.id === selectedMarkerId;
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;

      const areaA = getMarkerArea(a);
      const areaB = getMarkerArea(b);
      if (areaA !== areaB) {
        return areaB - areaA; // Mayor área primero (fondo), menor área después (arriba)
      }
      return 0;
    });
  }, [markers, selectedMarkerId]);

  // Group markers by structure name for accordion display
  const markerGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string;
      items: Array<{
        marker: InternalMarkerItem;
        originalIndex: number;
      }>;
    }> = [];
    const labelMap = new Map<string, typeof groups[0]>();

    markers.forEach((marker, index) => {
      const rawLabel = marker.label.trim();
      const key = rawLabel.toLowerCase() || `__unnamed_${index}`;

      let group = labelMap.get(key);
      if (!group) {
        group = {
          key,
          label: rawLabel || `Señalado ${index + 1}`,
          items: [],
        };
        labelMap.set(key, group);
        groups.push(group);
      }
      group.items.push({ marker, originalIndex: index });
    });

    return groups;
  }, [markers]);

  // Center/focus on marker
  const focusOnMarker = useCallback((marker: InternalMarkerItem) => {
    setSelectedMarkerId(marker.id);
    if (!imageSize || marker.x == null || marker.y == null) return;
    const targetX = (0.5 - marker.x) * imageSize.width * zoomLevel;
    const targetY = (0.5 - marker.y) * imageSize.height * zoomLevel;
    setPosition({ x: targetX, y: targetY });
  }, [imageSize, zoomLevel]);

  // Quick set edge of a marker
  const setMarkerOriginEdge = useCallback((markerId: string, edge: PointerEdge | 'auto') => {
    pushHistory(markers);
    setMarkers(prev => prev.map(m => {
      if (m.id !== markerId || m.x == null || m.y == null) return m;
      if (edge === 'auto') {
        return { ...m, startX: null, startY: null };
      }
      if (edge === 'left') {
        return { ...m, startX: 0, startY: m.y };
      }
      if (edge === 'right') {
        return { ...m, startX: 1, startY: m.y };
      }
      if (edge === 'top') {
        return { ...m, startX: m.x, startY: 0 };
      }
      if (edge === 'bottom') {
        return { ...m, startX: m.x, startY: 1 };
      }
      return m;
    }));
    setHasUnsavedModifications(true);
  }, [markers, pushHistory]);

  // Determine current edge of active marker
  const currentActiveMarkerEdge = useMemo((): PointerEdge | 'auto' => {
    if (!activeSelectedMarker || activeSelectedMarker.startX == null || activeSelectedMarker.startY == null) {
      return 'auto';
    }
    if (activeSelectedMarker.startX <= 0.005) return 'left';
    if (activeSelectedMarker.startX >= 0.995) return 'right';
    if (activeSelectedMarker.startY <= 0.005) return 'top';
    if (activeSelectedMarker.startY >= 0.995) return 'bottom';
    return 'auto';
  }, [activeSelectedMarker]);

  // Finalize Freehand Polygon Region
  const finalizeFreehandPolygon = useCallback((rawPoints: number[]) => {
    if (rawPoints.length < 6) {
      setDrawingPolygonPoints([]);
      return;
    }

    const simplified = simplifyPoints(rawPoints, 0.0015);
    if (simplified.length < 6) {
      setDrawingPolygonPoints([]);
      return;
    }

    pushHistory(markers);
    const count = simplified.length / 2;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < simplified.length; i += 2) {
      sumX += simplified[i];
      sumY += simplified[i + 1];
    }
    const centroidX = sumX / count;
    const centroidY = sumY / count;

    // 1. ZONA DE EXCLUSIÓN / HUECO INTERIOR (DONA):
    // Si hay un marcador con región actualmente SELECCIONADO para edición y el trazo nuevo se dibujó dentro de él
    const targetSelectedMarker = selectedMarkerId ? markers.find(m => m.id === selectedMarkerId) : null;
    const isDrawnInsideSelected = Boolean(
      targetSelectedMarker &&
      targetSelectedMarker.regionPoints &&
      targetSelectedMarker.regionPoints.length >= 6 &&
      (
        pointInPolygon(centroidX, centroidY, targetSelectedMarker.regionPoints) ||
        pointInPolygon(simplified[0], simplified[1], targetSelectedMarker.regionPoints)
      )
    );

    if (isDrawnInsideSelected && targetSelectedMarker) {
      const existingHoles = targetSelectedMarker.regionHoles || [];
      const updatedHoles = [...existingHoles, simplified];

      setMarkers(prev => prev.map(m => m.id === targetSelectedMarker.id ? {
        ...m,
        regionHoles: updatedHoles,
      } : m));

      setDrawingPolygonPoints([]);
      setHasUnsavedModifications(true);
      return;
    }

    const labelToUse = currentCreationLabel.trim() || (activeTool === 'batch-border' ? 'Estructura múltiple' : (singlePickerMode && targetLabel ? targetLabel : `Región ${markers.length + 1}`));

    if (singlePickerMode) {
      const updated: InternalMarkerItem = {
        id: markers[0]?.id || `marker-${Date.now()}`,
        label: labelToUse,
        x: centroidX,
        y: centroidY,
        startX: null,
        startY: null,
        regionPoints: simplified,
        regionColor: drawingPolygonColor,
        regionOpacity: drawingPolygonOpacity,
      };
      setMarkers([updated]);
      setSelectedMarkerId(updated.id);
      setSessionMarkerIds([updated.id]);
      setDrawingPolygonPoints([]);
      setHasUnsavedModifications(true);
      return;
    }

    if (activeTool === 'border') {
      if (sessionMarkerIds.length > 0) {
        const existingId = sessionMarkerIds[0];
        setMarkers(prev => prev.map(m => m.id === existingId ? {
          ...m,
          label: labelToUse,
          x: centroidX,
          y: centroidY,
          regionPoints: simplified,
          regionColor: drawingPolygonColor,
          regionOpacity: drawingPolygonOpacity,
        } : m));
        setSelectedMarkerId(existingId);
      } else {
        const newMarker: InternalMarkerItem = {
          id: `marker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: labelToUse,
          x: centroidX,
          y: centroidY,
          regionPoints: simplified,
          regionColor: drawingPolygonColor,
          regionOpacity: drawingPolygonOpacity,
        };
        setMarkers(prev => [...prev, newMarker]);
        setSessionMarkerIds([newMarker.id]);
        setSelectedMarkerId(newMarker.id);
      }
      setDrawingPolygonPoints([]);
      setHasUnsavedModifications(true);
      return;
    }

    if (activeTool === 'batch-border') {
      const newMarker: InternalMarkerItem = {
        id: `marker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        label: labelToUse,
        x: centroidX,
        y: centroidY,
        regionPoints: simplified,
        regionColor: drawingPolygonColor,
        regionOpacity: drawingPolygonOpacity,
      };
      setMarkers(prev => [...prev, newMarker]);
      setSessionMarkerIds(prev => [...prev, newMarker.id]);
      setSelectedMarkerId(newMarker.id);
      setDrawingPolygonPoints([]);
      setHasUnsavedModifications(true);
      return;
    }
  }, [activeTool, currentCreationLabel, drawingPolygonColor, drawingPolygonOpacity, markers, pushHistory, sessionMarkerIds, singlePickerMode, targetLabel]);

  // Unified Pointer Down for Canvas (Handles Freehand Drawing and Panning)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (isPinching) return;

    if (e.button === 1 || isSpacePressed || (activeTool === 'pan' && !reassigningTipMarkerId)) {
      e.preventDefault();
      setIsDraggingCanvas(true);
      setDragStartMouse({ x: e.clientX, y: e.clientY });
      setDragStartPosition({ ...position });
      return;
    }

    if ((activeTool === 'border' || activeTool === 'batch-border') && !reassigningTipMarkerId) {
      const coords = clientToImageCoords(e.clientX, e.clientY);
      if (!coords) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setIsDrawingFreehand(true);
      setDrawingPolygonPoints([coords.x, coords.y]);
    }
  };

  // Unified Pointer Move for Canvas
  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    const coords = clientToImageCoords(e.clientX, e.clientY);
    if (coords) setCursorImagePos(coords);

    if (isDrawingFreehand && (activeTool === 'border' || activeTool === 'batch-border') && coords) {
      setDrawingPolygonPoints(prev => {
        if (prev.length < 2) return [coords.x, coords.y];
        const lastX = prev[prev.length - 2];
        const lastY = prev[prev.length - 1];
        const dist = Math.hypot(coords.x - lastX, coords.y - lastY);
        // Continuous sampling when moved by at least ~3-4px
        if (dist >= 0.003) {
          return [...prev, coords.x, coords.y];
        }
        return prev;
      });
      return;
    }

    if (isDraggingCanvas && dragStartMouse) {
      const dx = e.clientX - dragStartMouse.x;
      const dy = e.clientY - dragStartMouse.y;
      setPosition({
        x: dragStartPosition.x + dx,
        y: dragStartPosition.y + dy,
      });
    }
  };

  // Unified Pointer Up for Canvas
  const handleCanvasPointerUp = () => {
    if (isDrawingFreehand && (activeTool === 'border' || activeTool === 'batch-border')) {
      setIsDrawingFreehand(false);
      finalizeFreehandPolygon(drawingPolygonPoints);
      return;
    }

    setIsDraggingCanvas(false);
    setDragStartMouse(null);
  };

  // Double-click outside any marker deselects the current selection
  const handleCanvasDoubleClick = (event: React.MouseEvent) => {
    if (selectedMarkerId) {
      event.stopPropagation();
      setSelectedMarkerId(null);
      setSelectedVertex(null);
      setReassigningTipMarkerId(null);
    }
  };

  // Click on image canvas (For Pointer, Batch or Reassigning Tip)
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (isDraggingCanvas || isSpacePressed || isDrawingFreehand) return;

    const coords = clientToImageCoords(event.clientX, event.clientY);
    if (!coords) return;

    // 1. Reassign Tip Mode
    if (reassigningTipMarkerId) {
      pushHistory(markers);
      setMarkers(prev => prev.map(m => m.id === reassigningTipMarkerId ? { ...m, x: coords.x, y: coords.y } : m));
      setReassigningTipMarkerId(null);
      setActiveTool('pan');
      return;
    }

    if (activeTool === 'pan') return;

    pushHistory(markers);

    const labelToUse = currentCreationLabel.trim() || (activeTool === 'batch' ? 'Estructura múltiple' : (singlePickerMode && targetLabel ? targetLabel : `Señalado ${markers.length + 1}`));

    if (activeTool === 'pointer') {
      if (singlePickerMode) {
        const updated: InternalMarkerItem = {
          id: markers[0]?.id || `marker-${Date.now()}`,
          label: labelToUse,
          x: coords.x,
          y: coords.y,
          startX: null,
          startY: null,
          regionPoints: null,
        };
        setMarkers([updated]);
        setSelectedMarkerId(updated.id);
        setSessionMarkerIds([updated.id]);
        setHasUnsavedModifications(true);
        return;
      }

      if (sessionMarkerIds.length > 0) {
        // Si ya colocó el señalado individual en esta sesión, reposicionarlo al nuevo clic
        const existingId = sessionMarkerIds[0];
        setMarkers(prev => prev.map(m => m.id === existingId ? { ...m, x: coords.x, y: coords.y, label: labelToUse } : m));
        setSelectedMarkerId(existingId);
      } else {
        const newMarker: InternalMarkerItem = {
          id: `marker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          label: labelToUse,
          x: coords.x,
          y: coords.y,
          startX: null,
          startY: null,
        };
        setMarkers(prev => [...prev, newMarker]);
        setSessionMarkerIds([newMarker.id]);
        setSelectedMarkerId(newMarker.id);
      }
      setHasUnsavedModifications(true);
      return;
    }

    if (activeTool === 'batch') {
      const newMarker: InternalMarkerItem = {
        id: `marker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        label: labelToUse,
        x: coords.x,
        y: coords.y,
        startX: null,
        startY: null,
      };
      setMarkers(prev => [...prev, newMarker]);
      setSessionMarkerIds(prev => [...prev, newMarker.id]);
      setSelectedMarkerId(newMarker.id);
      setHasUnsavedModifications(true);
      return;
    }
  };

  // Handle Dragging Handles (Tip, Start, Vertex)
  useEffect(() => {
    if (!draggingHandle || !imageSize) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const coords = clientToImageCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (draggingHandle.type === 'tip') {
        setMarkers(prev => prev.map(m => m.id === draggingHandle.markerId ? { ...m, x: coords.x, y: coords.y } : m));
        setHasUnsavedModifications(true);
      } else if (draggingHandle.type === 'start') {
        const startPx = clampPointToNearestEdge(
          coords.x * imageSize.width,
          coords.y * imageSize.height,
          imageSize.width,
          imageSize.height
        );
        setMarkers(prev => prev.map(m => m.id === draggingHandle.markerId ? {
          ...m,
          startX: startPx.x / imageSize.width,
          startY: startPx.y / imageSize.height,
        } : m));
        setHasUnsavedModifications(true);
      } else if (draggingHandle.type === 'vertex' && draggingHandle.vertexIndex != null) {
        const vIdx = draggingHandle.vertexIndex;
        const hIdx = draggingHandle.holeIndex;

        setMarkers(prev => prev.map(m => {
          if (m.id !== draggingHandle.markerId) return m;

          if (hIdx != null && m.regionHoles && m.regionHoles[hIdx]) {
            const newHoles = m.regionHoles.map((hole, idx) => {
              if (idx !== hIdx) return hole;
              const nextHole = [...hole];
              nextHole[vIdx * 2] = coords.x;
              nextHole[vIdx * 2 + 1] = coords.y;
              return nextHole;
            });
            return { ...m, regionHoles: newHoles };
          }

          if (!m.regionPoints) return m;
          const nextPts = [...m.regionPoints];
          nextPts[vIdx * 2] = coords.x;
          nextPts[vIdx * 2 + 1] = coords.y;

          const count = nextPts.length / 2;
          let sumX = 0;
          let sumY = 0;
          for (let i = 0; i < nextPts.length; i += 2) {
            sumX += nextPts[i];
            sumY += nextPts[i + 1];
          }

          return {
            ...m,
            x: sumX / count,
            y: sumY / count,
            regionPoints: nextPts,
          };
        }));
        setHasUnsavedModifications(true);
      }
    };

    const handlePointerUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clientToImageCoords, draggingHandle, imageSize]);

  // Insert vertex on polygon edge (either outer boundary or hole)
  const insertVertexOnEdge = (markerId: string, segmentIndex: number, clientX: number, clientY: number, holeIndex?: number) => {
    const coords = clientToImageCoords(clientX, clientY);
    if (!coords) return;

    pushHistory(markers);
    setMarkers(prev => prev.map(m => {
      if (m.id !== markerId) return m;

      if (holeIndex != null && m.regionHoles && m.regionHoles[holeIndex]) {
        const newHoles = m.regionHoles.map((hole, hIdx) => {
          if (hIdx !== holeIndex) return hole;
          const nextHole = [...hole];
          nextHole.splice((segmentIndex + 1) * 2, 0, coords.x, coords.y);
          return nextHole;
        });
        return { ...m, regionHoles: newHoles };
      }

      if (!m.regionPoints) return m;
      const nextPts = [...m.regionPoints];
      nextPts.splice((segmentIndex + 1) * 2, 0, coords.x, coords.y);
      return { ...m, regionPoints: nextPts };
    }));
    setSelectedMarkerId(markerId);
    setSelectedVertex({ vertexIndex: segmentIndex + 1, holeIndex });
  };

  // Touch Pinch Handlers for 2-finger zoom and pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      if (isDrawingFreehand) {
        setIsDrawingFreehand(false);
        setDrawingPolygonPoints([]);
      }
      setIsDraggingCanvas(false);
      setDragStartMouse(null);
      setIsPinching(true);

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchRef.current = {
        dist: Math.max(dist, 1),
        startZoom: zoomLevel,
        midX: (t1.clientX + t2.clientX) / 2,
        midY: (t1.clientY + t2.clientY) / 2,
        startPos: { ...position },
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const currentMidX = (t1.clientX + t2.clientX) / 2;
      const currentMidY = (t1.clientY + t2.clientY) / 2;

      const scale = dist / pinchRef.current.dist;
      const nextZoom = clamp(Number((pinchRef.current.startZoom * scale).toFixed(3)), ZOOM_MIN, ZOOM_MAX);

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const initialMidRelX = pinchRef.current.midX - rect.left - rect.width / 2;
        const initialMidRelY = pinchRef.current.midY - rect.top - rect.height / 2;
        const currentMidRelX = currentMidX - rect.left - rect.width / 2;
        const currentMidRelY = currentMidY - rect.top - rect.height / 2;

        const scaleRatio = nextZoom / pinchRef.current.startZoom;
        const nextPosX = currentMidRelX - (initialMidRelX - pinchRef.current.startPos.x) * scaleRatio;
        const nextPosY = currentMidRelY - (initialMidRelY - pinchRef.current.startPos.y) * scaleRatio;

        setPosition({ x: Math.round(nextPosX), y: Math.round(nextPosY) });
      }

      setZoomLevel(nextZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
      setIsPinching(false);
    }
  };

  // Save / Exit Handlers
  const handleRequestClose = () => {
    if (hasUnsavedModifications) {
      setShowExitConfirm(true);
    } else {
      onCancel();
    }
  };

  // Finaliza y guarda la sesión de la herramienta activa, asigna el nombre a todos los creados y pasa a Mano
  const handleSaveCurrentToolSession = useCallback(() => {
    const finalLabel = currentCreationLabel.trim();

    if (sessionMarkerIds.length > 0) {
      const labelToApply = finalLabel || (activeTool === 'batch' || activeTool === 'batch-border' ? 'Estructura múltiple' : `Señalado ${markers.length}`);
      setMarkers(prev => prev.map(m => sessionMarkerIds.includes(m.id) ? { ...m, label: labelToApply } : m));
    }

    setActiveTool('pan');
    setCurrentCreationLabel('');
    setSessionMarkerIds([]);
    setSelectedMarkerId(null);
    setDrawingPolygonPoints([]);
    setIsDrawingFreehand(false);
    setReassigningTipMarkerId(null);
    setHasUnsavedModifications(true);
  }, [activeTool, currentCreationLabel, markers.length, sessionMarkerIds]);

  const handleConfirmSave = () => {
    setIsSavingLocally(true);
    setHasUnsavedModifications(false);

    // Sincronizar nombres de la sesión activa
    let markersToSave = markers;
    if (sessionMarkerIds.length > 0) {
      const finalLabel = currentCreationLabel.trim() || (activeTool === 'batch' || activeTool === 'batch-border' ? 'Estructura múltiple' : `Señalado ${markers.length}`);
      markersToSave = markers.map(m => sessionMarkerIds.includes(m.id) ? { ...m, label: finalLabel } : m);
      setMarkers(markersToSave);
    }

    // Regresar a herramienta mano y reiniciar sesión
    setActiveTool('pan');
    setCurrentCreationLabel('');
    setSessionMarkerIds([]);
    setSelectedMarkerId(null);
    setDrawingPolygonPoints([]);
    setIsDrawingFreehand(false);
    setReassigningTipMarkerId(null);

    // 1. Single Picker Mode
    if (singlePickerMode) {
      const placedMarker = (activeSelectedMarker && activeSelectedMarker.x != null)
        ? activeSelectedMarker
        : (markersToSave.find(m => m.x != null && m.y != null) || markersToSave[0]);

      if (placedMarker && placedMarker.x != null && placedMarker.y != null) {
        onSaveSingle?.({
          x: placedMarker.x,
          y: placedMarker.y,
          startX: placedMarker.startX ?? null,
          startY: placedMarker.startY ?? null,
          regionPoints: placedMarker.regionPoints ?? null,
          regionHoles: placedMarker.regionHoles ?? null,
          regionColor: placedMarker.regionColor ?? '#22c55e',
          regionOpacity: placedMarker.regionOpacity ?? 0.28,
        }, placedMarker.label);
      } else {
        onSaveSingle?.(null, placedMarker?.label);
      }
    } else if (batchPickerMode) {
      // 2. Batch Picker Mode
      const validLocations: MarkerLocation[] = markersToSave
        .filter(m => m.x != null && m.y != null)
        .map(m => ({
          x: m.x!,
          y: m.y!,
          startX: m.startX ?? null,
          startY: m.startY ?? null,
          regionPoints: m.regionPoints ?? null,
          regionHoles: m.regionHoles ?? null,
          regionColor: m.regionColor ?? '#22c55e',
          regionOpacity: m.regionOpacity ?? 0.28,
        }));
      onSaveBatch?.(validLocations, currentCreationLabel || targetLabel || markersToSave[0]?.label);
    } else {
      // 3. Full Plate Save All
      const finalLabels: string[] = [];
      const finalPositions: Array<MarkerLocation | null> = [];

      markersToSave.forEach((m, idx) => {
        const label = m.label.trim() || `Señalado ${idx + 1}`;
        finalLabels.push(label);
        if (m.x != null && m.y != null) {
          finalPositions.push({
            x: m.x,
            y: m.y,
            startX: m.startX ?? null,
            startY: m.startY ?? null,
            regionPoints: m.regionPoints ?? null,
            regionHoles: m.regionHoles ?? null,
            regionColor: m.regionColor ?? '#22c55e',
            regionOpacity: m.regionOpacity ?? 0.28,
          });
        } else {
          finalPositions.push(null);
        }
      });

      onSaveAll?.(finalLabels, finalPositions);
    }

    // Finish saving spinner and display persistent confirmation toast
    setTimeout(() => {
      setIsSavingLocally(false);
      setSaveSuccessNotification('¡Señalados guardados correctamente!');
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setSaveSuccessNotification(null);
      }, 2800);
    }, 350);
  };

  return createPortal(
    <div
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1750,
        display: 'flex',
        flexDirection: 'row',
        background: 'rgba(15, 23, 42, 0.65)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        userSelect: 'none',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <style>
        {`
        @keyframes pulseGlowLight {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.5); transform: scale(1); }
          50% { box-shadow: 0 0 0 10px rgba(14, 165, 233, 0); transform: scale(1.06); }
        }
        @keyframes drawerSlideInLight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        `}
      </style>

      {/* Main Viewport & Canvas Area (MODO CLARO) */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(ellipse at top, #ffffff 0%, #f1f5f9 45%, #e2e8f0 100%)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: reassigningTipMarkerId
            ? 'crosshair'
            : (isSpacePressed || (activeTool === 'pan' && isDraggingCanvas)
              ? 'grabbing'
              : (activeTool === 'pan'
                ? 'grab'
                : ((activeTool === 'border' || activeTool === 'batch-border') ? 'crosshair' : 'default'))),
        }}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {/* Top Left Title & Topic Info */}
        {(temaNombre || subtemaNombre) && (
          <div style={{ position: 'absolute', top: 16, left: 86, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.94)',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '7px 16px',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#0f172a',
                fontSize: '0.85em',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
              }}
            >
              {temaNombre && <span style={{ color: '#0369a1' }}>{temaNombre}</span>}
              {subtemaNombre && <span style={{ color: '#475569' }}>• {subtemaNombre}</span>}
            </div>
          </div>
        )}

        {/* Top Center Toast Notification (Guardando / Guardado con éxito) */}
        {(isSavingLocally || saveSuccessNotification) && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              background: isSavingLocally
                ? 'rgba(255, 255, 255, 0.98)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: isSavingLocally ? '#0369a1' : '#ffffff',
              border: isSavingLocally ? '1.5px solid #38bdf8' : '1.5px solid #059669',
              borderRadius: '999px',
              padding: '9px 24px',
              fontWeight: 800,
              fontSize: '0.88em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: isSavingLocally
                ? '0 10px 30px rgba(14, 165, 233, 0.25)'
                : '0 10px 30px rgba(16, 185, 129, 0.35)',
              backdropFilter: 'blur(16px)',
              animation: 'pulseGlowLight 0.3s ease',
            }}
          >
            {isSavingLocally ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Guardando señalados en la placa...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>{saveSuccessNotification}</span>
              </>
            )}
          </div>
        )}

        {/* Top Right Controls when Sidebar is Closed */}
        {!sidebarOpen && (
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 30 }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              title="Abrir panel inspector"
              style={{
                background: '#ffffff',
                color: '#0284c7',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.1)',
              }}
            >
              <PanelRightOpen size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* VERTICAL STUDIO TOOLBAR (Lado Izquierdo, de gran altura y proporción) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 18,
            transform: 'translateY(-50%)',
            height: 'calc(100% - 36px)',
            maxHeight: '840px',
            width: '56px',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '20px',
            padding: '12px 6px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.05)',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Section: Tool Switchers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: '#f1f5f9', borderRadius: '14px', padding: '4px', width: '100%', alignItems: 'center' }}>
            <button
              type="button"
              aria-label="Mano"
              title="Mano / Paneo (mover la placa libremente)"
              onClick={() => handleSelectTool('pan')}
              style={{
                border: 'none',
                background: activeTool === 'pan' && !reassigningTipMarkerId ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                color: activeTool === 'pan' && !reassigningTipMarkerId ? '#fff' : '#475569',
                borderRadius: '10px',
                width: '42px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Hand size={19} />
            </button>

            <button
              type="button"
              aria-label="Individual"
              title="Señalado Individual (1 clic para ubicar señal)"
              onClick={() => handleSelectTool('pointer')}
              style={{
                border: 'none',
                background: activeTool === 'pointer' ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : 'transparent',
                color: activeTool === 'pointer' ? '#fff' : '#475569',
                borderRadius: '10px',
                width: '42px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <MousePointer size={19} />
            </button>

            <button
              type="button"
              aria-label="Múltiples"
              title="Punteros Múltiples (clics sucesivos para la misma estructura)"
              onClick={() => handleSelectTool('batch')}
              style={{
                border: 'none',
                background: activeTool === 'batch' ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : 'transparent',
                color: activeTool === 'batch' ? '#fff' : '#475569',
                borderRadius: '10px',
                width: '42px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={19} />
            </button>

            <button
              type="button"
              aria-label="Borde"
              title="Borde Individual (1 región a mano alzada)"
              onClick={() => handleSelectTool('border')}
              style={{
                border: 'none',
                background: activeTool === 'border' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: activeTool === 'border' ? '#fff' : '#475569',
                borderRadius: '10px',
                width: '42px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <PenTool size={19} />
            </button>

            <button
              type="button"
              aria-label="Bordes Múltiples"
              title="Bordes Múltiples (dibuja varias regiones para la misma estructura)"
              onClick={() => handleSelectTool('batch-border')}
              style={{
                border: 'none',
                background: activeTool === 'batch-border' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: activeTool === 'batch-border' ? '#fff' : '#475569',
                borderRadius: '10px',
                width: '42px',
                height: '40px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={19} style={{ color: activeTool === 'batch-border' ? '#fff' : '#059669' }} />
            </button>
          </div>

          <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} />

          {/* Middle Section: Visual Style & Colors */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              title={markerVisualMode === 'pointer' ? 'Estilo: Aguja (Clic para Flecha)' : 'Estilo: Flecha (Clic para Aguja)'}
              onClick={() => setMarkerVisualMode(m => m === 'pointer' ? 'arrow' : 'pointer')}
              style={{
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                borderRadius: '10px',
                width: '40px',
                height: '36px',
                fontSize: '1.1em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {markerVisualMode === 'pointer' ? '📍' : '🏹'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {MARKER_COLOR_OPTIONS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  title={`Color: ${c.label}`}
                  onClick={() => setMarkerColorKey(c.key)}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '999px',
                    background: c.fill,
                    border: markerColorKey === c.key ? '2.5px solid #0ea5e9' : `1.5px solid #94a3b8`,
                    cursor: 'pointer',
                    transform: markerColorKey === c.key ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: markerColorKey === c.key ? '0 0 6px rgba(14, 165, 233, 0.4)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} />

          {/* Zoom Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <button
              type="button"
              title="Acercar (+)"
              onClick={() => setZoomLevel(z => clamp(Number((z + ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#334155',
                width: '36px',
                height: '30px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ZoomIn size={18} />
            </button>
            <span
              onClick={() => { setZoomLevel(1); setPosition({ x: 0, y: 0 }); }}
              title="Restablecer zoom a 100%"
              style={{
                fontSize: '0.72em',
                fontWeight: 800,
                color: '#0284c7',
                textAlign: 'center',
                cursor: 'pointer',
                padding: '2px 0',
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              title="Alejar (-)"
              onClick={() => setZoomLevel(z => clamp(Number((z - ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX))}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#334155',
                width: '36px',
                height: '30px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ZoomOut size={18} />
            </button>
          </div>

          <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} />

          {/* Bottom Section: Canvas Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              title="Rotar 90°"
              onClick={() => setRotation(r => (r + 90) % 360)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#334155',
                width: '36px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RotateCw size={17} />
            </button>

            <button
              type="button"
              title={showAllMarkers ? 'Ocultar todos los señalados' : 'Mostrar todos los señalados'}
              onClick={() => setShowAllMarkers(v => !v)}
              style={{
                border: 'none',
                background: showAllMarkers ? 'transparent' : '#fee2e2',
                color: showAllMarkers ? '#334155' : '#dc2626',
                width: '36px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showAllMarkers ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>

            <button
              type="button"
              title="Mover todos los señalados a la vez"
              onClick={() => setShowMoveAllModal(true)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4f46e5',
                width: '36px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Move size={17} />
            </button>

            <button
              type="button"
              title="Deshacer (Ctrl+Z)"
              disabled={historyStack.length === 0 && drawingPolygonPoints.length === 0}
              onClick={handleUndo}
              style={{
                border: 'none',
                background: 'transparent',
                color: (historyStack.length > 0 || drawingPolygonPoints.length > 0) ? '#334155' : '#94a3b8',
                width: '36px',
                height: '32px',
                borderRadius: '8px',
                cursor: (historyStack.length > 0 || drawingPolygonPoints.length > 0) ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Undo size={17} />
            </button>
          </div>
        </div>

        {/* Interactive Image & SVG Stage (Crisp High-Res Render) */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: (isDraggingCanvas || isPinching) ? 'none' : 'transform 0.08s ease-out',
            display: 'inline-block',
          }}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
        >
          {/* Base Plate Image (High Resolution) */}
          <img
            ref={imageRef}
            src={resolvedImageSrc}
            alt={imageAlt ?? 'Placa histológica de alta calidad'}
            draggable={false}
            style={{
              display: 'block',
              maxWidth: '85vw',
              maxHeight: '85vh',
              width: 'auto',
              height: 'auto',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              pointerEvents: 'none',
              background: '#ffffff',
            }}
            onLoad={updateImageDimensions}
          />

          {/* Interactive SVG Overlay */}
          {imageSize && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: imageSize.width,
                height: imageSize.height,
                pointerEvents: 'auto',
              }}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            >
              {/* Render Saved Markers (con orden Z inteligente: regiones grandes al fondo, regiones pequeñas/contenidas y punteros encima) */}
              {showAllMarkers && sortedMarkersForRendering.map((marker) => {
                const isSelected = marker.id === selectedMarkerId;
                const originalIndex = markers.findIndex(m => m.id === marker.id);

                // 1. Polygon Region (con soporte de donas / zonas de exclusión interiores)
                if (marker.regionPoints && marker.regionPoints.length >= 6) {
                  const pts = Array.from({ length: marker.regionPoints.length / 2 }, (_, i) => ({
                    x: marker.regionPoints![i * 2] * imageSize.width,
                    y: marker.regionPoints![i * 2 + 1] * imageSize.height,
                  }));
                  const pathD = getPolygonPathD(marker.regionPoints, marker.regionHoles, imageSize.width, imageSize.height);

                  return (
                    <g key={marker.id}>
                      <path
                        d={pathD}
                        fill={marker.regionColor ?? '#22c55e'}
                        fillOpacity={marker.regionOpacity ?? 0.28}
                        fillRule="evenodd"
                        stroke={marker.regionColor ?? '#22c55e'}
                        strokeWidth={isSelected ? 3.5 : 2.5}
                        strokeDasharray={isSelected ? '8 4' : undefined}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMarkerId(marker.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                        }}
                      />

                      {/* Interactive Vertex Handles on Outer Polygon when selected */}
                      {isSelected && pts.map((pt, vIdx) => {
                        const isVertexSelected = selectedVertex?.holeIndex == null && selectedVertex?.vertexIndex === vIdx;
                        return (
                          <g key={`outer-v-${vIdx}`}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={8 / zoomLevel}
                              fill={isVertexSelected ? '#f59e0b' : '#ffffff'}
                              stroke={marker.regionColor ?? '#22c55e'}
                              strokeWidth={2.5 / zoomLevel}
                              style={{ cursor: 'move' }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                (e.target as Element).setPointerCapture?.(e.pointerId);
                                setSelectedVertex({ vertexIndex: vIdx });
                                setDraggingHandle({ markerId: marker.id, type: 'vertex', vertexIndex: vIdx });
                              }}
                            />

                            {/* Midpoint '+' handle to insert vertex */}
                            {(() => {
                              const nextPt = pts[(vIdx + 1) % pts.length];
                              const midX = (pt.x + nextPt.x) / 2;
                              const midY = (pt.y + nextPt.y) / 2;
                              return (
                                <g
                                  key={`mid-${vIdx}`}
                                  style={{ cursor: 'copy' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    insertVertexOnEdge(marker.id, vIdx, e.clientX, e.clientY);
                                  }}
                                >
                                  <circle
                                    cx={midX}
                                    cy={midY}
                                    r={4.5 / zoomLevel}
                                    fill="#ffffff"
                                    stroke="#0ea5e9"
                                    strokeWidth={1.5 / zoomLevel}
                                    style={{ opacity: 0.9 }}
                                  >
                                    <title>Clic para insertar vértice en el borde exterior</title>
                                  </circle>
                                </g>
                              );
                            })()}
                          </g>
                        );
                      })}

                      {/* Interactive Vertex Handles & Controls on Exclusion Zones (Holes) when selected */}
                      {isSelected && marker.regionHoles && marker.regionHoles.map((hole, hIdx) => {
                        if (hole.length < 6) return null;
                        const holePts = Array.from({ length: hole.length / 2 }, (_, i) => ({
                          x: hole[i * 2] * imageSize.width,
                          y: hole[i * 2 + 1] * imageSize.height,
                        }));
                        const isHoleSelected = selectedHoleIndex === hIdx || selectedVertex?.holeIndex === hIdx;
                        const holePointsStr = holePts.map(p => `${p.x},${p.y}`).join(' ');

                        let holeSumX = 0;
                        let holeSumY = 0;
                        holePts.forEach(p => { holeSumX += p.x; holeSumY += p.y; });
                        const holeCentroidX = holeSumX / holePts.length;
                        const holeCentroidY = holeSumY / holePts.length;

                        return (
                          <g key={`hole-group-${hIdx}`}>
                            {/* Interactive Hole Selection Outline & Hit Area */}
                            <polygon
                              points={holePointsStr}
                              fill={isHoleSelected ? 'rgba(239, 68, 68, 0.22)' : 'transparent'}
                              stroke={isHoleSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.65)'}
                              strokeWidth={(isHoleSelected ? 3.5 : 2) / zoomLevel}
                              strokeDasharray={isHoleSelected ? '8 4' : '5 4'}
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHoleIndex(hIdx);
                                setSelectedVertex(null);
                              }}
                            >
                              <title>Zona de exclusión #{hIdx + 1} (Clic para seleccionar / eliminar)</title>
                            </polygon>

                            {/* Floating On-Canvas Delete Badge for Selected Hole */}
                            {isHoleSelected && (
                              <g
                                transform={`translate(${holeCentroidX}, ${holeCentroidY})`}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteHole(marker.id, hIdx);
                                }}
                              >
                                <rect
                                  x={-42 / zoomLevel}
                                  y={-13 / zoomLevel}
                                  width={84 / zoomLevel}
                                  height={26 / zoomLevel}
                                  rx={13 / zoomLevel}
                                  fill="#ef4444"
                                  stroke="#ffffff"
                                  strokeWidth={1.8 / zoomLevel}
                                  style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.35))' }}
                                />
                                <text
                                  x={0}
                                  y={4.5 / zoomLevel}
                                  textAnchor="middle"
                                  fill="#ffffff"
                                  fontSize={11 / zoomLevel}
                                  fontWeight="800"
                                  fontFamily="Inter, sans-serif"
                                >
                                  🗑️ Quitar
                                </text>
                              </g>
                            )}

                            {/* Vertex Handles for this hole */}
                            {holePts.map((hPt, vIdx) => {
                              const isVertexSelected = selectedVertex?.holeIndex === hIdx && selectedVertex?.vertexIndex === vIdx;
                              const nextPt = holePts[(vIdx + 1) % holePts.length];
                              const midX = (hPt.x + nextPt.x) / 2;
                              const midY = (hPt.y + nextPt.y) / 2;

                              return (
                                <g key={`hole-${hIdx}-v-${vIdx}`}>
                                  <circle
                                    cx={hPt.x}
                                    cy={hPt.y}
                                    r={7.5 / zoomLevel}
                                    fill={isVertexSelected ? '#f59e0b' : '#ffffff'}
                                    stroke="#ef4444"
                                    strokeWidth={2 / zoomLevel}
                                    style={{ cursor: 'move' }}
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      (e.target as Element).setPointerCapture?.(e.pointerId);
                                      setSelectedVertex({ vertexIndex: vIdx, holeIndex: hIdx });
                                      setSelectedHoleIndex(hIdx);
                                      setDraggingHandle({ markerId: marker.id, type: 'vertex', vertexIndex: vIdx, holeIndex: hIdx });
                                    }}
                                  >
                                    <title>Vértice de zona de exclusión (hueco)</title>
                                  </circle>

                                  {/* Midpoint '+' handle on hole edge */}
                                  <g
                                    style={{ cursor: 'copy' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      insertVertexOnEdge(marker.id, vIdx, e.clientX, e.clientY, hIdx);
                                    }}
                                  >
                                    <circle
                                      cx={midX}
                                      cy={midY}
                                      r={4 / zoomLevel}
                                      fill="#ffffff"
                                      stroke="#ef4444"
                                      strokeWidth={1.5 / zoomLevel}
                                      style={{ opacity: 0.9 }}
                                    >
                                      <title>Clic para insertar vértice en el hueco</title>
                                    </circle>
                                  </g>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                    </g>
                  );
                }

                // 2. Simple or Batch Pointer Marker
                if (marker.x != null && marker.y != null) {
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
                    : enforceMinimumInclination(autoStart, endPx, imageSize.width, imageSize.height, POINTER_MIN_ANGLE_DEG);

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

                  // Arrow mode transformation
                  const svgPoints = [{ x: 140, y: 80 }, { x: 30, y: 20 }, { x: 55, y: 80 }, { x: 30, y: 140 }];
                  const actualTail = {
                    x: endPx.x - ux * Math.min(ARROW_TAIL_DISTANCE_PX, directionLen * 0.95),
                    y: endPx.y - uy * Math.min(ARROW_TAIL_DISTANCE_PX, directionLen * 0.95),
                  };
                  const angleSvg = Math.atan2(0, 110);
                  const angleReal = Math.atan2(endPx.y - actualTail.y, endPx.x - actualTail.x);
                  const rot = angleReal - angleSvg;
                  const cosR = Math.cos(rot);
                  const sinR = Math.sin(rot);
                  const scaleR = Math.hypot(endPx.x - actualTail.x, endPx.y - actualTail.y) / 110;

                  const transformedArrowPoints = svgPoints.map(pt => {
                    const x0 = pt.x - 30;
                    const y0 = pt.y - 80;
                    return {
                      x: actualTail.x + (x0 * cosR - y0 * sinR) * scaleR,
                      y: actualTail.y + (x0 * sinR + y0 * cosR) * scaleR,
                    };
                  });
                  const arrowPointsStr = transformedArrowPoints.map(p => `${p.x},${p.y}`).join(' ');

                  return (
                    <g
                      key={marker.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarkerId(marker.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Generous transparent hit-area for effortless clicking */}
                      <line
                        x1={startPx.x}
                        y1={startPx.y}
                        x2={endPx.x}
                        y2={endPx.y}
                        stroke="transparent"
                        strokeWidth={28 / zoomLevel}
                      />

                      {/* Selection Glow Aura */}
                      {isSelected && (
                        <line
                          x1={startPx.x}
                          y1={startPx.y}
                          x2={endPx.x}
                          y2={endPx.y}
                          stroke="#38bdf8"
                          strokeWidth={14 / zoomLevel}
                          strokeLinecap="round"
                          opacity={0.5}
                        />
                      )}

                      {/* Pointer Geometry */}
                      {markerVisualMode === 'arrow' ? (
                        <>
                          <polygon
                            points={arrowPointsStr}
                            fill={activeMarkerColor.fill}
                            stroke={isSelected ? '#0ea5e9' : activeMarkerColor.edge}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                          />
                        </>
                      ) : (
                        <>
                          <polygon
                            points={polygonPointsStr(outline)}
                            fill={isSelected ? '#38bdf8' : activeMarkerColor.edge}
                            opacity={isSelected ? 1 : 0.85}
                          />
                          <polygon
                            points={polygonPointsStr(core)}
                            fill={activeMarkerColor.fill}
                          />
                        </>
                      )}

                      {/* Guide connection line when Selected */}
                      {isSelected && (
                        <line
                          x1={startPx.x}
                          y1={startPx.y}
                          x2={endPx.x}
                          y2={endPx.y}
                          stroke="#0284c7"
                          strokeWidth={1.5 / zoomLevel}
                          strokeDasharray="4 3"
                          opacity={0.7}
                        />
                      )}

                      {/* Interactive Drag Handles when Selected */}
                      {isSelected && (() => {
                        // Position the tip control on the pointer shaft slightly behind the tip
                        const handleBackoff = Math.min(32 / zoomLevel, directionLen * 0.35);
                        const handleX = endPx.x - ux * handleBackoff;
                        const handleY = endPx.y - uy * handleBackoff;

                        return (
                          <>
                            {/* 1. Base / Start Handle along the image edge */}
                            <g
                              style={{ cursor: 'move' }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                (e.target as Element).setPointerCapture?.(e.pointerId);
                                setDraggingHandle({ markerId: marker.id, type: 'start' });
                              }}
                            >
                              {/* Transparent touch area */}
                              <circle cx={startPx.x} cy={startPx.y} r={18 / zoomLevel} fill="transparent" />
                              {/* Outer ring */}
                              <circle
                                cx={startPx.x}
                                cy={startPx.y}
                                r={11 / zoomLevel}
                                fill="#ffffff"
                                stroke="#6366f1"
                                strokeWidth={2.5 / zoomLevel}
                              />
                              {/* Inner solid grip */}
                              <circle
                                cx={startPx.x}
                                cy={startPx.y}
                                r={5 / zoomLevel}
                                fill="#6366f1"
                              />
                              <title>Arrastra para mover la base de origen por el borde</title>
                            </g>

                            {/* Precise tip marker dot at exact tissue location */}
                            <circle
                              cx={endPx.x}
                              cy={endPx.y}
                              r={3.5 / zoomLevel}
                              fill="#0ea5e9"
                              stroke="#ffffff"
                              strokeWidth={1.5 / zoomLevel}
                            />

                            {/* 2. Tip Control Handle (Ubicado sobre el cuerpo del señalador, un poco más atrás de la punta) */}
                            <g
                              style={{ cursor: 'move' }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                (e.target as Element).setPointerCapture?.(e.pointerId);
                                setDraggingHandle({ markerId: marker.id, type: 'tip' });
                              }}
                            >
                              {/* Transparent generous hit area */}
                              <circle cx={handleX} cy={handleY} r={20 / zoomLevel} fill="transparent" />
                              {/* Outer solid ring */}
                              <circle
                                cx={handleX}
                                cy={handleY}
                                r={11 / zoomLevel}
                                fill="#ffffff"
                                stroke="#0284c7"
                                strokeWidth={2.5 / zoomLevel}
                                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                              />
                              {/* Center Target Grip */}
                              <circle
                                cx={handleX}
                                cy={handleY}
                                r={5 / zoomLevel}
                                fill="#0ea5e9"
                              />
                              <title>Arrastra sobre el cuerpo del señalador para mover la punta</title>
                            </g>
                          </>
                        );
                      })()}

                      {/* Index badge placed over the arrow/needle body, behind the tip */}
                      {(() => {
                        const badgeBackoff = Math.min(52 / zoomLevel, directionLen * 0.55);
                        const badgeX = endPx.x - ux * badgeBackoff;
                        const badgeY = endPx.y - uy * badgeBackoff;
                        const badgeSize = 22 / zoomLevel;

                        return (
                          <g transform={`translate(${badgeX - badgeSize / 2}, ${badgeY - badgeSize / 2})`}>
                            <rect
                              width={badgeSize}
                              height={badgeSize}
                              rx={badgeSize / 2}
                              fill="#0f172a"
                              stroke={isSelected ? '#38bdf8' : '#ffffff'}
                              strokeWidth={1.5 / zoomLevel}
                              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                            />
                            <text
                              x={badgeSize / 2}
                              y={badgeSize * 0.68}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={11 / zoomLevel}
                              fontWeight="800"
                              fontFamily="Inter, sans-serif"
                            >
                              {originalIndex !== -1 ? originalIndex + 1 : 1}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                }

                return null;
              })}

              {/* Live Freehand Polygon Drawing In-Progress */}
              {(activeTool === 'border' || activeTool === 'batch-border') && drawingPolygonPoints.length >= 4 && (
                <g>
                  {/* Filled preview */}
                  <polygon
                    points={Array.from({ length: drawingPolygonPoints.length / 2 }, (_, i) => `${drawingPolygonPoints[i * 2] * imageSize.width},${drawingPolygonPoints[i * 2 + 1] * imageSize.height}`).join(' ')}
                    fill={drawingPolygonColor}
                    fillOpacity={drawingPolygonOpacity}
                    stroke={drawingPolygonColor}
                    strokeWidth={3 / zoomLevel}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Pulsing brush tip at current position */}
                  {cursorImagePos && (
                    <circle
                      cx={cursorImagePos.x * imageSize.width}
                      cy={cursorImagePos.y * imageSize.height}
                      r={7 / zoomLevel}
                      fill={drawingPolygonColor}
                      stroke="#ffffff"
                      strokeWidth={2 / zoomLevel}
                    />
                  )}
                </g>
              )}
            </svg>
          )}
        </div>

        {/* Minimap Thumbnail Navigator (Bottom Right del Visor) (MODO CLARO) */}
        {resolvedImageSrc && isDesktop && (
          <div
            ref={minimapRef}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              zIndex: 30,
              width: '150px',
              height: '100px',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
            }}
          >
            <img
              src={resolvedImageSrc}
              alt="Minimapa"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.8,
                display: 'block',
              }}
            />
            {/* Viewport Frame in minimap */}
            <div
              style={{
                position: 'absolute',
                top: `${clamp(50 - (position.y / (imageSize?.height || 1)) * 50 - (25 / zoomLevel), 0, 80)}%`,
                left: `${clamp(50 - (position.x / (imageSize?.width || 1)) * 50 - (25 / zoomLevel), 0, 80)}%`,
                width: `${clamp(100 / zoomLevel, 15, 100)}%`,
                height: `${clamp(100 / zoomLevel, 15, 100)}%`,
                border: '2px solid #0284c7',
                borderRadius: '4px',
                background: 'rgba(2, 132, 199, 0.16)',
                boxShadow: '0 0 8px rgba(2, 132, 199, 0.35)',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* Helper Hint at Bottom Center (MODO CLARO) */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            background: 'rgba(255, 255, 255, 0.96)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '999px',
            padding: '7px 18px',
            color: '#1e293b',
            fontSize: '0.82em',
            fontWeight: 700,
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.1)',
          }}
        >
          {reassigningTipMarkerId && (
            <span style={{ color: '#0284c7' }}>🎯 Haz clic en cualquier lugar de la placa para colocar la nueva punta del señalado.</span>
          )}
          {!reassigningTipMarkerId && activeTool === 'pointer' && (
            <span>📍 Haz clic en la placa para colocar el señalado.</span>
          )}
          {!reassigningTipMarkerId && activeTool === 'batch' && (
            <span>📍📍 Haz clics sucesivos para colocar múltiples puntos con el mismo nombre.</span>
          )}
          {!reassigningTipMarkerId && activeTool === 'border' && (
            <span>✍️ <strong>Mantén presionado y arrastra</strong> para dibujar el contorno. Al soltar, se cerrará y guardará automáticamente.</span>
          )}
          {!reassigningTipMarkerId && activeTool === 'batch-border' && (
            <span>✍️✍️ <strong>Dibuja múltiples bordes</strong> seguidos para la misma estructura. Mantén presionado y suelta para cada región.</span>
          )}
          {!reassigningTipMarkerId && activeTool === 'pan' && (
            <span>✋ Toca cualquier señalado para editar su punta o borde de origen. Arrastra para explorar.</span>
          )}
        </div>
      </div>

      {/* Right Inspector & Marker List Drawer (MODO CLARO) */}
      {sidebarOpen && (
        <aside
          style={{
            width: isDesktop ? '310px' : '280px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            borderLeft: '1px solid #cbd5e1',
            boxShadow: '-10px 0 35px rgba(15, 23, 42, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            animation: 'drawerSlideInLight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.98em', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#0284c7" /> Editor de Señalados
              </div>
              <div style={{ fontSize: '0.78em', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{markers.length} {markers.length === 1 ? 'señalado' : 'señalados'}</span>
                {aumento && <span>• 🔬 {aumento}</span>}
                {tincion && <span>• 🧪 {tincion}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Ocultar barra lateral"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                padding: '6px',
                cursor: 'pointer',
                borderRadius: '8px',
              }}
            >
              <PanelRightClose size={18} />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Active Tool Creation Form Card (solo se muestra cuando hay una herramienta activa distinta de Mano) */}
            {activeTool !== 'pan' && (
              <div
                style={{
                  borderRadius: '14px',
                  border: '1.5px solid #dbeafe',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(14, 165, 233, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ fontSize: '0.82em', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {activeTool === 'pointer' ? '📍 Nuevo Señalado Individual' : activeTool === 'batch' ? '📍📍 Nuevos Señalados Múltiples' : activeTool === 'border' ? '✍️ Nuevo Borde Individual' : '✍️✍️ Nuevos Bordes Múltiples'}
                  </div>
                  {sessionMarkerIds.length > 0 && (
                    <span style={{ fontSize: '0.74em', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
                      {sessionMarkerIds.length} {sessionMarkerIds.length === 1 ? 'colocado' : 'colocados'}
                    </span>
                  )}
                </div>

                {/* Name input */}
                <div>
                  <label style={{ fontSize: '0.8em', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Nombre / Estructura del señalado:
                  </label>
                  <BoldField
                    as="input"
                    inline
                    value={currentCreationLabel}
                    placeholder="Ej: Núcleo celular, Vellosidad..."
                    onChange={(val) => {
                      setCurrentCreationLabel(val);
                      if (sessionMarkerIds.length > 0) {
                        setMarkers(prev => prev.map(m => sessionMarkerIds.includes(m.id) ? { ...m, label: val } : m));
                        setHasUnsavedModifications(true);
                      }
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9em',
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#ffffff',
                    }}
                  />
                </div>

                {/* Pointer / Batch Edge Settings */}
                {(activeTool === 'pointer' || activeTool === 'batch') && activeSelectedMarker && activeSelectedMarker.x != null && !activeSelectedMarker.regionPoints && (
                  <div
                    style={{
                      borderRadius: '10px',
                      border: '1px solid #bfdbfe',
                      background: '#ffffff',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '0.78em', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Target size={13} color="#0284c7" /> Borde de salida de la flecha / aguja
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                      <button
                        type="button"
                        title="Borde Izquierdo"
                        onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'left')}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: currentActiveMarkerEdge === 'left' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: currentActiveMarkerEdge === 'left' ? '#e0f2fe' : '#f8fafc',
                          color: currentActiveMarkerEdge === 'left' ? '#0369a1' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.7em',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <ArrowLeft size={12} />
                        <span>Izq</span>
                      </button>

                      <button
                        type="button"
                        title="Borde Superior"
                        onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'top')}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: currentActiveMarkerEdge === 'top' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: currentActiveMarkerEdge === 'top' ? '#e0f2fe' : '#f8fafc',
                          color: currentActiveMarkerEdge === 'top' ? '#0369a1' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.7em',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <ArrowUp size={12} />
                        <span>Arriba</span>
                      </button>

                      <button
                        type="button"
                        title="Borde Derecho"
                        onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'right')}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: currentActiveMarkerEdge === 'right' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: currentActiveMarkerEdge === 'right' ? '#e0f2fe' : '#f8fafc',
                          color: currentActiveMarkerEdge === 'right' ? '#0369a1' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.7em',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <ArrowRight size={12} />
                        <span>Der</span>
                      </button>

                      <button
                        type="button"
                        title="Borde Inferior"
                        onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'bottom')}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: currentActiveMarkerEdge === 'bottom' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: currentActiveMarkerEdge === 'bottom' ? '#e0f2fe' : '#f8fafc',
                          color: currentActiveMarkerEdge === 'bottom' ? '#0369a1' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.7em',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <ArrowDown size={12} />
                        <span>Abajo</span>
                      </button>

                      <button
                        type="button"
                        title="Borde Automático (más cercano)"
                        onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'auto')}
                        style={{
                          padding: '5px 2px',
                          borderRadius: '6px',
                          border: currentActiveMarkerEdge === 'auto' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: currentActiveMarkerEdge === 'auto' ? '#e0f2fe' : '#f8fafc',
                          color: currentActiveMarkerEdge === 'auto' ? '#0369a1' : '#475569',
                          fontWeight: 800,
                          fontSize: '0.7em',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Auto</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Polygon specifics (Palette & Opacity) */}
                {(activeTool === 'border' || activeTool === 'batch-border') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.78em', fontWeight: 800, color: '#475569' }}>Color de región:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {REGION_PALETTE_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.name}
                            onClick={() => {
                              setDrawingPolygonColor(c.hex);
                              if (sessionMarkerIds.length > 0) {
                                setMarkers(prev => prev.map(m => sessionMarkerIds.includes(m.id) ? { ...m, regionColor: c.hex } : m));
                                setHasUnsavedModifications(true);
                              }
                            }}
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '999px',
                              background: c.hex,
                              border: drawingPolygonColor === c.hex ? '2.5px solid #0f172a' : '1.5px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78em', fontWeight: 800, color: '#475569' }}>
                        <span>Opacidad de relleno:</span>
                        <span>{Math.round(drawingPolygonOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.10"
                        max="0.80"
                        step="0.05"
                        value={drawingPolygonOpacity}
                        onChange={(e) => {
                          const val = Number.parseFloat(e.target.value);
                          setDrawingPolygonOpacity(val);
                          if (sessionMarkerIds.length > 0) {
                            setMarkers(prev => prev.map(m => sessionMarkerIds.includes(m.id) ? { ...m, regionOpacity: val } : m));
                            setHasUnsavedModifications(true);
                          }
                        }}
                        style={{ width: '100%', cursor: 'pointer', marginTop: '4px' }}
                      />
                    </div>

                    <div style={{ padding: '7px 9px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: '0.76em', color: '#065f46', lineHeight: 1.4 }}>
                      ✍️ <strong>{activeTool === 'batch-border' ? 'Bordes Múltiples:' : 'Borde a Mano Alzada:'}</strong> Mantén presionado y dibuja alrededor de la estructura. Al soltar se cerrará la región.
                    </div>
                  </div>
                )}

                {/* Guardar señalado / grupo y pasar a herramienta mano */}
                <button
                  type="button"
                  onClick={handleSaveCurrentToolSession}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.84em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 10px rgba(2, 132, 199, 0.25)',
                    marginTop: '2px',
                  }}
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>
                    {activeTool === 'batch' || activeTool === 'batch-border'
                      ? 'Guardar grupo y pasar a Mano'
                      : 'Guardar señalado y pasar a Mano'}
                  </span>
                </button>
              </div>
            )}

            {/* Selected Marker Edit Card when in Hand Mode (Paneo) */}
            {activeTool === 'pan' && activeSelectedMarker && (
              <div
                style={{
                  borderRadius: '14px',
                  border: '1.5px solid #bfdbfe',
                  background: '#f8fafc',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(14, 165, 233, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.82em', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#0284c7" /> Detalle del Señalado
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMarkerId(null)}
                    title="Cerrar detalle"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '0.78em', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Nombre del señalado:
                  </label>
                  <BoldField
                    as="input"
                    inline
                    value={activeSelectedMarker.label}
                    placeholder="Nombre del señalado..."
                    onChange={(val) => {
                      setMarkers(prev => prev.map(m => m.id === activeSelectedMarker.id ? { ...m, label: val } : m));
                      setHasUnsavedModifications(true);
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88em',
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#ffffff',
                    }}
                  />
                </div>

                {/* If pointer/arrow, show tip/edge options */}
                {activeSelectedMarker.x != null && !activeSelectedMarker.regionPoints && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (reassigningTipMarkerId === activeSelectedMarker.id) {
                          setReassigningTipMarkerId(null);
                        } else {
                          setReassigningTipMarkerId(activeSelectedMarker.id);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: reassigningTipMarkerId === activeSelectedMarker.id ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        background: reassigningTipMarkerId === activeSelectedMarker.id ? '#e0f2fe' : '#ffffff',
                        color: reassigningTipMarkerId === activeSelectedMarker.id ? '#0369a1' : '#334155',
                        fontWeight: 800,
                        fontSize: '0.8em',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Target size={14} />
                      {reassigningTipMarkerId === activeSelectedMarker.id ? '🎯 Haz clic en la placa para reubicar punta' : '🎯 Cambiar punta con un clic'}
                    </button>

                    <div>
                      <span style={{ fontSize: '0.74em', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Borde de salida:
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                        <button
                          type="button"
                          title="Borde Izquierdo"
                          onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'left')}
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            border: currentActiveMarkerEdge === 'left' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentActiveMarkerEdge === 'left' ? '#e0f2fe' : '#ffffff',
                            color: currentActiveMarkerEdge === 'left' ? '#0369a1' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.7em',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <ArrowLeft size={12} />
                          <span>Izq</span>
                        </button>
                        <button
                          type="button"
                          title="Borde Superior"
                          onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'top')}
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            border: currentActiveMarkerEdge === 'top' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentActiveMarkerEdge === 'top' ? '#e0f2fe' : '#ffffff',
                            color: currentActiveMarkerEdge === 'top' ? '#0369a1' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.7em',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <ArrowUp size={12} />
                          <span>Arriba</span>
                        </button>
                        <button
                          type="button"
                          title="Borde Derecho"
                          onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'right')}
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            border: currentActiveMarkerEdge === 'right' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentActiveMarkerEdge === 'right' ? '#e0f2fe' : '#ffffff',
                            color: currentActiveMarkerEdge === 'right' ? '#0369a1' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.7em',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <ArrowRight size={12} />
                          <span>Der</span>
                        </button>
                        <button
                          type="button"
                          title="Borde Inferior"
                          onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'bottom')}
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            border: currentActiveMarkerEdge === 'bottom' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentActiveMarkerEdge === 'bottom' ? '#e0f2fe' : '#ffffff',
                            color: currentActiveMarkerEdge === 'bottom' ? '#0369a1' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.7em',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <ArrowDown size={12} />
                          <span>Abajo</span>
                        </button>
                        <button
                          type="button"
                          title="Borde Automático"
                          onClick={() => setMarkerOriginEdge(activeSelectedMarker.id, 'auto')}
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            border: currentActiveMarkerEdge === 'auto' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentActiveMarkerEdge === 'auto' ? '#e0f2fe' : '#ffffff',
                            color: currentActiveMarkerEdge === 'auto' ? '#0369a1' : '#475569',
                            fontWeight: 800,
                            fontSize: '0.7em',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Auto</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* If polygon region */}
                {activeSelectedMarker.regionPoints && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '0.74em', fontWeight: 800, color: '#475569' }}>Color de región:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                        {REGION_PALETTE_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.name}
                            onClick={() => {
                              setMarkers(prev => prev.map(m => m.id === activeSelectedMarker.id ? { ...m, regionColor: c.hex } : m));
                              setHasUnsavedModifications(true);
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '999px',
                              background: c.hex,
                              border: activeSelectedMarker.regionColor === c.hex ? '2.5px solid #0f172a' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Zonas de exclusión / Huecos interiores */}
                    {activeSelectedMarker.regionHoles && activeSelectedMarker.regionHoles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.74em', fontWeight: 800, color: '#334155' }}>
                            🍩 Zonas de exclusión ({activeSelectedMarker.regionHoles.length}):
                          </span>
                          {activeSelectedMarker.regionHoles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAllHoles(activeSelectedMarker.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '0.70em',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Eliminar todas las zonas de exclusión"
                            >
                              <Trash2 size={11} />
                              <span>Quitar todas</span>
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {activeSelectedMarker.regionHoles.map((hole, hIdx) => {
                            const isThisHoleSelected = selectedHoleIndex === hIdx;
                            return (
                              <div
                                key={hIdx}
                                onClick={() => {
                                  setSelectedHoleIndex(hIdx);
                                  setSelectedVertex(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: isThisHoleSelected ? '#fef2f2' : '#f8fafc',
                                  border: isThisHoleSelected ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                  transition: 'all 150ms ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '999px',
                                      background: isThisHoleSelected ? '#ef4444' : '#94a3b8',
                                      display: 'inline-block',
                                    }}
                                  />
                                  <span style={{ fontSize: '0.73em', fontWeight: isThisHoleSelected ? 800 : 600, color: isThisHoleSelected ? '#991b1b' : '#475569' }}>
                                    Hueco interior #{hIdx + 1} ({hole.length / 2} pts)
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {isThisHoleSelected && (
                                    <span style={{ fontSize: '0.66em', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>
                                      Seleccionada
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    title="Eliminar este hueco de exclusión"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteHole(activeSelectedMarker.id, hIdx);
                                    }}
                                    style={{
                                      border: 'none',
                                      background: isThisHoleSelected ? '#fee2e2' : 'transparent',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      padding: '3px 5px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.73em', color: '#166534', lineHeight: 1.35 }}>
                      💡 <strong>Zona de exclusión / Dona:</strong> Con este borde seleccionado, activa la herramienta <em>Borde</em> y dibuja dentro para recortar el centro (crear un hueco). Haz clic sobre un hueco para seleccionarlo y eliminarlo con <kbd>Supr</kbd> o el botón de papelera.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List of All Placed Markers (Accordion para Múltiples & Aislamiento al Seleccionar) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.85em', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedMarkerId && markers.length > 1
                    ? `Señalado Seleccionado (1 de ${markers.length})`
                    : `Lista de Señalados (${markers.length})`}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedMarkerId && markers.length > 1 && (
                    <button
                      type="button"
                      title="Mostrar todos los señalados en la lista"
                      onClick={() => setSelectedMarkerId(null)}
                      style={{
                        border: '1.5px solid #cbd5e1',
                        background: '#f1f5f9',
                        color: '#0369a1',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.78em',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <Eye size={14} /> Ver todos ({markers.length})
                    </button>
                  )}
                </div>
              </div>

              {markers.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: '14px',
                    border: '1.5px dashed #cbd5e1',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.85em',
                    lineHeight: 1.5,
                  }}
                >
                  No hay señalados creados aún.<br />
                  Haz clic sobre la placa para agregar el primero.
                </div>
              ) : selectedMarkerId ? (
                // 1. Single active marker focus mode
                markers.filter(m => m.id === selectedMarkerId).map((marker) => {
                  const originalIndex = markers.findIndex(m => m.id === marker.id);
                  const isPolygon = Boolean(marker.regionPoints && marker.regionPoints.length >= 6);

                  return (
                    <div
                      key={marker.id}
                      onClick={() => focusOnMarker(marker)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '2px solid #0ea5e9',
                        background: '#f0f9ff',
                        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '999px',
                              background: isPolygon
                                ? (marker.regionColor ?? '#22c55e')
                                : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                              color: '#ffffff',
                              fontSize: '0.78em',
                              fontWeight: 900,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {originalIndex + 1}
                          </span>

                          <span style={{ fontSize: '0.88em', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {renderBoldText(marker.label || `Señalado ${originalIndex + 1}`)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            title="Eliminar este señalado"
                            onClick={(e) => {
                              e.stopPropagation();
                              pushHistory(markers);
                              setMarkers(prev => prev.filter(m => m.id !== marker.id));
                              setSelectedMarkerId(null);
                            }}
                            style={{
                              border: 'none',
                              background: '#fee2e2',
                              color: '#dc2626',
                              borderRadius: '8px',
                              padding: '5px 7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75em', color: '#64748b' }}>
                        <span>
                          {isPolygon
                            ? '⬡ Borde poligonal'
                            : (marker.startX != null
                              ? `📍 Aguja (Borde ${marker.startX <= 0.01 ? 'Izq' : marker.startX >= 0.99 ? 'Der' : (marker.startY ?? 0) <= 0.01 ? 'Arriba' : 'Abajo'})`
                              : '📍 Puntero (Auto)')}
                        </span>
                        <span style={{ color: marker.x != null ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                          {marker.x != null ? '✓ Ubicado' : '⚠️ Sin ubicar'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                // 2. Full Marker Groups with Accordion for Multiples
                markerGroups.map((group) => {
                  const isMultiple = group.items.length > 1;
                  const isExpanded = expandedGroupKeys[group.key] ?? false;

                  if (!isMultiple) {
                    const item = group.items[0];
                    const marker = item.marker;
                    const originalIndex = item.originalIndex;
                    const isPolygon = Boolean(marker.regionPoints && marker.regionPoints.length >= 6);

                    return (
                      <div
                        key={marker.id}
                        onClick={() => focusOnMarker(marker)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '999px',
                                background: isPolygon
                                  ? (marker.regionColor ?? '#22c55e')
                                  : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                color: '#ffffff',
                                fontSize: '0.78em',
                                fontWeight: 900,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {originalIndex + 1}
                            </span>

                            <span style={{ fontSize: '0.88em', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {renderBoldText(marker.label || `Señalado ${originalIndex + 1}`)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              title="Eliminar este señalado"
                              onClick={(e) => {
                                e.stopPropagation();
                                pushHistory(markers);
                                setMarkers(prev => prev.filter(m => m.id !== marker.id));
                              }}
                              style={{
                                border: 'none',
                                background: '#fee2e2',
                                color: '#dc2626',
                                borderRadius: '8px',
                                padding: '5px 7px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75em', color: '#64748b' }}>
                          <span>
                            {isPolygon
                              ? '⬡ Borde poligonal'
                              : (marker.startX != null
                                ? `📍 Aguja (Borde ${marker.startX <= 0.01 ? 'Izq' : marker.startX >= 0.99 ? 'Der' : (marker.startY ?? 0) <= 0.01 ? 'Arriba' : 'Abajo'})`
                                : '📍 Puntero (Auto)')}
                          </span>
                          <span style={{ color: marker.x != null ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                            {marker.x != null ? '✓ Ubicado' : '⚠️ Sin ubicar'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Multiple Markers Accordion Card
                  return (
                    <div
                      key={group.key}
                      style={{
                        borderRadius: '12px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                      }}
                    >
                      {/* Accordion Header */}
                      <div
                        onClick={() => setExpandedGroupKeys(prev => ({ ...prev, [group.key]: !isExpanded }))}
                        style={{
                          padding: '10px 12px',
                          background: isExpanded ? '#f0f9ff' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          cursor: 'pointer',
                          borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span style={{ color: '#0369a1', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                          </span>

                          <span style={{ fontSize: '0.88em', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {renderBoldText(group.label)}
                          </span>

                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '0.74em',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {group.items.length} señalados
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            title="Eliminar todo este grupo múltiple"
                            onClick={(e) => {
                              e.stopPropagation();
                              pushHistory(markers);
                              const idsToRemove = new Set(group.items.map(it => it.marker.id));
                              setMarkers(prev => prev.filter(m => !idsToRemove.has(m.id)));
                            }}
                            style={{
                              border: 'none',
                              background: '#fee2e2',
                              color: '#dc2626',
                              borderRadius: '8px',
                              padding: '5px 7px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Accordion Expanded Sub-Items */}
                      {isExpanded && (
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc' }}>
                          {group.items.map(({ marker, originalIndex }) => {
                            const isPolygon = Boolean(marker.regionPoints && marker.regionPoints.length >= 6);

                            return (
                              <div
                                key={marker.id}
                                onClick={() => focusOnMarker(marker)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '10px',
                                  border: '1px solid #e2e8f0',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <span
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '999px',
                                      background: isPolygon
                                        ? (marker.regionColor ?? '#22c55e')
                                        : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                      color: '#ffffff',
                                      fontSize: '0.75em',
                                      fontWeight: 900,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {originalIndex + 1}
                                  </span>

                                  <span style={{ fontSize: '0.78em', color: '#475569' }}>
                                    {isPolygon ? '⬡ Región' : (marker.startX != null ? '📍 Aguja' : '📍 Punto')}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.74em', color: marker.x != null ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
                                    {marker.x != null ? '✓ Ubicado' : '⚠️ Sin ubicar'}
                                  </span>

                                  <button
                                    type="button"
                                    title="Eliminar este punto individual"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pushHistory(markers);
                                      setMarkers(prev => prev.filter(m => m.id !== marker.id));
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#94a3b8',
                                      padding: '3px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment hint if present */}
            {comentario && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.82em',
                  color: '#475569',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#0f172a' }}>Comentario: </strong>
                {renderBoldText(comentario)}
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div
            style={{
              padding: '12px 14px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <button
              type="button"
              disabled={isSavingLocally}
              onClick={handleConfirmSave}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: 'none',
                background: isSavingLocally ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #0ea5e9 100%)',
                color: '#ffffff',
                fontSize: '0.95em',
                fontWeight: 900,
                cursor: isSavingLocally ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(14, 165, 233, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {isSavingLocally ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={2.5} /> Guardar señalados
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '0.9em',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Cancelar / Salir
            </button>
          </div>
        </aside>
      )}

      {/* Exit without saving confirmation modal */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1900,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            style={{
              width: 'min(440px, 100%)',
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '1.15em', fontWeight: 900, color: '#0f172a' }}>
              ¿Salir sin guardar cambios?
            </div>
            <div style={{ fontSize: '0.92em', color: '#64748b', lineHeight: 1.5 }}>
              Has realizado cambios en los señalados de la placa. Si sales ahora, se perderán las modificaciones no guardadas.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onCancel();
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                }}
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Markers Mover Sub-modal */}
      {showMoveAllModal && resolvedImageSrc && (
        <AllSenaladosMoverModal
          isOpen={showMoveAllModal}
          imageSrc={resolvedImageSrc}
          imageAlt={imageAlt}
          senalados={markers.map(m => m.label)}
          senaladosPos={markers.map(m => (m.x != null && m.y != null ? {
            x: m.x,
            y: m.y,
            startX: m.startX ?? null,
            startY: m.startY ?? null,
            regionPoints: m.regionPoints ?? null,
            regionColor: m.regionColor ?? '#22c55e',
            regionOpacity: m.regionOpacity ?? 0.28,
          } : null))}
          onClose={() => setShowMoveAllModal(false)}
          onSave={(updatedPos) => {
            pushHistory(markers);
            setMarkers(prev => prev.map((m, i) => {
              const u = updatedPos[i];
              if (!u) return m;
              return {
                ...m,
                x: u.x,
                y: u.y,
                startX: u.startX ?? null,
                startY: u.startY ?? null,
                regionPoints: u.regionPoints ?? null,
                regionColor: u.regionColor ?? m.regionColor,
                regionOpacity: u.regionOpacity ?? m.regionOpacity,
              };
            }));
            setShowMoveAllModal(false);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default PlateAnnotationViewerEditor;
