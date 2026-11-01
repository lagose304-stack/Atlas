import { describe, expect, it } from 'vitest';
import { directImageProjection, imageProjection } from './useWhiteboardProjection';
import { textBackdrop, textBounds } from './WhiteboardText';
import { isVisibleMark, markBounds, type BoardMark } from './viewerWhiteboardGeometry';

const note: BoardMark = { id: 1, tool: 'text', points: [{ x: 0.5, y: 0.5 }], width: 0.003, fontSize: 0.022, opacity: 1, color: '#fff', text: 'Núcleo' };

describe('Nitidez y presentación de los apuntes', () => {
  it('la proyección directa conserva zoom, giro y desplazamiento sin volver a medir la imagen', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const angle = rotation * Math.PI / 180, zoom = 3;
      const a = Math.cos(angle) * zoom, b = Math.sin(angle) * zoom, c = -b, d = a;
      const width = 800, height = 600, centerX = 500, centerY = 400, pos = { x: -100, y: 80 };
      const left = centerX + pos.x - (Math.abs(a) * width + Math.abs(c) * height) / 2;
      const top = centerY + pos.y - (Math.abs(b) * width + Math.abs(d) * height) / 2;
      const expected = imageProjection({ a, b, c, d }, { left, top, width, height }, { left: 0, top: 0 }, { width, height });
      const actual = directImageProjection({ zoom, pos, rotation }, { centerX, centerY, width, height }, { width, height });
      const numbers = (matrix: string) => matrix.slice(7, -1).split(' ').map(Number);
      numbers(actual).forEach((value, i) => expect(value).toBeCloseTo(numbers(expected)[i], 8));
    }
  });
  it('proyecta zoom, giro y desplazamiento en coordenadas SVG, sin ampliar la capa CSS', () => {
    expect(imageProjection({ a: 0, b: 2, c: -2, d: 0 }, { left: 200, top: 100, width: 100, height: 50 }, { left: 10, top: 20 }, { width: 100, height: 50 })).toBe('matrix(0 2 -2 0 290 80)');
    expect(imageProjection({ a: 8, b: 0, c: 0, d: 8 }, { left: -300, top: -100, width: 100, height: 50 }, { left: 0, top: 0 }, { width: 100, height: 50 })).toBe('matrix(8 0 0 8 -300 -100)');
  });
  it('ajusta el fondo al tamaño real de las letras y conserva margen proporcional a la fuente', () => {
    const node = { getBBox: () => ({ x: 500, y: 330, width: 71, height: 23 }) } as SVGTextElement;
    expect(textBounds(note, 1000, 700, node)).toEqual({ x: 494.72, y: 324.72, width: 81.56, height: 33.56 });
    expect(textBounds(note, 1000, 700)).toEqual(markBounds(note, 1000, 700));
  });
  it('elige un fondo legible para tinta clara y oscura', () => {
    expect(textBackdrop('#ffffff')).toBe('#0f172a');
    expect(textBackdrop('#111827')).toBe('#ffffff');
    expect(textBackdrop('#facc15')).toBe('#0f172a');
  });
  it('convierte las medidas de una fuente normalizada a las coordenadas de la placa', () => {
    const node = { getBBox: () => ({ x: 0, y: -20, width: 155, height: 50 }), getAttribute: () => '6' } as unknown as SVGTextElement;
    const result = textBounds({ ...note, fontSize: 0.022 / 6 }, 1000, 700, node);
    expect(result.x).toBeCloseTo(500 - 22 * 0.24 / 6);
    expect(result.y).toBeCloseTo(350 - (20 + 22 * 0.24) / 6);
    expect(result.width * 6).toBeCloseTo(155 + 22 * 0.48);
  });
  it('no guarda elipses sin ancho ni rectángulos aplastados, y sí puntos de escritura', () => {
    expect(isVisibleMark({ ...note, tool: 'ellipse', points: [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }] }, 1000, 700, 8)).toBe(false);
    expect(isVisibleMark({ ...note, tool: 'rectangle', points: [{ x: 0.5, y: 0.2 }, { x: 0.7, y: 0.2001 }] }, 1000, 700, 8)).toBe(false);
    expect(isVisibleMark({ ...note, tool: 'pen' }, 1000, 700, 8)).toBe(true);
  });
});
