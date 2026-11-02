import { regionBorderStyle } from './regionBorderStyle';
import { smoothRegionPoints } from './regionPolygonPath';

/** Cada segmento es una recta corta: no reproduce el temblor dentro de un palito. */
export function regionDashPath(outer: number[], holes: number[][] | null | undefined, width: number, height: number, zoom: number, border: Parameters<typeof regionBorderStyle>[0] & { regionSmooth?: boolean | null }) {
  const style = regionBorderStyle(border);
  const scale = Math.max(0.01, zoom);
  const dash = style.dash / scale;
  // Los extremos redondos ocupan un grosor adicional: conservar el hueco visible.
  const gap = (style.gap + style.width) / scale;
  const result: string[] = [];
  for (const original of [outer, ...(holes ?? [])]) {
    if (original.length < 6) continue;
    const points = border.regionSmooth ? smoothRegionPoints(original, width, height) : original;
    const count = points.length / 2;
    let distance = 0, nextStart = 0;
    let start: { x: number; y: number } | null = null;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const x = points[i * 2] * width, y = points[i * 2 + 1] * height;
      const dx = points[next * 2] * width - x, dy = points[next * 2 + 1] * height - y;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      const end = distance + length;
      while ((start ? nextStart + dash : nextStart) <= end) {
        const target = start ? nextStart + dash : nextStart;
        const fraction = Math.max(0, (target - distance) / length);
        const point = { x: x + dx * fraction, y: y + dy * fraction };
        if (!start) start = point;
        else {
          result.push(`M ${start.x} ${start.y} L ${point.x} ${point.y}`);
          start = null; nextStart += dash + gap;
        }
      }
      distance = end;
    }
    // El último segmento corto se omite para evitar un palito irregular en el cierre.
  }
  return result.join(' ');
}
