import { regionBorderStyle, regionStrokeMetrics } from './regionBorderStyle';
import { smoothRegionPoints } from './regionPolygonPath';

/** Cada segmento es una recta corta: no reproduce el temblor dentro de un palito. */
export function regionDashPath(outer: number[], holes: number[][] | null | undefined, width: number, height: number, zoom: number, border: Parameters<typeof regionBorderStyle>[0] & { regionSmooth?: boolean | null }, closed = true) {
  const metrics = regionStrokeMetrics(border, zoom);
  const dash = metrics.dash;
  // Los extremos redondos ocupan un grosor adicional: conservar el hueco visible.
  const gap = metrics.gap;
  const result: string[] = [];
  for (const original of [outer, ...(holes ?? [])]) {
    if (original.length < (closed ? 6 : 4)) continue;
    const points = border.regionSmooth && closed ? smoothRegionPoints(original, width, height) : original;
    const count = points.length / 2;
    let distance = 0, nextStart = 0;
    let start: { x: number; y: number } | null = null;
    for (let i = 0; i < count - (closed ? 0 : 1); i++) {
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
          // Una curva o región pequeña acorta la cuerda; conservar la longitud elegida.
          const vx = point.x - start.x, vy = point.y - start.y;
          const chord = Math.hypot(vx, vy);
          const ux = chord > 0.000001 ? vx / chord : dx / length;
          const uy = chord > 0.000001 ? vy / chord : dy / length;
          const cx = (start.x + point.x) / 2, cy = (start.y + point.y) / 2;
          result.push(`M ${cx - ux * dash / 2} ${cy - uy * dash / 2} L ${cx + ux * dash / 2} ${cy + uy * dash / 2}`);
          start = null; nextStart += dash + gap;
        }
      }
      distance = end;
    }
    // El último segmento corto se omite para evitar un palito irregular en el cierre.
  }
  return result.join(' ');
}
