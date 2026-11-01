export type ExportArea = 'view' | 'plate';
export type ExportMatrix = { a: number; b: number; c: number; d: number; e: number; f: number };
export type WhiteboardExportContext = { sources: string[]; temaNombre?: string; subtemaNombre?: string; plateId?: string | number | null; rotation: number };
type Size = { width: number; height: number };
// La composición conserva resolución para los apuntes; solo la foto se reduce a 1080 px.
const MAX_EDGE = 4096;
const MAX_PLATE_EDGE = 1080;
const MAX_IMAGE_PIXELS = 12_000_000;

export function exportPictureGeometry(area: ExportArea, logical: Size, natural: Size, view: Size & { matrix: ExportMatrix }, rotation: number) {
  if (area === 'view') {
    const scale = Math.min(2, MAX_EDGE / Math.max(view.width, view.height), Math.sqrt(MAX_IMAGE_PIXELS / (view.width * view.height)));
    const m = view.matrix;
    return { width: Math.round(view.width * scale), height: Math.round(view.height * scale), matrix: { a: m.a * scale, b: m.b * scale, c: m.c * scale, d: m.d * scale, e: m.e * scale, f: m.f * scale } };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(natural.width, natural.height), Math.sqrt(MAX_IMAGE_PIXELS / (natural.width * natural.height)));
  const width = Math.round(natural.width * scale), height = Math.round(natural.height * scale);
  const sx = width / logical.width, sy = height / logical.height;
  const angle = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (angle === 90) return { width: height, height: width, matrix: { a: 0, b: sx, c: -sy, d: 0, e: height, f: 0 } };
  if (angle === 180) return { width, height, matrix: { a: -sx, b: 0, c: 0, d: -sy, e: width, f: height } };
  if (angle === 270) return { width: height, height: width, matrix: { a: 0, b: -sx, c: sy, d: 0, e: 0, f: width } };
  return { width, height, matrix: { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 } };
}

/** Conservar únicamente los apuntes: sin controles, selección, láser ni fondo de captura. */
export function captureWhiteboardScene(scene: SVGGElement): string {
  const copy = scene.cloneNode(true) as SVGGElement;
  copy.removeAttribute('transform'); copy.removeAttribute('clip-path');
  copy.querySelectorAll('[data-whiteboard-surface], .viewer-whiteboard__hit, .viewer-whiteboard__selection, [data-whiteboard-handle]').forEach(node => node.remove());
  return new XMLSerializer().serializeToString(copy);
}

export function wrapCanvasText(context: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > maxWidth) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function whiteboardFileName(context: WhiteboardExportContext, area: ExportArea): string {
  const label = [context.temaNombre, context.subtemaNombre, context.plateId == null ? '' : `placa-${context.plateId}`].filter(Boolean).join('-');
  const safe = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
  return `apuntes-${safe || 'atlas'}-${area === 'view' ? 'vista' : 'placa-completa'}.png`;
}

export function exportPlateSize(natural: Size): Size {
  const scale = Math.min(1, MAX_PLATE_EDGE / Math.max(natural.width, natural.height));
  return { width: Math.max(1, Math.round(natural.width * scale)), height: Math.max(1, Math.round(natural.height * scale)) };
}

/** Reducir únicamente la foto antes de añadir los apuntes vectoriales. */
function rasterizePlate(image: HTMLImageElement): string {
  const size = exportPlateSize({ width: image.naturalWidth, height: image.naturalHeight });
  const canvas = document.createElement('canvas');
  canvas.width = size.width; canvas.height = size.height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este dispositivo no permite preparar la placa.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, size.width, size.height);
    return canvas.toDataURL('image/png');
  } finally { canvas.width = 0; canvas.height = 0; }
}

const loadImage = (url: string, signal: AbortSignal) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener('abort', abort); };
  const abort = () => { cleanup(); image.src = ''; reject(new DOMException('Descarga cancelada', 'AbortError')); };
  image.onload = () => { cleanup(); resolve(image); };
  image.onerror = () => { cleanup(); reject(new Error('No se pudo leer la imagen.')); };
  if (signal.aborted) { abort(); return; }
  signal.addEventListener('abort', abort, { once: true }); image.src = url;
});

