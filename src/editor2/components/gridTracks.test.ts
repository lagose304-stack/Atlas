import { describe, expect, it, vi } from 'vitest';
import { GRID_DOTTED_MARK } from '../domain/gridResolution';
import { gridGuideImage, gridLinePosition, readGridTracks } from './gridTracks';

describe('medidas de la cuadrícula del editor', () => {
  it('usa los bordes reales con filas desiguales y un hueco porcentual', () => {
    const grid = document.createElement('div');
    Object.defineProperties(grid, {
      clientWidth: { value: 578 },
      clientHeight: { value: 100 },
    });
    const computed = {
      display: 'grid',
      paddingLeft: '2px',
      paddingRight: '2px',
      paddingTop: '3px',
      paddingBottom: '0px',
      columnGap: 'min(7px, 1.25%)',
      rowGap: '5px',
      gridTemplateColumns: Array(48).fill('10px').join(' '),
      gridTemplateRows: '20px 40px 15px',
      gridAutoRows: 'minmax(15px, auto)',
    } as CSSStyleDeclaration;
    const style = vi.spyOn(window, 'getComputedStyle').mockReturnValue(computed);

    try {
      const tracks = readGridTracks(grid)!;
      expect(tracks.columns.start(2)).toBe(24);
      expect(tracks.columns.end(2)).toBe(34);
      expect(tracks.rows.start(2)).toBe(70);
      expect(tracks.rows.end(2)).toBe(85);
      expect(tracks.rows.cellAt(74)).toBe(3);
      const guides = gridGuideImage(tracks);
      expect(guides).toContain('var(--e2-guide-line) 26px 27px');
      expect(guides).toContain('var(--e2-guide-line) 73px 74px');
      const [columnGuides] = guides.split('), linear-gradient');
      expect(columnGuides.match(/var\(--e2-guide-(?:line|reference)\)/g)).toHaveLength(47);
      expect(columnGuides.match(/var\(--e2-guide-reference\)/g)).toHaveLength(6);
      const mark24 = gridLinePosition(tracks.columns, GRID_DOTTED_MARK);
      expect(mark24).toBe(278);
      expect(mark24 - gridLinePosition(tracks.columns, 16)).toBe(8 * 12);
      expect(gridLinePosition(tracks.columns, 32) - mark24).toBe(8 * 12);
      expect(columnGuides).not.toContain('278px 279px');
      expect(columnGuides).toContain('var(--e2-guide-line) 290px 291px');
      expect(columnGuides).not.toContain('var(--e2-guide-line) 35px 36px');

      style.mockReturnValue({ ...computed, columnGap: 'normal', rowGap: 'normal' });
      const contiguous = readGridTracks(grid)!;
      expect(contiguous.columns.end(2)).toBe(contiguous.columns.start(3));
      expect(contiguous.rows.end(1)).toBe(contiguous.rows.start(2));
    } finally {
      style.mockRestore();
    }
  });
});
