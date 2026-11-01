export type WhiteboardTool = 'select' | 'hand' | 'laser' | 'pen' | 'highlight' | 'arrow' | 'line' | 'ellipse' | 'rectangle' | 'text' | 'eraser';
export type BoardPoint = { x: number; y: number };
export type BoardMark = {
  id: number;
  tool: WhiteboardTool;
  points: BoardPoint[];
  color: string;
  width: number;
  opacity: number;
  text?: string;
  fontSize?: number;
  background?: boolean;
};

/** Curvas cuadráticas por puntos medios: suavizan sin retrasar la punta. */
export function strokePath(points: BoardPoint[], width: number, height: number): string {
  if (!points.length) return '';
  const xy = (p: BoardPoint) => `${p.x * width},${p.y * height}`;
  let path = `M${xy(points[0])}`;
  if (points.length === 2) return `${path} L${xy(points[1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], next = points[i + 1];
    path += ` Q${xy(p)} ${xy({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`;
  }
  if (points.length > 1) path += ` L${xy(points[points.length - 1])}`;
  return path;
}

/** Buffer del trazo en curso: solo añade las curvas nuevas, sin volver a recorrer su historia. */
export function createStrokePathBuilder() {
  let first: BoardPoint | undefined, last: BoardPoint | undefined;
  let count = 0, w = 0, h = 0, prefix = '';
  return (points: BoardPoint[], width: number, height: number) => {
    if (!points.length) { first = last = undefined; count = 0; prefix = ''; return ''; }
    const xy = (p: BoardPoint) => `${p.x * width},${p.y * height}`;
    if (first !== points[0] || width !== w || height !== h || points.length < count || (count && points[count - 1] !== last)) {
      prefix = `M${xy(points[0])}`; count = 1;
    }
    for (let i = Math.max(1, count - 1); i < points.length - 1; i++) {
      const p = points[i], next = points[i + 1];
      prefix += ` Q${xy(p)} ${xy({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`;
    }
    first = points[0]; last = points[points.length - 1]; count = points.length; w = width; h = height;
    return prefix + (count > 1 ? ` L${xy(last)}` : '');
  };
}

export function constrainedEnd(start: BoardPoint, end: BoardPoint, tool: WhiteboardTool, w: number, h: number): BoardPoint {
  const dx = (end.x - start.x) * w, dy = (end.y - start.y) * h;
  let x: number, y: number;
  if (tool === 'rectangle' || tool === 'ellipse') {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    x = Math.sign(dx || 1) * side; y = Math.sign(dy || 1) * side;
  } else {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
    const length = Math.hypot(dx, dy);
    x = Math.cos(angle) * length; y = Math.sin(angle) * length;
  }
  // Reducir ambos ejes juntos conserva la proporción cerca de los bordes.
  const limit = Math.min(1,
    x > 0 ? (1 - start.x) * w / x : x < 0 ? -start.x * w / x : 1,
    y > 0 ? (1 - start.y) * h / y : y < 0 ? -start.y * h / y : 1);
  return { x: start.x + x * limit / w, y: start.y + y * limit / h };
}

export function markBounds(mark: BoardMark, w: number, h: number) {
  const first = mark.points[0];
  if (mark.tool === 'text') {
    const font = (mark.fontSize ?? mark.width * 6) * w;
    const lines = (mark.text ?? '').split('\n');
    return { x: first.x * w - 5, y: first.y * h - font, width: Math.max(font, ...lines.map(line => line.length * font * 0.66)) + 10, height: font * lines.length * 1.3 + 6 };
  }
  let minX = first.x * w, maxX = minX, minY = first.y * h, maxY = minY;
  for (const p of mark.points) { minX = Math.min(minX, p.x * w); maxX = Math.max(maxX, p.x * w); minY = Math.min(minY, p.y * h); maxY = Math.max(maxY, p.y * h); }
  if (mark.tool === 'arrow' && mark.points.length > 1) {
    const last = mark.points[mark.points.length - 1];
    const dx = (last.x - first.x) * w, dy = (last.y - first.y) * h;
    const angle = Math.atan2(dy, dx), head = Math.min(Math.hypot(dx, dy) * 0.45, mark.width * w * 5);
    for (const side of [-0.5, 0.5]) {
      const x = last.x * w - head * Math.cos(angle + side), y = last.y * h - head * Math.sin(angle + side);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const margin = mark.width * w / 2;
  return { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 };
}

export function isVisibleMark(mark: BoardMark, w: number, h: number, zoom: number): boolean {
  if (mark.tool === 'pen' || mark.tool === 'highlight') return true;
  const first = mark.points[0], last = mark.points[mark.points.length - 1];
  const dx = Math.abs(last.x - first.x) * w * zoom, dy = Math.abs(last.y - first.y) * h * zoom;
  if (mark.tool === 'rectangle' || mark.tool === 'ellipse') return dx >= 3 && dy >= 3;
  return Math.hypot(dx, dy) >= Math.max(4, mark.width * w * zoom * 2);
}

export function moveMark(mark: BoardMark, dx: number, dy: number, w: number, h: number, bounds = markBounds(mark, w, h)): BoardMark {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const x = clamp(dx, -bounds.x / w, Math.max(-bounds.x / w, 1 - (bounds.x + bounds.width) / w));
  const y = clamp(dy, -bounds.y / h, Math.max(-bounds.y / h, 1 - (bounds.y + bounds.height) / h));
  return { ...mark, points: mark.points.map(p => ({ x: p.x + x, y: p.y + y })) };
}
