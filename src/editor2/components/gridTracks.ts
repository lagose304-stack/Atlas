import { GRID_COLUMNS, GRID_DOTTED_LINE, GRID_DOTTED_MARK, GRID_MAX_ROW, GRID_REFERENCE_MARKS } from '../domain/gridResolution';

function readPixels(value: string) {
  return parseFloat(value) || 0;
}

function readGap(value: string, extent: number) {
  return value.endsWith('%') ? readPixels(value) * extent / 100 : readPixels(value);
}

function readTracks(template: string) {
  return (template.match(/[\d.]+px/g) ?? []).map(readPixels);
}

function makeAxis(sizes: number[], gap: number, fallbackSize: number, padding: number, extent: number) {
  const offsets = [0];
  for (const size of sizes) offsets.push(offsets[offsets.length - 1] + size + gap);
  const last = offsets.length - 1;
  const pitch = fallbackSize + gap;
  const start = (index: number) => offsets[index] ?? offsets[last] + (index - last) * pitch;
  const end = (index: number) => start(index + 1) - gap;

  return {
    firstSize: sizes[0] ?? fallbackSize,
    padding,
    extent,
    start,
    end,
    cellAt(position: number) {
      const point = position - padding + gap / 2;
      const next = offsets.findIndex(offset => offset > point);
      return next < 0 ? offsets.length + Math.floor((point - offsets[last]) / pitch) : next;
    },
  };
}

export function readGridTracks(grid: HTMLElement) {
  const style = getComputedStyle(grid);
  if (style.display !== 'grid' || grid.parentElement?.dataset.flow === 'overlay') return;
  const width = grid.clientWidth;
  const height = grid.clientHeight;
  if (!width || !height) return;

  const left = readPixels(style.paddingLeft);
  const top = readPixels(style.paddingTop);
  const contentWidth = width - left - readPixels(style.paddingRight);
  const contentHeight = height - top - readPixels(style.paddingBottom);
  const columnSizes = readTracks(style.gridTemplateColumns);
  // El navegador puede conservar expresiones como min(7px, 1.25%) en column-gap.
  const columnGap = style.columnGap === 'normal' || style.columnGap === '0px'
    ? 0
    : columnSizes.length === GRID_COLUMNS
    ? Math.max(0, (contentWidth - columnSizes.reduce((sum, size) => sum + size, 0)) / (GRID_COLUMNS - 1))
    : readGap(style.columnGap, contentWidth);
  const rowGap = readGap(style.rowGap, contentHeight);
  const columnWidth = Math.max(1, (contentWidth - (GRID_COLUMNS - 1) * columnGap) / GRID_COLUMNS);
  const columns = makeAxis(columnSizes, columnGap, columnWidth, left, width);
  const minRowSize = readPixels(style.gridAutoRows.match(/^(?:minmax\()?([\d.]+px)/)?.[1] ?? '');
  const rows = makeAxis(readTracks(style.gridTemplateRows), rowGap, minRowSize || columns.firstSize || columnWidth, top, height);
  const availableWidth = width + readPixels(style.marginLeft) + readPixels(style.marginRight);
  return { columns, rows, availableWidth };
}

type Axis = ReturnType<typeof makeAxis>;
const referenceMarks = new Set<number>(GRID_REFERENCE_MARKS);

export function gridLinePosition(axis: Axis, line: number) {
  return axis.padding + axis.start(line - 1);
}

function guideGradient(axis: Axis, direction: 'right' | 'bottom', max: number) {
  const stops = [];
  let previousEnd = 0;
  for (let line = 1; line <= max; line++) {
    const start = gridLinePosition(axis, line);
    if (start >= axis.extent) break;
    if (line === GRID_DOTTED_LINE) continue;
    const end = Math.min(start + 1, axis.extent);
    if (start < previousEnd || end <= start) continue;
    const color = referenceMarks.has(line) && line !== GRID_DOTTED_MARK ? '--e2-guide-reference' : '--e2-guide-line';
    stops.push(`transparent ${start}px`, `var(${color}) ${start}px ${end}px`, `transparent ${end}px`);
    previousEnd = end;
  }
  return stops.length ? `linear-gradient(to ${direction}, ${stops.join(', ')})` : 'none';
}

export function gridGuideImage({ columns, rows }: NonNullable<ReturnType<typeof readGridTracks>>) {
  return `${guideGradient(columns, 'right', GRID_COLUMNS)}, ${guideGradient(rows, 'bottom', GRID_MAX_ROW)}`;
}
