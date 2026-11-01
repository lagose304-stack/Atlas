import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import ViewerWhiteboard, { type WhiteboardTool } from './ViewerWhiteboard';

let layer: HTMLDivElement;
let imageLayer: HTMLDivElement;
function Harness({ plate = 'a', zoom = 1 }: { plate?: string; zoom?: number }) {
  const [active, setActive] = useState(true);
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  return <ViewerWhiteboard key={plate} active={active} tool={tool} onToggle={() => setActive(value => !value)} onTool={setTool} launcherContainer={layer} imageLayer={imageLayer} size={{ width: 800, height: 600 }} zoom={zoom} navigating={false} disabled={false} onWheel={() => {}} />;
}
const canvas = () => screen.getByLabelText('Apuntes temporales sobre la placa');
const count = () => layer.querySelectorAll('[data-whiteboard-mark]').length;
function draw() {
  fireEvent.pointerDown(canvas(), { button: 0, pointerId: 1, clientX: 80, clientY: 60 });
  fireEvent.pointerMove(canvas(), { pointerId: 1, clientX: 160, clientY: 120 });
  fireEvent.pointerUp(canvas(), { pointerId: 1 });
}
beforeEach(() => {
  layer = document.body.appendChild(document.createElement('div'));
  imageLayer = layer.appendChild(document.createElement('div'));
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, options: PointerEventInit = {}) { super(type, options); this.pointerId = options.pointerId ?? 1; this.pointerType = options.pointerType ?? 'mouse'; }
  });
  vi.stubGlobal('DOMPoint', class { constructor(public x: number, public y: number) {} matrixTransform() { return this; } });
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => ({ inverse: () => ({}) }) });
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', { configurable: true, value: () => {} });
});
afterEach(() => { layer.remove(); vi.unstubAllGlobals(); });

