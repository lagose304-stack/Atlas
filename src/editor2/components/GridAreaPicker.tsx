import { useRef, useState, type PointerEvent } from 'react';
import type { SpanIntent } from '../domain/schema';

type Cell = { column: number; row: number };
const ticks = Array.from({ length: 24 }, (_, index) => index);

export function areaBetween(a: Cell, b: Cell): SpanIntent {
  return {
    start: Math.min(a.column, b.column),
    row: Math.min(a.row, b.row),
    span: Math.abs(a.column - b.column) + 1,
    rowSpan: Math.abs(a.row - b.row) + 1,
  };
}

export function GridAreaPicker({ intent, onChange }: {
  intent: SpanIntent;
  onChange: (next: SpanIntent) => void;
}) {
  const anchor = useRef<Cell | null>(null);
  const [draft, setDraft] = useState<SpanIntent | null>(null);
  const area = draft ?? intent;
  const firstRow = Math.min(977, 1 + 24 * Math.floor(((intent.row ?? 1) - 1) / 24));

  function cellAt(event: PointerEvent<HTMLDivElement>): Cell {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = (fraction: number) => Math.max(0, Math.min(23, Math.floor(fraction * 24)));
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
        {ticks.map(i => <span key={i}>{i + 1}</span>)}
      </div>
      <div className="e2-area-rows" aria-hidden="true">
        {ticks.map(i => <span key={i}>{firstRow + i}</span>)}
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
          gridColumn: `${area.start ?? 1} / span ${area.span}`,
          gridRow: `${(area.row ?? firstRow) - firstRow + 1} / span ${Math.min(area.rowSpan ?? 1, firstRow + 24 - (area.row ?? firstRow))}`,
        }} />
      </div>
      </div>
      <small className="e2-area-readout">
        {area.start ? `Columnas ${area.start}–${area.start + area.span - 1}` : 'Columna automática'}
        {' · '}
        {area.row ? `Fila ${area.row}${area.rowSpan ? `–${area.row + area.rowSpan - 1}` : ''}` : 'Fila automática'}
        {' · '}{area.span} × {area.rowSpan ?? 'auto'}
      </small>
    </div>
  );
}
