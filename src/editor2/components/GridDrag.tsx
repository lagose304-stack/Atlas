import { useEffect, useRef, useState, type RefObject } from 'react';
import { Crosshair, X } from 'lucide-react';
import { useGetPuck, usePuck, type ComponentData } from '@puckeditor/core';
import {
  editor2PuckConfig,
  setActiveAccordionIndex,
  setActiveTabIndex,
} from './Editor2Blocks';
import type { LayoutIntent, SpanIntent } from '../domain/schema';
import { GRID_COLUMNS, GRID_MAX_ROW, fromGridLine, fromGridSpan, toGridSpan } from '../domain/gridResolution';
import { useEditor2Store } from '../store/editor2Store';
import { readGridTracks } from './gridTracks';
import { useGridGuides } from './useGridGuides';
import { EDITABLE_FIELD, EDIT_TEXT_REQUEST, setInlineEditMode } from './inlineEditMode';

type PlaceableBlock =
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
  | 'examCarousel'
  | 'box';
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'sw' | 'se';

type GridBox = {
  start: number;
  span: number;
  row: number;
  rowSpan: number;
};

const COMPACT_SIZES: Record<PlaceableBlock, { span: number; rowSpan: number }> = {
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
  box: { span: 12, rowSpan: 4 },
};

function isPlaceableBlock(name: string | undefined): name is PlaceableBlock {
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
    name === 'examCarousel' ||
    name === 'box'
  );
}

