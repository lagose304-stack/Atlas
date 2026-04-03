import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { IMAGE_VIEWER_VISIBILITY_EVENT, type ImageViewerVisibilityDetail } from '../constants/uiEvents';

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
}) => {
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Point2D | null>(null);
  const isPinchingRef = useRef(false);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartScaleRef = useRef(MIN_ZOOM);

  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const [panOffset, setPanOffset] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const normalizedSections = useMemo(() => normalizeSections(sections), [sections]);
  const isNarrowLayout = windowWidth < 980;

  useEffect(() => {
    setActiveSectionIndex(null);
  }, [normalizedSections]);

  const toggleSectionSelection = (sectionIndex: number) => {
    setActiveSectionIndex((prev) => (prev === sectionIndex ? null : sectionIndex));
  };

  useEffect(() => {
    const handleResizeWindow = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResizeWindow);
    return () => window.removeEventListener('resize', handleResizeWindow);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
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
      const rect = frame.getBoundingClientRect();
      setWorkspaceSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
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
    stopPan();
    isPinchingRef.current = false;
    pinchStartDistanceRef.current = 0;
    pinchStartScaleRef.current = MIN_ZOOM;
    setZoomScale(MIN_ZOOM);
    setPanOffset({ x: 0, y: 0 });
  };

  const applyZoomAtPoint = (nextScaleRaw: number, anchorPoint: Point2D) => {
    if (!baseImageRect || !imageRect) return;

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

  const activeSection = activeSectionIndex !== null ? normalizedSections[activeSectionIndex] ?? null : null;
  const hasHighlightedSelection = activeSectionIndex !== null;
  const isResetDisabled = zoomScale <= MIN_ZOOM + 0.001 && Math.abs(panOffset.x) < 0.5 && Math.abs(panOffset.y) < 0.5;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(event) => event.stopPropagation()}>
        <header style={s.topBar}>
          <div style={s.titleWrap}>
            <h2 style={s.title}>{mapLabel}</h2>
            <p style={s.subtitle}>
              {temaNombre ?? 'Tema'} {'>'} {subtemaNombre ?? 'Subtema'}
            </p>
          </div>

          <div style={s.topActions}>
            <span style={s.zoomBadge}>{Math.round(zoomScale * 100)}%</span>
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
            <button
              type="button"
              style={s.toggleInfoBtn}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              {sidebarOpen ? 'Ocultar info' : 'Mostrar info'}
            </button>
            <button type="button" style={s.closeBtn} onClick={onClose}>Cerrar</button>
          </div>
        </header>

        <div style={sidebarOpen ? (isNarrowLayout ? s.bodyStack : s.bodyWithSidebar) : s.bodyNoSidebar}>
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
                    const strokeColor = shouldGrayOut ? '#94a3b8' : (isActive ? '#0f172a' : section.color);
                    const fillColor = shouldGrayOut ? 'rgba(148,163,184,0.16)' : (isActive ? hexToRgba(section.color, 0.34) : hexToRgba(section.color, 0.2));

                    return (
                      <Line
                        key={`viewer-section-${idx}`}
                        points={section.points}
                        closed
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isActive ? 1.3 : 0.8}
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

          {sidebarOpen && (
            <aside style={s.sidebar}>
              <h3 style={s.sidebarTitle}>Selecciones ({normalizedSections.length})</h3>

              {normalizedSections.length === 0 ? (
                <p style={s.emptyText}>Este mapa no tiene selecciones guardadas.</p>
              ) : (
                <div style={s.sectionList}>
                  {normalizedSections.map((section, idx) => (
                    <button
                      key={`section-info-${idx}`}
                      type="button"
                      style={{
                        ...s.sectionCard,
                        ...(idx === activeSectionIndex ? s.sectionCardActive : {}),
                        borderColor: idx === activeSectionIndex ? section.color : '#cbd5e1',
                      }}
                      onClick={() => toggleSectionSelection(idx)}
                    >
                      <div style={s.sectionCardHead}>
                        <span
                          style={{
                            ...s.sectionColorDot,
                            background: section.color,
                            boxShadow: `0 0 0 2px ${hexToRgba(section.color, 0.2)}`,
                          }}
                        />
                        <span style={s.sectionTitle} title={section.title}>{section.title}</span>
                      </div>

                      {section.description ? (
                        <p style={s.sectionDescription}>{section.description}</p>
                      ) : (
                        <p style={s.sectionDescriptionMuted}>Sin descripcion registrada.</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {activeSection && (
                <div style={s.activeHint}>
                  Seleccion activa: <strong>{activeSection.title}</strong>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.78)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    boxSizing: 'border-box',
  },
  modal: {
    width: 'min(96vw, 1450px)',
    height: 'min(94vh, 920px)',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)',
    boxShadow: '0 26px 64px rgba(2, 6, 23, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.34)',
    background: 'rgba(255,255,255,0.76)',
    backdropFilter: 'blur(8px)',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '1.08em',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: '0.84em',
    fontWeight: 600,
  },
  topActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  zoomBadge: {
    borderRadius: '999px',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1e3a8a',
    padding: '6px 10px',
    fontSize: '0.78em',
    fontWeight: 800,
    minWidth: '56px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  resetBtn: {
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resetBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  toggleInfoBtn: {
    borderRadius: '10px',
    border: '1.5px solid #bae6fd',
    background: '#f0f9ff',
    color: '#0369a1',
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  closeBtn: {
    borderRadius: '10px',
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    padding: '8px 12px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  bodyWithSidebar: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr minmax(250px, 320px)',
    gap: '12px',
    padding: '12px',
    boxSizing: 'border-box',
    minHeight: 0,
  },
  bodyStack: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'minmax(300px, 1fr) auto',
    gap: '12px',
    padding: '12px',
    boxSizing: 'border-box',
    minHeight: 0,
  },
  bodyNoSidebar: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    padding: '12px',
    boxSizing: 'border-box',
    minHeight: 0,
  },
  canvasArea: {
    minWidth: 0,
    minHeight: 0,
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    touchAction: 'none',
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontWeight: 700,
  },
  sidebar: {
    minWidth: 0,
    minHeight: 0,
    borderRadius: '12px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  sidebarTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '0.92em',
    fontWeight: 800,
  },
  sectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    paddingRight: '3px',
    minHeight: 0,
  },
  sectionCard: {
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sectionCardActive: {
    background: '#f0f9ff',
    boxShadow: '0 0 0 2px rgba(14,165,233,0.12)',
  },
  sectionCardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    flexShrink: 0,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: '0.82em',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sectionDescription: {
    margin: 0,
    color: '#334155',
    fontSize: '0.76em',
    lineHeight: 1.4,
  },
  sectionDescriptionMuted: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.74em',
    lineHeight: 1.35,
    fontStyle: 'italic',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.82em',
    lineHeight: 1.4,
  },
  activeHint: {
    marginTop: 'auto',
    borderRadius: '10px',
    border: '1px solid #bae6fd',
    background: '#f0f9ff',
    color: '#075985',
    padding: '8px 10px',
    fontSize: '0.76em',
    lineHeight: 1.35,
  },
};

export default InteractiveMapViewerModal;