describe('Pizarra temporal del visor', () => {
  it('dibuja en un SVG independiente de la capa CSS ampliada y solo captura sobre la placa', () => {
    render(<Harness zoom={6} />);
    expect(imageLayer.contains(canvas())).toBe(false);
    expect(canvas().parentElement).toBe(imageLayer.parentElement);
    expect(canvas()).toHaveStyle({ pointerEvents: 'none' });
    expect(layer.querySelector('[data-whiteboard-surface]')).toHaveStyle({ pointerEvents: 'all' });
    expect(layer.querySelector('[data-whiteboard-scene]')).toHaveAttribute('transform', 'matrix(1 0 0 1 0 0)');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar herramientas de pizarra' }));
    expect(layer.querySelector('[data-whiteboard-surface]')).toHaveStyle({ pointerEvents: 'none' });
  });

  it('normaliza la fuente al escribir con aumento para no dibujar letras diminutas y estirarlas', () => {
    render(<Harness zoom={6} />);
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 400, clientY: 300 });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Núcleo' } });
    const text = layer.querySelector('[data-whiteboard-text]')!;
    expect(text).toHaveAttribute('font-size', '22');
    expect(text).toHaveAttribute('data-whiteboard-font-scale', '6');
    expect(text.parentElement).toHaveAttribute('transform', `translate(400 300) scale(${1 / 6})`);
  });

  it('conserva apuntes al cerrar herramientas, permite deshacer/rehacer y los descarta al cambiar de placa', () => {
    const { rerender } = render(<Harness />);
    draw();
    expect(count()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer apunte' }));
    expect(count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer apunte' }));
    expect(count()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar herramientas de pizarra' }));
    expect(count()).toBe(1);
    expect(canvas()).toHaveStyle({ pointerEvents: 'none' });
    rerender(<Harness plate="b" />);
    expect(count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pizarra' }));
    expect(screen.getByRole('button', { name: 'Deshacer apunte' })).toBeDisabled();
  });

  it('mantiene la geometría del apunte al ampliar y permite texto sin capturar teclas del campo', () => {
    const { rerender } = render(<Harness />);
    draw();
    const points = layer.querySelector('[data-whiteboard-mark] path')?.getAttribute('d');
    rerender(<Harness zoom={3} />);
    expect(layer.querySelector('[data-whiteboard-mark] path')).toHaveAttribute('d', points);
    fireEvent.click(screen.getByRole('button', { name: 'Texto' }));
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 200, clientY: 200 });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Núcleo celular' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(layer.querySelector('text')).toHaveTextContent('Núcleo celular');
  });

  it('no guarda un gesto cancelado; confirma el borrado y permite recuperarlo', () => {
    render(<Harness />);
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 80, clientY: 60 });
    fireEvent.pointerCancel(canvas());
    expect(count()).toBe(0);
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de pizarra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todos los apuntes' }));
    expect(count()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer apunte' }));
    expect(count()).toBe(1);
  });

  it('borra el trazo señalado y puede deshacer el borrado', () => {
    render(<Harness />);
    draw();
    fireEvent.click(screen.getByRole('button', { name: 'Borrador' }));
    const hit = layer.querySelector('[data-whiteboard-mark] path')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 80, clientY: 60 });
    fireEvent.pointerUp(canvas());
    expect(count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer apunte' }));
    expect(count()).toBe(1);
  });

  it('selecciona, mueve y duplica un apunte; Supr y Ctrl + Z solo actúan fuera del texto', () => {
    render(<Harness />);
    draw();
    const before = layer.querySelector('[data-whiteboard-mark] path')!.getAttribute('d');
    fireEvent.keyDown(window, { key: 'v' });
    const hit = layer.querySelector('[data-whiteboard-mark] path')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 80, clientY: 60 });
    fireEvent.pointerMove(canvas(), { clientX: 180, clientY: 160 });
    fireEvent.pointerUp(canvas());
    expect(layer.querySelector('[data-whiteboard-mark] path')).not.toHaveAttribute('d', before);
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(count()).toBe(2);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(count()).toBe(1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(count()).toBe(2);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(count()).toBe(1);
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 200, clientY: 200 });
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Núcleo\nCélula' } });
    expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);
    expect(count()).toBe(2); // Vista previa viva, todavía sin añadir al historial.
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(layer.querySelectorAll('[data-whiteboard-mark] text tspan')).toHaveLength(2);
  });

  it('cancela un dibujo al iniciar dos dedos y no deja puntos al terminar el gesto', () => {
    render(<Harness />);
    draw();
    fireEvent.pointerDown(canvas(), { pointerType: 'touch', pointerId: 11, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(canvas(), { pointerType: 'touch', pointerId: 12, button: 0, clientX: 200, clientY: 200 });
    fireEvent.touchStart(canvas(), { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 200 }] });
    fireEvent.pointerMove(canvas(), { pointerType: 'touch', pointerId: 11, clientX: 140, clientY: 140 });
    fireEvent.pointerUp(canvas(), { pointerType: 'touch', pointerId: 11 });
    fireEvent.pointerUp(canvas(), { pointerType: 'touch', pointerId: 12 });
    fireEvent.touchEnd(canvas(), { touches: [] });
    expect(count()).toBe(1);
    draw();
    expect(count()).toBe(2);
  });

  it('aísla los eventos táctiles del contenedor mientras dibuja y pellizca', () => {
    const inherited = vi.fn();
    for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) layer.addEventListener(name, inherited);
    render(<Harness />);
    fireEvent.pointerDown(canvas(), { pointerType: 'touch', pointerId: 11, button: 0, clientX: 100, clientY: 100 });
    fireEvent.touchStart(canvas(), { touches: [{ identifier: 11, clientX: 100, clientY: 100 }] });
    fireEvent.pointerMove(canvas(), { pointerType: 'touch', pointerId: 11, clientX: 160, clientY: 150 });
    fireEvent.touchMove(canvas(), { touches: [{ identifier: 11, clientX: 160, clientY: 150 }] });
    fireEvent.pointerUp(canvas(), { pointerType: 'touch', pointerId: 11 });
    fireEvent.touchEnd(canvas(), { touches: [] });
    expect(count()).toBe(1);
    fireEvent.touchStart(canvas(), { touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 200 }] });
    fireEvent.touchMove(canvas(), { touches: [{ clientX: 80, clientY: 80 }, { clientX: 230, clientY: 230 }] });
    fireEvent.touchCancel(canvas(), { touches: [] });
    expect(inherited).not.toHaveBeenCalled();
    expect(count()).toBe(1);
  });

  it('no cancela un trazo de lápiz digital al apoyar un dedo o la palma', () => {
    render(<Harness />);
    fireEvent.pointerDown(canvas(), { pointerType: 'pen', pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerDown(canvas(), { pointerType: 'touch', pointerId: 2, button: 0, clientX: 240, clientY: 240 });
    fireEvent.touchStart(canvas(), { touches: [{ clientX: 240, clientY: 240 }, { clientX: 260, clientY: 260 }] });
    fireEvent.pointerMove(canvas(), { pointerType: 'pen', pointerId: 1, clientX: 180, clientY: 160 });
    fireEvent.pointerUp(canvas(), { pointerType: 'pen', pointerId: 1 });
    fireEvent.touchEnd(canvas(), { touches: [] });
    expect(count()).toBe(1);
    expect(layer.querySelector('[data-whiteboard-mark] path')).toHaveAttribute('d');
  });

  it('recuerda el estilo de cada herramienta y no registra formas sin arrastre', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de pizarra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Color #38bdf8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grosor grueso' }));
    draw();
    expect(layer.querySelector('[data-whiteboard-mark] path')).toHaveAttribute('stroke', '#38bdf8');
    expect(layer.querySelector('[data-whiteboard-mark] path')).toHaveAttribute('stroke-width', '5');
    fireEvent.keyDown(window, { key: 'm' });
    draw();
    expect(layer.querySelectorAll('[data-whiteboard-mark]')[1]).toHaveAttribute('opacity', '0.3');
    fireEvent.keyDown(window, { key: 'p' });
    draw();
    expect(layer.querySelectorAll('[data-whiteboard-mark] path')[2]).toHaveAttribute('stroke', '#38bdf8');
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas());
    expect(count()).toBe(3);
  });

  it('ajusta los extremos de una forma y deshace ese ajuste como una sola acción', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'r' });
    draw();
    const width = layer.querySelector('[data-whiteboard-mark] rect')!.getAttribute('width');
    fireEvent.keyDown(window, { key: 'v' });
    const hit = layer.querySelector('[data-whiteboard-mark] rect')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas());
    fireEvent.pointerDown(layer.querySelector('[data-whiteboard-handle="1"] circle')!, { button: 0, clientX: 160, clientY: 120 });
    fireEvent.pointerMove(canvas(), { clientX: 250, clientY: 200 });
    fireEvent.pointerUp(canvas());
    expect(layer.querySelector('[data-whiteboard-mark] rect')).not.toHaveAttribute('width', width);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(layer.querySelector('[data-whiteboard-mark] rect')).toHaveAttribute('width', width);
  });

  it('ignora una palma táctil mientras escribe el lápiz óptico', () => {
    render(<Harness />);
    fireEvent.pointerDown(canvas(), { pointerType: 'pen', pointerId: 5, button: 0, clientX: 80, clientY: 60 });
    fireEvent.pointerMove(canvas(), { pointerType: 'pen', pointerId: 5, clientX: 120, clientY: 90 });
    fireEvent.pointerDown(canvas(), { pointerType: 'touch', pointerId: 6, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerCancel(canvas(), { pointerType: 'touch', pointerId: 6 });
    fireEvent.pointerMove(canvas(), { pointerType: 'pen', pointerId: 5, clientX: 160, clientY: 120 });
    fireEvent.pointerUp(canvas(), { pointerType: 'pen', pointerId: 5 });
    expect(count()).toBe(1);
    expect(layer.querySelector('[data-whiteboard-mark] path')).toHaveAttribute('d', expect.stringContaining('160,120'));
  });

  it('permite cancelar la edición de texto sin perder el original', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 200, clientY: 200 });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Original' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    fireEvent.keyDown(window, { key: 'v' });
    const hit = layer.querySelector('[data-whiteboard-mark] text')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    fireEvent.doubleClick(canvas(), { clientX: 210, clientY: 195 });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Modificado' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tamaño del texto' }), { target: { value: '40' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(layer.querySelector('[data-whiteboard-mark] text')).toHaveTextContent('Original');
    expect(layer.querySelector('[data-whiteboard-mark] text')).toHaveAttribute('font-size', '22');
    expect(count()).toBe(1);
  });
});