function isGridBlock(name: string | undefined): boolean {
  return isPlaceableBlock(name) || name === 'tabs' || name === 'accordion';
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

function getGridMetrics(grid: HTMLElement) {
  const tracks = readGridTracks(grid);
  const rect = grid.getBoundingClientRect();
  if (!tracks || !rect.width || !rect.height) return;
  return { ...tracks, rect, grid };
}

type GridMetrics = NonNullable<ReturnType<typeof getGridMetrics>>;

function pointToGridCell(metrics: GridMetrics, clientX: number, clientY: number): { col: number; row: number } {
  const { rect, grid, columns, rows } = metrics;
  const left = (clientX - rect.left) * grid.offsetWidth / rect.width - grid.clientLeft;
  const top = (clientY - rect.top) * grid.offsetHeight / rect.height - grid.clientTop;
  const col = clamp(columns.cellAt(left), 1, GRID_COLUMNS);
  const row = clamp(rows.cellAt(top), 1, GRID_MAX_ROW);
  return { col, row };
}

function getBlockBox(metrics: GridMetrics, blockEl: HTMLElement): GridBox {
  const blockRect = blockEl.getBoundingClientRect();
  const style = getComputedStyle(blockEl);
  const topLeft = pointToGridCell(metrics, blockRect.left + 0.5, blockRect.top + 0.5);
  const bottomRight = pointToGridCell(
    metrics,
    Math.max(blockRect.left + 0.5, blockRect.right - 0.5),
    Math.max(blockRect.top + 0.5, blockRect.bottom - 0.5),
  );
  const columnSpan = Number(style.gridColumnEnd.match(/^span (\d+)$/)?.[1]);
  const span = clamp(columnSpan || bottomRight.col - topLeft.col + 1, 1, GRID_COLUMNS);
  const start = clamp(Number(style.gridColumnStart) || topLeft.col, 1, GRID_COLUMNS + 1 - span);
  const row = Number(style.gridRowStart) || topLeft.row;
  const measuredRowSpan = Math.max(1, bottomRight.row - row + 1);
  const rowSpan = clamp(Number(style.gridRowEnd.match(/^span (\d+)$/)?.[1]) || measuredRowSpan, 1, GRID_COLUMNS);
  return { start, span, row, rowSpan };
}

function applyBoxToLayout(grid: HTMLElement, layout: LayoutIntent, box: GridBox): LayoutIntent {
  const key = getActiveBreakpoint(grid, layout);
  const intent = getEffectiveIntent(grid, layout);
  const placement = {
    start: fromGridLine(box.start),
    span: fromGridSpan(box.span),
    row: fromGridLine(box.row),
    rowSpan: fromGridSpan(box.rowSpan),
  };
  const next: SpanIntent = { ...intent, ...placement };
  if (key === 'base') {
    return {
      base: next,
      ...(layout.md ? { md: { ...layout.md, ...placement } } : {}),
      ...(layout.lg ? { lg: { ...layout.lg, ...placement } } : {}),
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
  const start = clamp(box.start, 1, GRID_COLUMNS);
  const span = clamp(box.span, 1, GRID_COLUMNS + 1 - start);
  const row = clamp(box.row, 1, GRID_MAX_ROW);
  const rowSpan = clamp(box.rowSpan, 1, GRID_COLUMNS);
  const nextLayout = applyBoxToLayout(grid, layout, { start, span, row, rowSpan });
  const { columns, rows } = metrics;
  const left = columns.padding + columns.start(start - 1);
  const top = rows.padding + rows.start(row - 1);
  const width = columns.end(start + span - 2) - columns.start(start - 1);
  const height = rows.end(row + rowSpan - 2) - rows.start(row - 1);
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

function createTabsComponentData(): ComponentData {
  return {
    type: 'tabs',
    props: {
      ...editor2PuckConfig.components.tabs.defaultProps,
      id: `tabs-${crypto.randomUUID()}`,
      items: [
        {
          title: 'Sección 1',
          content: [],
        },
        {
          title: 'Sección 2',
          content: [],
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
          content: [],
        },
        {
          title: 'Sección desplegable 2',
          openByDefault: false,
          content: [],
        },
      ],
    },
  };
}

function findExistingLeaf(sections: ComponentData[], leafId: string): ComponentData | undefined {
  for (const section of sections) {
    if (section.props.id === leafId) return section;
    if ((section.type === 'canvas' || section.type === 'box') && Array.isArray(section.props.content)) {
      const children = section.props.content as ComponentData[];
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

function canPlaceBlock(item: ComponentData, grid: HTMLElement): boolean {
  if (grid.closest(`[data-puck-component="${item.props.id}"]`)) return false;
  const parentBox = grid.closest('[data-e2-block="box"]');
  if (item.type === 'tabs' || item.type === 'accordion') {
    return !parentBox && !grid.closest('.e2-tabs-slot');
  }
  if (item.type === 'box' && parentBox) {
    return !parentBox.parentElement?.closest('[data-e2-block="box"]') &&
      !item.props.content?.some((child: ComponentData) => child.type === 'box');
  }
  return true;
}

const ROOT_GRID_ID = 'root';

function panelGridId(blockId: string, index: number | string): string {
  return `${blockId}:panel:${index}`;
}

function getGridParent(grid: HTMLElement): string | undefined {
  const parent = grid.parentElement;
  if (parent?.hasAttribute('data-e2-canvas-root')) return ROOT_GRID_ID;
  const panel = parent?.dataset.e2PanelIndex;
  if (panel !== undefined) {
    const id = parent?.closest<HTMLElement>('[data-puck-component]')?.dataset.puckComponent;
    return id ? panelGridId(id, panel) : undefined;
  }
  return grid.closest<HTMLElement>('[data-e2-block="box"], [data-e2-block="canvas"]')?.dataset.puckComponent;
}

function updateCanvasChildren(
  sections: ComponentData[],
  parentId: string,
  leafId: string,
  placed: ComponentData,
  gridId = ROOT_GRID_ID,
): ComponentData[] {
  const destination = gridId === parentId;
  let replaced = false;
  const next = sections.flatMap((section) => {
    if (section.props.id === leafId) {
      if (!destination) return [];
      replaced = true;
      return [placed];
    }
    if (section.type === 'canvas' || section.type === 'box') {
      const children: ComponentData[] = Array.isArray(section.props.content) ? section.props.content : [];
      return [{ ...section, props: {
        ...section.props,
        content: updateCanvasChildren(children, parentId, leafId, placed, section.props.id),
      } }];
    }
    if ((section.type === 'tabs' || section.type === 'accordion') && Array.isArray(section.props.items)) {
      const items = section.props.items as Array<{ content?: ComponentData[] }>;
      return [{ ...section, props: {
        ...section.props,
        items: items.map((panel, index) => ({
          ...panel,
          content: updateCanvasChildren(
            Array.isArray(panel.content) ? panel.content : [],
            parentId, leafId, placed, panelGridId(section.props.id, index),
          ),
        })),
      } }];
    }
    return [section];
  });
  if (destination && !replaced) next.push(placed);
  return next;
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

function createPlaceableComponentData(leaf: PlaceableBlock): ComponentData {
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
      leaf: PlaceableBlock;
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
      leaf: PlaceableBlock;
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
      block: HTMLElement;
      box: GridBox;
      grabCol: number;
      grabRow: number;
      offsetX: number;
      offsetY: number;
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

function markSelectedBlock(shell: HTMLElement, id: string | null) {
  for (const block of shell.querySelectorAll<HTMLElement>('[data-e2-selected]')) {
    if (block.dataset.puckComponent !== id) block.removeAttribute('data-e2-selected');
  }
  if (id) shell.querySelector(`.e2-slot-grid > [data-puck-component="${id}"]`)?.setAttribute('data-e2-selected', 'true');
}

export default function GridDrag({ host }: { host: RefObject<HTMLDivElement> }) {
  useGridGuides(host);
  const getPuck = useGetPuck();
  const { selectedItem } = usePuck();
  const selectedId = typeof selectedItem?.props?.id === 'string' ? selectedItem.props.id : null;
  const [placing, setPlacing] = useState<PlaceableBlock | null>(null);
  const placingRef = useRef<PlaceableBlock | null>(null);
  placingRef.current = placing;

  useEffect(() => {
    const shell = host.current?.closest<HTMLElement>('.e2-puck-shell');
    if (!shell) return;
    markSelectedBlock(shell, selectedId);
  }, [host, selectedId]);

  useEffect(() => {
    const shell = host.current?.closest<HTMLElement>('.e2-puck-shell');
    if (!shell) return;
    if (placing) {
      shell.setAttribute('data-placing-tool', placing);
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
    let textSelectionFrame = 0;
    let textEdit: { block: HTMLElement; field: HTMLElement; focusScope: HTMLElement } | null = null;
    const editObserver = new MutationObserver(() => {
      if (textEdit && !textEdit.field.isConnected) stopTextEditing(textEdit.block.isConnected);
    });

    function focusBlock(block: HTMLElement) {
      block.tabIndex = -1;
      block.focus({ preventScroll: true });
    }

    function selectBlock(block: HTMLElement, moveFocus = false, keepPosition = false) {
      const blockId = block.dataset.puckComponent;
      const api = getPuck();
      const selector = blockId && api.getSelectorForId(blockId);
      const current = api.appState.ui.itemSelector;
      if (selector && (current?.index !== selector.index || current.zone !== selector.zone)) {
        const top = keepPosition ? block.getBoundingClientRect().top : undefined;
        api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
        if (top !== undefined) {
          cancelAnimationFrame(textSelectionFrame);
          textSelectionFrame = requestAnimationFrame(() => {
            if (!block.isConnected || getPuck().selectedItem?.props.id !== blockId) return;
            markSelectedBlock(shell!, blockId ?? null);
            const shift = block.getBoundingClientRect().top - top;
            if (Math.abs(shift) > 0.5) window.scrollBy({ top: shift, behavior: 'instant' });
          });
        }
      }
      if (selector) markSelectedBlock(shell!, blockId ?? null);
      if (moveFocus) focusBlock(block);
    }

    function stopTextEditing(restoreFocus = false) {
      if (!textEdit) return;
      const { block, field, focusScope } = textEdit;
      textEdit = null;
      editObserver.disconnect();
      block.removeAttribute('data-e2-text-editing');
      shell?.removeAttribute('data-e2-text-editing');
      if (restoreFocus) focusBlock(block);
      else if (focusScope.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      setInlineEditMode(field, false);
    }

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

    function slotAtPoint(clientX: number, clientY: number, movingBlock?: HTMLElement) {
      return document
        .elementsFromPoint(clientX, clientY)
        .map((el) => el.closest<HTMLElement>('.e2-slot-grid'))
        .find((slot): slot is HTMLElement => Boolean(
          slot && shell?.contains(slot) && !movingBlock?.contains(slot),
        ));
    }

    function flowTargetAtPoint(x: number, y: number, item: ComponentData) {
      const slot = slotAtPoint(x, y);
      if (!slot?.parentElement?.dataset.flow || !canPlaceBlock(item, slot)) return;
      return slot.closest<HTMLElement>('[data-puck-component]')?.dataset.puckComponent;
    }

    function findGridAtPoint(clientX: number, clientY: number, movingBlock?: HTMLElement) {
      const grid = slotAtPoint(clientX, clientY, movingBlock);
      if (!grid) return undefined;
      const parent = getGridParent(grid);
      const metrics = getGridMetrics(grid);
      if (!parent || !metrics) return undefined;
      return { grid, parent, metrics };
    }

    function startTextEditing(block: HTMLElement, point?: MouseEvent) {
      const pointedField = point?.target instanceof Element ? point.target.closest<HTMLElement>(EDITABLE_FIELD) : null;
      const field = pointedField ?? Array.from(block.querySelectorAll<HTMLElement>(EDITABLE_FIELD))
        .find(candidate => candidate.closest('[data-puck-component]') === block);
      if (!field || !block.contains(field)) return false;
      if (textEdit?.field === field) return true;
      stopTextEditing();
      selectBlock(block, false, Boolean(point));
      const focusScope = field.closest<HTMLElement>('.e2-rich-host') ?? field;
      textEdit = { block, field, focusScope };
      editObserver.observe(shell!, { childList: true, subtree: true });
      block.setAttribute('data-e2-text-editing', '');
      shell?.setAttribute('data-e2-text-editing', '');
      setInlineEditMode(field, true);
      field.focus({ preventScroll: Boolean(point) });
      const selection = window.getSelection();
      if (!selection) return true;
      const docWithCaret = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const clickedRange = point && docWithCaret.caretRangeFromPoint?.(point.clientX, point.clientY);
      const range = clickedRange && field.contains(clickedRange.startContainer) ? clickedRange : document.createRange();
      if (range !== clickedRange) {
        range.selectNodeContents(field);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }

    function commitPlacement(
      item: ComponentData,
      parentId: string,
      layout: LayoutIntent,
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
      });
    }

    function computeSessionHit(e: PointerEvent) {
      if (!drag) return undefined;

      if (drag.kind === 'draw') {
        const metrics = getGridMetrics(drag.grid);
        if (!metrics) return undefined;
        const curr = pointToGridCell(metrics, e.clientX, e.clientY);
        const compact = COMPACT_SIZES[drag.leaf];
        const compactSpan = toGridSpan(compact.span);
        const box: GridBox = drag.moved
          ? {
              start: Math.min(drag.anchor.col, curr.col),
              span: Math.abs(curr.col - drag.anchor.col) + 1,
              row: Math.min(drag.anchor.row, curr.row),
              rowSpan: Math.abs(curr.row - drag.anchor.row) + 1,
            }
          : {
              start: clamp(drag.anchor.col, 1, GRID_COLUMNS + 1 - compactSpan),
              span: compactSpan,
              row: drag.anchor.row,
              rowSpan: toGridSpan(compact.rowSpan),
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

        if (drag.dir.includes('e')) endCol = clamp(curr.col, startCol, GRID_COLUMNS);
        if (drag.dir.includes('w')) startCol = clamp(curr.col, 1, endCol);
        if (drag.dir.includes('s')) endRow = clamp(curr.row, startRow, startRow + GRID_COLUMNS - 1);
        if (drag.dir.includes('n')) startRow = clamp(curr.row, Math.max(1, endRow - GRID_COLUMNS + 1), endRow);

        const box: GridBox = {
          start: startCol,
          span: endCol - startCol + 1,
          row: startRow,
          rowSpan: endRow - startRow + 1,
        };
        const area = computeDropArea(drag.grid, metrics, drag.item.props.layout, box);
        return { grid: drag.grid, parent: drag.parent, area };
      }

      const x = e.clientX + (drag.kind === 'move' ? drag.offsetX : 0);
      const y = e.clientY + (drag.kind === 'move' ? drag.offsetY : 0);
      const found = findGridAtPoint(x, y, drag.kind === 'move' ? drag.block : undefined);
      if (!found) return undefined;
      const { grid, parent, metrics } = found;
      const curr = pointToGridCell(metrics, x, y);

      if (drag.kind === 'drawer') {
        if (!canPlaceBlock(drag.item, grid)) return undefined;
        const compact = COMPACT_SIZES[drag.leaf];
        const span = toGridSpan(compact.span);
        const start = clamp(curr.col, 1, GRID_COLUMNS + 1 - span);
        const box: GridBox = {
          start,
          span,
          row: curr.row,
          rowSpan: toGridSpan(compact.rowSpan),
        };
        const labelPrefix = editor2PuckConfig.components[drag.leaf]?.label ?? drag.leaf;
        const area = computeDropArea(grid, metrics, drag.item.props.layout, box, labelPrefix);
        return { grid, parent, area };
      }

      if (drag.kind === 'move') {
        if (!canPlaceBlock(drag.item, grid)) return undefined;
        const span = clamp(drag.box.span, 1, GRID_COLUMNS);
        const start = clamp(curr.col - drag.grabCol, 1, GRID_COLUMNS + 1 - span);
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
      if (e.target.closest('.e2-text-color-control')) return;

      const drawer = e.target.closest('[data-puck-drawer-item]')?.getAttribute('data-testid')?.split(':')[1];
      if (isPlaceableBlock(drawer)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        drag = {
          kind: 'drawer',
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          leaf: drawer,
          item: createPlaceableComponentData(drawer),
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
        const item = createPlaceableComponentData(placingRef.current);
        const flowTarget = flowTargetAtPoint(e.clientX, e.clientY, item);
        if (flowTarget) {
          e.stopImmediatePropagation();
          e.preventDefault();
          ignoreClick = true;
          setPlacing(null);
          clearHighlight();
          commitPlacement(item, flowTarget, item.props.layout);
          return;
        }
        const found = findGridAtPoint(e.clientX, e.clientY);
        if (found && canPlaceBlock(item, found.grid)) {
          e.stopImmediatePropagation();
          e.preventDefault();
          const leaf = placingRef.current;
          const anchor = pointToGridCell(found.metrics, e.clientX, e.clientY);
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
      const editable = e.target.closest<HTMLElement>(EDITABLE_FIELD);
      if (textEdit) {
        if (textEdit.focusScope.contains(e.target) && !resizeHandle && !moveHandle) return;
        stopTextEditing();
      }

      if (e.target.closest('[data-puck-overlay]') && !moveHandle) {
        return;
      }

      if (
        e.target.closest(
          '.e2-carousel-nav, .e2-carousel-dot, .e2-exam-head__nav, .e2-tabs-nav__btn, .e2-tabs-nav__add, .e2-accordion-trigger, .e2-compare-range, .e2-section-delete',
        )
      ) {
        return;
      }

      const blockSelector = '.e2-slot-grid > [data-puck-component]';
      let block: HTMLElement | null | undefined;
      if (moveHandle) {
        const selected = getPuck().selectedItem;
        if (!selected || !isGridBlock(selected.type)) return;
        block = shell.querySelector<HTMLElement>(
          `${blockSelector}[data-puck-component="${CSS.escape(selected.props.id)}"]`,
        );
      } else {
        block = e.target.closest<HTMLElement>(blockSelector) ?? document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>(blockSelector))
          .find((el): el is HTMLElement => Boolean(el && shell.contains(el)));
      }
      if (!block?.dataset.puckComponent || !isGridBlock(block.dataset.e2Block)) return;

      const existing = getPuck().getItemById(block.dataset.puckComponent);
      if (!existing) return;
      const grid = block.closest<HTMLElement>('.e2-slot-grid');
      const parent = grid ? getGridParent(grid) : undefined;
      const metrics = grid ? getGridMetrics(grid) : undefined;
      if (!grid || !parent || !metrics) {
        if (editable && !resizeHandle && !moveHandle) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }

      const box = getBlockBox(metrics, block);

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

      const rect = block.getBoundingClientRect();
      const grabX = moveHandle ? clamp(e.clientX, rect.left + 0.5, rect.right - 0.5) : e.clientX;
      const grabY = moveHandle ? clamp(e.clientY, rect.top + 0.5, rect.bottom - 0.5) : e.clientY;
      const pointerCell = pointToGridCell(metrics, grabX, grabY);
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
        block,
        box,
        grabCol,
        grabRow,
        offsetX: grabX - e.clientX,
        offsetY: grabY - e.clientY,
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
          !gridHit.grid.closest('.e2-tabs-slot, [data-e2-block="box"]') &&
          e.clientY > gridHit.metrics.rect.top + 22 &&
          e.clientY < gridHit.metrics.rect.bottom - 28;
        if (insideGridBody && gridHit) {
          const curr = pointToGridCell(gridHit.metrics, e.clientX, e.clientY);
          const span = 12;
          const rowSpan = 6;
          const start = clamp(curr.col, 1, GRID_COLUMNS + 1 - toGridSpan(span));
          const area = computeDropArea(
            gridHit.grid,
            gridHit.metrics,
            { base: { span, rowSpan } },
            { start, span: toGridSpan(span), row: curr.row, rowSpan: toGridSpan(rowSpan) },
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
          !gridHit.grid.closest('.e2-tabs-slot, [data-e2-block="box"]') &&
          e.clientY > gridHit.metrics.rect.top + 22 &&
          e.clientY < gridHit.metrics.rect.bottom - 28;
        if (insideGridBody && gridHit) {
          const curr = pointToGridCell(gridHit.metrics, e.clientX, e.clientY);
          const span = 12;
          const rowSpan = 6;
          const start = clamp(curr.col, 1, GRID_COLUMNS + 1 - toGridSpan(span));
          const area = computeDropArea(
            gridHit.grid,
            gridHit.metrics,
            { base: { span, rowSpan } },
            { start, span: toGridSpan(span), row: curr.row, rowSpan: toGridSpan(rowSpan) },
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
        const flowTarget = session.moved && flowTargetAtPoint(e.clientX, e.clientY, session.item);
        if (flowTarget) {
          setPlacing(null);
          commitPlacement(session.item, flowTarget, session.item.props.layout);
        } else if (session.moved && hit) {
          setPlacing(null);
          commitPlacement(session.item, hit.parent, hit.area.layout);
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
          commitPlacement(nextItem, hit.parent, hit.area.layout);
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

          commitPlacement(session.item, hit.parent, nextLayout, extraProps);
        }
        return;
      }

      if (session.kind === 'move') {
        if (session.moved && hit) {
          commitPlacement(session.item, hit.parent, hit.area.layout);
        } else {
          const block = shell?.querySelector<HTMLElement>(`[data-puck-component="${session.item.props.id}"]`);
          if (block) selectBlock(block, true, true);
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
            (count) => ({ title: `Sección ${count + 1}`, content: [] }),
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
              content: [],
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
    shell.addEventListener('dblclick', (event) => {
      if (!(event.target instanceof Element) || textEdit?.focusScope.contains(event.target)) return;
      if (event.target.closest('button, input, select, textarea, .e2-resize-handles, .e2-puck-actionbar')) return;
      const block = event.target.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]');
      if (!block || !startTextEditing(block, event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, options);
    shell.addEventListener(EDIT_TEXT_REQUEST, () => {
      const id = getPuck().selectedItem?.props.id;
      const block = id && shell.querySelector<HTMLElement>(`[data-puck-component="${id}"]`);
      if (block) startTextEditing(block);
    }, { signal: events.signal });
    shell.addEventListener('focusout', () => {
      const current = textEdit;
      queueMicrotask(() => {
        if (current && textEdit === current && !current.focusScope.contains(document.activeElement)) stopTextEditing();
      });
    }, { signal: events.signal });
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
        const editable = e.target.closest(EDITABLE_FIELD);
        if (editable && !textEdit?.focusScope.contains(editable)) {
          const textBlock = editable.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]');
          if (textBlock) {
            e.preventDefault();
            e.stopImmediatePropagation();
            selectBlock(textBlock, true, true);
            return;
          }
        }
        const layer = e.target.closest<HTMLElement>('.e2-slot-grid > [data-puck-component]');
        if (!layer && e.target.closest('.e2-canvas-stage--editing') &&
          !e.target.closest('[data-puck-component], [data-puck-overlay], button, a, input, select, textarea')) {
          const api = getPuck();
          if (api.appState.ui.itemSelector) {
            stopTextEditing();
            api.dispatch({ type: 'setUi', ui: { itemSelector: null } });
          }
          return;
        }
        if (layer?.parentElement?.parentElement?.dataset.flow === 'overlay' &&
          !e.target.closest('button, a, input, select, textarea')) {
          const api = getPuck();
          const selector = api.getSelectorForId(layer.dataset.puckComponent!);
          if (selector) {
            e.stopImmediatePropagation();
            api.dispatch({ type: 'setUi', ui: { itemSelector: selector } });
            return;
          }
        }
      },
      options,
    );
    window.addEventListener('pointerdown', down, options);
    window.addEventListener('pointermove', move, options);
    window.addEventListener('pointerup', up, options);
    window.addEventListener('pointercancel', (event) => {
      if (drag?.pointer === event.pointerId) cancel();
    }, options);
    // Blurring a focused block at the start of a drag must not cancel the gesture.
    window.addEventListener('blur', cancel, { signal: events.signal });
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          if (e.target instanceof Element && e.target.closest('.e2-color-palette')) return;
          if (textEdit) {
            e.preventDefault();
            e.stopImmediatePropagation();
            stopTextEditing(true);
            return;
          }
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
        if ((e.key === 'Enter' || e.key === 'F2') && active instanceof HTMLElement && shell.contains(active) &&
            active.dataset.puckComponent && active.dataset.puckComponent === getPuck().selectedItem?.props.id &&
            startTextEditing(active)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

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
      stopTextEditing();
      cancelAnimationFrame(textSelectionFrame);
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
