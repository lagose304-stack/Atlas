import { memo, useLayoutEffect, useRef, useState } from 'react';
import { markBounds, type BoardMark } from './viewerWhiteboardGeometry';

export function textBackdrop(color: string): string {
  const hex = color.replace('#', '');
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#0f172a' : '#ffffff';
}

/** Medidas reales de los glifos, antes de la proyección de zoom y giro. */
export function textBounds(mark: BoardMark, w: number, h: number, node?: SVGTextElement | null) {
  const fallback = markBounds(mark, w, h);
  if (!node?.getBBox) return fallback;
  try {
    const measured = node.getBBox();
    const normalization = Number(node.getAttribute?.('data-whiteboard-font-scale'));
    const box = normalization > 0 ? { x: mark.points[0].x * w + measured.x / normalization, y: mark.points[0].y * h + measured.y / normalization, width: measured.width / normalization, height: measured.height / normalization } : measured;
    const font = (mark.fontSize ?? mark.width * 6) * w;
    const padding = font * 0.24;
    return { x: box.x - padding, y: box.y - padding, width: Math.max(box.width, font * 0.3) + padding * 2, height: Math.max(box.height, font) + padding * 2 };
  } catch {
    return fallback;
  }
}

export default memo(function WhiteboardText({ mark, w, h, zoom, interactive }: { mark: BoardMark; w: number; h: number; zoom: number; interactive: boolean }) {
  const ref = useRef<SVGTextElement>(null);
  const [bounds, setBounds] = useState(() => markBounds(mark, w, h));
  const font = (mark.fontSize ?? mark.width * 6) * w;
  const x = mark.points[0].x * w, y = mark.points[0].y * h;
  useLayoutEffect(() => { setBounds(textBounds(mark, w, h, ref.current)); }, [mark, w, h, zoom]);
  const background = textBackdrop(mark.color);
  return <>
    {mark.background && <rect data-whiteboard-text-background {...bounds} rx={font * 0.16} fill={background} fillOpacity={background === '#ffffff' ? 0.9 : 0.78} pointerEvents="none" />}
    {/* Normalizar evita fuentes locales de 2–4 px y conserva el espaciado al ampliar. */}
    <g transform={`translate(${x} ${y}) scale(${1 / zoom})`}>
      <text ref={ref} data-whiteboard-text data-whiteboard-font-scale={zoom} x={0} y={0} fill={mark.color} fontSize={font * zoom} fontFamily="Arial, sans-serif" fontWeight="600" textRendering="geometricPrecision" pointerEvents="none">{(mark.text ?? '').split('\n').map((line, index) => <tspan key={index} x={0} dy={index === 0 ? 0 : font * zoom * 1.3}>{line || '\u00a0'}</tspan>)}</text>
    </g>
    {interactive && <rect className="viewer-whiteboard__hit" {...bounds} fill="transparent" pointerEvents="all" />}
  </>;
});
