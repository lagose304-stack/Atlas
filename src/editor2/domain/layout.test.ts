import { describe, expect, it } from 'vitest';
import { createLayoutIntent, createSpanIntent } from './defaults';
import { gridColumnValue, layoutClassList, layoutClasses, spanClass, startClass } from './layout';

describe('layout', () => {
  it('genera clases deterministas por breakpoint', () => {
    expect(spanClass('base', 6)).toBe('e2-span-base-6');
    expect(startClass('lg', 3)).toBe('e2-start-lg-3');
  });

  it('devuelve solo el breakpoint base cuando no hay overriding', () => {
    const layout = createLayoutIntent(8);

    expect(layoutClassList(layout)).toEqual(['e2-span-base-8']);
    expect(layoutClasses(layout)).toBe('e2-span-base-8');
  });

  it('incluye spans y starts explícitos en el orden base, md, lg', () => {
    const layout = {
      base: { span: 12 },
      md: { span: 6, start: 2 },
      lg: { span: 4 },
    };

    expect(layoutClassList(layout)).toEqual([
      'e2-span-base-12',
      'e2-span-md-6',
      'e2-start-md-2',
      'e2-span-lg-4',
    ]);
  });

  it('informa auto-placement cuando no hay start', () => {
    expect(gridColumnValue(createSpanIntent(6))).toBe('auto / span 12');
  });

  it('conserva la posición de cuadrícula junto al anclaje de la capa', () => {
    expect(layoutClassList({ base: { span: 8, start: 3, anchor: 'bottom-right' } })).toEqual([
      'e2-anchor-bottom-right', 'e2-span-base-8', 'e2-start-base-3',
    ]);
  });

  it('informa columna inicial cuando hay start', () => {
    expect(gridColumnValue(createSpanIntent(6, 3))).toBe('5 / span 12');
    expect(gridColumnValue({ start: 3.5, span: 6.5 })).toBe('6 / span 13');
  });
});
