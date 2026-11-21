import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GridDrag from './GridDrag';

const heading = { type: 'heading', props: { id: 'heading', layout: { base: { start: 1, span: 4, row: 1, rowSpan: 2 } } } };
const box = { type: 'box', props: { ...heading.props, id: 'box', content: [] } };
const api = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getItemById: vi.fn(),
  getSelectorForId: vi.fn(),
  appState: { ui: { itemSelector: null } },
}));

vi.mock('@puckeditor/core', () => ({
  useGetPuck: () => () => api,
  usePuck: () => ({ selectedItem: null }),
}));
vi.mock('./useGridGuides', () => ({ useGridGuides: vi.fn() }));

function mountGrid(item: typeof heading, children: React.ReactNode) {
  function Canvas() {
    const host = useRef<HTMLDivElement>(null);
    return (
      <div className="e2-puck-shell">
        <div ref={host} />
        <div data-e2-canvas-root="">
          <div className="e2-slot-grid" style={{ display: 'grid', gridAutoRows: '10px' }}>
            <div data-e2-block={item.type} data-puck-component={item.props.id} tabIndex={-1}
              style={{ gridColumnStart: '1', gridColumnEnd: 'span 8', gridRowStart: '1', gridRowEnd: 'span 4' }}>
              {children}
            </div>
          </div>
        </div>
        <GridDrag host={host} />
      </div>
    );
  }

  api.getItemById.mockReturnValue(item);
  api.getSelectorForId.mockReturnValue({ index: 0, zone: 'root' });
  const { container } = render(<Canvas />);
  const grid = container.querySelector<HTMLElement>('.e2-slot-grid')!;
  const block = grid.firstElementChild as HTMLElement;
  Object.defineProperties(grid, {
    clientWidth: { value: 480 }, clientHeight: { value: 480 },
    offsetWidth: { value: 480 }, offsetHeight: { value: 480 },
  });
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 480, 480));
  vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 80, 40));
  const elementsFromPoint = vi.fn<[], Element[]>().mockReturnValue([grid]);
  const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: elementsFromPoint });
  return {
    grid, block, elementsFromPoint,
    restore() {
      if (original) Object.defineProperty(document, 'elementsFromPoint', original);
      else Reflect.deleteProperty(document, 'elementsFromPoint');
    },
  };
}

function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  fireEvent(target, event);
}

describe('arrastre en la cuadrícula', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('mueve un texto enfocado desde su superficie al perder el foco', () => {
    const { grid, block, restore } = mountGrid(heading, <span data-e2-editable="">Epitelios</span>);
    try {
      const field = block.firstElementChild!;
      pointer(field, 'pointerdown', 15, 15);
      pointer(field, 'pointerup', 15, 15);
      expect(block).toHaveFocus();
      expect(api.dispatch).toHaveBeenCalledWith({ type: 'setUi', ui: { itemSelector: { index: 0, zone: 'root' } } });

      pointer(field, 'pointerdown', 15, 15);
      pointer(grid, 'pointermove', 115, 115);
      expect(grid).toHaveAttribute('data-grid-target');
      pointer(grid, 'pointerup', 115, 115);

      const update = api.dispatch.mock.calls.find(([action]) => action.type === 'setData')?.[0];
      expect(update?.data({ content: [heading] }).content[0].props.layout.base).toEqual({
        start: 6, span: 4, row: 6, rowSpan: 2,
      });
    } finally {
      restore();
    }
  });

  it('usa la cuadrícula exterior cuando la tarjeta arrastrada queda debajo del puntero', () => {
    const { grid, block, elementsFromPoint, restore } = mountGrid(box, <div className="e2-slot-grid" />);
    try {
      elementsFromPoint.mockReturnValue([block.firstElementChild!, block, grid]);
      pointer(block, 'pointerdown', 25, 25);
      pointer(block, 'pointermove', 35, 35);
      expect(grid).toHaveAttribute('data-grid-target');
      pointer(block, 'pointerup', 35, 35);

      const update = api.dispatch.mock.calls.find(([action]) => action.type === 'setData')?.[0];
      expect(update?.data({ content: [box] }).content).toHaveLength(1);
      expect(update?.data({ content: [box] }).content[0].props.layout.base.start).toBe(1.5);
    } finally {
      restore();
    }
  });

  it('reserva el arrastre dentro del texto para seleccionar caracteres al editar', () => {
    const { grid, block, restore } = mountGrid(heading, <span data-e2-editable="" tabIndex={-1}>Epitelios</span>);
    try {
      const field = block.firstElementChild!;
      fireEvent.doubleClick(field);
      expect(field).toHaveAttribute('contenteditable', 'true');

      pointer(field, 'pointerdown', 15, 15);
      pointer(field, 'pointermove', 35, 15);
      pointer(field, 'pointerup', 35, 15);
      expect(grid).not.toHaveAttribute('data-grid-target');
      expect(api.dispatch.mock.calls.some(([action]) => action.type === 'setData')).toBe(false);
    } finally {
      restore();
    }
  });
});
