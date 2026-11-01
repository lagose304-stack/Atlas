export const LASER_TRAIL_LIFETIME = 1750;
export type LaserPoint = { x: number; y: number; time: number; breakBefore?: boolean };
type Position = { x: number; y: number };

/** La velocidad nunca borra el rastro; las pausas y reentradas separan trazos. */
export function appendLaserPoint(points: LaserPoint[], previous: Position | null, raw: Position, now: number, newStroke = false) {
  let trail = points.filter(point => now - point.time < LASER_TRAIL_LIFETIME);
  const last = trail[trail.length - 1];
  if (newStroke || !previous || !last || now - last.time > 200) {
    trail.push({ ...raw, time: now, breakBefore: true });
    return { trail, position: raw };
  }
  // Mantener estabilidad a baja velocidad y seguir de cerca los movimientos rápidos.
  const speed = Math.min(1, Math.hypot(raw.x - previous.x, raw.y - previous.y) / 180);
  const factor = 0.38 + speed * 0.62;
  const position = { x: previous.x + (raw.x - previous.x) * factor, y: previous.y + (raw.y - previous.y) * factor };
  const dx = position.x - last.x, dy = position.y - last.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return { trail, position };
  const steps = Math.min(8, Math.max(1, Math.ceil(distance / 12)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    trail.push({ x: last.x + dx * t, y: last.y + dy * t, time: last.time + (now - last.time) * t });
  }
  // Reducir densidad, en lugar de recortar una estela todavía visible.
  if (trail.length > 512) trail = trail.filter((point, index) => index === 0 || index === trail.length - 1 || point.breakBefore || trail[index + 1]?.breakBefore || index % 2 === 0);
  return { trail, position };
}

export function splitLaserTrail(points: LaserPoint[]): LaserPoint[][] {
  const segments: LaserPoint[][] = [];
  for (const point of points) {
    if (!segments.length || point.breakBefore) segments.push([]);
    segments[segments.length - 1].push(point);
  }
  return segments;
}

/** La curva y sus normales dependen del recorrido, no del brillo ni del tiempo del fotograma. */
export function prepareLaserStroke(raw: LaserPoint[]) {
  let points = raw;
  if (raw.length >= 3) {
    points = [];
    const ext = [raw[0], ...raw, raw[raw.length - 1]];
    for (let i = 1; i < ext.length - 2; i++) {
      const [p0, p1, p2, p3] = ext.slice(i - 1, i + 3);
      for (let s = 0; s < 5; s++) {
        const t = s / 5, t2 = t * t, t3 = t2 * t;
        const f1 = -0.5 * t3 + t2 - 0.5 * t, f2 = 1.5 * t3 - 2.5 * t2 + 1;
        const f3 = -1.5 * t3 + 2 * t2 + 0.5 * t, f4 = 0.5 * t3 - 0.5 * t2;
        points.push({ x: p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4, y: p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4, time: p1.time + (p2.time - p1.time) * t });
      }
    }
    points.push(raw[raw.length - 1]);
  }
  const normals: Array<{ nx: number; ny: number }> = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x, dy = next.y - previous.y, length = Math.hypot(dx, dy);
    normals.push(length > 0.0001 ? { nx: -dy / length, ny: dx / length } : i > 0 ? normals[i - 1] : { nx: 0, ny: 1 });
  }
  const smoothNormals = normals.map((normal, i) => {
    if (i === 0 || i === normals.length - 1) return normal;
    const previous = normals[i - 1], next = normals[i + 1];
    const x = 0.25 * previous.nx + 0.5 * normal.nx + 0.25 * next.nx;
    const y = 0.25 * previous.ny + 0.5 * normal.ny + 0.25 * next.ny;
    const length = Math.hypot(x, y);
    return length > 0.0001 ? { nx: x / length, ny: y / length } : normal;
  });
  return { points, normals: smoothNormals };
}
