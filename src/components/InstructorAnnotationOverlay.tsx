import type { IdentificationAnnotation } from '../utils/identificationAnnotations';
import { regionPolygonPath } from '../utils/regionPolygonPath';
import { regionBorderStyle } from '../utils/regionBorderStyle';
import type { MarkerLocation } from './PlateAnnotationViewerEditor';

const POINTER_CORE_WIDTH_PX = 6;
const POINTER_OUTLINE_WIDTH_PX = 8.2;
const POINTER_TAPER_PX = 18;
const POINTER_MIN_ANGLE_DEG = 7;
const POINTER_OUTLINE_TIP_BACKOFF_PX = 1.1;
const POINTER_BASE_OUTSET_PX = 3;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPointerStart = (x: number, y: number, width: number, height: number) => {
  const distances = [
    { edge: 'left' as const, value: x },
    { edge: 'right' as const, value: width - x },
    { edge: 'top' as const, value: y },
    { edge: 'bottom' as const, value: height - y },
  ];
  const nearest = distances.reduce((previous, current) => (current.value < previous.value ? current : previous));
  if (nearest.edge === 'left') return { x: 0, y, edge: nearest.edge };
  if (nearest.edge === 'right') return { x: width, y, edge: nearest.edge };
  if (nearest.edge === 'top') return { x, y: 0, edge: nearest.edge };
  return { x, y: height, edge: nearest.edge };
};

const clampPointerStartToEdge = (x: number, y: number, width: number, height: number) => (
  getPointerStart(clamp(x, 0, width), clamp(y, 0, height), width, height)
);

const enforceMinimumPointerInclination = (
  start: { x: number; y: number; edge: 'left' | 'right' | 'top' | 'bottom' },
  end: { x: number; y: number },
  width: number,
  height: number,
) => {
  const tangent = Math.tan((POINTER_MIN_ANGLE_DEG * Math.PI) / 180);
  if (start.edge === 'left' || start.edge === 'right') {
    const minimumDeltaY = Math.abs(end.x - start.x) * tangent;
    if (Math.abs(end.y - start.y) < minimumDeltaY) {
      const direction = end.y < height / 2 ? 1 : -1;
      return { ...start, y: clamp(end.y - direction * minimumDeltaY, 0, height) };
    }
    return start;
  }
  const minimumDeltaX = Math.abs(end.y - start.y) * tangent;
  if (Math.abs(end.x - start.x) < minimumDeltaX) {
    const direction = end.x < width / 2 ? 1 : -1;
    return { ...start, x: clamp(end.x - direction * minimumDeltaX, 0, width) };
  }
  return start;
};

const getPointerPolygon = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  bodyWidth: number,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;
  const halfWidth = bodyWidth / 2;
  const taper = Math.min(POINTER_TAPER_PX, length * 0.6);
  const neck = { x: end.x - unitX * taper, y: end.y - unitY * taper };
  return [
    { x: start.x + normalX * halfWidth, y: start.y + normalY * halfWidth },
    { x: start.x - normalX * halfWidth, y: start.y - normalY * halfWidth },
    { x: neck.x - normalX * halfWidth, y: neck.y - normalY * halfWidth },
    end,
    { x: neck.x + normalX * halfWidth, y: neck.y + normalY * halfWidth },
  ].map(point => `${point.x},${point.y}`).join(' ');
};

type AnnotationAppearance = Pick<MarkerLocation, 'regionColor' | 'regionOpacity' | 'regionStrokeWidth' | 'regionDashLength' | 'regionDashGap'>;

