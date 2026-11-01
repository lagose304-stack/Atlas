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
