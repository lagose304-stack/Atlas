import { useLayoutEffect, type RefObject } from 'react';
import { DIRECT_VIEW_TRANSFORM_EVENT, type DirectViewDetail } from './viewerTouchNavigation';

export function directImageProjection(view: DirectViewDetail, layout: { centerX: number; centerY: number; width: number; height: number }, size: { width: number; height: number }) {
  const radians = view.rotation * Math.PI / 180;
  const a = Math.cos(radians) * view.zoom, b = Math.sin(radians) * view.zoom;
  const c = -b, d = a;
  return `matrix(${a * layout.width / size.width} ${b * layout.width / size.width} ${c * layout.height / size.height} ${d * layout.height / size.height} ${layout.centerX + view.pos.x - (a * layout.width + c * layout.height) / 2} ${layout.centerY + view.pos.y - (b * layout.width + d * layout.height) / 2})`;
}

/** Proyección en SVG nativo; el texto nunca se amplía como una textura CSS. */
export function imageProjection(
  matrix: { a: number; b: number; c: number; d: number },
  layer: { left: number; top: number; width: number; height: number },
  viewport: { left: number; top: number },
  size: { width: number; height: number },
): string {
  const { a, b, c, d } = matrix;
  const minX = Math.min(0, a * layer.width, c * layer.height, a * layer.width + c * layer.height);
  const minY = Math.min(0, b * layer.width, d * layer.height, b * layer.width + d * layer.height);
  return `matrix(${a * layer.width / size.width} ${b * layer.width / size.width} ${c * layer.height / size.height} ${d * layer.height / size.height} ${layer.left - viewport.left - minX} ${layer.top - viewport.top - minY})`;
}

export function useWhiteboardProjection(svgRef: RefObject<SVGSVGElement>, sceneRef: RefObject<SVGGElement>, imageLayer: HTMLDivElement | null, size: { width: number; height: number } | null, zoom: number, viewTransform: string, enabled = true) {
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!enabled || !svg || !imageLayer || !size) return;
    let frame: number | null = null;
    let layout: { centerX: number; centerY: number; width: number; height: number } | null = null;
    const update = () => {
      const css = getComputedStyle(imageLayer).transform;
      const matrix = css && css !== 'none' ? new DOMMatrixReadOnly(css) : { a: 1, b: 0, c: 0, d: 1 };
      const rect = imageLayer.getBoundingClientRect();
      const viewport = svg.getBoundingClientRect();
      const width = imageLayer.clientWidth || size.width, height = imageLayer.clientHeight || size.height;
      // El centro sin trasladar no cambia al mover o ampliar: se mide solo al preparar la vista.
      layout = { centerX: rect.left + rect.width / 2 - ('e' in matrix ? Number(matrix.e) || 0 : 0) - viewport.left, centerY: rect.top + rect.height / 2 - ('f' in matrix ? Number(matrix.f) || 0 : 0) - viewport.top, width, height };
      const next = imageProjection(matrix, { left: rect.left, top: rect.top, width, height }, viewport, size);
      // Actualizar antes del mismo repintado, sin esperar otro render de React.
      const scene = sceneRef.current;
      if (scene && scene.getAttribute('transform') !== next) scene.setAttribute('transform', next);
    };
    // Seguir también los valores intermedios de la transición real de la imagen.
    const animate = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      const end = performance.now() + 360;
      const tick = () => { update(); frame = performance.now() < end ? requestAnimationFrame(tick) : null; };
      update(); frame = requestAnimationFrame(tick);
    };
    animate();
    const directUpdate = (event: Event) => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      const view = (event as CustomEvent<DirectViewDetail>).detail;
      if (layout && view) sceneRef.current?.setAttribute('transform', directImageProjection(view, layout, size));
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(svg); observer?.observe(imageLayer);
    imageLayer.addEventListener('transitionrun', animate);
    imageLayer.addEventListener(DIRECT_VIEW_TRANSFORM_EVENT, directUpdate);
    window.addEventListener('resize', update);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect(); imageLayer.removeEventListener('transitionrun', animate); window.removeEventListener('resize', update);
      imageLayer.removeEventListener(DIRECT_VIEW_TRANSFORM_EVENT, directUpdate);
    };
  }, [svgRef, sceneRef, imageLayer, size?.width, size?.height, zoom, viewTransform, enabled]);
}
