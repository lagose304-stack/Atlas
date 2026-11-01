export const DIRECT_VIEW_TRANSFORM_EVENT = 'atlas-direct-view-transform';
export type ViewerTransform = { zoom: number; pos: { x: number; y: number } };
export type DirectViewDetail = ViewerTransform & { rotation: number };

/** Solo la posición visual del gesto; el estado de React se confirma al levantar los dedos. */
export function paintTouchView(layer: HTMLElement, view: ViewerTransform, rotation: number, ui: {
  frameSize: { width: number; height: number }; zoom: HTMLButtonElement | null; minimap: HTMLDivElement | null;
  size: { width: number; height: number } | null;
}) {
  const { width: frameWidth, height: frameHeight } = ui.frameSize;
  layer.style.transition = 'none';
  layer.style.transform = `translate3d(${view.pos.x}px, ${view.pos.y}px, 0) scale(${view.zoom}) rotate(${rotation}deg)`;
  // La pizarra se proyecta en el mismo fotograma que la imagen.
  layer.dispatchEvent(new CustomEvent<DirectViewDetail>(DIRECT_VIEW_TRANSFORM_EVENT, { detail: { ...view, rotation } }));
  if (ui.zoom) {
    const percentage = Math.round(view.zoom * 100);
    const text = `${percentage}%`, label = `Zoom actual ${percentage}%. Clic para 100%`;
    if (ui.zoom.textContent !== text) ui.zoom.textContent = text;
    if (ui.zoom.getAttribute('aria-label') !== label) ui.zoom.setAttribute('aria-label', label);
  }
  if (ui.minimap && ui.size) {
    const { width, height } = ui.size;
    const miniWidth = parseFloat(ui.minimap.style.width), miniHeight = parseFloat(ui.minimap.style.height);
    const visibleWidth = Math.min(width, frameWidth / view.zoom), visibleHeight = Math.min(height, frameHeight / view.zoom);
    const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
    const left = clamp(width / 2 + (-frameWidth / 2 - view.pos.x) / view.zoom, Math.max(0, width - visibleWidth));
    const top = clamp(height / 2 + (-frameHeight / 2 - view.pos.y) / view.zoom, Math.max(0, height - visibleHeight));
    ui.minimap.style.display = view.zoom > 1.05 ? 'block' : 'none';
    ui.minimap.setAttribute('aria-hidden', String(view.zoom <= 1.05));
    const viewport = ui.minimap.querySelector<HTMLElement>('[data-viewer-minimap-viewport]');
    if (viewport) Object.assign(viewport.style, { left: '0px', top: '0px', transform: `translate(${left / width * miniWidth}px, ${top / height * miniHeight}px)`, width: `${visibleWidth / width * miniWidth}px`, height: `${visibleHeight / height * miniHeight}px` });
  }
}
