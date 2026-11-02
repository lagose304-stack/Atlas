import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createStrokePathBuilder, type BoardMark } from './viewerWhiteboardGeometry';
import { createLiveStrokePainter } from './whiteboardLiveStroke';

export type WhiteboardDraftHandle = { update: (mark: BoardMark) => void };

/** Tinta temporal en Canvas; SVG como alternativa y como formato definitivo del apunte. */
export default forwardRef<WhiteboardDraftHandle, {
  initial: BoardMark; w: number; h: number; renderMark: (mark: BoardMark) => React.ReactNode;
}>(function WhiteboardDraft({ initial, w, h, renderMark }, ref) {
  const [shape, setShape] = useState(initial);
  const current = useRef(initial);
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const group = useRef<SVGGElement>(null);
  const live = useRef<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; paint: ReturnType<typeof createLiveStrokePainter>; dpr: number } | null>(null);
  const builder = useRef(createStrokePathBuilder());
  const freehand = initial.tool === 'pen' || initial.tool === 'highlight';
  const paint = (mark: BoardMark) => {
    current.current = mark;
    if (!freehand) { setShape(mark); return; }
    const preview = live.current;
    const transform = group.current?.closest('[data-whiteboard-scene]')?.getAttribute('transform');
    const matrix = transform?.slice(transform.indexOf('(') + 1, -1).trim().split(/[\s,]+/).map(Number);
    if (preview && matrix?.length === 6 && matrix.every(Number.isFinite)) {
      preview.paint(preview.context, mark, w, h, matrix, preview.dpr, preview.canvas);
      return;
    }
    const line = mark.points.length > 1;
    if (path.current) {
      path.current.setAttribute('d', builder.current(mark.points, w, h));
      path.current.style.display = line ? '' : 'none';
    }
    if (dot.current) dot.current.style.display = line ? 'none' : '';
  };
  useImperativeHandle(ref, () => ({ update: paint }), [freehand, w, h]);
  useLayoutEffect(() => {
    const svg = group.current?.ownerSVGElement;
    if (!freehand || !svg?.parentElement || typeof CanvasRenderingContext2D === 'undefined' || typeof Path2D === 'undefined') return;
    const canvas = document.createElement('canvas');
    let context: CanvasRenderingContext2D | null;
    // Componer la tinta junto con la foto evita superficies negras en GPU móviles.
    try { context = canvas.getContext('2d', { alpha: true }); } catch { return; }
    if (!context) return;
    canvas.setAttribute('data-whiteboard-live-stroke', ''); canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '9' });
    const preview = { canvas, context, paint: createLiveStrokePainter(), dpr: window.devicePixelRatio || 1 };
    const resize = () => {
      // Solo la tinta provisional tiene presupuesto; el apunte final sigue siendo vectorial.
      preview.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_000_000 / Math.max(1, svg.clientWidth * svg.clientHeight)));
      const width = Math.round(svg.clientWidth * preview.dpr), height = Math.round(svg.clientHeight * preview.dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
        preview.paint = createLiveStrokePainter();
      }
      paint(current.current);
    };
    svg.parentElement.appendChild(canvas); live.current = preview;
    if (group.current) group.current.style.display = 'none';
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(svg); window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', resize);
      live.current = null; canvas.remove(); canvas.width = 0; canvas.height = 0;
      if (group.current) group.current.style.display = '';
    };
  }, [freehand, w, h]);
  useLayoutEffect(() => { if (freehand) paint(current.current); }, [freehand, w, h]);
  if (!freehand) return <>{renderMark(shape)}</>;
  const first = initial.points[0];
  return <g ref={group} data-whiteboard-mark={initial.id} opacity={initial.opacity}>
    <circle ref={dot} cx={first.x * w} cy={first.y * h} r={initial.width * w / 2} fill={initial.color} pointerEvents="none" />
    <path ref={path} stroke={initial.color} strokeWidth={initial.width * w} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
  </g>;
});
