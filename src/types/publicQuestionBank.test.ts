import { describe, expect, it } from 'vitest';
import {
  calculateExpectedBankTestCount,
  createBlankPublicBankQuestion,
  isPublicBankQuestionComplete,
  type PublicBankConfig,
  type PublicBankTopicSummary,
} from './publicQuestionBank';

describe('publicQuestionBank helpers', () => {
  it('valida completitud de una pregunta de selección única', () => {
    const q = createBlankPublicBankQuestion(10, null, 0);
    expect(isPublicBankQuestionComplete(q)).toBe(false);

    q.titulo = '<p>¿Qué epitelio recubre la tráquea?</p>';
    q.options = q.options.map((opt, idx) => ({
      ...opt,
      texto: `Opción ${idx + 1}`,
      is_correct: idx === 1,
    }));
    expect(isPublicBankQuestionComplete(q)).toBe(true);

    // Si hay 0 correctas, no es completa
    q.options = q.options.map(opt => ({ ...opt, is_correct: false }));
    expect(isPublicBankQuestionComplete(q)).toBe(false);
  });

  it('calcula correctamente preguntas configuradas vs disponibles por tema y subtemas', () => {
    const summary: PublicBankTopicSummary = {
      tema_id: 5,
      general_count: 3,
      subtema_total_count: 10,
      total_count: 13,
      subtemas: [
        { subtema_id: 51, count: 6 },
        { subtema_id: 52, count: 4 },
      ],
    };

    const config: PublicBankConfig = {
      general_count: 5, // pide 5, solo hay 3
      subtema_counts: {
        '51': 4, // pide 4, hay 6 -> salen 4
        '52': 6, // pide 6, hay 4 -> salen 4
        '53': 2, // pide 2, hay 0 -> salen 0
      },
      shuffle_options: true,
      shuffle_questions: true,
    };

    const counts = calculateExpectedBankTestCount(config, summary);
    expect(counts.configured).toBe(17);
    expect(counts.available).toBe(11);
  });
});
