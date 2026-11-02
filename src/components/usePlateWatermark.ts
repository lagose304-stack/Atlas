import { useLayoutEffect, useRef } from 'react';
import { DIRECT_VIEW_TRANSFORM_EVENT, type DirectViewDetail } from './viewerTouchNavigation';

export function watermarkPlacement(image: { left: number; top: number; right: number; bottom: number }, frame: { width: number; height: number }, mark: { width: number; height: number }) {
  const left = Math.max(0, image.left), top = Math.max(0, image.top);
  const right = Math.min(frame.width, image.right), bottom = Math.min(frame.height, image.bottom);
  const width = right - left, height = bottom - top;
  if (width <= 0 || height <= 0 || !mark.width || !mark.height) return null;
  const margin = Math.min(14, width / 10, height / 10);
  const scale = Math.min(1, (width - margin * 2) / mark.width, (height - margin * 2) / mark.height);
  return { left: left + margin, top: bottom - margin - mark.height * scale, scale };
}

/** Sigue también los gestos táctiles directos sin renders ni lecturas de layout por contacto. */
export function usePlateWatermark(layer: HTMLDivElement | null, enabled: boolean, viewKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const mark = ref.current, frame = layer?.parentElement;
    if (!enabled || !mark || !layer || !frame) return;
    let animation = 0;
    let metrics = { width: 0, height: 0, imageWidth: 0, imageHeight: 0, markWidth: 0, markHeight: 0 };
    const paint = (bounds: { left: number; top: number; right: number; bottom: number }) => {
      const next = watermarkPlacement(bounds, metrics, { width: metrics.markWidth, height: metrics.markHeight });
      mark.style.visibility = next ? 'visible' : 'hidden';
      if (next) Object.assign(mark.style, { left: `${next.left}px`, top: `${next.top}px`, bottom: 'auto', transform: `scale(${next.scale})`, transformOrigin: 'top left' });
    };
    const update = () => {
      const image = layer.getBoundingClientRect(), viewport = frame.getBoundingClientRect();
      paint({ left: image.left - viewport.left, top: image.top - viewport.top, right: image.right - viewport.left, bottom: image.bottom - viewport.top });
    };
    const measure = () => {
      metrics = { width: frame.clientWidth, height: frame.clientHeight, imageWidth: layer.clientWidth, imageHeight: layer.clientHeight, markWidth: mark.offsetWidth, markHeight: mark.offsetHeight };
      update();
    };
    const animate = () => {
      cancelAnimationFrame(animation);
      const until = performance.now() + 340;
      const tick = () => { update(); if (performance.now() < until) animation = requestAnimationFrame(tick); };
      animation = requestAnimationFrame(tick);
    };
    const direct = (event: Event) => {
      cancelAnimationFrame(animation);
      const view = (event as CustomEvent<DirectViewDetail>).detail;
      const angle = view.rotation * Math.PI / 180;
      const width = (Math.abs(Math.cos(angle)) * metrics.imageWidth + Math.abs(Math.sin(angle)) * metrics.imageHeight) * view.zoom;
      const height = (Math.abs(Math.sin(angle)) * metrics.imageWidth + Math.abs(Math.cos(angle)) * metrics.imageHeight) * view.zoom;
      const x = metrics.width / 2 + view.pos.x, y = metrics.height / 2 + view.pos.y;
      paint({ left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 });
    };
    measure(); animate();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(frame); observer?.observe(layer); observer?.observe(mark);
    layer.addEventListener(DIRECT_VIEW_TRANSFORM_EVENT, direct);
    layer.addEventListener('transitionrun', animate);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(animation); observer?.disconnect(); layer.removeEventListener(DIRECT_VIEW_TRANSFORM_EVENT, direct); layer.removeEventListener('transitionrun', animate); window.removeEventListener('resize', measure); };
  }, [layer, enabled, viewKey]);
  return ref;
}
