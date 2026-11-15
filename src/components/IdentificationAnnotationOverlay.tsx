import { useId } from 'react';
import type { IdentificationAnnotation } from '../utils/identificationAnnotations';
import { regionPolygonPath } from '../utils/regionPolygonPath';
import { regionBorderStyle } from '../utils/regionBorderStyle';
import type { MarkerLocation } from './PlateAnnotationViewerEditor';

type AnnotationAppearance = Pick<MarkerLocation, 'regionColor' | 'regionOpacity' | 'regionStrokeWidth' | 'regionDashLength' | 'regionDashGap'>;
export default function IdentificationAnnotationOverlay({ marker, width, height }: { marker: IdentificationAnnotation & AnnotationAppearance; width: number; height: number }) {
  const id = useId();
  const x = (marker.x ?? 0) * width;
  const y = (marker.y ?? 0) * height;
  const regionStyle = regionBorderStyle(marker);
  return <svg className="desafio-annotation-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Señalado a identificar">
    {marker.regionPoints ? <path d={regionPolygonPath(marker.regionPoints, marker.regionHoles, width, height, marker.regionSmooth ?? false)} fill={marker.regionColor ?? 'rgba(250,204,21,.14)'} fillOpacity={marker.regionColor ? marker.regionOpacity ?? .28 : 1} fillRule="evenodd" stroke={marker.regionColor ?? '#facc15'} strokeWidth={marker.regionColor ? regionStyle.width : 3} strokeDasharray={marker.regionColor ? `${regionStyle.dash} ${regionStyle.gap}` : undefined} vectorEffect="non-scaling-stroke" /> : <>
      <defs><marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#facc15" /></marker></defs>
      {marker.startX != null && marker.startY != null ? <line x1={marker.startX * width} y1={marker.startY * height} x2={x} y2={y} stroke="#facc15" strokeWidth="3" vectorEffect="non-scaling-stroke" markerEnd={`url(#${id})`} /> : <>
        <circle cx={x} cy={y} r={Math.min(width, height) * .018} fill="none" stroke="#0f172a" strokeWidth="6" vectorEffect="non-scaling-stroke" />
        <circle cx={x} cy={y} r={Math.min(width, height) * .018} fill="none" stroke="#facc15" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </>}
    </>}
  </svg>;
}
