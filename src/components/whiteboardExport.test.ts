import { describe, expect, it } from 'vitest';
import { captureWhiteboardScene, exportPictureGeometry, exportPlateSize, whiteboardFileName, wrapCanvasText } from './whiteboardExport';

const logical = { width: 1000, height: 700 };
const view = { width: 800, height: 600, matrix: { a: 3, b: 0, c: 0, d: 3, e: -1000, f: -600 } };

describe('Descarga de los apuntes', () => {
  it('conserva el encuadre y zoom con doble resolución para los apuntes', () => {
    expect(exportPictureGeometry('view', logical, logical, view, 0)).toEqual({ width: 1600, height: 1200, matrix: { a: 6, b: 0, c: 0, d: 6, e: -2000, f: -1200 } });
  });
  it('limita solo la foto a 1080 px, sin ampliar las pequeñas ni deformar las proporciones', () => {
    expect(exportPlateSize({ width: 10000, height: 7000 })).toEqual({ width: 1080, height: 756 });
    expect(exportPlateSize({ width: 7000, height: 10000 })).toEqual({ width: 756, height: 1080 });
    expect(exportPlateSize({ width: 500, height: 300 })).toEqual({ width: 500, height: 300 });
    expect(exportPlateSize({ width: 100000, height: 1 })).toEqual({ width: 1080, height: 1 });
    const output = exportPictureGeometry('plate', logical, { width: 10000, height: 7000 }, view, 0);
    expect(output.width).toBeGreaterThan(1080);
  });
  it('incluye la placa completa girada y limita la memoria con originales grandes', () => {
    const rotated = exportPictureGeometry('plate', logical, logical, view, 90);
    expect(rotated).toEqual({ width: 700, height: 1000, matrix: { a: 0, b: 1, c: -1, d: 0, e: 700, f: 0 } });
    const large = exportPictureGeometry('plate', logical, { width: 10000, height: 7000 }, view, 270);
    expect(Math.max(large.width, large.height)).toBeLessThanOrEqual(4096);
    expect(large.width * large.height).toBeLessThanOrEqual(12_000_000);
  });
  it('aplica el límite también en pantallas verticales y conserva proporciones con todos los giros', () => {
    for (const area of ['view', 'plate'] as const) {
      for (const rotation of [0, 90, 180, 270]) {
        const result = exportPictureGeometry(area, logical, { width: 8000, height: 6000 }, { ...view, width: 1200, height: 2400 }, rotation);
        expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(4096);
        expect(Math.max(result.width, result.height)).toBeGreaterThan(1080);
        const ratio = area === 'view' ? 0.5 : rotation % 180 === 0 ? 4 / 3 : 3 / 4;
        expect(result.width / result.height).toBeCloseTo(ratio, 2);
      }
    }
  });
  it('quita controles y selección de la copia, conserva el texto y no altera los apuntes originales', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = '<g transform="matrix(6 0 0 6 10 20)" clip-path="url(#old)"><rect data-whiteboard-surface=""/><g data-whiteboard-mark="1"><text>&lt;Núcleo&gt;</text><path class="viewer-whiteboard__hit"/></g><rect class="viewer-whiteboard__selection"/><g data-whiteboard-handle="0"/></g>';
    const scene = svg.firstElementChild as SVGGElement;
    const copy = captureWhiteboardScene(scene);
    expect(copy).toContain('&lt;Núcleo&gt;');
    expect(copy).toContain('data-whiteboard-mark');
    expect(copy).not.toMatch(/whiteboard-surface|whiteboard__hit|whiteboard__selection|whiteboard-handle|matrix\(|url\(#old\)/);
    expect(scene.querySelector('.viewer-whiteboard__selection')).not.toBeNull();
  });
  it('distribuye títulos largos sin cortarlos y genera nombres de archivo seguros', () => {
    const measure = { measureText: (text: string) => ({ width: Array.from(text).length * 10 }) as TextMetrics };
    const text = 'Tema: Sistema linfoide Amígdala';
    const lines = wrapCanvasText(measure, text, 100);
    expect(lines.every(line => measure.measureText(line).width <= 100)).toBe(true);
    expect(lines.join(' ')).toBe(text);
    const file = whiteboardFileName({ sources: [], temaNombre: '../Sistema linfoide', subtemaNombre: 'Amígdala / x4', plateId: 201, rotation: 0 }, 'plate');
    expect(file).toBe('apuntes-Sistema-linfoide-Amigdala-x4-placa-201-placa-completa.png');
  });
});
