import type { BoardMark, BoardPoint } from './viewerWhiteboardGeometry';

/** La curva visible es la misma del SVG; Path2D evita volver a analizar un atributo d creciente. */
export function createLiveStrokePainter() {
  let path = new Path2D();
  let first: BoardPoint | undefined, last: BoardPoint | undefined, count = 0, width = 0, height = 0;
  let appearance = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  return (ctx: CanvasRenderingContext2D, mark: BoardMark, w: number, h: number, matrix: number[], dpr: number, canvas: HTMLCanvasElement) => {
    const points = mark.points;
    if (!points.length) return;
    const reset = first !== points[0] || w !== width || h !== height || points.length < count || !!(count && points[count - 1] !== last);
    const previousCount = reset ? 0 : count;
    if (reset) { minX = minY = Infinity; maxX = maxY = -Infinity; }
    for (let i = previousCount; i < points.length; i++) {
      minX = Math.min(minX, points[i].x * w); maxX = Math.max(maxX, points[i].x * w);
      minY = Math.min(minY, points[i].y * h); maxY = Math.max(maxY, points[i].y * h);
    }
    const nextAppearance = [w, h, ...matrix, dpr, canvas.width, canvas.height, mark.width, mark.color, mark.opacity].join(':');
    // Repintar la huella completa evita uniones de antialias y acumulación de opacidad.
    let left = 0, top = 0, right = canvas.width, bottom = canvas.height;
    if (!reset && appearance === nextAppearance) {
      left = top = Infinity; right = bottom = -Infinity;
      for (const [x, y] of [[minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]]) {
        const screenX = (matrix[0] * x + matrix[2] * y + matrix[4]) * dpr;
        const screenY = (matrix[1] * x + matrix[3] * y + matrix[5]) * dpr;
        left = Math.min(left, screenX); right = Math.max(right, screenX);
        top = Math.min(top, screenY); bottom = Math.max(bottom, screenY);
      }
      const radius = mark.width * w / 2 * dpr;
      const padX = radius * Math.hypot(matrix[0], matrix[2]) + 2;
      const padY = radius * Math.hypot(matrix[1], matrix[3]) + 2;
      left = Math.max(0, Math.floor(left - padX)); top = Math.max(0, Math.floor(top - padY));
      right = Math.min(canvas.width, Math.ceil(right + padX)); bottom = Math.min(canvas.height, Math.ceil(bottom + padY));
    }
    if (reset) {
      path = new Path2D(); path.moveTo(points[0].x * w, points[0].y * h); count = 1;
    }
    for (let i = Math.max(1, count - 1); i < points.length - 1; i++) {
      const point = points[i], next = points[i + 1];
      path.quadraticCurveTo(point.x * w, point.y * h, (point.x + next.x) / 2 * w, (point.y + next.y) / 2 * h);
    }
    first = points[0]; last = points[points.length - 1]; count = points.length; width = w; height = h;
    appearance = nextAppearance;
    if (right <= left || bottom <= top) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(left, top, right - left, bottom - top);
    ctx.setTransform(matrix[0] * dpr, matrix[1] * dpr, matrix[2] * dpr, matrix[3] * dpr, matrix[4] * dpr, matrix[5] * dpr);
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.globalAlpha = mark.opacity; ctx.fillStyle = mark.color; ctx.strokeStyle = mark.color;
    ctx.lineWidth = mark.width * w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (count === 1) {
      ctx.beginPath(); ctx.arc(first.x * w, first.y * h, mark.width * w / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      const visible = new Path2D(path); visible.lineTo(last.x * w, last.y * h); ctx.stroke(visible);
    }
    ctx.restore();
  };
}
