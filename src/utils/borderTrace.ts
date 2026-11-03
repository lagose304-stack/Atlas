/** Unir solo al extremo o al tramo final cercano; nunca a otra zona del contorno. */
export function joinBorderTrace(base: number[], stroke: number[], width: number, height: number, tolerance = 24): number[] | null {
  if (!base.length) return [...stroke];
  if (stroke.length < 2) return [...base];
  const sx = stroke[0], sy = stroke[1];
  let best = Infinity, cut = base.length - 2, ax = base[cut], ay = base[cut + 1], travelled = 0;
  for (let i = base.length - 4; i >= 0 && travelled <= 64; i -= 2) {
    const x = base[i], y = base[i + 1], dx = (base[i + 2] - x) * width, dy = (base[i + 3] - y) * height;
    const length = Math.hypot(dx, dy);
    const lower = Math.max(0, 1 - (64 - travelled) / (length || 1));
    const t = Math.max(lower, Math.min(1, ((sx - x) * width * dx + (sy - y) * height * dy) / (length * length || 1)));
    const px = x + dx * t / width, py = y + dy * t / height;
    const distance = Math.hypot((sx - px) * width, (sy - py) * height);
    if (distance < best) { best = distance; cut = i; ax = px; ay = py; }
    travelled += length;
  }
  if (base.length === 2) best = Math.hypot((sx - ax) * width, (sy - ay) * height);
  if (best > tolerance) return null;
  const result = [...base.slice(0, cut + 2)];
  if (result[result.length - 2] !== ax || result[result.length - 1] !== ay) result.push(ax, ay);
  let distance = 0;
  for (let i = 2; i < stroke.length; i += 2) {
    distance += Math.hypot((stroke[i] - stroke[i - 2]) * width, (stroke[i + 1] - stroke[i - 1]) * height);
    const blend = Math.max(0, 1 - distance / 24);
    result.push(stroke[i] + (ax - sx) * blend, stroke[i + 1] + (ay - sy) * blend);
  }
  return result;
}

export function closeBorderTrace(points: number[], width: number, height: number) {
  const result = [...points];
  if (points.length < 6) return result;
  const end = points.length - 2, dx = points[0] - points[end], dy = points[1] - points[end + 1];
  if (Math.hypot(dx * width, dy * height) > 24) return result;
  let distance = 0;
  for (let i = end; i >= 2; i -= 2) {
    if (i < end) distance += Math.hypot((points[i + 2] - points[i]) * width, (points[i + 3] - points[i + 1]) * height);
    const blend = Math.max(0, 1 - distance / 24);
    result[i] += dx * blend; result[i + 1] += dy * blend;
    if (!blend) break;
  }
  return result;
}

export function borderTraceHasArea(points: number[]) {
  if (points.length < 6) return false;
  let area = 0;
  for (let i = 0; i < points.length; i += 2) {
    const next = (i + 2) % points.length;
    area += points[i] * points[next + 1] - points[next] * points[i + 1];
  }
  return Math.abs(area) > 1e-10;
}
