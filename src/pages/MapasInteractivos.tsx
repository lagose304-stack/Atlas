import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle } from 'react-konva';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import { supabase } from '../services/supabase';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

interface Tema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
}

interface Subtema {
  id: number;
  nombre: string;
  tema_id: number;
}

interface Placa {
  id: number;
  photo_url: string;
  sort_order: number;
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

interface InsertHintState {
  visible: boolean;
  x: number;
  y: number;
  snapped: boolean;
}

interface SelectionDetails {
  title: string;
  color: string;
  description: string;
}

interface InteractiveMapSectionPayload {
  title: string;
  color: string;
  description: string;
  points: number[];
  sort_order: number;
  coordinate_space: string | null;
}

interface InteractiveMapRow {
  id: number;
  map_number: number;
  sections: InteractiveMapSectionPayload[] | null;
}

type ParcialKey = 'primer' | 'segundo' | 'tercer';
type ZoomSensitivity = 'suave' | 'media' | 'rapida';

const PARCIALES: { key: ParcialKey; label: string }[] = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
];

const MIN_POINT_DISTANCE_LASSO = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const MIN_DYNAMIC_MAX_ZOOM = 1.2;
const ZOOM_OVERSHOOT_FACTOR = 1.1;
const ZOOM_DRAG_SENSITIVITY: Record<ZoomSensitivity, number> = {
  suave: 0.0012,
  media: 0.0019,
  rapida: 0.003,
};
const ZOOM_EASE = 0.2;
const PAN_EASE = 0.18;
const INSERT_HINT_RADIUS = 7;
const TOUCH_LINE_HIT_STROKE = 28;
const MOUSE_LINE_HIT_STROKE = 18;
const TOUCH_HANDLE_RADIUS = 8;
const MOUSE_HANDLE_RADIUS = 5;
const TOUCH_SAVED_HANDLE_RADIUS = 8.5;
const MOUSE_SAVED_HANDLE_RADIUS = 5.5;
const TOUCH_INSERT_SNAP_DISTANCE = 26;
const MOUSE_INSERT_SNAP_DISTANCE = 14;
const INTERACTIVE_MAPS_TABLE = 'interactive_maps';
const INTERACTIVE_MAP_COORDINATE_SPACE = 'image_uv_v1';
const NORMALIZED_COORD_EPSILON = 0.0005;
const SELECTION_COLOR_OPTIONS = [
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#6366f1',
] as const;
const DEFAULT_SELECTION_COLOR = SELECTION_COLOR_OPTIONS[0];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const POINT_HIT_RADIUS = 10;

const isNormalizedCoordinateValue = (value: number): boolean => {
  return value >= -NORMALIZED_COORD_EPSILON && value <= 1 + NORMALIZED_COORD_EPSILON;
};

const areLikelyNormalizedFlatPoints = (points: number[]): boolean => {
  if (points.length < 6 || points.length % 2 !== 0) return false;
  return points.every((point) => isNormalizedCoordinateValue(point));
};

const stageToNormalizedFlatPoints = (points: number[], referenceRect: RectBox): number[] => {
  if (points.length < 6 || points.length % 2 !== 0) return [];

  const safeWidth = Math.max(1, referenceRect.width);
  const safeHeight = Math.max(1, referenceRect.height);

  return points.map((value, idx) => {
    if (idx % 2 === 0) {
      return clamp((value - referenceRect.x) / safeWidth, 0, 1);
    }
    return clamp((value - referenceRect.y) / safeHeight, 0, 1);
  });
};

const normalizedToStageFlatPoints = (points: number[], referenceRect: RectBox): number[] => {
  if (points.length < 6 || points.length % 2 !== 0) return [];

  const safeWidth = Math.max(1, referenceRect.width);
  const safeHeight = Math.max(1, referenceRect.height);

  return points.map((value, idx) => {
    const normalizedValue = clamp(value, 0, 1);
    if (idx % 2 === 0) {
      return referenceRect.x + normalizedValue * safeWidth;
    }
    return referenceRect.y + normalizedValue * safeHeight;
  });
};

const isValidHexColor = (value: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
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

const buildSectionsPayload = (
  selections: number[][],
  details: SelectionDetails[],
  referenceRect: RectBox | null
): InteractiveMapSectionPayload[] => {
  return selections
    .map((points, index) => {
      if (!Array.isArray(points) || points.length < 6 || points.length % 2 !== 0) return null;
      const cleanPoints = points.filter(point => typeof point === 'number' && Number.isFinite(point));
      if (cleanPoints.length < 6 || cleanPoints.length % 2 !== 0) return null;

      const pointsForStorage = referenceRect
        ? stageToNormalizedFlatPoints(cleanPoints, referenceRect)
        : cleanPoints;

      if (pointsForStorage.length < 6 || pointsForStorage.length % 2 !== 0) return null;

      const detail = details[index];
      const title = detail?.title?.trim() || `Seleccion ${index + 1}`;
      const color = isValidHexColor(detail?.color ?? '') ? detail.color : DEFAULT_SELECTION_COLOR;
      const description = detail?.description?.trim() || '';

      return {
        title,
        color,
        description,
        points: pointsForStorage,
        sort_order: index,
        coordinate_space: referenceRect ? INTERACTIVE_MAP_COORDINATE_SPACE : null,
      };
    })
    .filter((section): section is InteractiveMapSectionPayload => section !== null);
};

const hydrateSectionsPayload = (
  sectionsRaw: InteractiveMapSectionPayload[] | null | undefined,
  referenceRect: RectBox | null
): { selections: number[][]; details: SelectionDetails[] } => {
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) {
    return { selections: [], details: [] };
  }

  const selections: number[][] = [];
  const details: SelectionDetails[] = [];

  sectionsRaw.forEach((section) => {
    const rawPoints = Array.isArray(section?.points)
      ? section.points.filter(value => typeof value === 'number' && Number.isFinite(value))
      : [];

    if (rawPoints.length < 6 || rawPoints.length % 2 !== 0) return;

    const coordinateSpace = typeof section?.coordinate_space === 'string'
      ? section.coordinate_space
      : null;
    const isNormalizedCoordinates =
      coordinateSpace === INTERACTIVE_MAP_COORDINATE_SPACE || areLikelyNormalizedFlatPoints(rawPoints);

    const points =
      isNormalizedCoordinates && referenceRect
        ? normalizedToStageFlatPoints(rawPoints, referenceRect)
        : rawPoints;

    if (points.length < 6 || points.length % 2 !== 0) return;

    const fallbackLabel = `Seleccion ${selections.length + 1}`;
    const title = typeof section?.title === 'string' && section.title.trim().length > 0
      ? section.title.trim()
      : fallbackLabel;
    const color = typeof section?.color === 'string' && isValidHexColor(section.color)
      ? section.color
      : DEFAULT_SELECTION_COLOR;
    const description = typeof section?.description === 'string' ? section.description.trim() : '';

    selections.push(points);
    details.push({ title, color, description });
  });

  return { selections, details };
};

const cloneSelections = (selections: number[][]): number[][] => {
  return selections.map(points => [...points]);
};

const cloneSelectionDetails = (details: SelectionDetails[]): SelectionDetails[] => {
  return details.map(detail => ({ ...detail }));
};

const clampPanForScale = (pan: Point2D, scale: number): Point2D => {
  // A 100% o menos siempre se recentra a la posición original.
  if (scale <= 1) return { x: 0, y: 0 };

  // Por encima de 100% se respeta totalmente el ancla de zoom del usuario.
  return pan;
};

const pointsToPairs = (points: number[]): Array<{ x: number; y: number; index: number }> => {
  const pairs: Array<{ x: number; y: number; index: number }> = [];
  for (let i = 0; i < points.length; i += 2) {
    pairs.push({ x: points[i], y: points[i + 1], index: i / 2 });
  }
  return pairs;
};

const perpendicularDistance = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

const simplifyDouglasPeucker = (
  points: Array<{ x: number; y: number }>,
  tolerance: number
): Array<{ x: number; y: number }> => {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), tolerance);
    const right = simplifyDouglasPeucker(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
};

const simplifyLassoPoints = (flatPoints: number[]): number[] => {
  if (flatPoints.length < 8) return flatPoints;

  const pairs = pointsToPairs(flatPoints).map(p => ({ x: p.x, y: p.y }));
  // Tolerancia equilibrada para conservar curvas importantes sin sobrecargar de puntos.
  const simplified = simplifyDouglasPeucker(pairs, 2.6);

  if (simplified.length < 3) return flatPoints;
  return simplified.flatMap(p => [p.x, p.y]);
};

const projectPointToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; distance: number } => {
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    const distance = Math.hypot(px - ax, py - ay);
    return { x: ax, y: ay, distance };
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const x = ax + t * dx;
  const y = ay + t * dy;
  const distance = Math.hypot(px - x, py - y);
  return { x, y, distance };
};

const findClosestSegmentProjection = (
  flatPoints: number[],
  x: number,
  y: number
): { segmentStartIndex: number; x: number; y: number; distance: number } | null => {
  if (flatPoints.length < 6) return null;

  const pairs = pointsToPairs(flatPoints);
  let closestSegmentStartIndex = 0;
  let closestX = x;
  let closestY = y;
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < pairs.length; i++) {
    const a = pairs[i];
    const b = pairs[(i + 1) % pairs.length];
    const projected = projectPointToSegment(x, y, a.x, a.y, b.x, b.y);

    if (projected.distance < minDistance) {
      minDistance = projected.distance;
      closestSegmentStartIndex = i;
      closestX = projected.x;
      closestY = projected.y;
    }
  }

  return {
    segmentStartIndex: closestSegmentStartIndex,
    x: closestX,
    y: closestY,
    distance: minDistance,
  };
};

