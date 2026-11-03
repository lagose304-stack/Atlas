import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Editor from './PlateAnnotationViewerEditor';
afterEach(() => { vi.unstubAllGlobals(); });
const outer = [0.1,0.1, 0.9,0.1, 0.9,0.9, 0.1,0.9];
function setup() {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const save = vi.fn();
  render(<Editor imageSrc="https://isolated.atlas-tests.invalid/placa.webp" initialSenalados={['Exterior', 'Superpuesto']}
    initialSenaladosPos={[{ x:0.5,y:0.5,regionPoints:outer }, { x:0.5,y:0.5,regionPoints:[0.2,0.2, 0.8,0.2, 0.8,0.8, 0.2,0.8] }]} onSaveAll={save} onCancel={() => {}} />);
  const image = screen.getByAltText('Placa histológica de alta calidad');
  Object.defineProperties(image, { clientWidth:{value:1000},clientHeight:{value:800},getBoundingClientRect:{value:()=>({left:0,top:0,width:1000,height:800,right:1000,bottom:800})} });
  fireEvent.load(image);
  fireEvent.click(document.querySelector('path[fill-rule="evenodd"]')!);
  return { save, surface: image.parentElement!.parentElement! };
}
function draw(surface: HTMLElement, points = [[400,400],[450,400],[450,450],[400,450]]) {
  fireEvent.mouseDown(surface,{button:0,clientX:points[0][0],clientY:points[0][1]});
  for (const [clientX,clientY] of points.slice(1)) fireEvent.mouseMove(surface,{clientX,clientY});
  fireEvent.mouseUp(surface,{clientX:points[points.length-1][0],clientY:points[points.length-1][1]});
}
it('oculta la lista al crear y la recupera al terminar conservando su estado plegado', () => {
  setup();
  expect(screen.getByRole('button', { name: /Ocultar lista/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Borde' }));
  expect(screen.queryByRole('button', { name: /Ocultar lista/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Añadir señalado' }));
  expect(screen.getByRole('button', { name: /Ocultar lista/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Ocultar lista/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
  expect(screen.queryByRole('button', { name: /Mostrar lista/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mano' }));
  expect(screen.getByRole('button', { name: /Mostrar lista/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Mostrar lista/ }));
  expect(screen.getByRole('button', { name: 'Mostrar borde' })).toHaveAttribute('aria-pressed', 'true');
});
it('filtra por las cuatro herramientas sin mezclar puntos y bordes del mismo nombre ni alterar el guardado', () => {
  const save = vi.fn();
  const labels = ['Único', 'Grupo de puntos', 'Grupo de puntos', 'Único', 'Grupo de bordes', 'Grupo de bordes'];
  const point = { x: 0.5, y: 0.5 };
  const border = { ...point, regionPoints: outer };
  render(<Editor imageSrc="https://isolated.atlas-tests.invalid/placa.webp" initialSenalados={labels}
    initialSenaladosPos={[point, point, point, border, border, border]} onSaveAll={save} onCancel={() => {}} />);
  fireEvent.load(screen.getByAltText('Placa histológica de alta calidad'));
  expect(screen.getByRole('button', { name: 'Mostrar punto' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Único')).toBeInTheDocument();
  expect(screen.queryByText('Grupo de puntos')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar puntos' }));
  expect(screen.getByText('Grupo de puntos')).toBeInTheDocument();
  expect(screen.queryByText('Único')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar borde' }));
  expect(screen.getByText('Único')).toBeInTheDocument();
  expect(screen.queryByText('Grupo de bordes')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar bordes' }));
  expect(screen.getByText('Grupo de bordes')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Ocultar lista/ }));
  expect(screen.queryByRole('button', { name: 'Mostrar bordes' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
  expect(save.mock.calls[0][0]).toEqual(labels);
  expect(save.mock.calls[0][1]).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', { name: /Mostrar lista/ }));
  expect(screen.getByRole('button', { name: 'Mostrar bordes' })).toHaveAttribute('aria-pressed', 'true');
});
it('conserva el contorno al soltar, navegar y continuar con una unión aproximada', () => {
  const { save, surface } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Borde' }));
  draw(surface, [[200,200],[300,200],[300,300]]);
  expect(document.querySelector('[data-border-continuation]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mano' }));
  draw(surface, [[600,400],[650,450]]);
  fireEvent.click(screen.getByTitle('Acercar (+)'));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar trazado' }));
  // No es necesario acertar al píxel: empieza cerca del extremo.
  draw(surface, [[304,302],[300,400],[200,400]]);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar borde' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
  const positions = save.mock.calls[0][1];
  expect(positions).toHaveLength(3);
  expect(positions[2].regionPoints.length).toBeGreaterThanOrEqual(8);
  expect(positions[2].regionPoints.slice(0, 2)).toEqual([0.2, 0.25]);
  expect(positions[2].regionPoints.slice(-2)).toEqual([0.2, 0.5]);
  expect(positions[2].regionHoles).toBeNull();
});
it('rechaza continuaciones lejanas y deshace solo el último tramo', () => {
  const { save, surface } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Bordes Múltiples' }));
  draw(surface, [[200,200],[300,200],[300,300]]);
  const initial = document.querySelector('[data-region-index="-1"]')!.getAttribute('d');
  draw(surface, [[800,700],[850,700],[850,750]]);
  expect(screen.getByRole('alert')).toHaveTextContent('extremo resaltado');
  expect(document.querySelector('[data-region-index="-1"]')!.getAttribute('d')).toBe(initial);
  draw(surface, [[301,300],[300,400],[200,400]]);
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer tramo' }));
  expect(document.querySelector('[data-region-index="-1"]')!.getAttribute('d')).toBe(initial);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar contorno' }));
  expect(document.querySelector('[data-border-continuation]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
  expect(save.mock.calls[0][1]).toHaveLength(2);
});
it('conserva el borrador al hacer pellizco y no convierte el dedo restante en un tramo', () => {
  const { surface } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Borde' }));
  draw(surface, [[200,200],[300,200],[300,300]]);
  const initial = document.querySelector('[data-region-index="-1"]')!.getAttribute('d');
  fireEvent.touchStart(surface, { touches: [{clientX:300,clientY:300},{clientX:600,clientY:600}] });
  fireEvent.touchMove(surface, { touches: [{clientX:250,clientY:250},{clientX:650,clientY:650}] });
  fireEvent.touchEnd(surface, { touches: [{clientX:250,clientY:250}] });
  fireEvent.pointerMove(surface, {clientX:400,clientY:400});
  fireEvent.touchEnd(surface, { touches: [] });
  expect(document.querySelector('[data-region-index="-1"]')!.getAttribute('d')).toBe(initial);
  expect(screen.getByRole('button', { name: 'Cerrar borde' })).toBeEnabled();
});
it('mantiene el patrón fuera de la textura de imagen al ampliar en el editor', () => {
  const { save } = setup();
  const path = document.querySelector('[data-public-region-borders] path')!;
  const original = path.getAttribute('d');
  const width = path.getAttribute('stroke-width');
  const image = screen.getByAltText('Placa histológica de alta calidad');
  expect(image.parentElement!.contains(path)).toBe(false);
  fireEvent.click(screen.getByTitle('Acercar (+)'));
  fireEvent.click(screen.getByTitle('Acercar (+)'));
  expect(path.getAttribute('d')).toBe(original);
  expect(path.getAttribute('stroke-width')).toBe(width);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar señalados' }));
  expect(save.mock.calls[0][1][0].regionPoints).toEqual(outer);
});
it('editar no recorta; excluir afecta solo al borde elegido aunque haya otro debajo', () => {
  const { save, surface } = setup();
  expect(screen.getByRole('button',{name:'Editar borde'})).toHaveAttribute('aria-pressed','true');
  expect(document.querySelector('[data-region-edit-handle]')).not.toBeNull();
  draw(surface);
  expect(screen.queryByText(/Hueco interior #1/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Crear exclusión'}));
  expect(document.querySelector('[data-region-edit-handle]')).toBeNull();
  draw(surface);
  fireEvent.click(screen.getByRole('button',{name:'Guardar señalados'}));
  const positions = save.mock.calls[0][1];
  expect(positions[0].regionHoles).toHaveLength(1);
  expect(positions[1].regionHoles).toBeNull();
  expect(positions[0].regionPoints).toEqual(outer);
});
it('dibujar en modo múltiple dentro de otra región crea una región independiente', () => {
  const { save, surface } = setup();
  fireEvent.click(screen.getByRole('button',{name:'Bordes Múltiples'}));
  draw(surface);
  fireEvent.click(screen.getByRole('button',{name:'Cerrar borde'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar cierre'}));
  expect(screen.getByRole('button',{name:'Dibujar región'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'Añadir señalado'}));
  fireEvent.click(screen.getByRole('button',{name:'Guardar señalados'}));
  const positions = save.mock.calls[0][1];
  expect(positions).toHaveLength(3);
  expect(positions.every((p: {regionHoles: unknown})=>p.regionHoles==null)).toBe(true);
});
it('rechaza exclusiones fuera del contorno sin modificar la región', () => {
  const { save, surface } = setup();
  fireEvent.click(screen.getByRole('button',{name:'Crear exclusión'}));
  draw(surface,[[50,50],[400,50],[400,400],[50,400]]);
  expect(screen.getByRole('alert')).toHaveTextContent('completamente dentro');
  fireEvent.click(screen.getByRole('button',{name:'Guardar señalados'}));
  expect(save.mock.calls[0][1][0].regionHoles).toBeNull();
});
it('arrastra un vértice sin iniciar trazo ni arrastre del lienzo y permite deshacer', () => {
  const { save } = setup();
  const vertex = document.querySelector('[data-region-edit-handle] circle')!;
  fireEvent.pointerDown(vertex,{button:0,clientX:100,clientY:80,pointerId:1});
  fireEvent.mouseDown(vertex,{button:0,clientX:100,clientY:80});
  fireEvent.pointerMove(window,{clientX:150,clientY:120,pointerId:1});
  fireEvent.pointerUp(window,{pointerId:1});
  expect(document.querySelector('[data-region-edit-handle] circle')).toHaveAttribute('cx', '150');
  fireEvent.keyDown(window,{key:'z',ctrlKey:true});
  fireEvent.click(screen.getByRole('button',{name:'Guardar señalados'}));
  expect(save.mock.calls[0][1][0].regionPoints).toEqual(outer);
});

// jsdom no implementa las matrices SVG usadas por la proyección nativa.
beforeEach(() => { vi.stubGlobal('DOMMatrixReadOnly', class { a = 1; b = 0; c = 0; d = 1; }); });
afterEach(() => { vi.unstubAllGlobals(); });
