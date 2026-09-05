import { describe, expect, it } from 'vitest';
import { collectWeeklyThemeIds, groupHistoricalTestsByPartial, orderTestsByWeeklyPriority } from './evaluacionesUtils';

describe('evaluaciones weekly filters', () => {
  it('extrae los temas activos de la publicación semanal', () => {
    const blocks = [
      {
        block_type: 'weekly_publication',
        content: {
          topic_1_id: '12',
          topic_2_id: '9',
          topic_3_id: '15',
          topic_1: 'Epitelio',
          topic_2: 'Tejido conjuntivo',
          topic_3: 'Tejido muscular',
        },
      },
    ];

    expect(collectWeeklyThemeIds(blocks as any)).toEqual([12, 9, 15]);
  });

  it('ordena primero las pruebas del tema de la semana y deja el historial después', () => {
    const tests = [
      { id: 'old', tema_id: 3, created_at: '2024-08-10T00:00:00Z' },
      { id: 'week', tema_id: 9, created_at: '2026-08-10T00:00:00Z' },
      { id: 'week-2', tema_id: 12, created_at: '2026-08-11T00:00:00Z' },
      { id: 'week-3', tema_id: 15, created_at: '2026-08-12T00:00:00Z' },
    ];

    expect(orderTestsByWeeklyPriority(tests as any, [12, 9, 15])).toMatchObject([
      { id: 'week-2' },
      { id: 'week' },
      { id: 'week-3' },
      { id: 'old' },
    ]);
  });

  it('agrupa el historial por parcial y dentro de cada parcial ordena por tema antes que subtema', () => {
    const tests = [
      { id: 's2', parcial_key: 'segundo', scope: 'subtema', tema_id: 7, tema: { nombre: 'Tema B' }, created_at: '2024-04-01T00:00:00Z' },
      { id: 'p1', parcial_key: 'primer', scope: 'parcial', tema_id: 3, tema: { nombre: 'Tema A' }, created_at: '2024-01-01T00:00:00Z' },
      { id: 't2', parcial_key: 'segundo', scope: 'tema', tema_id: 9, tema: { nombre: 'Tema C' }, created_at: '2024-04-02T00:00:00Z' },
      { id: 't1', parcial_key: 'primer', scope: 'tema', tema_id: 3, tema: { nombre: 'Tema A' }, created_at: '2024-02-01T00:00:00Z' },
      { id: 'p2', parcial_key: 'segundo', scope: 'parcial', tema_id: 6, tema: { nombre: 'Tema B' }, created_at: '2024-03-01T00:00:00Z' },
    ] as any;

    expect(groupHistoricalTestsByPartial(tests)).toMatchObject([
      {
        key: 'primer',
        items: [
          { id: 'p1' },
          { id: 't1' },
        ],
      },
      {
        key: 'segundo',
        items: [
          { id: 'p2' },
          { id: 't2' },
          { id: 's2' },
        ],
      },
    ]);
  });

  it('cuando no hay publicación semanal y hay bloque exam_week, devuelve los temas del parcial en orden de sort_order', () => {
    const blocks = [
      {
        block_type: 'exam_week',
        content: {
          parcial: 'primer',
          title: 'Semana de Exámenes: Primer Parcial',
        },
      },
    ];

    const catalogTemas = [
      { id: 34, nombre: 'Tejido Nervioso', parcial: 'primer', sort_order: 8 },
      { id: 29, nombre: 'Epitelios', parcial: 'primer', sort_order: 2 },
      { id: 38, nombre: 'Tejido Sanguíneo', parcial: 'segundo', sort_order: 0 },
      { id: 31, nombre: 'Tejidos Conectivos', parcial: 'primer', sort_order: 4 },
      { id: 62, nombre: 'Microscopía', parcial: 'primer', sort_order: 0 },
    ];

    const ids = collectWeeklyThemeIds(blocks as any, catalogTemas);
    // Debe devolver sólo temas del primer parcial y en orden de sort_order (0, 2, 4, 8)
    expect(ids).toEqual([62, 29, 31, 34]);
  });

  it('ordena las pruebas respetando el orden del temario del parcial durante la semana de exámenes', () => {
    const tests = [
      { id: 'nervioso', tema_id: 34, created_at: '2026-08-01' },
      { id: 'epitelios', tema_id: 29, created_at: '2026-08-01' },
      { id: 'microscopia', tema_id: 62, created_at: '2026-08-01' },
      { id: 'conectivo', tema_id: 31, created_at: '2026-08-01' },
    ];

    const ordered = orderTestsByWeeklyPriority(tests as any, [62, 29, 31, 34]);
    expect(ordered.map(t => t.id)).toEqual(['microscopia', 'epitelios', 'conectivo', 'nervioso']);
  });
});