const pointInPolygonFlat = (x: number, y: number, flatPoints: number[]): boolean => {
  const points = pointsToPairs(flatPoints);
  if (points.length < 3) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

const pointInsideRect = (x: number, y: number, rect: RectBox): boolean => {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
};

const fitRect = (containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number): RectBox => {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = (containerWidth - width) / 2;
  const y = (containerHeight - height) / 2;
  return { x, y, width, height };
};

const computeDynamicMaxZoom = (baseRect: RectBox | null, image: HTMLImageElement | null): number => {
  if (!baseRect || !image || baseRect.width <= 0 || baseRect.height <= 0) return MAX_ZOOM;

  const ratioX = image.width / baseRect.width;
  const ratioY = image.height / baseRect.height;
  const nativeDetailRatio = Math.min(ratioX, ratioY);
  const recommendedMax = nativeDetailRatio * ZOOM_OVERSHOOT_FACTOR;

  return clamp(recommendedMax, MIN_DYNAMIC_MAX_ZOOM, MAX_ZOOM);
};

const MapasInteractivos: React.FC = () => {
  const handleGoBack = useSmartBackNavigation('/placas');

  const [temas, setTemas] = useState<Tema[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);

  const [selectedTemaId, setSelectedTemaId] = useState<number | null>(null);
  const [selectedSubtemaId, setSelectedSubtemaId] = useState<number | null>(null);
  const [selectedPlaca, setSelectedPlaca] = useState<Placa | null>(null);
  const [selectedTool, setSelectedTool] = useState<'lasso' | 'zoom'>('lasso');
  const [zoomSensitivity, setZoomSensitivity] = useState<ZoomSensitivity>('media');
  const [zoomScale, setZoomScale] = useState(1);
  const [isZoomDragging, setIsZoomDragging] = useState(false);
  const [panOffset, setPanOffset] = useState<Point2D>({ x: 0, y: 0 });

  const [loadingTemas, setLoadingTemas] = useState(true);
  const [loadingSubtemas, setLoadingSubtemas] = useState(false);
  const [loadingPlacas, setLoadingPlacas] = useState(false);

  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeLassoPoints, setActiveLassoPoints] = useState<number[]>([]);
  const [selectionPoints, setSelectionPoints] = useState<number[]>([]);
  const [savedSelections, setSavedSelections] = useState<number[][]>([]);
  const [savedSelectionDetails, setSavedSelectionDetails] = useState<SelectionDetails[]>([]);
  const [activeSavedSelectionIndex, setActiveSavedSelectionIndex] = useState<number | null>(null);
  const [editingSelectionIndex, setEditingSelectionIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [insertHint, setInsertHint] = useState<InsertHintState>({ visible: false, x: 0, y: 0, snapped: false });
  const [showSelectionInfoForm, setShowSelectionInfoForm] = useState(false);
  const [pendingSelectionDetails, setPendingSelectionDetails] = useState<SelectionDetails>({
    title: '',
    color: DEFAULT_SELECTION_COLOR,
    description: '',
  });
  const [selectionInfoError, setSelectionInfoError] = useState<string | null>(null);
  const [showPendingReplaceConfirm, setShowPendingReplaceConfirm] = useState(false);
  const [pendingLassoStartPoint, setPendingLassoStartPoint] = useState<Point2D | null>(null);
  const [dashOffset, setDashOffset] = useState(0);
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [currentMapNumber, setCurrentMapNumber] = useState<number | null>(null);
  const [pendingHydrationMapRow, setPendingHydrationMapRow] = useState<InteractiveMapRow | null>(null);
  const [isPersistingMap, setIsPersistingMap] = useState(false);
  const [hasUnsavedMapChanges, setHasUnsavedMapChanges] = useState(false);
  const [mapPersistMessage, setMapPersistMessage] = useState<string | null>(null);
  const [persistedSelectionsSnapshot, setPersistedSelectionsSnapshot] = useState<number[][]>([]);
  const [persistedSelectionDetailsSnapshot, setPersistedSelectionDetailsSnapshot] = useState<SelectionDetails[]>([]);
  const [showUnsavedExitConfirm, setShowUnsavedExitConfirm] = useState(false);

  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const lastMeasuredSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isZoomDraggingRef = useRef(false);
  const zoomDragStartXRef = useRef(0);
  const zoomDragStartScaleRef = useRef(1);
  const zoomAnchorUVRef = useRef<{ u: number; v: number } | null>(null);
  const isPinchZoomingRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const isPointerGestureActiveRef = useRef(false);
  const targetZoomRef = useRef(1);
  const targetPanRef = useRef<Point2D>({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(pointer: coarse)');
    const updatePointerType = () => setIsCoarsePointer(media.matches);

    updatePointerType();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updatePointerType);
      return () => media.removeEventListener('change', updatePointerType);
    }

    media.addListener(updatePointerType);
    return () => media.removeListener(updatePointerType);
  }, []);

  useEffect(() => {
    const fetchTemas = async () => {
      const { data } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('parcial')
        .order('sort_order', { ascending: true });
      if (data) setTemas(data);
      setLoadingTemas(false);
    };

    fetchTemas();
  }, []);

  useEffect(() => {
    setSubtemas([]);
    setPlacas([]);
    setSelectedSubtemaId(null);
    setSelectedPlaca(null);
    if (!selectedTemaId) return;

    const fetchSubtemas = async () => {
      setLoadingSubtemas(true);
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, tema_id')
        .eq('tema_id', selectedTemaId)
        .order('sort_order', { ascending: true });
      if (data) setSubtemas(data);
      setLoadingSubtemas(false);
    };

    fetchSubtemas();
  }, [selectedTemaId]);

  useEffect(() => {
    setPlacas([]);
    setSelectedPlaca(null);
    if (!selectedSubtemaId) return;

    const fetchPlacas = async () => {
      setLoadingPlacas(true);
      const { data } = await supabase
        .from('placas')
        .select('id, photo_url, sort_order')
        .eq('subtema_id', selectedSubtemaId)
        .order('sort_order', { ascending: true });
      if (data) setPlacas(data);
      setLoadingPlacas(false);
    };

    fetchPlacas();
  }, [selectedSubtemaId]);

  useEffect(() => {
    if (!selectedPlaca) {
      setImageElement(null);
      setPendingHydrationMapRow(null);
      setCurrentMapId(null);
      setCurrentMapNumber(null);
      setHasUnsavedMapChanges(false);
      setMapPersistMessage(null);
      setPersistedSelectionsSnapshot([]);
      setPersistedSelectionDetailsSnapshot([]);
      setShowUnsavedExitConfirm(false);
      return;
    }

    let isEffectActive = true;

    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectionPoints([]);
    setSavedSelections([]);
    setSavedSelectionDetails([]);
    setActiveSavedSelectionIndex(null);
    setEditingSelectionIndex(null);
    setShowSelectionInfoForm(false);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);
    setShowPendingReplaceConfirm(false);
    setPendingLassoStartPoint(null);
    setPendingHydrationMapRow(null);
    setCurrentMapId(null);
    setCurrentMapNumber(null);
    setHasUnsavedMapChanges(false);
    setMapPersistMessage(null);
    setPersistedSelectionsSnapshot([]);
    setPersistedSelectionDetailsSnapshot([]);
    setShowUnsavedExitConfirm(false);
    targetZoomRef.current = 1;
    targetPanRef.current = { x: 0, y: 0 };

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = getCloudinaryImageUrl(selectedPlaca.photo_url, 'zoom');
    img.onload = () => {
      if (!isEffectActive) return;
      setImageElement(img);
    };

    const loadSavedMap = async () => {
      const { data, error } = await supabase
        .from(INTERACTIVE_MAPS_TABLE)
        .select('id, map_number, sections')
        .eq('placa_id', selectedPlaca.id)
        .maybeSingle();

      if (!isEffectActive) return;

      if (error) {
        console.error('Error al cargar mapa interactivo:', error);
        setMapPersistMessage('No se pudo cargar el mapa guardado de esta placa.');
        return;
      }

      if (!data) {
        setPendingHydrationMapRow(null);
        setPersistedSelectionsSnapshot([]);
        setPersistedSelectionDetailsSnapshot([]);
        return;
      }

      const mapRow = data as InteractiveMapRow;
      setPendingHydrationMapRow(mapRow);
      setCurrentMapId(mapRow.id);
      setCurrentMapNumber(mapRow.map_number);
      setHasUnsavedMapChanges(false);
      setMapPersistMessage(`Mapa #${mapRow.map_number} cargado.`);
    };

    void loadSavedMap();

    return () => {
      isEffectActive = false;
    };
  }, [selectedPlaca]);

  useEffect(() => {
    if (!selectedPlaca) return;

    const frame = canvasFrameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const rect = frame.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));

      const prev = lastMeasuredSizeRef.current;
      const widthChanged = Math.abs(prev.width - nextWidth) >= 1;
      const heightChanged = Math.abs(prev.height - nextHeight) >= 1;

      if (!widthChanged && !heightChanged) return;

      lastMeasuredSizeRef.current = { width: nextWidth, height: nextHeight };
      setWorkspaceSize({ width: nextWidth, height: nextHeight });
    };

    updateSize();

    // Solo recalcular en resize real de ventana evita el loop de auto-zoom.
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [selectedPlaca]);

  const runAnimationStep = () => {
    let keepAnimating = false;

    setZoomScale(prev => {
      const target = targetZoomRef.current;
      const diff = target - prev;
      if (Math.abs(diff) < 0.0008) return target;
      keepAnimating = true;
      return prev + diff * ZOOM_EASE;
    });

    setPanOffset(prev => {
      const target = targetPanRef.current;
      const dx = target.x - prev.x;
      const dy = target.y - prev.y;

      if (Math.abs(dx) < 0.12 && Math.abs(dy) < 0.12) {
        return target;
      }

      keepAnimating = true;
      return {
        x: prev.x + dx * PAN_EASE,
        y: prev.y + dy * PAN_EASE,
      };
    });

    if (keepAnimating) {
      animationFrameRef.current = window.requestAnimationFrame(runAnimationStep);
    } else {
      animationFrameRef.current = null;
    }
  };

  const scheduleAnimation = () => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(runAnimationStep);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedPlaca) return;
    const hasSelection =
      selectionPoints.length >= 6 || activeLassoPoints.length >= 4 || savedSelections.length > 0;
    if (!hasSelection) return;

    const timer = window.setInterval(() => {
      setDashOffset(prev => (prev + 1) % 120);
    }, 40);

    return () => window.clearInterval(timer);
  }, [selectedPlaca, selectionPoints.length, activeLassoPoints.length, savedSelections.length]);

  const baseImageRect = useMemo<RectBox | null>(() => {
    if (!imageElement || workspaceSize.width <= 0 || workspaceSize.height <= 0) return null;
    return fitRect(workspaceSize.width, workspaceSize.height, imageElement.width, imageElement.height);
  }, [imageElement, workspaceSize]);

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

  useEffect(() => {
    if (!pendingHydrationMapRow || !baseImageRect) return;

    const hydrated = hydrateSectionsPayload(pendingHydrationMapRow.sections, baseImageRect);
    setSavedSelections(hydrated.selections);
    setSavedSelectionDetails(hydrated.details);
    setPersistedSelectionsSnapshot(cloneSelections(hydrated.selections));
    setPersistedSelectionDetailsSnapshot(cloneSelectionDetails(hydrated.details));
    setPendingHydrationMapRow(null);
  }, [pendingHydrationMapRow, baseImageRect]);

  const effectiveMaxZoom = useMemo(() => {
    return computeDynamicMaxZoom(baseImageRect, imageElement);
  }, [baseImageRect, imageElement]);

  const perceptualEnhanceLevel = useMemo(() => {
    if (zoomScale <= 1.35) return 0;
    const span = Math.max(0.001, effectiveMaxZoom - 1.35);
    return clamp((zoomScale - 1.35) / span, 0, 1);
  }, [zoomScale, effectiveMaxZoom]);

  const canvasFilterStyle = useMemo(() => {
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

  const applyZoomCenteredOnAnchor = (nextScale: number) => {
    if (!baseImageRect || !zoomAnchorUVRef.current) return;

    const clampedScale = clamp(nextScale, MIN_ZOOM, effectiveMaxZoom);

    if (clampedScale <= 1) {
      targetZoomRef.current = clampedScale;
      targetPanRef.current = { x: 0, y: 0 };
      scheduleAnimation();
      return;
    }

    const nextWidth = baseImageRect.width * clampedScale;
    const nextHeight = baseImageRect.height * clampedScale;

    const { u, v } = zoomAnchorUVRef.current;
    const viewportCenterX = workspaceSize.width / 2;
    const viewportCenterY = workspaceSize.height / 2;

    const nextX = viewportCenterX - u * nextWidth;
    const nextY = viewportCenterY - v * nextHeight;

    const baseX = baseImageRect.x + (baseImageRect.width - nextWidth) / 2;
    const baseY = baseImageRect.y + (baseImageRect.height - nextHeight) / 2;

    const rawPan = {
      x: nextX - baseX,
      y: nextY - baseY,
    };
    const normalizedPan = clampPanForScale(rawPan, clampedScale);

    targetZoomRef.current = clampedScale;
    targetPanRef.current = normalizedPan;
    scheduleAnimation();
  };

  const stopLassoDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    setActiveLassoPoints(prev => {
      if (prev.length < 6) {
        setSelectionPoints([]);
        return [];
      }
      setSelectionPoints(simplifyLassoPoints(prev));
      return [];
    });
  };

  const startLassoDrawing = () => {
    if (selectedTool !== 'lasso') return;
    if (!stageRef.current || !imageRect) return;

    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    if (!pointInsideRect(pointer.x, pointer.y, imageRect)) return;

    setShowPendingReplaceConfirm(false);
    setPendingLassoStartPoint(null);
    setShowSelectionInfoForm(false);
    setSelectionInfoError(null);

    setActiveSavedSelectionIndex(null);
    setSelectionPoints([]);
    setIsDrawing(true);
    setActiveLassoPoints([pointer.x, pointer.y]);
  };

  const startLassoDrawingAt = (x: number, y: number) => {
    if (selectedTool !== 'lasso' || !imageRect) return;
    if (!pointInsideRect(x, y, imageRect)) return;

    setShowPendingReplaceConfirm(false);
    setPendingLassoStartPoint(null);
    setShowSelectionInfoForm(false);
    setSelectionInfoError(null);
    setActiveSavedSelectionIndex(null);
    setSelectionPoints([]);
    setIsDrawing(true);
    setActiveLassoPoints([x, y]);
  };

  const continueLassoDrawing = () => {
    if (!isDrawing) return;
    if (!stageRef.current || !imageRect) return;

    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    const x = clamp(pointer.x, imageRect.x, imageRect.x + imageRect.width);
    const y = clamp(pointer.y, imageRect.y, imageRect.y + imageRect.height);

    setActiveLassoPoints(prev => {
      if (prev.length < 2) return [x, y];

      const lastX = prev[prev.length - 2];
      const lastY = prev[prev.length - 1];
      const distance = Math.hypot(x - lastX, y - lastY);
      if (distance < MIN_POINT_DISTANCE_LASSO) return prev;

      return [...prev, x, y];
    });
  };

  const clearSelection = () => {
    const hadDraftSelection = isDrawing || activeLassoPoints.length > 0 || selectionPoints.length > 0;

    setIsDrawing(false);
    setActiveLassoPoints([]);
    setSelectionPoints([]);
    setActiveSavedSelectionIndex(null);
    setEditingSelectionIndex(null);
    setShowDeleteConfirm(false);
    setInsertHint({ visible: false, x: 0, y: 0, snapped: false });
    setShowSelectionInfoForm(false);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);
    setShowPendingReplaceConfirm(false);
    setPendingLassoStartPoint(null);

    if (hasUnsavedMapChanges) {
      const restoredSelections = cloneSelections(persistedSelectionsSnapshot);
      const restoredDetails = cloneSelectionDetails(persistedSelectionDetailsSnapshot);
      setSavedSelections(restoredSelections);
      setSavedSelectionDetails(restoredDetails);
      setHasUnsavedMapChanges(false);
      setMapPersistMessage('Cambios no guardados descartados.');
      return;
    }

    if (hadDraftSelection) {
      setMapPersistMessage('Selección no guardada limpiada.');
    }
  };

  const markPendingMapChanges = () => {
    if (!currentMapId) return;
    setHasUnsavedMapChanges(true);
    setMapPersistMessage('Cambios pendientes: recuerda actualizar el mapa.');
  };

  const createInteractiveMapRecord = async (
    selectionsToPersist: number[][],
    detailsToPersist: SelectionDetails[]
  ): Promise<{ id: number; mapNumber: number } | null> => {
    if (!selectedTemaId || !selectedPlaca) return null;

    const sectionsPayload = buildSectionsPayload(selectionsToPersist, detailsToPersist, imageRect ?? baseImageRect);
    if (sectionsPayload.length === 0) return null;

    // Si la placa ya tiene mapa, se reutiliza y se actualiza en lugar de crear otro.
    const { data: existingMap, error: existingMapError } = await supabase
      .from(INTERACTIVE_MAPS_TABLE)
      .select('id, map_number')
      .eq('placa_id', selectedPlaca.id)
      .maybeSingle();

    if (existingMapError) {
      throw existingMapError;
    }

    if (existingMap) {
      const existingMapRow = existingMap as { id: number; map_number: number };

      const { error: updateExistingMapError } = await supabase
        .from(INTERACTIVE_MAPS_TABLE)
        .update({
          tema_id: selectedTemaId,
          subtema_id: selectedSubtemaId,
          placa_id: selectedPlaca.id,
          sections: sectionsPayload,
        })
        .eq('id', existingMapRow.id);

      if (updateExistingMapError) {
        throw updateExistingMapError;
      }

      setCurrentMapId(existingMapRow.id);
      setCurrentMapNumber(existingMapRow.map_number);
      setPersistedSelectionsSnapshot(cloneSelections(selectionsToPersist));
      setPersistedSelectionDetailsSnapshot(cloneSelectionDetails(detailsToPersist));
      setHasUnsavedMapChanges(false);
      setMapPersistMessage(`Mapa #${existingMapRow.map_number} actualizado.`);
      return { id: existingMapRow.id, mapNumber: existingMapRow.map_number };
    }

    const { data: latestMapRows, error: latestMapError } = await supabase
      .from(INTERACTIVE_MAPS_TABLE)
      .select('map_number')
      .eq('tema_id', selectedTemaId)
      .order('map_number', { ascending: false })
      .limit(1);

    if (latestMapError) {
      throw latestMapError;
    }

    const nextMapNumber = (latestMapRows?.[0]?.map_number ?? 0) + 1;

    const { data: createdMap, error: createMapError } = await supabase
      .from(INTERACTIVE_MAPS_TABLE)
      .insert({
        tema_id: selectedTemaId,
        subtema_id: selectedSubtemaId,
        placa_id: selectedPlaca.id,
        map_number: nextMapNumber,
        sections: sectionsPayload,
      })
      .select('id, map_number')
      .single();

    if (createMapError) {
      throw createMapError;
    }

    const mapId = (createdMap as { id: number; map_number: number }).id;
    const mapNumber = (createdMap as { id: number; map_number: number }).map_number;
    setCurrentMapId(mapId);
    setCurrentMapNumber(mapNumber);
    setPersistedSelectionsSnapshot(cloneSelections(selectionsToPersist));
    setPersistedSelectionDetailsSnapshot(cloneSelectionDetails(detailsToPersist));
    setHasUnsavedMapChanges(false);
    setMapPersistMessage(`Mapa #${mapNumber} creado.`);
    return { id: mapId, mapNumber };
  };

  const updateInteractiveMapRecord = async (): Promise<boolean> => {
    if (!selectedTemaId || !selectedPlaca) return false;

    const sectionsPayload = buildSectionsPayload(savedSelections, savedSelectionDetails, imageRect ?? baseImageRect);
    if (sectionsPayload.length === 0) {
      setMapPersistMessage('No hay selecciones para guardar en el mapa.');
      return false;
    }

    setIsPersistingMap(true);

    try {
      if (!currentMapId) {
        setMapPersistMessage('Creando mapa...');
        const createdOrUpdatedMap = await createInteractiveMapRecord(savedSelections, savedSelectionDetails);
        return createdOrUpdatedMap !== null;
      } else {
        setMapPersistMessage('Actualizando mapa...');

        const { error: updateError } = await supabase
          .from(INTERACTIVE_MAPS_TABLE)
          .update({
            tema_id: selectedTemaId,
            subtema_id: selectedSubtemaId,
            placa_id: selectedPlaca.id,
            sections: sectionsPayload,
          })
          .eq('id', currentMapId);

        if (updateError) {
          throw updateError;
        }

        setPersistedSelectionsSnapshot(cloneSelections(savedSelections));
        setPersistedSelectionDetailsSnapshot(cloneSelectionDetails(savedSelectionDetails));
        setHasUnsavedMapChanges(false);
        setMapPersistMessage(`Mapa #${currentMapNumber ?? currentMapId} actualizado.`);
        return true;
      }
    } catch (error) {
      console.error('Error al actualizar mapa interactivo:', error);
      setMapPersistMessage('No se pudo guardar el mapa. Intenta nuevamente.');
      return false;
    } finally {
      setIsPersistingMap(false);
    }
  };

  const closeWorkspaceEditor = () => {
    setShowUnsavedExitConfirm(false);
    setSelectedPlaca(null);
  };

  const handleCancelWorkspace = () => {
    if (isPersistingMap) return;

    if (hasUnsavedMapChanges) {
      setShowUnsavedExitConfirm(true);
      return;
    }

    closeWorkspaceEditor();
  };

  const closeWithoutSaving = () => {
    closeWorkspaceEditor();
  };

  const saveChangesAndCloseWorkspace = async () => {
    const wasSaved = await updateInteractiveMapRecord();
    if (wasSaved) {
      closeWorkspaceEditor();
    }
  };

  const discardPendingSelection = () => {
    setSelectionPoints([]);
    setInsertHint({ visible: false, x: 0, y: 0, snapped: false });
    setShowSelectionInfoForm(false);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);
  };

  const confirmPendingSelection = () => {
    if (selectionPoints.length < 6) return;
    setEditingSelectionIndex(null);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);
    setShowSelectionInfoForm(true);
  };

  const cancelSelectionInfoForm = () => {
    setShowSelectionInfoForm(false);
    setEditingSelectionIndex(null);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);
  };

  const openEditSelectionInfoForm = () => {
    if (activeSavedSelectionIndex === null) return;

    const currentDetails = savedSelectionDetails[activeSavedSelectionIndex];
    const fallbackTitle = `Seleccion ${activeSavedSelectionIndex + 1}`;

    setPendingSelectionDetails({
      title: currentDetails?.title?.trim() || fallbackTitle,
      color: isValidHexColor(currentDetails?.color ?? '') ? currentDetails.color : DEFAULT_SELECTION_COLOR,
      description: currentDetails?.description ?? '',
    });
    setSelectionInfoError(null);
    setEditingSelectionIndex(activeSavedSelectionIndex);
    setShowDeleteConfirm(false);
    setShowSelectionInfoForm(true);
  };

  const saveSelectionWithDetails = async () => {
    const normalizedTitle = pendingSelectionDetails.title.trim();
    if (!normalizedTitle) {
      setSelectionInfoError('El titulo es obligatorio.');
      return;
    }

    const detailToSave: SelectionDetails = {
      title: normalizedTitle,
      color: pendingSelectionDetails.color || DEFAULT_SELECTION_COLOR,
      description: pendingSelectionDetails.description.trim(),
    };

    if (editingSelectionIndex !== null) {
      if (editingSelectionIndex < 0 || editingSelectionIndex >= savedSelectionDetails.length) return;

      const nextDetails = [...savedSelectionDetails];
      nextDetails[editingSelectionIndex] = detailToSave;
      setSavedSelectionDetails(nextDetails);
      setActiveSavedSelectionIndex(editingSelectionIndex);
      setShowSelectionInfoForm(false);
      setEditingSelectionIndex(null);
      setSelectionInfoError(null);
      setPendingSelectionDetails({
        title: '',
        color: DEFAULT_SELECTION_COLOR,
        description: '',
      });

      if (currentMapId) {
        markPendingMapChanges();
      }
      return;
    }

    if (selectionPoints.length < 6) return;

    const selectionToSave = [...selectionPoints];

    const nextSelections = [...savedSelections, selectionToSave];
    const nextDetails = [...savedSelectionDetails, detailToSave];

    setSavedSelections(nextSelections);
    setSavedSelectionDetails(nextDetails);
    setActiveSavedSelectionIndex(nextSelections.length - 1);

    setSelectionPoints([]);
    setInsertHint({ visible: false, x: 0, y: 0, snapped: false });
    setShowSelectionInfoForm(false);
    setEditingSelectionIndex(null);
    setPendingSelectionDetails({
      title: '',
      color: DEFAULT_SELECTION_COLOR,
      description: '',
    });
    setSelectionInfoError(null);

    if (currentMapId) {
      markPendingMapChanges();
      return;
    }

    if (!selectedTemaId || !selectedPlaca) return;

    setIsPersistingMap(true);
    setMapPersistMessage('Creando mapa...');

    try {
      await createInteractiveMapRecord(nextSelections, nextDetails);
    } catch (error) {
      console.error('Error al crear mapa interactivo:', error);
      setHasUnsavedMapChanges(true);
      setMapPersistMessage('No se pudo crear el mapa. Puedes intentar con Actualizar mapa.');
    } finally {
      setIsPersistingMap(false);
    }
  };

  const deleteActiveSavedSelection = async () => {
    if (activeSavedSelectionIndex === null) return;
    if (activeSavedSelectionIndex < 0 || activeSavedSelectionIndex >= savedSelections.length) return;

    const nextSelections = savedSelections.filter((_, idx) => idx !== activeSavedSelectionIndex);
    const nextDetails = savedSelectionDetails.filter((_, idx) => idx !== activeSavedSelectionIndex);

    setShowDeleteConfirm(false);
    setActiveSavedSelectionIndex(null);
    setEditingSelectionIndex(null);

    if (!currentMapId) {
      setSavedSelections(nextSelections);
      setSavedSelectionDetails(nextDetails);
      setHasUnsavedMapChanges(nextSelections.length > 0);
      setMapPersistMessage('Selección eliminada.');
      return;
    }

    setIsPersistingMap(true);
    setMapPersistMessage('Eliminando selección...');

    try {
      const sectionsPayload = buildSectionsPayload(nextSelections, nextDetails, imageRect ?? baseImageRect);

      const { error: deleteError } = await supabase
        .from(INTERACTIVE_MAPS_TABLE)
        .update({
          sections: sectionsPayload,
        })
        .eq('id', currentMapId);

      if (deleteError) {
        throw deleteError;
      }

      setSavedSelections(nextSelections);
      setSavedSelectionDetails(nextDetails);
      setPersistedSelectionsSnapshot(cloneSelections(nextSelections));
      setPersistedSelectionDetailsSnapshot(cloneSelectionDetails(nextDetails));
      setHasUnsavedMapChanges(false);
      setMapPersistMessage(
        nextSelections.length > 0
          ? `Selección eliminada y guardada en Mapa #${currentMapNumber ?? currentMapId}.`
          : `Mapa #${currentMapNumber ?? currentMapId} quedó sin selecciones.`
      );
    } catch (error) {
      console.error('Error al eliminar selección guardada:', error);
      setMapPersistMessage('No se pudo eliminar la selección en la base de datos.');
    } finally {
      setIsPersistingMap(false);
    }
  };

  const cancelPendingReplaceConfirm = () => {
    setShowPendingReplaceConfirm(false);
    setPendingLassoStartPoint(null);
  };

  const confirmPendingReplaceSelection = () => {
    if (!pendingLassoStartPoint) {
      cancelPendingReplaceConfirm();
      return;
    }

    hideInsertHint();
    setShowSelectionInfoForm(false);
    setSelectionInfoError(null);
    setSelectionPoints([]);
    setShowDeleteConfirm(false);
    startLassoDrawingAt(pendingLassoStartPoint.x, pendingLassoStartPoint.y);
  };

  const stopZoomDrag = () => {
    if (!isZoomDraggingRef.current) return;
    isZoomDraggingRef.current = false;
    setIsZoomDragging(false);
  };

  const getStagePointFromTouch = (touch: Touch): Point2D | null => {
    if (!stageRef.current) return null;
    const container = stageRef.current.container?.();
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const getPointerFromKonvaEvent = (e: any): Point2D | null => {
    const stage = e?.target?.getStage?.();
    const pointer = stage?.getPointerPosition?.();

    if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
      return { x: pointer.x, y: pointer.y };
    }

    const touch = e?.evt?.touches?.[0] ?? e?.evt?.changedTouches?.[0];
    const container = stage?.container?.();

    if (!touch || !container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startPinchZoom = (firstTouch: Touch, secondTouch: Touch) => {
    if (selectedTool !== 'zoom' || !imageRect) return;

    const p1 = getStagePointFromTouch(firstTouch);
    const p2 = getStagePointFromTouch(secondTouch);
    if (!p1 || !p2) return;

    const centerX = (p1.x + p2.x) / 2;
    const centerY = (p1.y + p2.y) / 2;
    if (!pointInsideRect(centerX, centerY, imageRect)) return;

    const startDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (startDistance < 8) return;

    isPinchZoomingRef.current = true;
    stopZoomDrag();

    pinchStartDistanceRef.current = startDistance;
    pinchStartScaleRef.current = zoomScale;

    const u = clamp((centerX - imageRect.x) / imageRect.width, 0, 1);
    const v = clamp((centerY - imageRect.y) / imageRect.height, 0, 1);
    zoomAnchorUVRef.current = { u, v };
  };

  const updatePinchZoom = (firstTouch: Touch, secondTouch: Touch) => {
    if (!isPinchZoomingRef.current) return;

    const p1 = getStagePointFromTouch(firstTouch);
    const p2 = getStagePointFromTouch(secondTouch);
    if (!p1 || !p2) return;

    const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (currentDistance < 2 || pinchStartDistanceRef.current <= 0) return;

    const distanceRatio = currentDistance / pinchStartDistanceRef.current;
    const nextScale = pinchStartScaleRef.current * distanceRatio;
    applyZoomCenteredOnAnchor(nextScale);
  };

  const handleStageMouseDown = () => {
    if (!stageRef.current || !imageRect) return;
    if (showPendingReplaceConfirm) return;
    if (showSelectionInfoForm) return;

    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    if (selectedTool === 'lasso') {
      const hasPendingSelection = selectionPoints.length >= 6 && !isDrawing;
      const isInsidePending = hasPendingSelection
        ? pointInPolygonFlat(pointer.x, pointer.y, selectionPoints)
        : false;

      if (hasPendingSelection && !isInsidePending && pointInsideRect(pointer.x, pointer.y, imageRect)) {
        setShowDeleteConfirm(false);
        hideInsertHint();
        setPendingLassoStartPoint({ x: pointer.x, y: pointer.y });
        setShowPendingReplaceConfirm(true);
        return;
      }

      startLassoDrawing();
      return;
    }

    if (selectedTool === 'zoom') {
      if (!pointInsideRect(pointer.x, pointer.y, imageRect)) return;
      isZoomDraggingRef.current = true;
      setIsZoomDragging(true);
      zoomDragStartXRef.current = pointer.x;
      zoomDragStartScaleRef.current = zoomScale;
      const u = clamp((pointer.x - imageRect.x) / imageRect.width, 0, 1);
      const v = clamp((pointer.y - imageRect.y) / imageRect.height, 0, 1);
      zoomAnchorUVRef.current = { u, v };
    }
  };

  const handleStageMouseMove = () => {
    if (selectedTool === 'lasso') {
      continueLassoDrawing();
      return;
    }

    if (selectedTool !== 'zoom' || !isZoomDraggingRef.current || !stageRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    const deltaX = pointer.x - zoomDragStartXRef.current;
    const sensitivity = ZOOM_DRAG_SENSITIVITY[zoomSensitivity];
    const nextScale = clamp(
      zoomDragStartScaleRef.current * Math.exp(deltaX * sensitivity),
      MIN_ZOOM,
      effectiveMaxZoom
    );
    applyZoomCenteredOnAnchor(nextScale);
  };

  const cycleZoomSensitivity = () => {
    setZoomSensitivity(prev => {
      if (prev === 'suave') return 'media';
      if (prev === 'media') return 'rapida';
      return 'suave';
    });
  };

  const handleStageMouseUp = () => {
    stopLassoDrawing();
    stopZoomDrag();
  };

  const handleStageTouchStart = (e: any) => {
    e?.evt?.preventDefault?.();
    if (isPointerGestureActiveRef.current) return;

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (selectedTool === 'zoom' && touchCount >= 2) {
      startPinchZoom(touches[0], touches[1]);
      return;
    }

    if (touchCount > 1) return;

    handleStageMouseDown();
  };

  const handleStageTouchMove = (e: any) => {
    e?.evt?.preventDefault?.();
    if (isPointerGestureActiveRef.current) return;

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (selectedTool === 'zoom' && isPinchZoomingRef.current && touchCount >= 2) {
      updatePinchZoom(touches[0], touches[1]);
      return;
    }

    if (touchCount > 1) return;

    handleStageMouseMove();
  };

  const handleStageTouchEnd = (e: any) => {
    e?.evt?.preventDefault?.();
    if (isPointerGestureActiveRef.current) return;

    const touches = e?.evt?.touches;
    const touchCount = touches?.length ?? 0;

    if (isPinchZoomingRef.current && touchCount < 2) {
      isPinchZoomingRef.current = false;
      pinchStartDistanceRef.current = 0;
      pinchStartScaleRef.current = zoomScale;
    }

    if (touchCount > 0) return;

    handleStageMouseUp();
  };

  const isStylusLikePointerEvent = (evt: any): boolean => {
    const pointerType = evt?.pointerType;
    if (pointerType === 'pen') return true;
    // Algunos navegadores/drivers reportan el lápiz como touch o unknown.
    if (pointerType === 'touch') return true;
    if (pointerType === '' || pointerType === 'unknown' || pointerType == null) {
      return typeof evt?.pressure === 'number' && evt.pressure > 0;
    }
    return false;
  };

  const handleStagePointerDown = (e: any) => {
    const evt = e?.evt;
    if (!isStylusLikePointerEvent(evt)) return;
    isPointerGestureActiveRef.current = true;
    evt?.preventDefault?.();
    handleStageMouseDown();
  };

  const handleStagePointerMove = (e: any) => {
    const evt = e?.evt;
    if (!isStylusLikePointerEvent(evt)) return;
    evt?.preventDefault?.();
    handleStageMouseMove();
  };

  const handleStagePointerUp = (e: any) => {
    const evt = e?.evt;
    if (!isStylusLikePointerEvent(evt)) return;
    isPointerGestureActiveRef.current = false;
    evt?.preventDefault?.();
    handleStageMouseUp();
  };

  const moveSelectionPoint = (pointIndex: number, x: number, y: number) => {
    if (!imageRect) return;

    const clampedX = clamp(x, imageRect.x, imageRect.x + imageRect.width);
    const clampedY = clamp(y, imageRect.y, imageRect.y + imageRect.height);

    setSelectionPoints(prev => {
      const next = [...prev];
      const idx = pointIndex * 2;
      if (idx + 1 >= next.length) return prev;
      next[idx] = clampedX;
      next[idx + 1] = clampedY;
      return next;
    });
  };

  const moveSavedSelectionPoint = (selectionIndex: number, pointIndex: number, x: number, y: number) => {
    if (!imageRect) return;

    const clampedX = clamp(x, imageRect.x, imageRect.x + imageRect.width);
    const clampedY = clamp(y, imageRect.y, imageRect.y + imageRect.height);

    setSavedSelections(prev => {
      if (selectionIndex < 0 || selectionIndex >= prev.length) return prev;

      const currentSelection = prev[selectionIndex];
      const nextSelection = [...currentSelection];
      const idx = pointIndex * 2;
      if (idx + 1 >= nextSelection.length) return prev;

      nextSelection[idx] = clampedX;
      nextSelection[idx + 1] = clampedY;

      const next = [...prev];
      next[selectionIndex] = nextSelection;
      return next;
    });

    markPendingMapChanges();
  };

  const canInsertPointIntoSelection = (flatPoints: number[], x: number, y: number): boolean => {
    if (flatPoints.length < 6) return false;
    const pairs = pointsToPairs(flatPoints);
    return !pairs.some(p => Math.hypot(x - p.x, y - p.y) <= POINT_HIT_RADIUS);
  };

  const hideInsertHint = () => {
    setInsertHint({ visible: false, x: 0, y: 0, snapped: false });
  };

  const showInsertHintAt = (x: number, y: number, snapped = false) => {
    setInsertHint({ visible: true, x, y, snapped });
  };

  const resolveInsertHint = (flatPoints: number[], x: number, y: number): InsertHintState | null => {
    if (!imageRect || flatPoints.length < 6) return null;

    const clampedX = clamp(x, imageRect.x, imageRect.x + imageRect.width);
    const clampedY = clamp(y, imageRect.y, imageRect.y + imageRect.height);
    const projection = findClosestSegmentProjection(flatPoints, clampedX, clampedY);
    if (!projection) return null;

    const snapDistance = isCoarsePointer ? TOUCH_INSERT_SNAP_DISTANCE : MOUSE_INSERT_SNAP_DISTANCE;
    if (projection.distance > snapDistance) return null;

    const hintX = projection.x;
    const hintY = projection.y;

    if (!canInsertPointIntoSelection(flatPoints, hintX, hintY)) return null;

    return { visible: true, x: hintX, y: hintY, snapped: true };
  };

  const insertSavedSelectionPoint = (selectionIndex: number, x: number, y: number) => {
    if (!imageRect) return;

    const clampedX = clamp(x, imageRect.x, imageRect.x + imageRect.width);
    const clampedY = clamp(y, imageRect.y, imageRect.y + imageRect.height);

    setSavedSelections(prev => {
      if (selectionIndex < 0 || selectionIndex >= prev.length) return prev;

      const currentSelection = prev[selectionIndex];
      if (currentSelection.length < 6) return prev;

      const projection = findClosestSegmentProjection(currentSelection, clampedX, clampedY);
      if (!projection) return prev;

      const snapDistance = isCoarsePointer ? TOUCH_INSERT_SNAP_DISTANCE : MOUSE_INSERT_SNAP_DISTANCE;
      if (projection.distance > snapDistance) return prev;

      const insertX = projection.x;
      const insertY = projection.y;

      if (!canInsertPointIntoSelection(currentSelection, insertX, insertY)) return prev;

      const insertAt = (projection.segmentStartIndex + 1) * 2;
      const nextSelection = [...currentSelection];
      nextSelection.splice(insertAt, 0, insertX, insertY);

      const next = [...prev];
      next[selectionIndex] = nextSelection;
      return next;
    });

    markPendingMapChanges();
  };

  const insertPendingSelectionPoint = (x: number, y: number) => {
    if (!imageRect || selectionPoints.length < 6) return;

    const clampedX = clamp(x, imageRect.x, imageRect.x + imageRect.width);
    const clampedY = clamp(y, imageRect.y, imageRect.y + imageRect.height);

    setSelectionPoints(prev => {
      if (prev.length < 6) return prev;

      const projection = findClosestSegmentProjection(prev, clampedX, clampedY);
      if (!projection) return prev;

      const snapDistance = isCoarsePointer ? TOUCH_INSERT_SNAP_DISTANCE : MOUSE_INSERT_SNAP_DISTANCE;
      if (projection.distance > snapDistance) return prev;

      const insertX = projection.x;
      const insertY = projection.y;

      if (!canInsertPointIntoSelection(prev, insertX, insertY)) return prev;

      const insertAt = (projection.segmentStartIndex + 1) * 2;
      const next = [...prev];
      next.splice(insertAt, 0, insertX, insertY);
      return next;
    });
  };

  useEffect(() => {
    if (selectedTool !== 'lasso') {
      hideInsertHint();
    }
  }, [selectedTool]);

  useEffect(() => {
    if (!selectedPlaca) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlaca]);

  const temasByParcial: Record<ParcialKey, Tema[]> = { primer: [], segundo: [], tercer: [] };
  temas.forEach(t => {
    if (temasByParcial[t.parcial as ParcialKey]) {
      temasByParcial[t.parcial as ParcialKey].push(t);
    }
  });

  const selectedTema = temas.find(t => t.id === selectedTemaId) ?? null;
  const selectedSubtema = subtemas.find(s => s.id === selectedSubtemaId) ?? null;
  const selectedPlacaIndex = selectedPlaca ? placas.findIndex(p => p.id === selectedPlaca.id) : -1;
  const isWorkspaceMode = selectedPlaca !== null;
  const activeSavedSelectionTitle = activeSavedSelectionIndex !== null
    ? (savedSelectionDetails[activeSavedSelectionIndex]?.title?.trim() || `Seleccion ${activeSavedSelectionIndex + 1}`)
    : '';

  return (
    <div style={isWorkspaceMode ? s.pageWorkspace : s.page}>
      {!isWorkspaceMode && <Header />}
      <main style={isWorkspaceMode ? s.mainWorkspace : s.main}>
        {!isWorkspaceMode && <BackButton onClick={handleGoBack} />}

        {selectedPlaca ? (
          <div style={s.workspaceCard}>
            <div style={s.workspaceTopBar}>
              <div>
                <h1 style={s.workspaceTitle}>Mapas interactivos</h1>
                <p style={s.workspaceSubtitle}>
                  {selectedTema?.nombre ?? 'Tema'} {'›'} {selectedSubtema?.nombre ?? 'Subtema'}
                  {selectedPlacaIndex >= 0 ? ` · Placa ${selectedPlacaIndex + 1}` : ''}
                  {currentMapNumber ? ` · Mapa ${currentMapNumber}` : ''}
                </p>
              </div>

              <div style={s.workspaceActions}>
                <button
                  type="button"
                  style={{
                    ...s.updateMapBtn,
                    ...((isPersistingMap || !hasUnsavedMapChanges || savedSelections.length === 0) ? s.updateMapBtnDisabled : {}),
                  }}
                  onClick={updateInteractiveMapRecord}
                  disabled={isPersistingMap || !hasUnsavedMapChanges || savedSelections.length === 0}
                >
                  {isPersistingMap ? 'Guardando...' : 'Actualizar mapa'}
                </button>
                <button type="button" style={s.secondaryWorkspaceBtn} onClick={clearSelection}>
                  Limpiar no guardadas
                </button>
                <button
                  type="button"
                  style={{
                    ...s.changePlacaBtn,
                    ...(isPersistingMap ? s.updateMapBtnDisabled : {}),
                  }}
                  onClick={handleCancelWorkspace}
                  disabled={isPersistingMap}
                >
                  Cancelar
                </button>
              </div>
            </div>

            <div style={s.workspaceLayout}>
              <div style={s.canvasArea}>
                <div
                  ref={canvasFrameRef}
                  style={{
                    ...s.canvasFrame,
                    filter: canvasFilterStyle,
                    cursor:
                      selectedTool === 'zoom'
                        ? (isZoomDragging ? 'ew-resize' : 'zoom-in')
                        : (insertHint.visible ? 'copy' : 'crosshair'),
                  }}
                >
                  {imageElement && imageRect ? (
                    <Stage
                      ref={stageRef}
                      width={workspaceSize.width}
                      height={workspaceSize.height}
                      onMouseDown={handleStageMouseDown}
                      onMouseMove={handleStageMouseMove}
                      onMouseUp={handleStageMouseUp}
                      onMouseLeave={handleStageMouseUp}
                      onTouchStart={handleStageTouchStart}
                      onTouchMove={handleStageTouchMove}
                      onTouchEnd={handleStageTouchEnd}
                      onTouchCancel={handleStageTouchEnd}
                      onPointerDown={handleStagePointerDown}
                      onPointerMove={handleStagePointerMove}
                      onPointerUp={handleStagePointerUp}
                      onPointerCancel={handleStagePointerUp}
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

                        {savedSelections.map((points, idx) => {
                          const details = savedSelectionDetails[idx];
                          const fillColor = hexToRgba(details?.color ?? DEFAULT_SELECTION_COLOR, 0.2);

                          return (
                          <React.Fragment key={`saved-${idx}`}>
                            <Line
                              points={points}
                              closed
                              listening={selectedTool === 'lasso'}
                              onMouseDown={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                setActiveSavedSelectionIndex(idx);
                                setShowDeleteConfirm(false);
                                setSelectionPoints([]);
                                setActiveLassoPoints([]);
                              }}
                              onTouchStart={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                setActiveSavedSelectionIndex(idx);
                                setShowDeleteConfirm(false);
                                setSelectionPoints([]);
                                setActiveLassoPoints([]);
                              }}
                              stroke="#0f766e"
                              strokeWidth={1.5}
                              fill={fillColor}
                            />
                            <Line
                              points={points}
                              closed
                              listening={selectedTool === 'lasso'}
                              hitStrokeWidth={isCoarsePointer ? TOUCH_LINE_HIT_STROKE : MOUSE_LINE_HIT_STROKE}
                              onMouseDown={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                setActiveSavedSelectionIndex(idx);
                                setSelectionPoints([]);
                                setActiveLassoPoints([]);
                                hideInsertHint();
                              }}
                              onTouchStart={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                setActiveSavedSelectionIndex(idx);
                                setSelectionPoints([]);
                                setActiveLassoPoints([]);
                                hideInsertHint();
                              }}
                              onMouseMove={e => {
                                if (selectedTool !== 'lasso' || activeSavedSelectionIndex !== idx) return;
                                if (isCoarsePointer) {
                                  hideInsertHint();
                                  return;
                                }
                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;

                                const hint = resolveInsertHint(points, pointer.x, pointer.y);
                                if (!hint) {
                                  hideInsertHint();
                                  return;
                                }
                                showInsertHintAt(hint.x, hint.y, hint.snapped);
                              }}
                              onTouchMove={e => {
                                e.cancelBubble = true;
                                e?.evt?.preventDefault?.();
                                if (selectedTool !== 'lasso' || activeSavedSelectionIndex !== idx) return;

                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;

                                const hint = resolveInsertHint(points, pointer.x, pointer.y);
                                if (!hint) {
                                  hideInsertHint();
                                  return;
                                }
                                showInsertHintAt(hint.x, hint.y, hint.snapped);
                              }}
                              onMouseLeave={() => {
                                hideInsertHint();
                              }}
                              onTouchEnd={() => {
                                hideInsertHint();
                              }}
                              onTouchCancel={() => {
                                hideInsertHint();
                              }}
                              onClick={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                if (isCoarsePointer) return;

                                if (activeSavedSelectionIndex !== idx) {
                                  setActiveSavedSelectionIndex(idx);
                                  setShowDeleteConfirm(false);
                                  hideInsertHint();
                                  return;
                                }

                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;
                                insertSavedSelectionPoint(idx, pointer.x, pointer.y);
                                setShowDeleteConfirm(false);
                                hideInsertHint();
                              }}
                              onTap={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;

                                if (activeSavedSelectionIndex !== idx) {
                                  setActiveSavedSelectionIndex(idx);
                                  setShowDeleteConfirm(false);
                                  hideInsertHint();
                                  return;
                                }

                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;
                                insertSavedSelectionPoint(idx, pointer.x, pointer.y);
                                setShowDeleteConfirm(false);
                                hideInsertHint();
                              }}
                              stroke={activeSavedSelectionIndex === idx ? '#0f172a' : '#134e4a'}
                              strokeWidth={activeSavedSelectionIndex === idx ? 2.2 : 1.5}
                              dash={[8, 6]}
                              dashOffset={dashOffset}
                            />
                          </React.Fragment>
                        );})}

                        {selectedTool === 'lasso' &&
                          activeSavedSelectionIndex !== null &&
                          savedSelections[activeSavedSelectionIndex] &&
                          savedSelections[activeSavedSelectionIndex].length >= 6 &&
                          pointsToPairs(savedSelections[activeSavedSelectionIndex]).map(point => (
                            <Circle
                              key={`saved-handle-${activeSavedSelectionIndex}-${point.index}`}
                              x={point.x}
                              y={point.y}
                              radius={isCoarsePointer ? TOUCH_SAVED_HANDLE_RADIUS : MOUSE_SAVED_HANDLE_RADIUS}
                              fill="#ffffff"
                              stroke="#0f172a"
                              strokeWidth={2}
                              draggable
                              onMouseDown={e => {
                                e.cancelBubble = true;
                                setShowDeleteConfirm(false);
                              }}
                              onTouchStart={e => {
                                e.cancelBubble = true;
                                setShowDeleteConfirm(false);
                              }}
                              onDragMove={e =>
                                moveSavedSelectionPoint(
                                  activeSavedSelectionIndex,
                                  point.index,
                                  e.target.x(),
                                  e.target.y()
                                )
                              }
                            />
                          ))}

                        {selectionPoints.length >= 6 && (
                          <>
                            <Line
                              points={selectionPoints}
                              closed
                              listening={selectedTool === 'lasso'}
                              hitStrokeWidth={isCoarsePointer ? TOUCH_LINE_HIT_STROKE : MOUSE_LINE_HIT_STROKE}
                              onMouseDown={e => {
                                e.cancelBubble = true;
                                hideInsertHint();
                              }}
                              onMouseMove={e => {
                                if (selectedTool !== 'lasso') return;
                                if (isCoarsePointer) {
                                  hideInsertHint();
                                  return;
                                }
                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;

                                const hint = resolveInsertHint(selectionPoints, pointer.x, pointer.y);
                                if (!hint) {
                                  hideInsertHint();
                                  return;
                                }
                                showInsertHintAt(hint.x, hint.y, hint.snapped);
                              }}
                              onTouchMove={e => {
                                e.cancelBubble = true;
                                e?.evt?.preventDefault?.();
                                if (selectedTool !== 'lasso') return;

                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;

                                const hint = resolveInsertHint(selectionPoints, pointer.x, pointer.y);
                                if (!hint) {
                                  hideInsertHint();
                                  return;
                                }
                                showInsertHintAt(hint.x, hint.y, hint.snapped);
                              }}
                              onMouseLeave={() => {
                                hideInsertHint();
                              }}
                              onTouchEnd={() => {
                                hideInsertHint();
                              }}
                              onTouchCancel={() => {
                                hideInsertHint();
                              }}
                              onClick={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                if (isCoarsePointer) return;
                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;
                                insertPendingSelectionPoint(pointer.x, pointer.y);
                                hideInsertHint();
                              }}
                              onTap={e => {
                                e.cancelBubble = true;
                                if (selectedTool !== 'lasso') return;
                                const pointer = getPointerFromKonvaEvent(e);
                                if (!pointer) return;
                                insertPendingSelectionPoint(pointer.x, pointer.y);
                                hideInsertHint();
                              }}
                              stroke="#111827"
                              strokeWidth={2}
                              dash={[10, 8]}
                              dashOffset={dashOffset}
                              fill={hexToRgba(pendingSelectionDetails.color || DEFAULT_SELECTION_COLOR, 0.2)}
                            />
                            <Line
                              points={selectionPoints}
                              closed
                              listening={false}
                              stroke="#ffffff"
                              strokeWidth={1}
                              dash={[10, 8]}
                              dashOffset={-dashOffset}
                            />

                            {selectedTool === 'lasso' && pointsToPairs(selectionPoints).map(point => (
                              <Circle
                                key={`handle-${point.index}`}
                                x={point.x}
                                y={point.y}
                                radius={isCoarsePointer ? TOUCH_HANDLE_RADIUS : MOUSE_HANDLE_RADIUS}
                                fill="#ffffff"
                                stroke="#0369a1"
                                strokeWidth={2}
                                draggable
                                onMouseDown={e => {
                                  e.cancelBubble = true;
                                  hideInsertHint();
                                }}
                                onTouchStart={e => {
                                  e.cancelBubble = true;
                                  hideInsertHint();
                                }}
                                onDragStart={e => {
                                  e.cancelBubble = true;
                                  hideInsertHint();
                                }}
                                onDragMove={e => moveSelectionPoint(point.index, e.target.x(), e.target.y())}
                              />
                            ))}
                          </>
                        )}

                        {isDrawing && activeLassoPoints.length >= 4 && (
                          <Line
                            points={activeLassoPoints}
                            closed={false}
                            stroke="#0f172a"
                            strokeWidth={2}
                            dash={[8, 6]}
                            dashOffset={dashOffset}
                          />
                        )}

                        {selectedTool === 'lasso' && insertHint.visible && (
                          <>
                            <Circle
                              x={insertHint.x}
                              y={insertHint.y}
                              radius={INSERT_HINT_RADIUS}
                              fill="#ffffff"
                              stroke={insertHint.snapped ? '#16a34a' : '#0ea5e9'}
                              strokeWidth={2}
                              listening={false}
                            />
                            <Line
                              points={[insertHint.x - 4, insertHint.y, insertHint.x + 4, insertHint.y]}
                              stroke={insertHint.snapped ? '#15803d' : '#0284c7'}
                              strokeWidth={2}
                              listening={false}
                            />
                            <Line
                              points={[insertHint.x, insertHint.y - 4, insertHint.x, insertHint.y + 4]}
                              stroke={insertHint.snapped ? '#15803d' : '#0284c7'}
                              strokeWidth={2}
                              listening={false}
                            />
                          </>
                        )}
                      </Layer>
                    </Stage>
                  ) : (
                    <div style={s.canvasLoading}>Cargando imagen...</div>
                  )}

                  {grainOpacity > 0 && (
                    <div
                      style={{
                        ...s.perceptualNoiseOverlay,
                        opacity: grainOpacity,
                      }}
                    />
                  )}
                </div>
              </div>

              <aside style={s.toolsRibbon}>
                <button
                  type="button"
                  style={{ ...s.toolBtn, ...(selectedTool === 'lasso' ? s.toolBtnActive : {}) }}
                  onClick={() => setSelectedTool('lasso')}
                  title="Lazo"
                >
                  🪢
                </button>

                <button
                  type="button"
                  style={{ ...s.toolBtn, ...(selectedTool === 'zoom' ? s.toolBtnActive : {}) }}
                  onClick={() => setSelectedTool('zoom')}
                  title="Lupa"
                >
                  🔍
                </button>
                {selectedTool === 'zoom' && (
                  <button
                    type="button"
                    style={s.zoomPresetBtn}
                    onClick={cycleZoomSensitivity}
                    title="Cambiar sensibilidad de zoom"
                  >
                    {zoomSensitivity === 'suave' ? 'Suave' : zoomSensitivity === 'media' ? 'Media' : 'Rapida'}
                  </button>
                )}
                <span style={s.zoomValue}>{Math.round(zoomScale * 100)}%</span>

                {selectionPoints.length >= 6 && !isDrawing && (
                  <div style={s.selectionActionsWrap}>
                    <button
                      type="button"
                      style={s.selectionDiscardBtn}
                      onClick={discardPendingSelection}
                      title="Descartar selección"
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      style={s.selectionConfirmBtn}
                      onClick={confirmPendingSelection}
                      title="Confirmar selección"
                    >
                      ✓
                    </button>
                  </div>
                )}

                {activeSavedSelectionIndex !== null && !isDrawing && (
                  <div style={s.savedSelectionActionsWrap}>
                    <div style={s.editActionAnchor}>
                      <button
                        type="button"
                        style={s.selectionEditBtn}
                        onClick={openEditSelectionInfoForm}
                        title="Editar información de la selección"
                      >
                        ✎
                      </button>
                      <span style={s.savedSelectionTitlePill} title={activeSavedSelectionTitle}>
                        {activeSavedSelectionTitle}
                      </span>
                    </div>

                    <div style={s.deleteActionAnchor}>
                      <button
                        type="button"
                        style={s.selectionDeleteBtn}
                        onClick={() => setShowDeleteConfirm(prev => !prev)}
                        title="Eliminar selección activa"
                      >
                        🗑
                      </button>

                      {showDeleteConfirm && (
                        <div style={s.deleteConfirmPopover}>
                          <button
                            type="button"
                            style={s.deleteConfirmYesBtn}
                            onClick={deleteActiveSavedSelection}
                            title="Confirmar borrado"
                            disabled={isPersistingMap}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            style={s.deleteConfirmNoBtn}
                            onClick={() => setShowDeleteConfirm(false)}
                            title="Cancelar borrado"
                            disabled={isPersistingMap}
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <p style={s.workspaceHint}>Esc limpia la selección. Haz clic o toca una selección confirmada para editar nodos, usar el lápiz para editar su información o eliminarla (con confirmación). Para agregar nodos, haz clic o toca sobre la línea de borde de la selección. Con la lupa, arrastra a la derecha para acercar y a la izquierda para alejar.</p>
            {mapPersistMessage && <p style={s.workspacePersistHint}>{mapPersistMessage}</p>}

            {showUnsavedExitConfirm && (
              <div style={s.unsavedExitBackdrop}>
                <div style={s.unsavedExitModal}>
                  <h3 style={s.unsavedExitTitle}>Hay cambios sin guardar</h3>
                  <p style={s.unsavedExitText}>
                    Tienes cambios pendientes en este mapa. ¿Deseas guardar antes de cerrar?
                  </p>
                  <div style={s.unsavedExitActions}>
                    <button
                      type="button"
                      style={s.unsavedExitStayBtn}
                      onClick={() => setShowUnsavedExitConfirm(false)}
                      disabled={isPersistingMap}
                    >
                      Seguir editando
                    </button>
                    <button
                      type="button"
                      style={{
                        ...s.unsavedExitSaveBtn,
                        ...(isPersistingMap ? s.selectionInfoSaveBtnDisabled : {}),
                      }}
                      onClick={saveChangesAndCloseWorkspace}
                      disabled={isPersistingMap}
                    >
                      {isPersistingMap ? 'Guardando...' : 'Guardar y cerrar'}
                    </button>
                    <button
                      type="button"
                      style={{
                        ...s.unsavedExitDiscardBtn,
                        ...(isPersistingMap ? s.selectionInfoSaveBtnDisabled : {}),
                      }}
                      onClick={closeWithoutSaving}
                      disabled={isPersistingMap}
                    >
                      Cerrar sin guardar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPendingReplaceConfirm && (
              <div style={s.pendingReplaceBackdrop}>
                <div style={s.pendingReplaceModal}>
                  <h3 style={s.pendingReplaceTitle}>Seleccion sin confirmar</h3>
                  <p style={s.pendingReplaceText}>
                    Si continúas, la selección actual se borrará para iniciar una nueva. ¿Deseas continuar?
                  </p>
                  <div style={s.pendingReplaceActions}>
                    <button
                      type="button"
                      style={s.pendingReplaceCancelBtn}
                      onClick={cancelPendingReplaceConfirm}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      style={s.pendingReplaceConfirmBtn}
                      onClick={confirmPendingReplaceSelection}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showSelectionInfoForm && (
              <div style={s.selectionInfoBackdrop}>
                <div style={s.selectionInfoModal}>
                  <h3 style={s.selectionInfoTitle}>
                    {editingSelectionIndex !== null ? 'Editar selección guardada' : 'Información de la selección'}
                  </h3>
                  <p style={s.selectionInfoText}>
                    {editingSelectionIndex !== null
                      ? 'Actualiza los datos de la selección y guarda los cambios.'
                      : 'Completa los datos antes de confirmar esta selección.'}
                  </p>

                  <label style={s.selectionInfoLabel} htmlFor="selection-title-input">
                    Título <span style={s.selectionInfoRequired}>*</span>
                  </label>
                  <input
                    id="selection-title-input"
                    type="text"
                    value={pendingSelectionDetails.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setPendingSelectionDetails(prev => ({ ...prev, title: nextTitle }));
                      if (selectionInfoError && nextTitle.trim().length > 0) {
                        setSelectionInfoError(null);
                      }
                    }}
                    placeholder="Ej. Epitelio respiratorio"
                    style={s.selectionInfoInput}
                  />
                  {selectionInfoError && <p style={s.selectionInfoError}>{selectionInfoError}</p>}

                  <label style={s.selectionInfoLabel}>Color del área</label>
                  <div style={s.selectionColorGrid}>
                    {SELECTION_COLOR_OPTIONS.map(color => {
                      const isSelected = pendingSelectionDetails.color === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setPendingSelectionDetails(prev => ({ ...prev, color }))}
                          title={`Color ${color}`}
                          style={{
                            ...s.selectionColorOption,
                            background: hexToRgba(color, 0.6),
                            border: isSelected ? `2px solid ${color}` : '2px solid #cbd5e1',
                            boxShadow: isSelected
                              ? `0 0 0 3px ${hexToRgba(color, 0.28)}`
                              : '0 2px 7px rgba(15,23,42,0.12)',
                          }}
                        />
                      );
                    })}
                  </div>

                  <label style={s.selectionInfoLabel} htmlFor="selection-description-input">Información</label>
                  <textarea
                    id="selection-description-input"
                    value={pendingSelectionDetails.description}
                    onChange={(event) => setPendingSelectionDetails(prev => ({ ...prev, description: event.target.value }))}
                    placeholder="Escribe un párrafo descriptivo para esta selección..."
                    rows={4}
                    style={s.selectionInfoTextarea}
                  />

                  <div style={s.selectionInfoActions}>
                    <button type="button" style={s.selectionInfoCancelBtn} onClick={cancelSelectionInfoForm}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      style={{
                        ...s.selectionInfoSaveBtn,
                        ...(pendingSelectionDetails.title.trim().length === 0 ? s.selectionInfoSaveBtnDisabled : {}),
                      }}
                      onClick={saveSelectionWithDetails}
                      disabled={pendingSelectionDetails.title.trim().length === 0}
                    >
                      {editingSelectionIndex !== null ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={s.pageHeader}>
              <h1 style={s.pageTitle}>Mapas interactivos</h1>
              <p style={s.pageSubtitle}>Selecciona un tema y subtema para cargar la galería de placas.</p>
              <div style={s.accentLine} />
            </div>

            <div style={s.card}>
              <div style={s.cardHeader}>
                <h2 style={s.cardTitle}>Selecciona tema y subtema</h2>
                <p style={s.cardSubtitle}>Elige el subtema para visualizar sus placas</p>
                <div style={s.divider} />
              </div>

              <div style={s.selectsRow}>
                <div style={s.selectGroup}>
                  <label style={s.selectLabel}>Tema</label>
                  {loadingTemas ? (
                    <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
                  ) : (
                    <select
                      style={s.select}
                      value={selectedTemaId ?? ''}
                      onChange={e => setSelectedTemaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Elige un tema —</option>
                      {PARCIALES.map(({ key, label }) =>
                        temasByParcial[key].length > 0 ? (
                          <optgroup key={key} label={label}>
                            {temasByParcial[key].map(t => (
                              <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                          </optgroup>
                        ) : null
                      )}
                    </select>
                  )}
                </div>

                <div style={s.selectGroup}>
                  <label style={s.selectLabel}>Subtema</label>
                  {loadingSubtemas ? (
                    <div style={s.inlineLoading}><div style={s.spinnerSm} /> Cargando...</div>
                  ) : (
                    <select
                      style={{ ...s.select, ...(!selectedTemaId ? s.selectDisabled : {}) }}
                      value={selectedSubtemaId ?? ''}
                      disabled={!selectedTemaId || subtemas.length === 0}
                      onChange={e => setSelectedSubtemaId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">
                        {!selectedTemaId
                          ? '— Primero elige un tema —'
                          : subtemas.length === 0
                          ? '— Sin subtemas —'
                          : '— Elige un subtema —'}
                      </option>
                      {subtemas.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {selectedSubtema && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h2 style={s.cardTitle}>{selectedTema?.nombre} {'›'} {selectedSubtema.nombre}</h2>
                  <p style={s.cardSubtitle}>{placas.length} {placas.length === 1 ? 'placa' : 'placas'} cargadas</p>
                  <div style={s.divider} />
                </div>

                {loadingPlacas ? (
                  <div style={s.loadingWrap}>
                    <div style={s.spinner} />
                    <p style={s.loadingText}>Cargando placas...</p>
                  </div>
                ) : placas.length === 0 ? (
                  <div style={s.emptyState}>Este subtema no tiene placas aún.</div>
                ) : (
                  <div className="placas-gallery-grid">
                    {placas.map((placa, idx) => (
                      <div
                        key={placa.id}
                        style={s.placaCard}
                        onClick={() => {
                          clearSelection();
                          setSelectedPlaca(placa);
                        }}
                      >
                        <div style={s.cardAccent} />
                        <span style={s.positionBadge}>{idx + 1}</span>
                        <div style={s.imgWrap}>
                          <img
                            src={getCloudinaryImageUrl(placa.photo_url, 'thumb')}
                            alt={`Placa ${idx + 1}`}
                            style={s.img}
                            loading="lazy"
                            draggable={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      {!isWorkspaceMode && <Footer />}
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  pageWorkspace: {
    minHeight: '100vh',
    width: '100%',
    background: '#eef2ff',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1300px',
    margin: '0 auto',
    padding: 'clamp(16px, 3vw, 40px) clamp(12px, 3vw, 40px) clamp(24px, 4vw, 60px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  mainWorkspace: {
    width: '100vw',
    minHeight: '100vh',
    margin: 0,
    padding: '12px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
  pageHeader: { display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: {
    fontSize: 'clamp(1.6em, 4vw, 2.4em)',
    fontWeight: 900,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 'clamp(0.88em, 2vw, 1em)',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  accentLine: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)',
    borderRadius: '4px',
    marginTop: '8px',
  },
  card: {
    background: 'transparent',
    borderRadius: '20px',
    padding: 'clamp(16px, 3vw, 36px)',
    boxShadow: 'none',
    border: 'none',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: 'clamp(1.2em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: '0.9em',
    color: '#64748b',
    margin: '0 0 14px',
    textAlign: 'center',
  },
  divider: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },
  selectsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  selectLabel: {
    fontSize: '0.875em',
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.03em',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '1em',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  inlineLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    fontSize: '0.9em',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
  },
  spinnerSm: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '3px solid #e0f2fe',
    borderTop: '3px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 0',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '4px solid #e0f2fe',
    borderTop: '4px solid #38bdf8',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#64748b', fontSize: '1em', fontWeight: 500 },
  emptyState: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '36px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #e2e8f0',
    fontSize: '0.95em',
  },
  placaCard: {
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1.5px solid #e0f2fe',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    boxShadow: '0 2px 10px rgba(15,23,42,0.10)',
    cursor: 'pointer',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    borderRadius: '12px 12px 0 0',
    zIndex: 1,
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
  },
  positionBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    minWidth: '28px',
    height: '28px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.75)',
    color: '#fff',
    fontSize: '0.78em',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    zIndex: 2,
  },
  imgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#f1f5f9',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  workspaceCard: {
    background: 'transparent',
    borderRadius: '18px',
    padding: '0',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minHeight: 'calc(100vh - 24px)',
  },
  workspaceTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    paddingRight: '10px',
    boxSizing: 'border-box',
  },
  workspaceTitle: {
    margin: 0,
    fontSize: 'clamp(1.2em, 2.6vw, 1.8em)',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  workspaceSubtitle: {
    margin: '4px 0 0',
    color: '#475569',
    fontSize: '0.92em',
    fontWeight: 600,
  },
  workspaceHint: {
    margin: 0,
    color: '#475569',
    fontSize: '0.86em',
    fontWeight: 600,
  },
  workspacePersistHint: {
    margin: '-6px 0 0',
    color: '#0f766e',
    fontSize: '0.82em',
    fontWeight: 700,
  },
  workspaceActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  updateMapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid #86efac',
    background: '#ecfdf5',
    color: '#166534',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  updateMapBtnDisabled: {
    opacity: 0.56,
    cursor: 'not-allowed',
  },
  changePlacaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  secondaryWorkspaceBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid #bae6fd',
    background: '#f0f9ff',
    color: '#0369a1',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  workspaceLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 64px',
    gap: '14px',
    alignItems: 'stretch',
    height: 'calc(100vh - 130px)',
    paddingRight: '10px',
    boxSizing: 'border-box',
  },
  canvasArea: {
    borderRadius: '16px',
    padding: '12px',
    background: 'linear-gradient(160deg, #eef2ff, #f0f9ff)',
    border: '1.5px solid #dbeafe',
    height: '100%',
    display: 'flex',
  },
  canvasFrame: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    cursor: 'default',
  },
  perceptualNoiseOverlay: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    mixBlendMode: 'soft-light',
    backgroundImage:
      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28) 0 1px, rgba(0,0,0,0) 1px), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.22) 0 1px, rgba(0,0,0,0) 1px), radial-gradient(circle at 40% 80%, rgba(255,255,255,0.2) 0 1px, rgba(0,0,0,0) 1px)',
    backgroundSize: '3px 3px, 4px 4px, 5px 5px',
    zIndex: 3,
  },
  canvasLoading: {
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.92em',
  },
  toolsRibbon: {
    borderRadius: '12px',
    border: '1.5px solid #dbeafe',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 8px',
  },
  toolBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: '1.1em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  toolBtnActive: {
    border: '1.5px solid #0ea5e9',
    background: '#e0f2fe',
    color: '#0369a1',
    boxShadow: '0 0 0 2px rgba(56,189,248,0.18)',
  },
  zoomValue: {
    fontSize: '0.72em',
    color: '#475569',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  zoomPresetBtn: {
    minWidth: '52px',
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    fontSize: '0.7em',
    fontWeight: 700,
    letterSpacing: '0.02em',
    fontFamily: 'inherit',
  },
  selectionActionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '6px',
    alignItems: 'center',
  },
  selectionDiscardBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontSize: '1.02em',
    fontWeight: 800,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  selectionConfirmBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1.5px solid #86efac',
    background: '#f0fdf4',
    color: '#166534',
    cursor: 'pointer',
    fontSize: '1.02em',
    fontWeight: 800,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  selectionDeleteBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1.5px solid #fecaca',
    background: '#fff',
    color: '#b91c1c',
    cursor: 'pointer',
    fontSize: '0.95em',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  savedSelectionActionsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    marginTop: '4px',
  },
  editActionAnchor: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionEditBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1.5px solid #fed7aa',
    background: '#fff7ed',
    color: '#c2410c',
    cursor: 'pointer',
    fontSize: '0.98em',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  savedSelectionTitlePill: {
    position: 'absolute',
    right: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
    maxWidth: '180px',
    minWidth: '110px',
    padding: '7px 10px',
    borderRadius: '10px',
    border: '1.5px solid #bae6fd',
    background: '#f8fafc',
    boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
    color: '#0f172a',
    fontSize: '0.74em',
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
  },
  deleteActionAnchor: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '4px',
  },
  deleteConfirmPopover: {
    position: 'absolute',
    right: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    gap: '6px',
    padding: '6px',
    borderRadius: '10px',
    border: '1.5px solid #dbeafe',
    background: '#ffffff',
    boxShadow: '0 8px 20px rgba(15,23,42,0.14)',
    zIndex: 4,
  },
  deleteConfirmYesBtn: {
    minWidth: '34px',
    height: '28px',
    borderRadius: '8px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontSize: '0.72em',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  deleteConfirmNoBtn: {
    minWidth: '34px',
    height: '28px',
    borderRadius: '8px',
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
    fontSize: '0.72em',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  pendingReplaceBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.38)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: '20px',
    boxSizing: 'border-box',
  },
  unsavedExitBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
    padding: '20px',
    boxSizing: 'border-box',
  },
  unsavedExitModal: {
    width: 'min(94vw, 460px)',
    borderRadius: '14px',
    border: '1.5px solid #bfdbfe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 16px 34px rgba(15,23,42,0.26)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  unsavedExitTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.02em',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  unsavedExitText: {
    margin: 0,
    color: '#475569',
    fontSize: '0.9em',
    lineHeight: 1.45,
  },
  unsavedExitActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
    flexWrap: 'wrap',
  },
  unsavedExitStayBtn: {
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  unsavedExitSaveBtn: {
    borderRadius: '10px',
    border: '1.5px solid #86efac',
    background: '#ecfdf5',
    color: '#166534',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  unsavedExitDiscardBtn: {
    borderRadius: '10px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  pendingReplaceModal: {
    width: 'min(92vw, 420px)',
    borderRadius: '14px',
    border: '1.5px solid #bfdbfe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 16px 34px rgba(15,23,42,0.26)',
    padding: '16px 16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  pendingReplaceTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.02em',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  pendingReplaceText: {
    margin: 0,
    color: '#475569',
    fontSize: '0.9em',
    lineHeight: 1.45,
  },
  pendingReplaceActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
  },
  pendingReplaceCancelBtn: {
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  pendingReplaceConfirmBtn: {
    borderRadius: '10px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  selectionInfoBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 24,
    padding: '20px',
    boxSizing: 'border-box',
  },
  selectionInfoModal: {
    width: 'min(94vw, 460px)',
    borderRadius: '14px',
    border: '1.5px solid #bfdbfe',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 18px 38px rgba(15,23,42,0.28)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  selectionInfoTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.05em',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  selectionInfoText: {
    margin: 0,
    color: '#475569',
    fontSize: '0.9em',
    lineHeight: 1.45,
  },
  selectionInfoLabel: {
    marginTop: '4px',
    color: '#334155',
    fontSize: '0.8em',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  selectionInfoRequired: {
    color: '#dc2626',
    fontWeight: 800,
  },
  selectionInfoInput: {
    width: '100%',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '10px 12px',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  selectionInfoError: {
    margin: '-2px 0 2px',
    color: '#b91c1c',
    fontSize: '0.78em',
    fontWeight: 700,
  },
  selectionColorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '2px',
  },
  selectionColorOption: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: '999px',
    cursor: 'pointer',
    padding: 0,
    fontSize: 0,
    lineHeight: 0,
    transition: 'transform 0.16s ease, box-shadow 0.18s ease',
  },
  selectionInfoTextarea: {
    width: '100%',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '10px 12px',
    fontSize: '0.88em',
    fontFamily: 'inherit',
    lineHeight: 1.45,
    resize: 'vertical',
    minHeight: '92px',
    boxSizing: 'border-box',
  },
  selectionInfoActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
  },
  selectionInfoCancelBtn: {
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  selectionInfoSaveBtn: {
    borderRadius: '10px',
    border: '1.5px solid #86efac',
    background: '#ecfdf5',
    color: '#166534',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.84em',
    fontFamily: 'inherit',
  },
  selectionInfoSaveBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
};

export default MapasInteractivos;
