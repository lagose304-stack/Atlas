import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import RequiredTextPromptModal from './RequiredTextPromptModal';

interface MarkerLocation {
  x: number;
  y: number;
  startX?: number | null;
  startY?: number | null;
}

interface SenaladosEditorModalProps {
  imageSrc: string;
  senalados: string[];
  senaladosPos: Array<MarkerLocation | null>;
  onChangeSenalados: (next: string[]) => void;
  onChangeSenaladosPos: (next: Array<MarkerLocation | null>) => void;
  onClose: () => void;
}

type Mode = 'view' | 'add_single' | 'add_multi';

type PointerEdge = 'left' | 'right' | 'top' | 'bottom';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const clampPointToBoundsPx = (x: number, y: number, width: number, height: number) => {
  return {
    x: clamp(x, 0, width),
    y: clamp(y, 0, height),
  };
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

const polygonPoints = (points: Array<{ x: number; y: number }>) => points.map(p => `${p.x},${p.y}`).join(' ');

const POINTER_CORE_WIDTH_PX = 3.6;
const POINTER_OUTLINE_WIDTH_PX = 5.4;
const POINTER_TAPER_PX = 14;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 2;

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP_BTN = 0.25;
const ZOOM_STEP_WHEEL = 0.1;
const PAN_DEADZONE_PX = 4;

const CALLOUT_MARGIN_PX = 14;

const buildGroups = (
  names: string[],
  locations: Array<MarkerLocation | null>
): Array<{ label: string; indices: number[]; count: number; hasMarker: boolean }> => {
  const byLabel = new Map<string, number[]>();
  const total = Math.max(names.length, locations.length);
  for (let i = 0; i < total; i += 1) {
    const label = (names[i] ?? '').trim();
    const loc = locations[i] ?? null;
    if (!label && !loc) continue;
    const key = label || '(Sin nombre)';
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key)!.push(i);
  }

  const groups: Array<{ label: string; indices: number[]; count: number; hasMarker: boolean }> = [];
  for (const [label, indices] of byLabel.entries()) {
    const hasMarker = indices.some(idx => {
      const loc = locations[idx];
      return loc?.x != null && loc?.y != null;
    });
    groups.push({ label, indices, count: indices.length, hasMarker });
  }
  return groups;
};

