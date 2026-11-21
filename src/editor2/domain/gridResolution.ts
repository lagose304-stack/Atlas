export const GRID_COLUMNS = 48;
export const GRID_MAX_ROW = 2000;
export const GRID_STEP = 0.5;
export const GRID_REFERENCE_MARKS = [1, 8, 16, 24, 32, 40, 48] as const;
export const GRID_DOTTED_MARK = 24;
export const GRID_DOTTED_LINE = GRID_DOTTED_MARK + 1;

// Las coordenadas guardadas siguen usando la cuadrícula original como unidad.
export const toGridLine = (position: number) => (position - 1) / GRID_STEP + 1;
export const fromGridLine = (line: number) => 1 + (line - 1) * GRID_STEP;
export const toGridSpan = (size: number) => size / GRID_STEP;
export const fromGridSpan = (cells: number) => cells * GRID_STEP;
