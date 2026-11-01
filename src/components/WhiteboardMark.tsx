import React, { memo, useMemo } from 'react';
import { strokePath, type BoardMark as Mark, type WhiteboardTool } from './viewerWhiteboardGeometry';
import WhiteboardText from './WhiteboardText';
const shapes: WhiteboardTool[] = ['arrow', 'line', 'ellipse', 'rectangle'];

export default memo(function WhiteboardMark({ mark, w, h, zoom, selectable, tool }: {
  mark: Mark; w: number; h: number; zoom: number; selectable: boolean; tool: WhiteboardTool | null;
}) {
  const path = useMemo(() => mark.tool === 'pen' || mark.tool === 'highlight' ? strokePath(mark.points, w, h) : '', [mark.points, mark.tool, w, h]);
  const first = mark.points[0]; if (!first) return null;
  const last = mark.points[mark.points.length - 1];
  const x = first.x * w, y = first.y * h, x2 = last.x * w, y2 = last.y * h;
  const stroke = mark.width * w;
  const common = { stroke: mark.color, strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, pointerEvents: 'none' as const };
  if (mark.tool === 'text') return <g key={mark.id} data-whiteboard-mark={mark.id} opacity={mark.opacity}><WhiteboardText mark={mark} w={w} h={h} zoom={zoom} interactive={selectable} /></g>;
  let shape: React.ReactElement;
  if (mark.tool === 'rectangle') shape = <rect {...common} x={Math.min(x, x2)} y={Math.min(y, y2)} width={Math.abs(x2 - x)} height={Math.abs(y2 - y)} />;
  else if (mark.tool === 'ellipse') shape = <ellipse {...common} cx={(x + x2) / 2} cy={(y + y2) / 2} rx={Math.abs(x2 - x) / 2} ry={Math.abs(y2 - y) / 2} />;
  else if (mark.tool === 'arrow') {
    const angle = Math.atan2(y2 - y, x2 - x), head = Math.min(Math.hypot(x2 - x, y2 - y) * 0.45, stroke * 5);
    shape = <path {...common} d={`M${x},${y} L${x2},${y2} M${x2 - head * Math.cos(angle - 0.5)},${y2 - head * Math.sin(angle - 0.5)} L${x2},${y2} L${x2 - head * Math.cos(angle + 0.5)},${y2 - head * Math.sin(angle + 0.5)}`} />;
  } else if (mark.points.length === 1) shape = <circle cx={x} cy={y} r={stroke / 2} fill={mark.color} pointerEvents="none" />;
  else shape = <path {...common} d={mark.tool === 'line' ? `M${x},${y} L${x2},${y2}` : path} />;
  return <g key={mark.id} data-whiteboard-mark={mark.id} opacity={mark.opacity}>
    {shape}
    {selectable && React.cloneElement(shape, { className: 'viewer-whiteboard__hit', stroke: 'transparent', strokeWidth: Math.max(stroke, 16 / zoom), fill: tool === 'select' && (shapes.includes(mark.tool) || mark.points.length === 1) ? 'transparent' : 'none', pointerEvents: tool === 'select' && (shapes.includes(mark.tool) || mark.points.length === 1) ? 'all' : 'stroke' })}
  </g>;
});
