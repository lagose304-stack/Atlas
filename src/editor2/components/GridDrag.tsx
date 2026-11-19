import { useEffect, useRef, useState, type RefObject } from 'react';
import { Crosshair, X } from 'lucide-react';
import { useGetPuck, usePuck, type ComponentData } from '@puckeditor/core';
import {
  editor2PuckConfig,
  getActiveAccordionIndex,
  getActiveTabIndex,
  setActiveAccordionIndex,
  setActiveTabIndex,
} from './Editor2Blocks';
import type { LayoutIntent, SpanIntent } from '../domain/schema';
import { useEditor2Store } from '../store/editor2Store';

type Leaf =
  | 'heading'
  | 'text'
  | 'image'
  | 'gif'
  | 'video'
  | 'compare'
  | 'callout'
  | 'divider'
  | 'button'
  | 'table'
  | 'carousel'
  | 'badge'
  | 'icon'
  | 'examCarousel';
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'sw' | 'se';

type GridBox = {
  start: number;
  span: number;
  row: number;
  rowSpan: number;
};

type GridMetrics = {
  rect: DOMRect;
  clientWidth: number;
  clientHeight: number;
  colWidth: number;
  gap: number;
  pitch: number;
  rowHeight: (index: number) => number;
  rowOffset: (row: number) => number;
};

const COMPACT_SIZES: Record<Leaf, { span: number; rowSpan: number }> = {
  heading: { span: 8, rowSpan: 1 },
  text: { span: 10, rowSpan: 2 },
  image: { span: 6, rowSpan: 4 },
  gif: { span: 6, rowSpan: 4 },
  video: { span: 12, rowSpan: 6 },
  compare: { span: 10, rowSpan: 6 },
  callout: { span: 12, rowSpan: 3 },
  divider: { span: 12, rowSpan: 1 },
  button: { span: 6, rowSpan: 1 },
  table: { span: 12, rowSpan: 4 },
  carousel: { span: 10, rowSpan: 6 },
  badge: { span: 6, rowSpan: 1 },
  icon: { span: 3, rowSpan: 2 },
  examCarousel: { span: 24, rowSpan: 5 },
};

function isLeaf(name: string | undefined): name is Leaf {
  return (
    name === 'heading' ||
    name === 'text' ||
    name === 'image' ||
    name === 'gif' ||
    name === 'video' ||
    name === 'compare' ||
    name === 'callout' ||
    name === 'divider' ||
    name === 'button' ||
    name === 'table' ||
    name === 'carousel' ||
    name === 'badge' ||
    name === 'icon' ||
    name === 'examCarousel'
  );
}

function isGridBlock(name: string | undefined): boolean {
  return isLeaf(name) || name === 'box' || name === 'tabs' || name === 'accordion';
}

