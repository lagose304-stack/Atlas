type Point = { x: number; y: number };
const vertices = (ring: number[]) => Array.from({ length: ring.length / 2 }, (_, i) => ({ x: ring[i * 2], y: ring[i * 2 + 1] }));
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x) && Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y) && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
}
function inside(p: Point, ring: Point[]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
function ringsIntersect(a: Point[], b: Point[]) {
  return a.some((p, i) => b.some((q, j) => intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}
export function validRegionExclusion(outer: number[], holes: number[][], candidate: number[]) {
  if (candidate.length < 6 || candidate.length % 2 || !candidate.every(Number.isFinite)) return false;
  const points = vertices(candidate), boundary = vertices(outer);
  if (points.length > 3 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y) points.pop();
  if (!points.every(p => inside(p, boundary)) || ringsIntersect(points, boundary)) return false;
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue;
    if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return false;
  }
  return holes.every(hole => {
    const existing = vertices(hole);
    return !ringsIntersect(points, existing) && !inside(points[0], existing) && !inside(existing[0], points);
  });
}
