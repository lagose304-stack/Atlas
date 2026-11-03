import { useEffect, useRef } from 'react';
import './viewerInteraction.css';

/** Reducir efectos de la interfaz durante el gesto sin alterar los filtros de la placa. */
export function useViewerInteraction() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const pointers = new Set<number>();
    let touches = 0;
    const refresh = () => root.toggleAttribute('data-viewer-interacting', touches > 0 || pointers.size > 0);
    const onSurface = (target: EventTarget | null) => target instanceof Element
      && !target.closest('button, a, input, textarea, select, [role="button"]')
      && !!target.closest('[data-viewer-image-frame], .viewer-whiteboard__canvas, [data-viewer-laser-surface], [data-viewer-minimap]');
    const down = (event: PointerEvent) => { if (onSurface(event.target)) { pointers.add(event.pointerId); refresh(); } };
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId); refresh(); };
    const start = (event: TouchEvent) => { if (touches || onSurface(event.target)) { touches = event.touches.length; refresh(); } };
    const end = (event: TouchEvent) => { touches = event.touches.length; refresh(); };
    const reset = () => { pointers.clear(); touches = 0; refresh(); };
    root.addEventListener('pointerdown', down, { capture: true, passive: true });
    root.addEventListener('touchstart', start, { capture: true, passive: true });
    window.addEventListener('pointerup', up, { capture: true, passive: true });
    window.addEventListener('pointercancel', up, { capture: true, passive: true });
    window.addEventListener('touchend', end, { capture: true, passive: true });
    window.addEventListener('touchcancel', end, { capture: true, passive: true });
    window.addEventListener('blur', reset);
    return () => {
      root.removeEventListener('pointerdown', down, true); root.removeEventListener('touchstart', start, true);
      window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('touchend', end, true); window.removeEventListener('touchcancel', end, true);
      window.removeEventListener('blur', reset); root.removeAttribute('data-viewer-interacting');
    };
  }, []);
  return rootRef;
}