function isResizeDir(value: string | undefined): value is ResizeDir {
  return (
    value === 'n' ||
    value === 's' ||
    value === 'e' ||
    value === 'w' ||
    value === 'nw' ||
    value === 'sw' ||
    value === 'se'
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getActiveBreakpoint(grid: HTMLElement, layout: LayoutIntent): 'base' | 'md' | 'lg' {
  const activeBp = grid
    .closest('.e2-puck-shell')
    ?.querySelector<HTMLElement>('.e2-layout-field__row')
    ?.dataset.breakpoint;
  return activeBp === 'lg' && layout.lg ? 'lg' : activeBp === 'md' && layout.md ? 'md' : 'base';
}

function getEffectiveIntent(grid: HTMLElement, layout: LayoutIntent): SpanIntent {
  const key = getActiveBreakpoint(grid, layout);
  const direct = layout[key];
  if (direct) {
    if (key === 'base' && direct.start === undefined && direct.row === undefined) {
      const override = layout.lg ?? layout.md;
      if (override) return { ... override, ...direct, start: override.start, row: override.row, rowSpan: direct.rowSpan ?? override.rowSpan };
    }
    return direct;
  }
  return (key === 'lg' ? layout.md : undefined) ?? layout.base;
}

function getGridMetrics(grid: HTMLElement): GridMetrics | undefined {
  const rect = grid.getBoundingClientRect();
  const style = getComputedStyle(grid);
  const columns = style.gridTemplateColumns
    .split(' ')
    .map(parseFloat)
    .filter((value) => Number.isFinite(value) && value > 0);
  const colWidth = columns[0] || grid.clientWidth / 24;
  const gap =
    columns.length >= 24
      ? Math.max(0, (grid.clientWidth - columns.slice(0, 24).reduce((sum, value) => sum + value, 0)) / 23)
      : 0;
  const pitch = colWidth + gap;
  if (!(pitch > 0) || !(rect.width > 0) || !(rect.height > 0)) return undefined;
  const rowHeight = () => colWidth;
  const rowOffset = (targetRow: number) => Math.max(0, targetRow - 1) * pitch;
  return {
    rect,
    clientWidth: grid.clientWidth,
    clientHeight: grid.clientHeight,
    colWidth,
    gap,
    pitch,
    rowHeight,
    rowOffset,
  };
}

function pointToGridCell(metrics: GridMetrics, clientX: number, clientY: number): { col: number; row: number } {
  const { rect, clientWidth, clientHeight, gap, pitch } = metrics;
  const left = ((clientX - rect.left) * clientWidth) / rect.width;
  const top = ((clientY - rect.top) * clientHeight) / rect.height;
  const col = clamp(1 + Math.floor((left + gap / 2) / pitch), 1, 24);
  const row = clamp(1 + Math.floor((top + gap / 2) / pitch), 1, 1000);
  return { col, row };
}

function getBlockBox(metrics: GridMetrics, blockEl: HTMLElement, intent: SpanIntent): GridBox {
  const blockRect = blockEl.getBoundingClientRect();
  const topLeft = pointToGridCell(metrics, blockRect.left + 4, blockRect.top + 4);
  const bottomRight = pointToGridCell(
    metrics,
    Math.max(blockRect.left + 4, blockRect.right - 4),
    Math.max(blockRect.top + 4, blockRect.bottom - 4),
  );
  const span = clamp(intent.span || bottomRight.col - topLeft.col + 1, 1, 24);
  const start = clamp(intent.start ?? topLeft.col, 1, 25 - span);
  const row = Math.max(1, intent.row ?? topLeft.row);
  const measuredRowSpan = Math.max(1, bottomRight.row - row + 1);
  const rowSpan = Math.max(1, intent.rowSpan ?? measuredRowSpan);
  return { start, span, row, rowSpan };
}

function applyBoxToLayout(grid: HTMLElement, layout: LayoutIntent, box: GridBox): LayoutIntent {
  const key = getActiveBreakpoint(grid, layout);
  const intent = getEffectiveIntent(grid, layout);
  const start = clamp(box.start, 1, 24);
  const span = clamp(box.span, 1, 25 - start);
  const row = Math.max(1, box.row);
  const rowSpan = Math.max(1, box.rowSpan);
  const next: SpanIntent = { ...intent, start, span, row, rowSpan };
  if (key === 'base') {
    return {
      base: next,
      ...(layout.md ? { md: { ...layout.md, start, span, row, rowSpan } } : {}),
      ...(layout.lg ? { lg: { ...layout.lg, start, span, row, rowSpan } } : {}),
    };
  }
  return { ...layout, [key]: next };
}

function computeDropArea(
  grid: HTMLElement,
  metrics: GridMetrics,
  layout: LayoutIntent,
  box: GridBox,
  prefix?: string,
) {
  const start = clamp(box.start, 1, 24);
  const span = clamp(box.span, 1, 25 - start);
  const row = Math.max(1, box.row);
  const rowSpan = Math.max(1, box.rowSpan);
  const nextLayout = applyBoxToLayout(grid, layout, { start, span, row, rowSpan });
  const left = (start - 1) * metrics.pitch;
  const top = metrics.rowOffset(row);
  const width = span * metrics.pitch - metrics.gap;
  const height = Array.from({ length: rowSpan }, (_, index) => metrics.rowHeight(row - 1 + index) + metrics.gap).reduce(
    (sum, value) => sum + value,
    -metrics.gap,
  );
  const colText = span > 1 ? `Col ${start}–${start + span - 1}` : `Col ${start}`;
  const rowText = rowSpan > 1 ? `Fila ${row}–${row + rowSpan - 1}` : `Fila ${row}`;
  const label = `${prefix ? `${prefix} · ` : ''}${span}×${rowSpan} (${colText}, ${rowText})`;
  return {
    layout: nextLayout,
    box: { start, span, row, rowSpan },
    left,
    top,
    width,
    height,
    label,
  };
}

function createCanvasComponentData(): ComponentData {
  return {
    type: 'canvas',
    props: {
      ...editor2PuckConfig.components.canvas.defaultProps,
      id: `canvas-${crypto.randomUUID()}`,
      content: [],
    },
  };
}

function createTabsComponentData(): ComponentData {
  return {
    type: 'tabs',
    props: {
      ...editor2PuckConfig.components.tabs.defaultProps,
      id: `tabs-${crypto.randomUUID()}`,
      items: [
        {
          title: 'Sección 1',
          content: [createCanvasComponentData()],
        },
        {
          title: 'Sección 2',
          content: [createCanvasComponentData()],
        },
      ],
    },
  };
}

function createAccordionComponentData(): ComponentData {
  return {
    type: 'accordion',
    props: {
      ...editor2PuckConfig.components.accordion.defaultProps,
      id: `accordion-${crypto.randomUUID()}`,
      items: [
        {
          title: 'Sección desplegable 1',
          openByDefault: true,
          content: [createCanvasComponentData()],
        },
        {
          title: 'Sección desplegable 2',
          openByDefault: false,
          content: [createCanvasComponentData()],
        },
      ],
    },
  };
}

function hasCanvasInSections(sections: ComponentData[]): boolean {
  for (const section of sections) {
    if (section.type === 'canvas') return true;
    if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      for (const tab of section.props.items as Array<{ content?: ComponentData[] }>) {
        if (Array.isArray(tab?.content) && hasCanvasInSections(tab.content)) {
          return true;
        }
      }
    }
  }
  return false;
}

function findExistingLeaf(sections: ComponentData[], leafId: string): ComponentData | undefined {
  for (const section of sections) {
    if ((section.type === 'canvas' || section.type === 'box') && Array.isArray(section.props.content)) {
      const children = section.props.content as ComponentData[];
      const found = children.find((child) => child.props.id === leafId);
      if (found) return found;
      const nested = findExistingLeaf(children, leafId);
      if (nested) return nested;
    } else if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      for (const tab of section.props.items as Array<{ content?: ComponentData[] }>) {
        if (Array.isArray(tab?.content)) {
          const found = findExistingLeaf(tab.content, leafId);
          if (found) return found;
        }
      }
    }
  }
  return undefined;
}

function updateCanvasChildren(
  sections: ComponentData[],
  parentId: string,
  leafId: string,
  placed: ComponentData,
): ComponentData[] {
  return sections.map((section) => {
    if (section.type === 'canvas' || section.type === 'box') {
      const children: ComponentData[] = Array.isArray(section.props.content) ? section.props.content : [];
      const destination = section.props.id === parentId;
      const hasDirect = children.some((child) => child.props.id === leafId);
      let nextChildren = children.map((child) =>
        child.type === 'box' || child.type === 'tabs' || child.type === 'accordion'
          ? updateCanvasChildren([child], parentId, leafId, placed)[0]
          : child,
      );
      if (destination || hasDirect) {
        const previousIndex = nextChildren.findIndex((child) => child.props.id === leafId);
        nextChildren = nextChildren.filter((child) => child.props.id !== leafId);
        if (destination) {
          nextChildren.splice(previousIndex < 0 ? nextChildren.length : previousIndex, 0, placed);
        }
      }
      return { ...section, props: { ...section.props, content: nextChildren } };
    }
    if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      return {
        ...section,
        props: {
          ...section.props,
          items: (section.props.items as Array<{ title: string; openByDefault?: boolean; content?: ComponentData[] }>).map((tab) => ({
            ...tab,
            content: updateCanvasChildren(
              Array.isArray(tab?.content) ? tab.content : [],
              parentId,
              leafId,
              placed,
            ),
          })),
        },
      };
    }
    return section;
  });
}

