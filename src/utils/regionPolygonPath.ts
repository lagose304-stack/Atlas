/** Filtro leve, de una sola pasada. Los puntos guardados nunca se sustituyen. */
export function smoothRegionPoints(points: number[], width: number, height: number) {
  const radius = Math.min(width, height) * 0.001;
  const count = points.length / 2;
  return points.map((value, index) => {
    const vertex = Math.floor(index / 2), axis = index % 2;
    const previous = (vertex + count - 1) % count, next = (vertex + 1) % count;
    const deltaX = (points[previous * 2] + points[next * 2] - 2 * points[vertex * 2]) / 4 * width;
    const deltaY = (points[previous * 2 + 1] + points[next * 2 + 1] - 2 * points[vertex * 2 + 1]) / 4 * height;
    const factor = Math.min(1, radius / Math.max(Math.hypot(deltaX, deltaY), 0.000001));
    return value + (axis === 0 ? deltaX / width : deltaY / height) * factor;
  });
}

export function regionPolygonPath(outer: number[], holes: number[][] | null | undefined, width: number, height: number, smooth = false, closed = true): string {
  const minimumCoordinates = closed ? 6 : 4;
  if (outer.length < minimumCoordinates || width <= 0 || height <= 0) return '';
  return [outer, ...(holes ?? [])].filter(ring => ring.length >= minimumCoordinates).map(original => {
    if (!smooth || !closed) return original.reduce((path, value, index) => index % 2 ? `${path}${index === 1 ? 'M' : ' L'} ${original[index - 1] * width} ${value * height}` : path, '') + (closed ? ' Z' : '');
    const ring = smoothRegionPoints(original, width, height);
    const count = ring.length / 2, radius = Math.min(width, height) * 0.0005;
    const corners = Array.from({ length: count }, (_, i) => {
      const x = ring[i * 2] * width, y = ring[i * 2 + 1] * height;
      const previous = (i + count - 1) % count, next = (i + 1) % count;
      const px = ring[previous * 2] * width, py = ring[previous * 2 + 1] * height;
      const nx = ring[next * 2] * width, ny = ring[next * 2 + 1] * height;
      const lengthIn = Math.hypot(px - x, py - y), lengthOut = Math.hypot(nx - x, ny - y);
      const r = Math.min(radius, lengthIn / 4, lengthOut / 4);
      return { x, y, ax: x + (px - x) * r / (lengthIn || 1), ay: y + (py - y) * r / (lengthIn || 1), bx: x + (nx - x) * r / (lengthOut || 1), by: y + (ny - y) * r / (lengthOut || 1) };
    });
    return `M ${corners[0].ax} ${corners[0].ay}` + corners.map((c, i) => `${i ? ` L ${c.ax} ${c.ay}` : ''} Q ${c.x} ${c.y} ${c.bx} ${c.by}`).join('') + ' Z';
  }).join(' ');
}