export default function InstructorAnnotationOverlay({
  marker,
  width,
  height,
  orderNumber,
}: {
  marker: IdentificationAnnotation & AnnotationAppearance;
  width: number;
  height: number;
  orderNumber?: number;
}) {
  const base = Math.min(width, height);
  const badgeRadius = Math.max(12, base * 0.028);
  const badgeFontSize = badgeRadius * 1.15;
  const badgeStroke = Math.max(2, badgeRadius * 0.16);
  const hasRegion = !!(marker.regionPoints && marker.regionPoints.length >= 6);

  if (hasRegion) {
    const regionStyle = regionBorderStyle(marker);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < marker.regionPoints!.length; i += 2) {
      xs.push(marker.regionPoints![i] * width);
      ys.push(marker.regionPoints![i + 1] * height);
    }
    const cx = clamp((Math.min(...xs) + Math.max(...xs)) / 2, badgeRadius + 2, Math.max(badgeRadius + 2, width - badgeRadius - 2));
    const cy = clamp((Math.min(...ys) + Math.max(...ys)) / 2, badgeRadius + 2, Math.max(badgeRadius + 2, height - badgeRadius - 2));

    return (
      <svg className="desafio-annotation-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={orderNumber ? `Señalado ${orderNumber} a identificar` : 'Señalado a identificar'}>
        <path
          d={regionPolygonPath(marker.regionPoints!, marker.regionHoles, width, height, marker.regionSmooth ?? false)}
          fill={marker.regionColor ?? '#22c55e'}
          fillOpacity={marker.regionOpacity ?? 0.28}
          fillRule="evenodd"
          stroke={marker.regionColor ?? '#22c55e'}
          strokeWidth={regionStyle.width}
          strokeDasharray={marker.regionDashLength != null || marker.regionDashGap != null ? `${regionStyle.dash} ${regionStyle.gap}` : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {orderNumber != null && (
          <g data-marker-order={orderNumber}>
            <circle cx={cx} cy={cy} r={badgeRadius} fill="#0f172a" stroke="#ffffff" strokeWidth={badgeStroke} />
            <text x={cx} y={cy} fill="#ffffff" fontSize={badgeFontSize} fontWeight="800" textAnchor="middle" dominantBaseline="central">{orderNumber}</text>
          </g>
        )}
      </svg>
    );
  }

  const end = { x: (marker.x ?? 0) * width, y: (marker.y ?? 0) * height };
  const hasSavedStart = marker.startX != null && marker.startY != null;
  const start = hasSavedStart
    ? clampPointerStartToEdge(marker.startX! * width, marker.startY! * height, width, height)
    : enforceMinimumPointerInclination(getPointerStart(end.x, end.y, width, height), end, width, height);
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const unitX = (end.x - start.x) / length;
  const unitY = (end.y - start.y) / length;
  const drawStart = { x: start.x - unitX * POINTER_BASE_OUTSET_PX, y: start.y - unitY * POINTER_BASE_OUTSET_PX };
  const outlineEnd = { x: end.x - unitX * POINTER_OUTLINE_TIP_BACKOFF_PX, y: end.y - unitY * POINTER_OUTLINE_TIP_BACKOFF_PX };
  const coreWidth = Math.max(POINTER_CORE_WIDTH_PX, base * 0.012);
  const outlineWidth = Math.max(POINTER_OUTLINE_WIDTH_PX, base * 0.017);

  const badgeOffset = Math.min(length * 0.55, Math.max(badgeRadius * 2.3, base * 0.065));
  const badgeX = clamp(end.x - unitX * badgeOffset, badgeRadius + 2, Math.max(badgeRadius + 2, width - badgeRadius - 2));
  const badgeY = clamp(end.y - unitY * badgeOffset, badgeRadius + 2, Math.max(badgeRadius + 2, height - badgeRadius - 2));

  return (
    <svg className="desafio-annotation-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={orderNumber ? `Señalado ${orderNumber} a identificar` : 'Señalado a identificar'}>
      <polygon points={getPointerPolygon(drawStart, outlineEnd, outlineWidth)} fill="#ffffff" opacity={0.55} shapeRendering="geometricPrecision" />
      <polygon points={getPointerPolygon(drawStart, end, coreWidth)} fill="#0a0a0a" shapeRendering="geometricPrecision" />
      {orderNumber != null && (
        <g data-marker-order={orderNumber}>
          <circle cx={badgeX} cy={badgeY} r={badgeRadius} fill="#0f172a" stroke="#ffffff" strokeWidth={badgeStroke} />
          <text x={badgeX} y={badgeY} fill="#ffffff" fontSize={badgeFontSize} fontWeight="800" textAnchor="middle" dominantBaseline="central">{orderNumber}</text>
        </g>
      )}
    </svg>
  );
}
