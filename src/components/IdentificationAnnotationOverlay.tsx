import { useId } from 'react';
import type { IdentificationAnnotation } from '../utils/identificationAnnotations';
import { regionPolygonPath } from '../utils/regionPolygonPath';

export default function IdentificationAnnotationOverlay({ marker, width, height }: { marker: IdentificationAnnotation; width: number; height: number }) {
  const id = useId();
  const x = (marker.x ?? 0) * width;
  const y = (marker.y ?? 0) * height;
  return <svg className="desafio-annotation-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Señalado a identificar">
    {marker.regionPoints ? <path d={regionPolygonPath(marker.regionPoints, marker.regionHoles, width, height, marker.regionSmooth ?? false)} fill="rgba(250,204,21,.14)" fillRule="evenodd" stroke="#facc15" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : <>
      <defs><marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#facc15" /></marker></defs>
      {marker.startX != null && marker.startY != null ? <line x1={marker.startX * width} y1={marker.startY * height} x2={x} y2={y} stroke="#facc15" strokeWidth="3" vectorEffect="non-scaling-stroke" markerEnd={`url(#${id})`} /> : <>
        <circle cx={x} cy={y} r={Math.min(width, height) * .018} fill="none" stroke="#0f172a" strokeWidth="6" vectorEffect="non-scaling-stroke" />
        <circle cx={x} cy={y} r={Math.min(width, height) * .018} fill="none" stroke="#facc15" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </>}
    </>}
  </svg>;
}