async function readPlate(sources: string[], signal: AbortSignal) {
  for (const source of [...new Set(sources.filter(Boolean))]) {
    try {
      const url = new URL(source, window.location.href);
      const path = url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === window.location.origin ? url.href : `/api/plate-image?url=${encodeURIComponent(url.href)}`;
      const response = await fetch(path, { signal, credentials: 'omit' });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      const objectURL = URL.createObjectURL(blob);
      try {
        const image = await loadImage(objectURL, signal);
        return { width: image.naturalWidth, height: image.naturalHeight, data: rasterizePlate(image) };
      } finally { URL.revokeObjectURL(objectURL); }
    } catch (error) { if (signal.aborted) throw error; }
  }
  throw new Error('No se pudo descargar la placa. Tus apuntes siguen en el visor; vuelve a intentarlo.');
}

/** Identificación flotante, dibujada a resolución final y sin modificar la foto ni los apuntes. */
export function drawExportLabels(ctx: CanvasRenderingContext2D, size: Size, metadata: WhiteboardExportContext) {
  const unit = Math.min(size.width / 1600, size.height / 1200);
  const margin = 28 * unit;
  const padding = 22 * unit;
  const maxTextWidth = Math.max(1, Math.min(560 * unit, size.width - 2 * margin - 2 * padding));
  const theme = metadata.temaNombre?.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es') || 'TEMA NO ESPECIFICADO';
  const subtheme = metadata.subtemaNombre?.trim().replace(/\s+/g, ' ') || 'Subtema no especificado';
  // Cada nombre conserva una sola línea y ajusta su tamaño de forma independiente.
  const fit = (text: string, maximum: number, width: number, style: string, family: string) => {
    let low = 0, high = maximum;
    ctx.font = `${style} ${maximum}px ${family}`;
    if (ctx.measureText(text).width <= width) return maximum;
    for (let attempt = 0; attempt < 24; attempt++) {
      const middle = (low + high) / 2;
      ctx.font = `${style} ${middle}px ${family}`;
      if (ctx.measureText(text).width <= width) low = middle;
      else high = middle;
    }
    return low;
  };
  const themeFont = fit(theme, 14 * unit, maxTextWidth - 20 * unit, '700', 'Arial, sans-serif');
  const titleFont = fit(subtheme, 42 * unit, maxTextWidth, '600', 'Georgia, serif');
  ctx.font = `700 ${themeFont}px Arial, sans-serif`;
  const themeWidth = ctx.measureText(theme).width + 20 * unit;
  ctx.font = `600 ${titleFont}px Georgia, serif`;
  const titleWidth = ctx.measureText(subtheme).width;
  const cardWidth = Math.max(1, themeWidth, titleWidth) + 2 * padding;
  const cardHeight = 2 * padding + themeFont * 1.35 + 4 * unit + titleFont * 1.05;
  const panel = (x: number, y: number, width: number, height: number, radius: number, fill: string) => {
    ctx.save(); ctx.shadowColor = 'rgba(15, 10, 30, 0.25)'; ctx.shadowBlur = 22 * unit; ctx.shadowOffsetY = 10 * unit;
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  };
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  panel(margin, margin, cardWidth, cardHeight, 16 * unit, 'rgba(48, 43, 61, 0.72)');
  ctx.fillStyle = '#c4a0f1'; ctx.beginPath(); ctx.arc(margin + padding + 5 * unit, margin + padding + themeFont * 0.6, 5 * unit, 0, Math.PI * 2); ctx.fill();
  ctx.font = `700 ${themeFont}px Arial, sans-serif`;
  ctx.fillText(theme, margin + padding + 20 * unit, margin + padding);
  const titleY = margin + padding + themeFont * 1.35 + 4 * unit;
  ctx.fillStyle = '#ffffff'; ctx.font = `600 ${titleFont}px Georgia, serif`;
  ctx.fillText(subtheme, margin + padding, titleY);

  const brandFont = 17 * unit, domainFont = 12 * unit;
  const domain = 'https://atlas-histolab.pages.dev';
  ctx.font = `500 ${domainFont}px monospace`;
  const domainWidth = ctx.measureText(domain).width;
  ctx.font = `700 ${brandFont}px Arial, sans-serif`;
  const brandWidth = Math.max(ctx.measureText('Atlas Histolab').width, domainWidth);
  const badgeWidth = brandWidth + 70 * unit, badgeHeight = 58 * unit;
  const bx = size.width - margin - badgeWidth, by = size.height - margin - badgeHeight;
  panel(bx, by, badgeWidth, badgeHeight, 29 * unit, 'rgba(40, 34, 73, 0.94)');
  ctx.fillStyle = '#c4a0f1'; ctx.beginPath(); ctx.roundRect(bx + 13 * unit, by + 15 * unit, 28 * unit, 28 * unit, 8 * unit); ctx.fill();
  ctx.strokeStyle = '#282249'; ctx.lineWidth = 2.4 * unit; ctx.beginPath(); ctx.arc(bx + 27 * unit, by + 29 * unit, 7 * unit, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#282249'; ctx.beginPath(); ctx.arc(bx + 27 * unit, by + 29 * unit, 2.2 * unit, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `700 ${brandFont}px Arial, sans-serif`; ctx.fillText('Atlas Histolab', bx + 55 * unit, by + 12 * unit);
  ctx.fillStyle = '#d2c9e4'; ctx.font = `500 ${domainFont}px monospace`; ctx.fillText(domain, bx + 55 * unit, by + 33 * unit);
  ctx.restore();
}

export async function createWhiteboardPNG(options: {
  context: WhiteboardExportContext; area: ExportArea; logical: Size; view: Size & { matrix: ExportMatrix }; annotations: string; signal: AbortSignal;
}): Promise<Blob> {
  const { context: metadata, area, logical, view, annotations, signal } = options;
  const plate = await readPlate(metadata.sources, signal);
  signal.throwIfAborted();
  const picture = exportPictureGeometry(area, logical, plate, view, metadata.rotation);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este dispositivo no permite preparar la descarga.');
  canvas.width = picture.width; canvas.height = picture.height;
  if (!canvas.width || !canvas.height || canvas.width * canvas.height > 16_000_000) throw new Error('La imagen es demasiado grande para este dispositivo. Prueba con la vista actual.');
  const m = picture.matrix;
  const transform = `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
  // Rasterizar al tamaño final: los textos y trazos no se amplían como una captura.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><defs><clipPath id="export-view"><rect x="0" y="0" width="${picture.width}" height="${picture.height}"/></clipPath><clipPath id="export-plate"><rect width="${logical.width}" height="${logical.height}"/></clipPath></defs><rect width="100%" height="100%" fill="#f8fafc"/><rect x="0" y="0" width="${picture.width}" height="${picture.height}" fill="#0f172a"/><g clip-path="url(#export-view)"><g transform="${transform}"><image href="${plate.data}" width="${logical.width}" height="${logical.height}" preserveAspectRatio="none"/></g><g transform="${transform}"><g clip-path="url(#export-plate)">${annotations}</g></g></g></svg>`;
  const svgURL = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(svgURL, signal);
    ctx.drawImage(image, 0, 0);
  } finally { URL.revokeObjectURL(svgURL); }
  signal.throwIfAborted();
  drawExportLabels(ctx, { width: canvas.width, height: canvas.height }, metadata);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo generar el archivo PNG.')), 'image/png'));
  canvas.width = 0; canvas.height = 0;
  signal.throwIfAborted();
  return blob;
}

export function downloadWhiteboard(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  // Dar tiempo al navegador para iniciar la descarga antes de liberar el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