function patchLeafInSections(
  sections: ComponentData[],
  blockId: string,
  patch: Record<string, unknown>,
): ComponentData[] {
  return sections.map((section) => {
    if (section.props.id === blockId) {
      return { ...section, props: { ...section.props, ...patch } };
    }
    if (section.type === 'canvas' || section.type === 'box') {
      const children: ComponentData[] = Array.isArray(section.props.content) ? section.props.content : [];
      return {
        ...section,
        props: {
          ...section.props,
          content: patchLeafInSections(children, blockId, patch),
        },
      };
    }
    if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      return {
        ...section,
        props: {
          ...section.props,
          items: (section.props.items as Array<{ title: string; openByDefault?: boolean; content?: ComponentData[] }>).map((tab) => ({
            ...tab,
            content: patchLeafInSections(
              Array.isArray(tab?.content) ? tab.content : [],
              blockId,
              patch,
            ),
          })),
        },
      };
    }
    return section;
  });
}

function removeBlockFromSections(sections: ComponentData[], targetId: string): ComponentData[] {
  return sections
    .filter((section) => section.props.id !== targetId)
    .map((section) => {
      if (section.type === 'canvas') {
        const children: ComponentData[] = Array.isArray(section.props.content) ? section.props.content : [];
        return {
          ...section,
          props: {
            ...section.props,
            content: removeBlockFromSections(children, targetId),
          },
        };
      }
      if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
        return {
          ...section,
          props: {
            ...section.props,
            items: (section.props.items as Array<{ title: string; openByDefault?: boolean; content?: ComponentData[] }>).map((tab) => ({
              ...tab,
              content: removeBlockFromSections(Array.isArray(tab?.content) ? tab.content : [], targetId),
            })),
          },
        };
      }
      return section;
    });
}

function appendStructureItem(
  sections: ComponentData[],
  targetType: 'tabs' | 'accordion',
  targetId: string,
  maxItems: number,
  makeItem: (count: number) => { title: string; openByDefault?: boolean; content: ComponentData[] },
  onIndex: (idx: number) => void,
): ComponentData[] {
  return sections.map((section) => {
    if (section.type === targetType && section.props.id === targetId) {
      const items = Array.isArray(section.props.items)
        ? (section.props.items as Array<{ title: string; openByDefault?: boolean; content: ComponentData[] }>)
        : [];
      if (items.length >= maxItems) return section;
      onIndex(items.length);
      return { ...section, props: { ...section.props, items: [...items, makeItem(items.length)] } };
    }
    if (section.type === 'canvas' && Array.isArray(section.props.content)) {
      return {
        ...section,
        props: {
          ...section.props,
          content: appendStructureItem(
            section.props.content as ComponentData[],
            targetType,
            targetId,
            maxItems,
            makeItem,
            onIndex,
          ),
        },
      };
    }
    if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      return {
        ...section,
        props: {
          ...section.props,
          items: (section.props.items as Array<{ title: string; openByDefault?: boolean; content?: ComponentData[] }>).map((tab) => ({
            ...tab,
            content: appendStructureItem(
              Array.isArray(tab?.content) ? tab.content : [],
              targetType,
              targetId,
              maxItems,
              makeItem,
              onIndex,
            ),
          })),
        },
      };
    }
    return section;
  });
}

function createLeafComponentData(leaf: Leaf): ComponentData {
  const compact = COMPACT_SIZES[leaf];
  return {
    type: leaf,
    props: {
      ...editor2PuckConfig.components[leaf].defaultProps,
      id: `${leaf}-${crypto.randomUUID()}`,
      layout: { base: { span: compact.span, rowSpan: compact.rowSpan } },
    },
  };
}

type DragSession =
  | {
      kind: 'drawer';
      pointer: number;
      x: number;
      y: number;
      moved: boolean;
      leaf: Leaf;
      item: ComponentData;
    }
  | {
      kind: 'structure-drawer';
      pointer: number;
      x: number;
      y: number;
      moved: boolean;
      structure: 'tabs' | 'accordion';
    }
  | {
      kind: 'draw';
      pointer: number;
      x: number;
      y: number;
      moved: boolean;
      leaf: Leaf;
      item: ComponentData;
      grid: HTMLElement;
      parent: string;
      anchor: { col: number; row: number };
    }
  | {
      kind: 'move';
      pointer: number;
      x: number;
      y: number;
      moved: boolean;
      item: ComponentData;
      box: GridBox;
      grabCol: number;
      grabRow: number;
    }
  | {
      kind: 'resize';
      pointer: number;
      x: number;
      y: number;
      moved: boolean;
      item: ComponentData;
      grid: HTMLElement;
      parent: string;
      dir: ResizeDir;
      initialBox: GridBox;
    };

