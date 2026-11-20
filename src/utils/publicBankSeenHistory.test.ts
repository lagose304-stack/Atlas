import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartedPublicBankQuestion } from "../types/publicQuestionBank";
import { drawPublicBankQuestions, getSeenQuestionIds, recordDrawnQuestions } from './publicBankSeenHistory';

const q1 = '11111111-1111-4111-8111-111111111111';
const q2 = '22222222-2222-4222-8222-222222222222';
const q3 = '33333333-3333-4333-8333-333333333333';
const q4 = '44444444-4444-4444-8444-444444444444';
const s1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const s2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('publicBankSeenHistory', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('agota cada grupo con su propio cupo y respeta el orden configurado', () => {
    const pool = [q1, q2, q3, q4, s1, s2].map((id, index) => ({
      id, subtema_id: index < 4 ? null : 10, options: [],
    } as unknown as StartedPublicBankQuestion));
    const config = { general_count: 3, subtema_counts: { 10: 1 }, shuffle_questions: false, shuffle_options: false };
    const first = drawPublicBankQuestions('test', pool, config);
    const second = drawPublicBankQuestions('test', pool, config);
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    expect(new Set([...first, ...second].map(q => q.id)).size).toBe(6);
    expect(new Set(second.map(q => q.id)).size).toBe(4);
    expect(second.map(q => q.subtema_id)).toEqual([null, null, null, 10]);
    expect(second.map(q => q.id)).toEqual(pool.filter(q => second.some(s => s.id === q.id)).map(q => q.id));
    expect(getSeenQuestionIds('otra-cuenta')).toEqual([]);
  });

  it('acumula preguntas vistas por generales y subtemas y reinicia solo el rubro que ya completó ciclo', () => {
    const pruebaId = 'prueba-epitelios';

    // Intento 1: 2 generales (q1, q2) + 1 del subtema 10 (s1)
    recordDrawnQuestions(pruebaId, [
      { id: q1, subtema_id: null },
      { id: q2, subtema_id: null },
      { id: s1, subtema_id: 10 },
    ]);
    expect(getSeenQuestionIds(pruebaId)).toEqual(expect.arrayContaining([q1, q2, s1]));

    // Intento 2: en generales sale q3 y se repite q1 (completó ciclo de generales),
    // mientras en subtema 10 sale s2 (nueva, aún no completa ciclo)
    recordDrawnQuestions(pruebaId, [
      { id: q3, subtema_id: null },
      { id: q1, subtema_id: null },
      { id: s2, subtema_id: 10 },
    ]);

    const seenAfterCycle = getSeenQuestionIds(pruebaId);
    // En generales se reinició el ciclo conservando solo q3 y q1 (q2 queda libre para el siguiente intento)
    expect(seenAfterCycle).toContain(q1);
    expect(seenAfterCycle).toContain(q3);
    expect(seenAfterCycle).not.toContain(q2);
    // En subtema 10 se conservan ambas vistas (s1 y s2) porque aún no hubo repetición
    expect(seenAfterCycle).toContain(s1);
    expect(seenAfterCycle).toContain(s2);
    expect(seenAfterCycle).not.toContain(q4);
  });
});
