import { useId, useState, type RefObject } from 'react';
import { usePuck } from '@puckeditor/core';
import { Minus, Plus } from 'lucide-react';
import { GRID_MAX_ROW } from '../domain/gridResolution';

const ROW_STEP = 8;

function visibleRows(grid: HTMLElement | null | undefined) {
  if (!grid) return 1;
  const style = getComputedStyle(grid);
  const tracks = (style.gridTemplateRows.match(/[\d.]+px/g) ?? []).map(parseFloat);
  const rowHeight = parseFloat(style.gridTemplateColumns);
  const trackHeight = tracks.reduce((sum, height) => sum + height, 0);
  const emptyHeight = Math.max(0, grid.clientHeight - trackHeight);
  return tracks.length + (rowHeight > 0 ? Math.floor(emptyHeight / rowHeight) : 0);
}

export default function CanvasRowControls({
  host,
  minRows,
}: {
  host: RefObject<HTMLDivElement>;
  minRows?: number;
}) {
  const { dispatch } = usePuck();
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = useId();

  function updateRows(value: number | undefined) {
    if (minRows === value) return;
    dispatch({
      type: 'setData',
      data: previous => ({
        ...previous,
        root: { ...previous.root, props: { ...previous.root.props, minRows: value } },
      }),
    });
  }

  function adjustRows(delta: number) {
    const grid = host.current?.querySelector<HTMLElement>('[data-e2-canvas-root] > .e2-slot-grid');
    const current = minRows === undefined || delta > 0
      ? Math.max(minRows ?? 0, visibleRows(grid))
      : minRows;
    const next = Math.max(1, Math.min(GRID_MAX_ROW, current + delta));
    updateRows(next);
  }

  function commitDraft() {
    if (draft === null) return;
    const trimmed = draft.trim();
    const rows = Number(trimmed);
    if (!trimmed || rows === 0) updateRows(undefined);
    else if (Number.isInteger(rows) && rows > 0 && rows <= GRID_MAX_ROW) updateRows(rows);
    setDraft(null);
  }

  return (
    <div className="e2-canvas-row-tools" role="group" aria-label="Altura del lienzo">
      <label>
        Filas mínimas
        <input
          type="number"
          min={0}
          max={GRID_MAX_ROW}
          step={1}
          placeholder="Automática"
          value={draft ?? minRows ?? ''}
          aria-describedby={hintId}
          onChange={event => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(null);
          }}
        />
      </label>
      <div className="e2-canvas-row-tools__actions">
        <button type="button" className="e2-button e2-button--quiet" disabled={minRows === 1} onClick={() => adjustRows(-ROW_STEP)}>
          <Minus size={14} aria-hidden="true" />
          Quitar 8 filas
        </button>
        <button type="button" className="e2-button e2-button--quiet" disabled={minRows === 1} onClick={() => adjustRows(-1)}>
          <Minus size={14} aria-hidden="true" />
          Quitar 1 fila
        </button>
        <button type="button" className="e2-button e2-button--quiet" disabled={minRows === GRID_MAX_ROW} onClick={() => adjustRows(1)}>
          <Plus size={14} aria-hidden="true" />
          Añadir 1 fila
        </button>
        <button type="button" className="e2-button e2-button--quiet" disabled={minRows === GRID_MAX_ROW} onClick={() => adjustRows(ROW_STEP)}>
          <Plus size={14} aria-hidden="true" />
          Añadir 8 filas
        </button>
      </div>
      <small id={hintId}>La altura se aplica a la página pública. El lienzo crece si el contenido ocupa más filas.</small>
    </div>
  );
}