export default function GridDrag({ host }: { host: RefObject<HTMLDivElement> }) {
  const getPuck = useGetPuck();
  const { selectedItem } = usePuck();
  const selectedId = typeof selectedItem?.props?.id === 'string' ? selectedItem.props.id : null;
  const [placing, setPlacing] = useState<Leaf | null>(null);
  const placingRef = useRef<Leaf | null>(null);
  placingRef.current = placing;

  useEffect(() => {
    const shell = host.current?.closest<HTMLElement>('.e2-puck-shell');
    if (!shell) return;
    shell.querySelectorAll<HTMLElement>('[data-e2-selected="true"]').forEach((el) => {
      if (el.dataset.puckComponent !== selectedId) {
        el.removeAttribute('data-e2-selected');
      }
    });
    if (selectedId) {
      const activeEl = shell.querySelector<HTMLElement>(`[data-puck-component="${selectedId}"]`);
      if (activeEl) {
        activeEl.setAttribute('data-e2-selected', 'true');
      }
    }
  }, [host, selectedId]);

  useEffect(() => {
    const shell = host.current?.closest<HTMLElement>('.e2-puck-shell');
    if (!shell) return;
    if (placing) {
      shell.setAttribute('data-placing-tool', placing);
      const api = getPuck();
      const hasCanvas = hasCanvasInSections(api.appState.data.content);
      if (!hasCanvas) {
        api.dispatch({
          type: 'setData',
          data: (previous) => ({
            ...previous,
            content: [...previous.content, createCanvasComponentData()],
          }),
        });
      }
    } else {
      shell.removeAttribute('data-placing-tool');
    }
    const items = shell.querySelectorAll<HTMLElement>('[data-puck-drawer-item]');
    items.forEach((el) => {
      const name = el.getAttribute('data-testid')?.split(':')[1];
      if (placing && name === placing) {
        el.setAttribute('data-placing-active', 'true');
      } else {
        el.removeAttribute('data-placing-active');
      }
    });
  }, [getPuck, host, placing]);

  useEffect(() => {
    const shell = host.current?.closest<HTMLElement>('.e2-puck-shell');
    if (!shell) return;
    let drag: DragSession | undefined;
    let ignoreClick = false;
    let selectionFrame = 0;
    let scrollFrame = 0;
    let highlighted: HTMLElement | undefined;
    let highlightedRoot: HTMLElement | undefined;

    function clearHighlight() {
      highlighted?.removeAttribute('data-grid-target');
      highlighted?.removeAttribute('data-grid-label');
      highlighted = undefined;
      highlightedRoot?.removeAttribute('data-root-drop');
      highlightedRoot?.removeAttribute('data-root-drop-label');
      highlightedRoot = undefined;
    }

    function computeRootInsert(clientX: number, clientY: number, label: string) {
      const rootZone = shell?.querySelector<HTMLElement>('[data-e2-canvas-root] > div');
      if (!rootZone) return undefined;
      const rootRect = rootZone.getBoundingClientRect();
      if (
        clientX < rootRect.left - 40 ||
        clientX > rootRect.right + 40 ||
        clientY < rootRect.top - 40 ||
        clientY > rootRect.bottom + 80
      ) {
        return undefined;
      }
      const sections = Array.from(rootZone.children).filter((el): el is HTMLElement =>
        el instanceof HTMLElement &&
        Boolean(el.matches('[data-puck-component]') || el.querySelector(':scope > [data-puck-component]')),
      );
      let insertIndex = sections.length;
      let lineY = Math.max(8, rootRect.height - 20);
      for (let i = 0; i < sections.length; i++) {
        const rect = sections[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid) {
          insertIndex = i;
          lineY = Math.max(4, rect.top - rootRect.top - 6);
          break;
        }
        lineY = rect.bottom - rootRect.top + 6;
      }
      return { rootZone, insertIndex, lineY, label };
    }

    function paintRootDrop(rootZone: HTMLElement, lineY: number, label: string) {
      clearHighlight();
      rootZone.style.setProperty('--root-drop-y', `${lineY}px`);
      rootZone.setAttribute('data-root-drop', '');
      rootZone.setAttribute('data-root-drop-label', label);
      highlightedRoot = rootZone;
    }

    function cancel() {
      clearHighlight();
      shell?.removeAttribute('data-e2-dragging');
      drag = undefined;
      cancelAnimationFrame(scrollFrame);
    }

    function paintArea(
      grid: HTMLElement,
      area: { left: number; top: number; width: number; height: number; label: string },
    ) {
      clearHighlight();
      grid.style.setProperty('--drop-x', `${area.left}px`);
      grid.style.setProperty('--drop-y', `${area.top}px`);
      grid.style.setProperty('--drop-width', `${area.width}px`);
      grid.style.setProperty('--drop-height', `${area.height}px`);
      grid.setAttribute('data-grid-target', '');
      grid.setAttribute('data-grid-label', area.label);
      highlighted = grid;
    }

    function findGridAtPoint(clientX: number, clientY: number) {
      const grid = document
        .elementsFromPoint(clientX, clientY)
        .map((el) => el.closest<HTMLElement>('.e2-slot-grid'))
        .find((el): el is HTMLElement => Boolean(el && shell?.contains(el)));
      if (!grid) return undefined;
      const parent = grid.closest<HTMLElement>('[data-e2-block="box"], [data-e2-block="canvas"]')?.dataset.puckComponent;
      const metrics = getGridMetrics(grid);
      if (!parent || !metrics) return undefined;
      return { grid, parent, metrics };
    }

    function focusBlockEditable(
      blockId: string,
      options: { selectAll?: boolean; clientX?: number; clientY?: number } = {},
    ) {
      const blockEl = shell?.querySelector<HTMLElement>(`[data-puck-component="${blockId}"]`);
      if (!blockEl) return;
      const pointEditable =
        typeof options.clientX === 'number' && typeof options.clientY === 'number'
          ? document
              .elementsFromPoint(options.clientX, options.clientY)
              .map((el) => el.closest<HTMLElement>('[data-e2-editable]'))
              .find((el): el is HTMLElement => Boolean(el && blockEl.contains(el)))
          : undefined;
      const editable = pointEditable ?? blockEl.querySelector<HTMLElement>('[data-e2-editable]');
      if (!editable) return;
      if (document.activeElement !== editable) {
        editable.focus();
      }
      if (typeof window.getSelection !== 'function' || typeof document.createRange !== 'function') return;
      const selection = window.getSelection();
      if (!selection) return;

      if (options.selectAll && editable.textContent) {
        const range = document.createRange();
        range.selectNodeContents(editable);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }

      if (typeof options.clientX === 'number' && typeof options.clientY === 'number') {
        const docWithCaret = document as Document & {
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
        };
        if (typeof docWithCaret.caretRangeFromPoint === 'function') {
          const caretRange = docWithCaret.caretRangeFromPoint(options.clientX, options.clientY);
          if (caretRange && editable.contains(caretRange.startContainer)) {
            selection.removeAllRanges();
            selection.addRange(caretRange);
            return;
          }
        }
      }

      if (editable.textContent) {
        const range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    function commitPlacement(
      item: ComponentData,
      parentId: string,
      layout: LayoutIntent,
      focusNewText = false,
      extraProps?: Record<string, unknown>,
    ) {
      const api = getPuck();
      api.dispatch({
        type: 'setData',
        data: (previous) => {
          const existingChild = findExistingLeaf(previous.content, item.props.id);
          const baseItem = existingChild ?? item;
          const placed: ComponentData = {
            ...baseItem,
            props: { ...baseItem.props, ...(extraProps ?? {}), layout },
          };
          return {
            ...previous,
            content: updateCanvasChildren(previous.content, parentId, item.props.id, placed),
          };
        },
      });
      cancelAnimationFrame(selectionFrame);
      selectionFrame = requestAnimationFrame(() => {
        const selector = getPuck().getSelectorForId(item.props.id);
        if (selector) api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
        if (focusNewText) {
          focusBlockEditable(item.props.id, { selectAll: true });
        }
      });
    }

    function computeSessionHit(e: PointerEvent) {
      if (!drag) return undefined;

      if (drag.kind === 'draw') {
        const metrics = getGridMetrics(drag.grid);
        if (!metrics) return undefined;
        const curr = pointToGridCell(metrics, e.clientX, e.clientY);
        const box: GridBox = drag.moved
          ? {
              start: Math.min(drag.anchor.col, curr.col),
              span: Math.abs(curr.col - drag.anchor.col) + 1,
              row: Math.min(drag.anchor.row, curr.row),
              rowSpan: Math.abs(curr.row - drag.anchor.row) + 1,
            }
          : {
              start: clamp(drag.anchor.col, 1, 25 - COMPACT_SIZES[drag.leaf].span),
              span: COMPACT_SIZES[drag.leaf].span,
              row: drag.anchor.row,
              rowSpan: COMPACT_SIZES[drag.leaf].rowSpan,
            };
        const labelPrefix = editor2PuckConfig.components[drag.leaf]?.label ?? drag.leaf;
        const area = computeDropArea(drag.grid, metrics, drag.item.props.layout, box, labelPrefix);
        return { grid: drag.grid, parent: drag.parent, area };
      }

      if (drag.kind === 'resize') {
        const metrics = getGridMetrics(drag.grid);
        if (!metrics) return undefined;
        const curr = pointToGridCell(metrics, e.clientX, e.clientY);
        let startCol = drag.initialBox.start;
        let endCol = drag.initialBox.start + drag.initialBox.span - 1;
        let startRow = drag.initialBox.row;
        let endRow = drag.initialBox.row + drag.initialBox.rowSpan - 1;

        if (drag.dir.includes('e')) endCol = clamp(curr.col, startCol, 24);
        if (drag.dir.includes('w')) startCol = clamp(curr.col, 1, endCol);
        if (drag.dir.includes('s')) endRow = Math.max(startRow, curr.row);
        if (drag.dir.includes('n')) startRow = clamp(curr.row, 1, endRow);

        const box: GridBox = {
          start: startCol,
          span: endCol - startCol + 1,
          row: startRow,
          rowSpan: endRow - startRow + 1,
        };
        const area = computeDropArea(drag.grid, metrics, drag.item.props.layout, box);
        return { grid: drag.grid, parent: drag.parent, area };
      }

      const found = findGridAtPoint(e.clientX, e.clientY);
      if (!found) return undefined;
      const { grid, parent, metrics } = found;
      const curr = pointToGridCell(metrics, e.clientX, e.clientY);

      if (drag.kind === 'drawer') {
        const compact = COMPACT_SIZES[drag.leaf];
        const start = clamp(curr.col, 1, 25 - compact.span);
        const box: GridBox = {
          start,
          span: compact.span,
          row: curr.row,
          rowSpan: compact.rowSpan,
        };
        const labelPrefix = editor2PuckConfig.components[drag.leaf]?.label ?? drag.leaf;
        const area = computeDropArea(grid, metrics, drag.item.props.layout, box, labelPrefix);
        return { grid, parent, area };
      }

      if (drag.kind === 'move') {
        if (drag.item.type === 'box' && grid.closest(`[data-puck-component="${drag.item.props.id}"]`)) {
          return undefined;
        }
        const span = clamp(drag.box.span, 1, 24);
        const start = clamp(curr.col - drag.grabCol, 1, 25 - span);
        const row = Math.max(1, curr.row - drag.grabRow);
        const box: GridBox = {
          start,
          span,
          row,
          rowSpan: drag.box.rowSpan,
        };
        const area = computeDropArea(grid, metrics, drag.item.props.layout, box);
        return { grid, parent, area };
      }

      return undefined;
    }

    function down(e: PointerEvent) {
      ignoreClick = false;
      if (!e.isPrimary || e.button !== 0 || !(e.target instanceof Element) || !shell?.contains(e.target)) return;

      const drawer = e.target.closest('[data-puck-drawer-item]')?.getAttribute('data-testid')?.split(':')[1];
      if (isLeaf(drawer)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        drag = {
          kind: 'drawer',
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          leaf: drawer,
          item: createLeafComponentData(drawer),
        };
        return;
      }

      if (drawer === 'tabs' || drawer === 'accordion') {
        e.stopImmediatePropagation();
        e.preventDefault();
        setPlacing(null);
        drag = {
          kind: 'structure-drawer',
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          structure: drawer,
        };
        return;
      }

      if (placingRef.current) {
        const found = findGridAtPoint(e.clientX, e.clientY);
        if (found) {
          e.stopImmediatePropagation();
          e.preventDefault();
          const leaf = placingRef.current;
          const anchor = pointToGridCell(found.metrics, e.clientX, e.clientY);
          const item = createLeafComponentData(leaf);
          drag = {
            kind: 'draw',
            pointer: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            moved: false,
            leaf,
            item,
            grid: found.grid,
            parent: found.parent,
            anchor,
          };
          const labelPrefix = editor2PuckConfig.components[leaf]?.label ?? leaf;
          const area = computeDropArea(
            found.grid,
            found.metrics,
            item.props.layout,
            { start: anchor.col, span: 1, row: anchor.row, rowSpan: 1 },
            labelPrefix,
          );
          paintArea(found.grid, area);
          return;
        }
      }

      const resizeHandle = e.target.closest<HTMLElement>('[data-e2-resize]');
      const moveHandle = e.target.closest<HTMLElement>('[data-e2-move-handle], [data-puck-drag-handle]');
      const editable = e.target.closest<HTMLElement>('[data-e2-editable]');

      const activeEditable =
        document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute('data-e2-editable')
          ? document.activeElement
          : null;
      if (activeEditable && (resizeHandle || moveHandle || activeEditable !== editable)) {
        activeEditable.blur();
      }

      if (e.target.closest('[data-puck-overlay]') && !moveHandle) {
        return;
      }

      if (
        e.target.closest(
          '.e2-carousel-nav, .e2-carousel-dot, .e2-tabs-nav__btn, .e2-tabs-nav__add, .e2-accordion-trigger, .e2-compare-range, .e2-section-delete',
        )
      ) {
        return;
      }

      let block = e.target.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]');
      if (!block) {
        if (moveHandle) {
          const selected = getPuck().selectedItem;
          if (!selected || !isGridBlock(selected.type)) return;
          block =
            shell?.querySelector<HTMLElement>(
              `.e2-slot-grid > [data-puck-component="${selected.props.id}"]`,
            ) ?? null;
        } else {
          const hitBlock = document
            .elementsFromPoint(e.clientX, e.clientY)
            .map((el) => el.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]'))
            .find((el): el is HTMLElement => Boolean(el && shell?.contains(el)));
          if (hitBlock) {
            block = hitBlock;
          }
        }
      }
      if (!block?.dataset.puckComponent || !isGridBlock(block.dataset.e2Block)) return;

      if (!resizeHandle && !moveHandle && editable) {
        e.stopImmediatePropagation();
        const blockId = block.dataset.puckComponent;
        const api = getPuck();
        const selector = api.getSelectorForId(blockId);
        if (selector) {
          const current = api.appState.ui.itemSelector;
          if (!current || current.index !== selector.index || current.zone !== selector.zone) {
            api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
          }
        }
        return;
      }

      const existing = getPuck().getItemById(block.dataset.puckComponent);
      if (!existing) return;
      const grid = block.closest<HTMLElement>('.e2-slot-grid');
      const parent = grid?.closest<HTMLElement>('[data-e2-block="box"], [data-e2-block="canvas"]')?.dataset.puckComponent;
      const metrics = grid ? getGridMetrics(grid) : undefined;
      if (!grid || !parent || !metrics) return;

      const intent = getEffectiveIntent(grid, existing.props.layout);
      const box = getBlockBox(metrics, block, intent);

      if (resizeHandle && isResizeDir(resizeHandle.dataset.e2Resize)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        drag = {
          kind: 'resize',
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          item: existing,
          grid,
          parent,
          dir: resizeHandle.dataset.e2Resize,
          initialBox: box,
        };
        const area = computeDropArea(grid, metrics, existing.props.layout, box);
        paintArea(grid, area);
        return;
      }

      const pointerCell = pointToGridCell(metrics, e.clientX, e.clientY);
      const grabCol = clamp(pointerCell.col - box.start, 0, box.span - 1);
      const grabRow = clamp(pointerCell.row - box.row, 0, box.rowSpan - 1);

      e.stopImmediatePropagation();
      e.preventDefault();
      drag = {
        kind: 'move',
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        item: existing,
        box,
        grabCol,
        grabRow,
      };
    }

    function move(e: PointerEvent) {
      if (!drag) {
        if (placingRef.current) {
          const found = findGridAtPoint(e.clientX, e.clientY);
          if (!found) {
            clearHighlight();
            return;
          }
          const cell = pointToGridCell(found.metrics, e.clientX, e.clientY);
          const leaf = placingRef.current;
          const labelPrefix = `${editor2PuckConfig.components[leaf]?.label ?? leaf} · arrastra para definir tamaño`;
          const area = computeDropArea(
            found.grid,
            found.metrics,
            { base: { span: 1 } },
            { start: cell.col, span: 1, row: cell.row, rowSpan: 1 },
            labelPrefix,
          );
          paintArea(found.grid, area);
        }
        return;
      }

      if (drag.pointer !== e.pointerId) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        shell?.setAttribute('data-e2-dragging', 'true');
        if (drag.kind === 'move' && document.activeElement instanceof HTMLElement && shell?.contains(document.activeElement)) {
          document.activeElement.blur();
          window.getSelection?.()?.removeAllRanges();
        }
      }
      cancelAnimationFrame(scrollFrame);
      const edge = Math.min(64, window.innerHeight / 8);
      const velocity =
        e.clientY < edge ? (e.clientY - edge) / 4 : Math.max(0, e.clientY - window.innerHeight + edge) / 4;
      if (velocity) {
        const scroll = () => {
          const previous = window.scrollY;
          window.scrollBy(0, velocity);
          if (window.scrollY !== previous && drag) {
            const hit = computeSessionHit(e);
            if (hit) paintArea(hit.grid, hit.area);
            scrollFrame = requestAnimationFrame(scroll);
          }
        };
        scrollFrame = requestAnimationFrame(scroll);
      }
      if (drag.kind === 'structure-drawer') {
        const structureLabel = drag.structure === 'tabs' ? 'Pestañas' : 'Acordeón';
        const gridHit = findGridAtPoint(e.clientX, e.clientY);
        const insideGridBody =
          gridHit &&
          !gridHit.grid.closest('.e2-block--tabs, .e2-block--accordion') &&
          e.clientY > gridHit.metrics.rect.top + 22 &&
          e.clientY < gridHit.metrics.rect.bottom - 28;
        if (insideGridBody && gridHit) {
          const curr = pointToGridCell(gridHit.metrics, e.clientX, e.clientY);
          const span = 12;
          const rowSpan = 6;
          const start = clamp(curr.col, 1, 25 - span);
          const area = computeDropArea(
            gridHit.grid,
            gridHit.metrics,
            { base: { span, rowSpan } },
            { start, span, row: curr.row, rowSpan },
            `${structureLabel} (dentro)`,
          );
          paintArea(gridHit.grid, area);
          return;
        }
        const hit = computeRootInsert(e.clientX, e.clientY, `Soltar fuera (raíz) · ${structureLabel}`);
        if (hit) {
          paintRootDrop(hit.rootZone, hit.lineY, hit.label);
        } else {
          clearHighlight();
        }
        return;
      }

      const hit = computeSessionHit(e);
      if (hit) {
        paintArea(hit.grid, hit.area);
      } else {
        clearHighlight();
      }
    }

    function up(e: PointerEvent) {
      if (!drag || drag.pointer !== e.pointerId) return;
      e.stopImmediatePropagation();
      ignoreClick = true;
      const session = drag;
      let structureGridHit:
        | { parent: string; layout: LayoutIntent }
        | undefined;
      if (session.kind === 'structure-drawer' && session.moved) {
        const gridHit = findGridAtPoint(e.clientX, e.clientY);
        const insideGridBody =
          gridHit &&
          !gridHit.grid.closest('.e2-block--tabs, .e2-block--accordion') &&
          e.clientY > gridHit.metrics.rect.top + 22 &&
          e.clientY < gridHit.metrics.rect.bottom - 28;
        if (insideGridBody && gridHit) {
          const curr = pointToGridCell(gridHit.metrics, e.clientX, e.clientY);
          const span = 12;
          const rowSpan = 6;
          const start = clamp(curr.col, 1, 25 - span);
          const area = computeDropArea(
            gridHit.grid,
            gridHit.metrics,
            { base: { span, rowSpan } },
            { start, span, row: curr.row, rowSpan },
          );
          structureGridHit = { parent: gridHit.parent, layout: area.layout };
        }
      }
      const rootHit =
        session.kind === 'structure-drawer' && !structureGridHit
          ? computeRootInsert(e.clientX, e.clientY, '')
          : undefined;
      const hit = session.kind === 'structure-drawer' ? undefined : computeSessionHit(e);
      cancel();

      if (session.kind === 'structure-drawer') {
        if (structureGridHit) {
          const newStructure =
            session.structure === 'tabs'
              ? createTabsComponentData()
              : createAccordionComponentData();
          commitPlacement(newStructure, structureGridHit.parent, structureGridHit.layout);
          return;
        }
        if (!session.moved || rootHit) {
          const api = getPuck();
          const newStructure =
            session.structure === 'tabs'
              ? createTabsComponentData()
              : createAccordionComponentData();
          api.dispatch({
            type: 'setData',
            data: (previous) => {
              const nextContent = [...previous.content];
              const idx = rootHit
                ? Math.max(0, Math.min(rootHit.insertIndex, nextContent.length))
                : nextContent.length;
              nextContent.splice(idx, 0, newStructure);
              return { ...previous, content: nextContent };
            },
          });
          cancelAnimationFrame(selectionFrame);
          selectionFrame = requestAnimationFrame(() => {
            const selector = getPuck().getSelectorForId(newStructure.props.id);
            if (selector) api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
          });
        }
        return;
      }

      if (session.kind === 'drawer') {
        if (session.moved && hit) {
          setPlacing(null);
          commitPlacement(session.item, hit.parent, hit.area.layout, true);
        } else {
          setPlacing((previous) => (previous === session.leaf ? null : session.leaf));
        }
        return;
      }

      if (session.kind === 'draw') {
        if (hit) {
          setPlacing(null);
          const nextItem =
            session.leaf === 'divider' && hit.area.box.rowSpan > hit.area.box.span
              ? { ...session.item, props: { ...session.item.props, orientation: 'vertical' } }
              : session.item;
          commitPlacement(nextItem, hit.parent, hit.area.layout, true);
        }
        return;
      }

      if (session.kind === 'resize') {
        if (session.moved && hit) {
          const resizedVertically = session.dir.includes('n') || session.dir.includes('s');
          let nextLayout = hit.area.layout;
          let extraProps: Record<string, unknown> | undefined;

          if (resizedVertically) {
            // Al redimensionar en vertical, limpia verticalAlign para que el bloque ocupe exactamente las filas elegidas.
            const clearVerticalAlign = (intent: SpanIntent | undefined): SpanIntent | undefined => {
              if (!intent) return undefined;
              const { verticalAlign: _ignored, ...rest } = intent;
              return rest;
            };
            nextLayout = {
              base: clearVerticalAlign(nextLayout.base)!,
              ...(nextLayout.md ? { md: clearVerticalAlign(nextLayout.md) } : {}),
              ...(nextLayout.lg ? { lg: clearVerticalAlign(nextLayout.lg) } : {}),
            };
            // En imágenes/GIFs, desbloquea proporción fija (p. ej. 4/3) para respetar el alto exacto arrastrado.
            if (session.item.type === 'image' || session.item.type === 'gif') {
              const prevMedia = (session.item.props.media as Record<string, unknown> | undefined) ?? {};
              if (prevMedia.aspect && prevMedia.aspect !== 'auto') {
                extraProps = { media: { ...prevMedia, aspect: 'auto' } };
              }
            }
          } else if (session.item.type === 'image' || session.item.type === 'gif') {
            // Si solo se redimensiona en horizontal y la imagen tiene proporción fija (p. ej. 4/3),
            // deja rowSpan libre si no existía para que escale proporcionalmente sin distorsión.
            const prevMedia = (session.item.props.media as Record<string, unknown> | undefined) ?? {};
            const hasFixedAspect = Boolean(prevMedia.aspect && prevMedia.aspect !== 'auto');
            if (hasFixedAspect) {
              const dropRowSpan = (intent: SpanIntent | undefined): SpanIntent | undefined => {
                if (!intent) return undefined;
                const { rowSpan: _rs, ...rest } = intent;
                return rest;
              };
              nextLayout = {
                base: dropRowSpan(nextLayout.base)!,
                ...(nextLayout.md ? { md: dropRowSpan(nextLayout.md) } : {}),
                ...(nextLayout.lg ? { lg: dropRowSpan(nextLayout.lg) } : {}),
              };
            }
          }

          commitPlacement(session.item, hit.parent, nextLayout, false, extraProps);
        }
        return;
      }

      if (session.kind === 'move') {
        if (session.moved && hit) {
          commitPlacement(session.item, hit.parent, hit.area.layout);
        } else {
          const api = getPuck();
          const clickX = e.clientX;
          const clickY = e.clientY;
          const clickedMoveHandle =
            e.target instanceof Element && Boolean(e.target.closest('[data-e2-move-handle], [data-puck-drag-handle]'));
          cancelAnimationFrame(selectionFrame);
          selectionFrame = requestAnimationFrame(() => {
            const selector = getPuck().getSelectorForId(session.item.props.id);
            if (selector) api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
            if (!clickedMoveHandle) {
              focusBlockEditable(session.item.props.id, { clientX: clickX, clientY: clickY });
            }
          });
        }
      }
    }

    function onInlineTextChange(event: Event) {
      const custom = event as CustomEvent<{ text: string }>;
      const target = event.target instanceof Element ? event.target : null;
      const block = target?.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]');
      const blockId = block?.dataset.puckComponent;
      if (!blockId || typeof custom.detail?.text !== 'string') return;
      const api = getPuck();
      const nextText = custom.detail.text;
      api.dispatch({
        type: 'setData',
        data: (previous) => ({
          ...previous,
          content: patchLeafInSections(previous.content, blockId, { text: nextText }),
        }),
      });
    }

    function onInlineBlockPatch(event: Event) {
      const custom = event as CustomEvent<{ patch: Record<string, unknown> }>;
      const target = event.target instanceof Element ? event.target : null;
      const block = target?.closest<HTMLElement>('[data-puck-component]');
      const blockId = block?.dataset.puckComponent;
      if (!blockId || !custom.detail?.patch || typeof custom.detail.patch !== 'object') return;
      const api = getPuck();
      const patch = custom.detail.patch;
      api.dispatch({
        type: 'setData',
        data: (previous) => ({
          ...previous,
          content: patchLeafInSections(previous.content, blockId, patch),
        }),
      });
    }

    function onTabsAdd(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      const tabsId = detail?.id;
      if (!tabsId) return;
      const api = getPuck();
      let newTabIndex = 0;
      api.dispatch({
        type: 'setData',
        data: (previous) => ({
          ...previous,
          content: appendStructureItem(
            previous.content,
            'tabs',
            tabsId,
            10,
            (count) => ({ title: `Sección ${count + 1}`, content: [createCanvasComponentData()] }),
            (idx) => {
              newTabIndex = idx;
            },
          ),
        }),
      });
      setActiveTabIndex(tabsId, newTabIndex);
      window.dispatchEvent(new CustomEvent('e2:tabs-select', { detail: { id: tabsId, index: newTabIndex } }));
      window.dispatchEvent(new CustomEvent('e2:tabs-changed', { detail: { id: tabsId, index: newTabIndex } }));
    }

    function onAccordionAdd(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      const accordionId = detail?.id;
      if (!accordionId) return;
      const api = getPuck();
      let newIndex = 0;
      api.dispatch({
        type: 'setData',
        data: (previous) => ({
          ...previous,
          content: appendStructureItem(
            previous.content,
            'accordion',
            accordionId,
            12,
            (count) => ({
              title: `Sección desplegable ${count + 1}`,
              openByDefault: false,
              content: [createCanvasComponentData()],
            }),
            (idx) => {
              newIndex = idx;
            },
          ),
        }),
      });
      setActiveAccordionIndex(accordionId, newIndex);
      window.dispatchEvent(new CustomEvent('e2:accordion-select', { detail: { id: accordionId, index: newIndex } }));
      window.dispatchEvent(new CustomEvent('e2:accordion-changed', { detail: { id: accordionId, index: newIndex } }));
    }

    function onRemoveBlock(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      const targetId = detail?.id;
      if (!targetId) return;
      const api = getPuck();
      api.dispatch({
        type: 'setData',
        data: (previous) => ({
          ...previous,
          content: removeBlockFromSections(previous.content, targetId),
        }),
      });
      if (api.selectedItem?.props?.id === targetId) {
        api.dispatch({ type: 'setUi', ui: { itemSelector: null } });
      }
    }

    const events = new AbortController();
    const options = { capture: true, signal: events.signal };
    shell.addEventListener('e2:text-change', onInlineTextChange, { signal: events.signal });
    shell.addEventListener('e2:block-patch', onInlineBlockPatch, { signal: events.signal });
    window.addEventListener('e2:tabs-add', onTabsAdd, { signal: events.signal });
    window.addEventListener('e2:accordion-add', onAccordionAdd, { signal: events.signal });
    window.addEventListener('e2:remove-block', onRemoveBlock, { signal: events.signal });
    window.addEventListener(
      'click',
      (e) => {
        if (ignoreClick && e.detail > 0) {
          ignoreClick = false;
          e.stopImmediatePropagation();
          return;
        }
        if (!(e.target instanceof Element) || !shell?.contains(e.target)) return;
        const drawer = e.target.closest('[data-puck-drawer-item]')?.getAttribute('data-testid')?.split(':')[1];
        if (drawer === 'canvas') {
          const api = getPuck();
          const selected = api.selectedItem;
          const newCanvas = createCanvasComponentData();
          if (selected?.type === 'tabs' || selected?.type === 'accordion') {
            const activeIdx =
              selected.type === 'tabs'
                ? getActiveTabIndex(selected.props.id)
                : getActiveAccordionIndex(selected.props.id);
            api.dispatch({
              type: 'setData',
              data: (previous) => ({
                ...previous,
                content: previous.content.map((section) => {
                  if (section.type !== selected.type || section.props.id !== selected.props.id) return section;
                  const items = Array.isArray(section.props.items)
                    ? (section.props.items as Array<{ title: string; openByDefault?: boolean; content: ComponentData[] }>)
                    : [];
                  const safeIdx = Math.min(activeIdx, Math.max(0, items.length - 1));
                  return {
                    ...section,
                    props: {
                      ...section.props,
                      items: items.map((tab, idx) =>
                        idx === safeIdx
                          ? { ...tab, content: [...(Array.isArray(tab.content) ? tab.content : []), newCanvas] }
                          : tab,
                      ),
                    },
                  };
                }),
              }),
            });
          } else {
            api.dispatch({
              type: 'setData',
              data: (previous) => ({
                ...previous,
                content: [...previous.content, newCanvas],
              }),
            });
          }
        }
      },
      options,
    );
    window.addEventListener('pointerdown', down, options);
    window.addEventListener('pointermove', move, options);
    window.addEventListener('pointerup', up, options);
    window.addEventListener('pointercancel', cancel, options);
    window.addEventListener('blur', cancel, options);
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          cancel();
          setPlacing(null);
          return;
        }
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLElement &&
          (active.isContentEditable ||
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT');
        if (isTyping) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            useEditor2Store.getState().redo();
          } else {
            useEditor2Store.getState().undo();
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          useEditor2Store.getState().redo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          const api = getPuck();
          const selected = api.selectedItem;
          if (!selected) return;
          const pos = api.getSelectorForId(selected.props.id);
          if (!pos) return;
          e.preventDefault();
          api.dispatch({ type: 'duplicate', sourceIndex: pos.index, sourceZone: pos.zone });
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const api = getPuck();
          const selected = api.selectedItem;
          if (!selected) return;
          const pos = api.getSelectorForId(selected.props.id);
          if (!pos) return;
          e.preventDefault();
          api.dispatch({ type: 'remove', index: pos.index, zone: pos.zone });
          api.dispatch({ type: 'setUi', ui: { itemSelector: null } });
        }
      },
      options,
    );
    return () => {
      events.abort();
      cancelAnimationFrame(selectionFrame);
      cancel();
    };
  }, [getPuck, host]);

  if (!placing) return null;
  const label = editor2PuckConfig.components[placing]?.label ?? placing;

  return (
    <div className="e2-placing-banner" role="status" aria-live="polite">
      <span className="e2-placing-banner__badge">
        <Crosshair size={14} aria-hidden="true" />
        <span>Dibujar {label}</span>
      </span>
      <span className="e2-placing-banner__hint">
        Haz clic y arrastra sobre las celdas de la cuadrícula para elegir dónde colocarlo y qué tamaño tendrá.
      </span>
      <button
        type="button"
        className="e2-button e2-button--quiet e2-placing-banner__cancel"
        onClick={() => setPlacing(null)}
      >
        <X size={13} aria-hidden="true" />
        <span>Cancelar</span>
      </button>
    </div>
  );
}
