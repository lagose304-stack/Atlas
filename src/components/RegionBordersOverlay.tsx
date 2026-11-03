import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWhiteboardProjection } from './useWhiteboardProjection';
import { regionBorderStyle } from '../utils/regionBorderStyle';
import { regionDashPath } from '../utils/regionDashPath';
import { regionPolygonPath } from '../utils/regionPolygonPath';

type Region = {
  regionOpen?: boolean;
  regionPoints?: number[] | null; regionHoles?: number[][] | null; regionColor?: string | null;
  regionStrokeWidth?: number | null; regionDashLength?: number | null; regionDashGap?: number | null; regionSmooth?: boolean | null;
};
/** SVG fuera de la textura CSS de la foto; el patrón permanece anclado a la imagen. */
export default function RegionBordersOverlay({ layer, size, regions, zoom, viewKey }: {
  layer: HTMLDivElement | null; size: { width: number; height: number } | null;
  regions: { index: number; marker: Region }[]; zoom: number; viewKey: string;
}) {
  const svg = useRef<SVGSVGElement>(null), scene = useRef<SVGGElement>(null);
  useWhiteboardProjection(svg, scene, layer, size, zoom, viewKey, regions.length > 0);
  if (!layer?.parentElement || !size || !regions.length) return null;
  return createPortal(<svg ref={svg} data-public-region-borders aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: 8 }}>
    <g ref={scene}><svg width={size.width} height={size.height} overflow="hidden">
      {regions.map(({ index, marker }) => {
        if (!marker.regionPoints || marker.regionPoints.length < (marker.regionOpen ? 4 : 6)) return null;
        const style = regionBorderStyle(marker);
        const custom = marker.regionStrokeWidth != null || marker.regionDashLength != null || marker.regionDashGap != null;
        return <path key={index} data-region-clean-dashes={custom ? '' : undefined} data-region-index={index}
          d={custom ? regionDashPath(marker.regionPoints, marker.regionHoles, size.width, size.height, 1, marker, !marker.regionOpen) : regionPolygonPath(marker.regionPoints, marker.regionHoles, size.width, size.height, marker.regionSmooth ?? false)}
          fill="none" stroke={marker.regionColor ?? '#22c55e'} strokeWidth={style.width}
          strokeDasharray={custom ? undefined : `${style.dash} ${style.gap}`} strokeLinecap={custom ? 'round' : 'butt'} strokeLinejoin="round" />;
      })}
    </svg></g>
  </svg>, layer.parentElement);
}
