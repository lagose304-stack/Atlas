import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createStrokePathBuilder, type BoardMark } from './viewerWhiteboardGeometry';

export type WhiteboardDraftHandle = { update: (mark: BoardMark) => void };

/** La tinta del gesto se pinta en SVG antes del repintado, sin esperar una actualización de React. */
export default forwardRef<WhiteboardDraftHandle, {
  initial: BoardMark; w: number; h: number; renderMark: (mark: BoardMark) => React.ReactNode;
}>(function WhiteboardDraft({ initial, w, h, renderMark }, ref) {
  const [shape, setShape] = useState(initial);
  const current = useRef(initial);
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const builder = useRef(createStrokePathBuilder());
  const freehand = initial.tool === 'pen' || initial.tool === 'highlight';
  const paint = (mark: BoardMark) => {
    current.current = mark;
    if (!freehand) { setShape(mark); return; }
    const line = mark.points.length > 1;
    if (path.current) {
      path.current.setAttribute('d', builder.current(mark.points, w, h));
      path.current.style.display = line ? '' : 'none';
    }
    if (dot.current) dot.current.style.display = line ? 'none' : '';
  };
  useImperativeHandle(ref, () => ({ update: paint }), [freehand, w, h]);
  useLayoutEffect(() => { if (freehand) paint(current.current); }, [freehand, w, h]);
  if (!freehand) return <>{renderMark(shape)}</>;
  const first = initial.points[0];
  return <g data-whiteboard-mark={initial.id} opacity={initial.opacity}>
    <circle ref={dot} cx={first.x * w} cy={first.y * h} r={initial.width * w / 2} fill={initial.color} pointerEvents="none" />
    <path ref={path} stroke={initial.color} strokeWidth={initial.width * w} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
  </g>;
});