const SenaladosEditorModal: React.FC<SenaladosEditorModalProps> = ({
  imageSrc,
  senalados,
  senaladosPos,
  onChangeSenalados,
  onChangeSenaladosPos,
  onClose,
}) => {
  const [mode, setMode] = useState<Mode>('view');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [renameTargetLabel, setRenameTargetLabel] = useState<string | null>(null);

  const groups = useMemo(() => buildGroups(senalados, senaladosPos), [senalados, senaladosPos]);

  useEffect(() => {
    if (selectedLabel === null) return;
    const exists = groups.some(group => group.label === selectedLabel);
    if (!exists) setSelectedLabel(null);
  }, [selectedLabel, groups]);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const stateRef = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedBeyondDeadzoneRef = useRef(false);

  const [draggingPointerStart, setDraggingPointerStart] = useState(false);
  const pointerClipId = useId();
  const labelTagFilterId = useId();
  const [hoveredMarkerIdx, setHoveredMarkerIdx] = useState<number | null>(null);
  const [draggingSavedLabel, setDraggingSavedLabel] = useState(false);

  useEffect(() => { stateRef.current.zoom = zoomLevel; }, [zoomLevel]);
  useEffect(() => { stateRef.current.pos = position; }, [position]);

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

  const applyZoom = (newZoom: number, newPos?: { x: number; y: number }) => {
    const z = clamp(newZoom, ZOOM_MIN, ZOOM_MAX);
    stateRef.current.zoom = z;
    setZoomLevel(z);
    if (z <= 1) {
      stateRef.current.pos = { x: 0, y: 0 };
      setPosition({ x: 0, y: 0 });
      return;
    }

    if (!newPos) return;
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const next = clampPositionToViewport(
      newPos,
      z,
      imageSize,
      { width: containerEl.clientWidth, height: containerEl.clientHeight }
    );
    stateRef.current.pos = next;
    setPosition(next);
  };

  const handleZoomIn = () => applyZoom(stateRef.current.zoom + ZOOM_STEP_BTN, stateRef.current.pos);
  const handleZoomOut = () => applyZoom(stateRef.current.zoom - ZOOM_STEP_BTN, stateRef.current.pos);
  const handleZoomReset = () => applyZoom(1);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    applyZoom(stateRef.current.zoom + direction * ZOOM_STEP_WHEEL, stateRef.current.pos);
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
        const scale = newDist / pinchRef.current.dist;
        pinchRef.current.dist = newDist;
        const newZoom = clamp(stateRef.current.zoom * scale, ZOOM_MIN, ZOOM_MAX);
        stateRef.current.zoom = newZoom;
        setZoomLevel(newZoom);
        if (newZoom <= 1) {
          stateRef.current.pos = { x: 0, y: 0 };
          setPosition({ x: 0, y: 0 });
        }
      } else if (e.touches.length === 1 && isDraggingRef.current && stateRef.current.zoom > 1) {
        const containerEl = containerRef.current;
        const rawPos = {
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        };
        const nextPos = containerEl
          ? clampPositionToViewport(rawPos, stateRef.current.zoom, imageSize, { width: containerEl.clientWidth, height: containerEl.clientHeight })
          : rawPos;
        stateRef.current.pos = nextPos;
        setPosition(nextPos);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) { pinchRef.current = null; setIsPinching(false); }
      if (e.touches.length === 0) { isDraggingRef.current = false; setIsDragging(false); }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [imageSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // ── Añadir 1 señalado (flujo: click para ubicar → pedir nombre) ─────────────────
  const [draftSingleLocation, setDraftSingleLocation] = useState<MarkerLocation | null>(null);
  const [promptSingleNameOpen, setPromptSingleNameOpen] = useState(false);

  // ── Añadir múltiples (flujo: pedir nombre → clicks para añadir puntos → guardar) ─
  const [multiLabel, setMultiLabel] = useState<string | null>(null);
  const [promptMultiNameOpen, setPromptMultiNameOpen] = useState(false);
  const [draftMultiLocations, setDraftMultiLocations] = useState<MarkerLocation[]>([]);
  const [draftMultiStart, setDraftMultiStart] = useState<{ x: number; y: number } | null>(null);

  const resetDrafts = () => {
    setDraftSingleLocation(null);
    setPromptSingleNameOpen(false);
    setMultiLabel(null);
    setPromptMultiNameOpen(false);
    setDraftMultiLocations([]);
    setDraftMultiStart(null);
    setDraggingPointerStart(false);
  };

  const getGroupIndicesByLabel = (label: string) => {
    return groups.find(group => group.label === label)?.indices ?? [];
  };

  const applyRenameGroup = (fromLabel: string, nextLabel: string) => {
    const normalized = nextLabel.trim();
    if (!normalized) return;

    const indices = getGroupIndicesByLabel(fromLabel);
    if (indices.length === 0) return;

    const total = Math.max(senalados.length, senaladosPos.length);
    const nextNames = Array.from({ length: total }, (_, i) => senalados[i] ?? '');
    for (const index of indices) {
      nextNames[index] = normalized;
    }

    onChangeSenalados(nextNames);
    if (selectedLabel === fromLabel) setSelectedLabel(normalized);
  };

  const applyDeleteGroup = (label: string) => {
    const indices = getGroupIndicesByLabel(label);
    if (indices.length === 0) return;

    const ok = window.confirm(`¿Eliminar el señalado "${label}"${indices.length > 1 ? ` (×${indices.length})` : ''}?`);
    if (!ok) return;

    const toRemove = new Set(indices);
    const total = Math.max(senalados.length, senaladosPos.length);
    const nextNames: string[] = [];
    const nextLocations: Array<MarkerLocation | null> = [];

    for (let i = 0; i < total; i += 1) {
      if (toRemove.has(i)) continue;
      nextNames.push(senalados[i] ?? '');
      nextLocations.push(senaladosPos[i] ?? null);
    }

    onChangeSenalados(nextNames);
    onChangeSenaladosPos(nextLocations);
    if (selectedLabel === label) setSelectedLabel(null);
  };

  const handleSelectAddSingle = () => {
    resetDrafts();
    setMode('add_single');
    setSelectedLabel(null);
  };

  const handleSelectAddMulti = () => {
    resetDrafts();
    setMode('add_multi');
    setSelectedLabel(null);
    setPromptMultiNameOpen(true);
  };

  const updatePointerTipFromClient = (clientX: number, clientY: number) => {
    const imageEl = imageRef.current;
    if (!imageEl) return null;
    const rect = imageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

    const x = clamp(relX, 0, 1);
    const y = clamp(relY, 0, 1);
    return { x, y };
  };

  const updateAllDraftPointerStartsFromClient = (clientX: number, clientY: number) => {
    if (!imageRef.current || !imageSize) return;

    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);

    setDraftMultiStart({ x: relX, y: relY });
    setDraftMultiLocations(prev => prev.map(item => ({
      ...item,
      startX: relX,
      startY: relY,
    })));
  };

  useEffect(() => {
    if (!draggingPointerStart) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      if (mode === 'add_multi') {
        updateAllDraftPointerStartsFromClient(event.clientX, event.clientY);
      }
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
  }, [draggingPointerStart, mode, imageSize]);

  const updateGroupPointerStartsFromClient = (label: string, clientX: number, clientY: number) => {
    if (!imageRef.current || !imageSize) return;
    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);

    const indices = getGroupIndicesByLabel(label);
    if (indices.length === 0) return;

    const total = Math.max(senalados.length, senaladosPos.length);
    const nextLocations = Array.from({ length: total }, (_, i) => senaladosPos[i] ?? null);

    for (const idx of indices) {
      const prev = nextLocations[idx];
      if (!prev || prev.x == null || prev.y == null) continue;
      nextLocations[idx] = {
        ...prev,
        startX: relX,
        startY: relY,
      };
    }

    onChangeSenaladosPos(nextLocations);
  };

  useEffect(() => {
    if (!draggingSavedLabel) return;
    if (mode !== 'view') return;
    if (!selectedLabel) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      updateGroupPointerStartsFromClient(selectedLabel, event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      setDraggingSavedLabel(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingSavedLabel, mode, selectedLabel, imageSize, senalados, senaladosPos]);

  const handleOverlayPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.tagName.toLowerCase() === 'circle') return;

    if (draggingPointerStart) return;

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    movedBeyondDeadzoneRef.current = false;

    if (stateRef.current.zoom > 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = {
        x: event.clientX - stateRef.current.pos.x,
        y: event.clientY - stateRef.current.pos.y,
      };
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // noop
    }
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || stateRef.current.zoom <= 1) return;

    const start = pointerStartRef.current;
    if (start) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!movedBeyondDeadzoneRef.current && (Math.abs(dx) > PAN_DEADZONE_PX || Math.abs(dy) > PAN_DEADZONE_PX)) {
        movedBeyondDeadzoneRef.current = true;
      }
    }

    const rawPos = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    };

    const containerEl = containerRef.current;
    const nextPos = containerEl
      ? clampPositionToViewport(rawPos, stateRef.current.zoom, imageSize, { width: containerEl.clientWidth, height: containerEl.clientHeight })
      : rawPos;

    stateRef.current.pos = nextPos;
    setPosition(nextPos);
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const wasDragging = movedBeyondDeadzoneRef.current;
    pointerStartRef.current = null;
    movedBeyondDeadzoneRef.current = false;

    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // noop
    }

    if (wasDragging) return;

    const target = event.target as Element;
    if (target.tagName.toLowerCase() === 'circle') return;

    const tip = updatePointerTipFromClient(event.clientX, event.clientY);
    if (!tip) return;

    if (mode === 'add_single') {
      event.preventDefault();
      if (!imageSize) {
        setDraftSingleLocation({ x: tip.x, y: tip.y, startX: null, startY: null });
        setPromptSingleNameOpen(true);
        return;
      }

      const startPx = getPointerStartPx(tip.x * imageSize.width, tip.y * imageSize.height, imageSize.width, imageSize.height);
      setDraftSingleLocation({
        x: tip.x,
        y: tip.y,
        startX: startPx.x / imageSize.width,
        startY: startPx.y / imageSize.height,
      });
      setPromptSingleNameOpen(true);
      return;
    }

    if (mode === 'add_multi') {
      event.preventDefault();
      if (!multiLabel) return;

      const start = draftMultiStart ?? { x: 0.5, y: 0.5 };
      if (!draftMultiStart) setDraftMultiStart(start);

      setDraftMultiLocations(prev => {
        const next = [...prev];
        next.push({
          x: tip.x,
          y: tip.y,
          startX: start.x,
          startY: start.y,
        });
        return next;
      });
    }
  };

  const selectedMarkers = useMemo(() => {
    if (selectedLabel === null) return [] as MarkerLocation[];
    const group = groups.find(item => item.label === selectedLabel);
    if (!group) return [];

    return group.indices
      .map(idx => senaladosPos[idx])
      .filter((loc): loc is MarkerLocation => !!loc && loc.x != null && loc.y != null);
  }, [selectedLabel, groups, senaladosPos]);

  const selectedGroupCount = useMemo(() => {
    if (selectedLabel == null) return 0;
    const group = groups.find(item => item.label === selectedLabel);
    return group?.count ?? 0;
  }, [groups, selectedLabel]);

  const selectedLabelAnchorPx = useMemo(() => {
    if (!imageSize) return null;
    if (mode !== 'view') return null;
    if (selectedLabel == null) return null;
    if (selectedMarkers.length === 0) return null;

    const markerWithStart = selectedMarkers.find(loc => loc?.startX != null && loc?.startY != null);
    if (markerWithStart?.startX != null && markerWithStart.startY != null) {
      return clampPointToBoundsPx(
        markerWithStart.startX * imageSize.width,
        markerWithStart.startY * imageSize.height,
        imageSize.width,
        imageSize.height
      );
    }

    // Auto: coloca el label hacia el lado más cercano a borde (izq/der) y con Y promedio.
    const avgX = selectedMarkers.reduce((acc, m) => acc + (m.x ?? 0), 0) / selectedMarkers.length;
    const avgY = selectedMarkers.reduce((acc, m) => acc + (m.y ?? 0), 0) / selectedMarkers.length;
    const anchorX = avgX >= 0.5 ? (imageSize.width - CALLOUT_MARGIN_PX) : CALLOUT_MARGIN_PX;
    const anchorY = clamp(avgY * imageSize.height, CALLOUT_MARGIN_PX, imageSize.height - CALLOUT_MARGIN_PX);
    return { x: anchorX, y: anchorY };
  }, [imageSize, mode, selectedLabel, selectedMarkers]);

  const startCircleForMulti = useMemo(() => {
    if (!imageSize) return null;
    if (mode !== 'add_multi') return null;
    if (!multiLabel) return null;
    if (!draftMultiStart) return null;

    return clampPointToBoundsPx(
      draftMultiStart.x * imageSize.width,
      draftMultiStart.y * imageSize.height,
      imageSize.width,
      imageSize.height
    );
  }, [draftMultiStart, imageSize, mode, multiLabel]);

  const handleMultiStartDown = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!multiLabel) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingPointerStart(true);
    updateAllDraftPointerStartsFromClient(event.clientX, event.clientY);
  };

  const renderLabelTag = (
    label: string,
    x: number,
    y: number,
    options?: { interactive?: boolean; onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void; isDragging?: boolean }
  ) => {
    if (!imageSize) return null;
    const safe = (label ?? '').trim();
    if (!safe) return null;

    const text = safe.length > 44 ? `${safe.slice(0, 44)}…` : safe;

    const maxWidth = 300;
    const approxCharW = 7.1;
    const padX = 12;
    const boxW = clamp(Math.round(text.length * approxCharW + padX * 2), 92, maxWidth);
    const boxH = 26;
    const margin = 6;
    const gap = 12;

    let x0 = x + gap;
    let side: 'right' | 'left' = 'right';
    if (x0 + boxW > imageSize.width - margin) {
      x0 = x - gap - boxW;
      side = 'left';
    }

    x0 = clamp(x0, margin, imageSize.width - boxW - margin);
    const y0 = clamp(y - boxH / 2, margin, imageSize.height - boxH - margin);
    const cy = clamp(y, y0 + 9, y0 + boxH - 9);
    const edgeX = side === 'right' ? x0 : x0 + boxW;
    const tipX = x;

    const interactive = options?.interactive === true;
    return (
      <g
        pointerEvents={interactive ? 'auto' : 'none'}
        filter={`url(#${labelTagFilterId})`}
        onPointerDown={options?.onPointerDown}
        style={{ cursor: interactive ? (options?.isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <path
          d={`M ${edgeX} ${cy - 7} L ${edgeX} ${cy + 7} L ${tipX} ${cy} Z`}
          fill="rgba(15, 23, 42, 0.78)"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
        />
        <rect
          x={x0}
          y={y0}
          width={boxW}
          height={boxH}
          rx={12}
          fill="rgba(15, 23, 42, 0.78)"
          stroke="rgba(255,255,255,0.58)"
          strokeWidth={1}
        />
        <text
          x={x0 + padX}
          y={y0 + boxH / 2 + 4}
          fontSize={12}
          fontWeight={900}
          fill="#ffffff"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {text}
        </text>
      </g>
    );
  };

  const renderViewModeCallouts = () => {
    if (!imageSize) return null;
    if (mode !== 'view') return null;
    if (!selectedLabel) return null;
    if (!selectedLabelAnchorPx) return null;
    if (selectedMarkers.length === 0) return null;

    const count = selectedGroupCount;
    const color = '#0ea5e9';
    const labelText = count > 1 ? `${selectedLabel} (x${count})` : selectedLabel;

    return (
      <>
        <g clipPath={`url(#${pointerClipId})`}>
          {selectedMarkers.map((marker, idx) => {
            const endPx = { x: marker.x * imageSize.width, y: marker.y * imageSize.height };
            const isHovered = hoveredMarkerIdx === idx;
            const showLine = count <= 1 || isHovered;

            return (
              <g key={idx}>
                {showLine && (
                  <path
                    d={`M ${endPx.x} ${endPx.y} L ${selectedLabelAnchorPx.x} ${selectedLabelAnchorPx.y}`}
                    stroke="rgba(255,255,255,0.78)"
                    strokeWidth={1.35}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}

                <circle
                  cx={endPx.x}
                  cy={endPx.y}
                  r={isHovered ? 7.5 : 6.2}
                  fill="rgba(15, 23, 42, 0.25)"
                  stroke={color}
                  strokeWidth={2}
                  pointerEvents="auto"
                  onPointerEnter={() => setHoveredMarkerIdx(idx)}
                  onPointerLeave={() => setHoveredMarkerIdx(prev => (prev === idx ? null : prev))}
                  style={{ transition: 'all 120ms ease' }}
                />
                <circle
                  cx={endPx.x}
                  cy={endPx.y}
                  r={2.1}
                  fill="#ffffff"
                  opacity={0.92}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>

        {renderLabelTag(labelText, selectedLabelAnchorPx.x, selectedLabelAnchorPx.y, {
          interactive: true,
          isDragging: draggingSavedLabel,
          onPointerDown: (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (mode !== 'view') return;
            setDraggingSavedLabel(true);
            updateGroupPointerStartsFromClient(selectedLabel, e.clientX, e.clientY);
          }
        })}
      </>
    );
  };

  const renderPointers = (markers: MarkerLocation[], options?: { allowDeleteInMulti?: boolean }) => {
    if (!imageSize) return null;
    const allowDeleteInMulti = options?.allowDeleteInMulti === true;

    return markers.map((marker, idx) => {
      if (marker.x == null || marker.y == null) return null;
      const endPx = {
        x: marker.x * imageSize.width,
        y: marker.y * imageSize.height,
      };

      const hasManualStart = marker.startX != null && marker.startY != null;
      const manualStart = hasManualStart
        ? clampPointToBoundsPx(
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
        <g key={idx}>
          <g pointerEvents="none">
            <polygon points={polygonPoints(outline)} fill="rgba(255,255,255,0.55)" shapeRendering="geometricPrecision" />
            <polygon points={polygonPoints(core)} fill="#0b1220" shapeRendering="geometricPrecision" />
          </g>

          {allowDeleteInMulti && (
            <circle
              cx={endPx.x}
              cy={endPx.y}
              r={6.5}
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth={2}
              pointerEvents="auto"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (mode !== 'add_multi') return;
                setDraftMultiLocations(prev => prev.filter((_, i) => i !== idx));
              }}
              style={{ cursor: 'pointer' }}
            />
          )}
        </g>
      );
    });
  };

  const saveSingleWithLabel = (label: string) => {
    const normalized = label.trim();
    if (!normalized) return;
    if (!draftSingleLocation) return;

    onChangeSenalados([...senalados, normalized]);
    onChangeSenaladosPos([...senaladosPos, draftSingleLocation]);
    resetDrafts();
    setMode('view');
  };

  const saveMulti = () => {
    if (!multiLabel) return;
    const normalized = multiLabel.trim();
    if (!normalized) return;
    if (draftMultiLocations.length === 0) return;

    onChangeSenalados([...senalados, ...draftMultiLocations.map(() => normalized)]);
    onChangeSenaladosPos([...senaladosPos, ...draftMultiLocations]);

    resetDrafts();
    setMode('view');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1600,
        background: 'rgba(15, 23, 42, 0.78)',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {/* Imagen */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'linear-gradient(135deg, #0b1220, #0f172a)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onWheel={handleWheel}
          >
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : (mode === 'view' ? 'default' : 'crosshair'),
                transition: (isDragging || isPinching) ? 'none' : 'transform 0.22s ease',
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Editor de señalados"
                draggable={false}
                onLoad={updateImageSize}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  userSelect: 'none',
                  display: 'block',
                  borderRadius: '14px',
                  boxShadow: '0 16px 44px rgba(0, 0, 0, 0.45)',
                }}
              />

              {imageSize && (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'auto',
                    overflow: 'visible',
                  }}
                  width={imageSize.width}
                  height={imageSize.height}
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={handleOverlayPointerUp}
                  onPointerCancel={handleOverlayPointerUp}
                  onPointerLeave={handleOverlayPointerUp}
                >
                  <defs>
                    <clipPath id={pointerClipId}>
                      <rect x="0" y="0" width={imageSize.width} height={imageSize.height} />
                    </clipPath>

                    <filter id={labelTagFilterId} x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(0,0,0,0.45)" />
                      <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.35)" />
                    </filter>
                  </defs>

                  {mode === 'view' && renderViewModeCallouts()}

                  <g clipPath={`url(#${pointerClipId})`}>
                    {mode === 'add_single' && draftSingleLocation && renderPointers([draftSingleLocation])}
                    {mode === 'add_multi' && renderPointers(draftMultiLocations, { allowDeleteInMulti: true })}
                  </g>

                  {mode === 'add_multi' && startCircleForMulti && (
                    <>{renderLabelTag(multiLabel ?? '', startCircleForMulti.x, startCircleForMulti.y)}</>
                  )}

                  {mode === 'add_multi' && startCircleForMulti && (
                    <circle
                      cx={startCircleForMulti.x}
                      cy={startCircleForMulti.y}
                      r={8}
                      fill={draggingPointerStart ? '#2563eb' : '#0ea5e9'}
                      stroke="#ffffff"
                      strokeWidth={2}
                      onPointerDown={handleMultiStartDown}
                      style={{ cursor: draggingPointerStart ? 'grabbing' : 'grab' }}
                    />
                  )}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: '360px',
            borderLeft: '1px solid #d8e1ec',
            background: 'linear-gradient(180deg, #f7fafd 0%, #edf2f7 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Montserrat', 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              padding: '14px 14px 10px',
              borderBottom: '1px solid #d4dde8',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.92em' }}>
                Señalados
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.78em', color: '#475569', lineHeight: 1.35 }}>
                {mode === 'add_single'
                  ? 'Modo: Añadir señalado. Toca la imagen para ubicar.'
                  : mode === 'add_multi'
                    ? `Modo: Múltiple${multiLabel ? ` (${multiLabel})` : ''}. Toca para añadir puntos.`
                    : 'Selecciona un señalado del listado para verlo.'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                borderRadius: '10px',
                padding: '6px 10px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              Cerrar
            </button>
          </div>

          <div style={{ padding: '10px 14px 0' }}>
            <div style={{
              color: '#475569',
              fontSize: '0.62em',
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Zoom
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= ZOOM_MIN + 0.001}
                style={{
                  flex: 1,
                  border: '1px solid #cbd5e1',
                  background: zoomLevel <= ZOOM_MIN + 0.001 ? '#f1f5f9' : '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  padding: '9px 10px',
                  fontWeight: 900,
                  cursor: zoomLevel <= ZOOM_MIN + 0.001 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                style={{
                  flex: 1,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  borderRadius: '12px',
                  padding: '9px 10px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= ZOOM_MAX - 0.001}
                style={{
                  flex: 1,
                  border: '1px solid #cbd5e1',
                  background: zoomLevel >= ZOOM_MAX - 0.001 ? '#f1f5f9' : '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  padding: '9px 10px',
                  fontWeight: 900,
                  cursor: zoomLevel >= ZOOM_MAX - 0.001 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                +
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.76em', color: '#475569', lineHeight: 1.35 }}>
              Usa la rueda o pellizca para hacer zoom. Arrastra para mover.
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSelectAddSingle}
              style={{
                border: mode === 'add_single' ? '1px solid #93c5fd' : '1px solid #d1d9e6',
                background: mode === 'add_single' ? '#e9f1ff' : '#ffffff',
                color: mode === 'add_single' ? '#1e3a8a' : '#334155',
                borderRadius: '12px',
                padding: '10px 12px',
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.85em',
                boxShadow: mode === 'add_single' ? '0 6px 14px rgba(37,99,235,0.12)' : 'none',
              }}
            >
              + Añadir señalado
            </button>
            <button
              type="button"
              onClick={handleSelectAddMulti}
              style={{
                border: mode === 'add_multi' ? '1px solid #93c5fd' : '1px solid #d1d9e6',
                background: mode === 'add_multi' ? '#e9f1ff' : '#ffffff',
                color: mode === 'add_multi' ? '#1e3a8a' : '#334155',
                borderRadius: '12px',
                padding: '10px 12px',
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.85em',
                boxShadow: mode === 'add_multi' ? '0 6px 14px rgba(37,99,235,0.12)' : 'none',
              }}
            >
              + Añadir señalado múltiple
            </button>

            {mode === 'add_multi' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDraftMultiLocations(prev => prev.slice(0, -1))}
                  disabled={draftMultiLocations.length === 0}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    background: draftMultiLocations.length === 0 ? '#f1f5f9' : '#ffffff',
                    color: draftMultiLocations.length === 0 ? '#94a3b8' : '#475569',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontWeight: 800,
                    cursor: draftMultiLocations.length === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.78em',
                  }}
                >
                  Quitar último
                </button>
                <button
                  type="button"
                  onClick={saveMulti}
                  disabled={draftMultiLocations.length === 0 || !multiLabel}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: (draftMultiLocations.length === 0 || !multiLabel)
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontWeight: 900,
                    cursor: (draftMultiLocations.length === 0 || !multiLabel) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.78em',
                    opacity: (draftMultiLocations.length === 0 || !multiLabel) ? 0.82 : 1,
                  }}
                >
                  Guardar
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
            <div style={{
              padding: '10px 2px 8px',
              color: '#475569',
              fontSize: '0.64em',
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Listado
            </div>

            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groups.map((group, i) => {
                const isActive = selectedLabel === group.label && mode === 'view';
                const disabled = !group.hasMarker;
                return (
                  <li key={`${group.label}-${i}`} style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '10px',
                    background: isActive ? '#eff6ff' : '#f8fafc',
                    borderRadius: '12px',
                    padding: '8px 10px',
                    border: isActive ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    boxShadow: isActive ? '0 8px 18px rgba(37,99,235,0.12)' : '0 1px 0 rgba(148,163,184,0.12)',
                    transition: 'all 0.2s ease',
                  }}>
                    <span style={{
                      minWidth: '24px',
                      height: '24px',
                      borderRadius: '999px',
                      background: isActive
                        ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                        : disabled
                          ? 'linear-gradient(135deg, #cbd5e1, #94a3b8)'
                          : 'linear-gradient(135deg, #818cf8, #6366f1)',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: '0.68em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '6px',
                    }}>{i + 1}</span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setMode('view');
                          resetDrafts();
                          setSelectedLabel(group.label);
                        }}
                        style={{
                          width: '100%',
                          border: isActive ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                          background: isActive ? '#e8f0ff' : disabled ? '#f1f5f9' : '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.72em',
                          lineHeight: 1.35,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontWeight: isActive ? 800 : 700,
                          borderRadius: '10px',
                          padding: '7px 10px',
                          textAlign: 'center',
                          fontFamily: 'inherit',
                          opacity: disabled ? 0.78 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.label}
                          {group.count > 1 && (
                            <span style={{ marginLeft: '8px', fontWeight: 900, color: '#0c4a6e', opacity: 0.78 }}>
                              ×{group.count}
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: '0.66em',
                          fontWeight: 800,
                          borderRadius: '999px',
                          padding: '3px 8px',
                          border: disabled ? '1px solid #d1d5db' : '1px solid #bae6fd',
                          background: disabled ? '#f1f5f9' : '#ecfeff',
                          color: disabled ? '#6b7280' : '#0c4a6e',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '26px',
                          minHeight: '22px',
                        }}>
                          {disabled ? 'Sin ubicación' : 'Ver'}
                        </span>
                      </button>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setRenameTargetLabel(group.label)}
                          style={{
                            flex: 1,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            borderRadius: '10px',
                            padding: '7px 10px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '0.72em',
                          }}
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDeleteGroup(group.label)}
                          style={{
                            flex: 1,
                            border: '1px solid #fecaca',
                            background: '#fff1f2',
                            color: '#b91c1c',
                            borderRadius: '10px',
                            padding: '7px 10px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '0.72em',
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      {promptSingleNameOpen && (
        <RequiredTextPromptModal
          title="Nombre del señalado"
          description="Después de ubicar el señalado, escribe su nombre para guardarlo."
          placeholder="Ej: Glomérulo"
          required
          cancelLabel="Cancelar"
          onCancel={() => {
            setPromptSingleNameOpen(false);
            setDraftSingleLocation(null);
            setMode('view');
          }}
          onSubmit={(value) => {
            setPromptSingleNameOpen(false);
            saveSingleWithLabel(value);
          }}
        />
      )}

      {promptMultiNameOpen && (
        <RequiredTextPromptModal
          title="Nombre del señalado (múltiple)"
          description="Escribe el nombre una vez y luego podrás marcar varios puntos."
          placeholder="Ej: Epitelio"
          required
          cancelLabel="Cancelar"
          onCancel={() => {
            setPromptMultiNameOpen(false);
            resetDrafts();
            setMode('view');
          }}
          onSubmit={(value) => {
            setPromptMultiNameOpen(false);
            setMultiLabel(value);
            setDraftMultiStart({ x: 0.5, y: 0.5 });
            setDraftMultiLocations([]);
          }}
        />
      )}

      {renameTargetLabel !== null && (
        <RequiredTextPromptModal
          title="Renombrar señalado"
          description="Este cambio se aplicará a todos los puntos que compartan este nombre."
          placeholder="Nuevo nombre"
          initialValue={renameTargetLabel === '(Sin nombre)' ? '' : renameTargetLabel}
          required
          cancelLabel="Cancelar"
          onCancel={() => setRenameTargetLabel(null)}
          onSubmit={(value) => {
            const from = renameTargetLabel;
            setRenameTargetLabel(null);
            if (from) applyRenameGroup(from, value);
          }}
        />
      )}
    </div>
  );
};

export default SenaladosEditorModal;
export type { MarkerLocation };
