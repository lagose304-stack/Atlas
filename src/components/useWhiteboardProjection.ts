import { useLayoutEffect, type RefObject } from 'react';
import { DIRECT_VIEW_TRANSFORM_EVENT } from './viewerTouchNavigation';

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

export function useWhiteboardProjection(svgRef: RefObject<SVGSVGElement>, sceneRef: RefObject<SVGGElement>, imageLayer: HTMLDivElement | null, size: { width: number; height: number } | null, zoom: number, viewTransform: string) {
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !imageLayer || !size) return;
    let frame: number | null = null;
    const update = () => {
      const css = getComputedStyle(imageLayer).transform;
      const matrix = css && css !== 'none' ? new DOMMatrixReadOnly(css) : { a: 1, b: 0, c: 0, d: 1 };
      const rect = imageLayer.getBoundingClientRect();
      const next = imageProjection(matrix, { left: rect.left, top: rect.top, width: imageLayer.clientWidth || size.width, height: imageLayer.clientHeight || size.height }, svg.getBoundingClientRect(), size);
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
    const directUpdate = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; update();
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
  }, [svgRef, sceneRef, imageLayer, size?.width, size?.height, zoom, viewTransform]);
}
