import { describe, expect, it } from 'vitest';
import { createEmptyCanvasDoc, createLeafPlacedBlock, createNestedCanvasNode, createPlacedBlock, createTabsBlock, createTextBlock } from './defaults';
import { prepareBlockMove } from './blockMove';
import { useEditor2Store } from '../store/editor2Store';

const label = (type: string) => type;
function fixture() {
  const a = createLeafPlacedBlock(createTextBlock({text: 'Primero'}));
  const b = createLeafPlacedBlock(createTextBlock({text: 'Segundo'}));
  const left = createNestedCanvasNode({ children: [a, b] });
  const right = createNestedCanvasNode();
  const tabs = createTabsBlock({items: [{title: 'Histología', content: 'Introducción'}]});
  const doc = createEmptyCanvasDoc('home', {children: [left, right, tabs].map(block => createPlacedBlock(block))});
  return {a, b, left, right, tabs, doc};
}

describe('Mover bloques desde el inspector', () => {
  it.each(['after', 'before'] as const)('reordena hermanos %s sin cambiar sus datos', position => {
    const {doc, a, b} = fixture();
    const [source, target] = position === 'after' ? [a,b] : [b,a];
    const result = prepareBlockMove(doc, source.block.id, position, label).move(target.block.id);
    expect(result?.root.slots.children[0].block).toMatchObject({slots:{children:[b,a]}});
    expect(doc.root.slots.children[0].block).toMatchObject({slots:{children:[a,b]}});
  });
  it('traslada a una sección vacía y permite deshacer en un único paso', () => {
    const {doc, a, b, right} = fixture();
    const store = useEditor2Store.getState;
    store().setDoc(doc);
    const current = store().doc!;
    const next = prepareBlockMove(current, a.block.id, 'inside', label).move(right.id)!;
    store().applyBlockMove(current, next);
    expect(store().doc?.root.slots.children[0].block).toMatchObject({slots:{children:[b]}});
    expect(store().doc?.root.slots.children[1].block).toMatchObject({slots:{children:[a]}});
    store().undo();
    expect(store().doc).toEqual(current);
    store().redo();
    expect(store().doc).toEqual(next);
  });
  it('admite una sección y contenido directo en una pestaña vacía y conserva lo anterior', () => {
    const {doc, a, left, tabs} = fixture();
    const plan = prepareBlockMove(doc, left.id, 'inside', label);
    expect(plan.destinations.map(d => d.key)).not.toContain(a.block.id);
    const next = plan.move(tabs.id + '/0');
    expect(next?.root.slots.children[1].block).toMatchObject({props:{items:[{
      title: 'Histología', content:'Introducción', children:[{block:left}],
    }]}});
    const leafNext = prepareBlockMove(doc, a.block.id, 'inside', label).move(tabs.id + '/0');
    expect(leafNext?.root.slots.children[2].block).toMatchObject({props:{items:[{
      title: 'Histología', content:'Introducción', children:[a],
    }]}});
  });
});
