import type { BoardMark, BoardPoint } from './viewerWhiteboardGeometry';

/** La curva visible es la misma del SVG; Path2D evita volver a analizar un atributo d creciente. */
export function createLiveStrokePainter() {
  let path = new Path2D();
  let first: BoardPoint | undefined, last: BoardPoint | undefined, count = 0, width = 0, height = 0;
  return (ctx: CanvasRenderingContext2D, mark: BoardMark, w: number, h: number, matrix: number[], dpr: number, canvas: HTMLCanvasElement) => {
    const points = mark.points;
    if (!points.length) return;
    if (first !== points[0] || w !== width || h !== height || points.length < count || (count && points[count - 1] !== last)) {
      path = new Path2D(); path.moveTo(points[0].x * w, points[0].y * h); count = 1;
    }
    for (let i = Math.max(1, count - 1); i < points.length - 1; i++) {
      const point = points[i], next = points[i + 1];
      path.quadraticCurveTo(point.x * w, point.y * h, (point.x + next.x) / 2 * w, (point.y + next.y) / 2 * h);
    }
    first = points[0]; last = points[points.length - 1]; count = points.length; width = w; height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
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
