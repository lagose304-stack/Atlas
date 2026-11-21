import { useRef, useState, type PointerEvent } from 'react';
import type { SpanIntent } from '../domain/schema';
import { GRID_COLUMNS, GRID_MAX_ROW, GRID_REFERENCE_MARKS, fromGridLine, fromGridSpan, toGridLine, toGridSpan } from '../domain/gridResolution';

type Cell = { column: number; row: number };

function areaBetween(a: Cell, b: Cell): SpanIntent {
  return {
    start: fromGridLine(Math.min(a.column, b.column)),
    row: fromGridLine(Math.min(a.row, b.row)),
    span: fromGridSpan(Math.abs(a.column - b.column) + 1),
    rowSpan: fromGridSpan(Math.abs(a.row - b.row) + 1),
  };
}

export function GridAreaPicker({ intent, onChange }: {
  intent: SpanIntent;
  onChange: (next: SpanIntent) => void;
}) {
  const anchor = useRef<Cell | null>(null);
  const [draft, setDraft] = useState<SpanIntent | null>(null);
  const area = draft ?? intent;
  const firstRow = Math.min(GRID_MAX_ROW - GRID_COLUMNS + 1, 1 + GRID_COLUMNS * Math.floor((toGridLine(intent.row ?? 1) - 1) / GRID_COLUMNS));
  const start = area.start === undefined ? undefined : toGridLine(area.start);
  const row = area.row === undefined ? undefined : toGridLine(area.row);
  const span = toGridSpan(area.span);
  const rowSpan = area.rowSpan === undefined ? undefined : toGridSpan(area.rowSpan);

  function cellAt(event: PointerEvent<HTMLDivElement>): Cell {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = (fraction: number) => Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor(fraction * GRID_COLUMNS)));
    return {
      column: 1 + index((event.clientX - bounds.left) / bounds.width),
      row: firstRow + index((event.clientY - bounds.top) / bounds.height),
    };
  }

  function reset() {
    anchor.current = null;
    setDraft(null);
  }

  return (
    <div className="e2-area-picker">
      <small>Arrastra para marcar el área</small>
      <div className="e2-area-chart">
      <div className="e2-area-columns" aria-hidden="true">
        {GRID_REFERENCE_MARKS.map(i => <span key={i} style={{ gridColumn: i }}>{i}</span>)}
      </div>
      <div className="e2-area-rows" aria-hidden="true">
        {GRID_REFERENCE_MARKS.map(i => <span key={i} style={{ gridRow: i }}>{firstRow + i - 1}</span>)}
      </div>
      <div className="e2-area-map" aria-hidden="true"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          anchor.current = cellAt(event);
          setDraft(areaBetween(anchor.current, anchor.current));
        }}
        onPointerMove={(event) => {
          if (anchor.current && event.isPrimary) setDraft(areaBetween(anchor.current, cellAt(event)));
        }}
        onPointerUp={(event) => {
          if (!anchor.current || !event.isPrimary) return;
          onChange({ ...intent, ...areaBetween(anchor.current, cellAt(event)) });
          reset();
        }}
        onLostPointerCapture={reset}
        onPointerCancel={reset}
      >
        <span style={{
          gridColumn: `${start ?? 1} / span ${span}`,
          gridRow: `${(row ?? firstRow) - firstRow + 1} / span ${Math.min(rowSpan ?? 1, firstRow + GRID_COLUMNS - (row ?? firstRow))}`,
        }} />
      </div>
      </div>
      <small className="e2-area-readout">
        {start ? `Columnas ${start}–${start + span - 1}` : 'Columna automática'}
        {' · '}
        {row ? `Fila ${row}${rowSpan ? `–${row + rowSpan - 1}` : ''}` : 'Fila automática'}
        {' · '}{span} × {rowSpan ?? 'auto'}
      </small>
    </div>
  );
}
