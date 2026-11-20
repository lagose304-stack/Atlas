import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicBankTestConfig from './PublicBankTestConfig';
import type { CatalogTema } from '../services/catalogService';
import type { PublicBankTopicSummary } from '../types/publicQuestionBank';

vi.mock('../services/catalogService', () => ({
  getCachedSubtemas: vi.fn().mockResolvedValue([
    { id: 101, nombre: 'Epitelio plano simple', tema_id: 1, sort_order: 1 },
    { id: 102, nombre: 'Epitelio cilíndrico', tema_id: 1, sort_order: 2 },
  ]),
}));

const saveMock = vi.fn().mockResolvedValue({
  id: 'test-1',
  nombre: 'Prueba de Tejido Epitelial',
  instrucciones: 'Instrucciones',
  scope: 'tema',
  parcial_key: 'primer',
  tema_id: 1,
  subtema_id: null,
  estado: 'borrador',
  mode: 'bank',
  bank_config: {
    general_count: 2,
    subtema_counts: { '101': 3 },
    shuffle_options: true,
    shuffle_questions: true,
  },
  created_at: '2026-11-20T00:00:00Z',
});

vi.mock('../services/publicTestsBank', () => ({
  savePublicBankTest: (...args: unknown[]) => saveMock(...args),
}));

describe('PublicBankTestConfig', () => {
  const temas: CatalogTema[] = [
    { id: 1, nombre: 'Tejido Epitelial', parcial: 'primer', sort_order: 1, logo_url: null },
    { id: 2, nombre: 'Tejido Conectivo', parcial: 'primer', sort_order: 2, logo_url: null },
  ];

  const summaryMap = new Map<number, PublicBankTopicSummary>([
    [1, {
      tema_id: 1,
      general_count: 4,
      subtema_total_count: 8,
      total_count: 12,
      subtemas: [
        { subtema_id: 101, count: 5 },
        { subtema_id: 102, count: 3 },
      ],
    }],
  ]);

  it('permite configurar preguntas generales y por subtema solo para temas sin prueba', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(
      <PublicBankTestConfig
        existingTest={null}
        temas={temas}
        usedTemaIds={new Set([2])}
        bankSummaryByTema={summaryMap}
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    );

    // Tema 2 ya está usado, solo debe ofrecer Tema 1
    const select = screen.getByLabelText(/Tema de la prueba/i);
    expect(select).toHaveValue('1');
    expect(screen.queryByRole('option', { name: /Tejido Conectivo/i })).not.toBeInTheDocument();

    // Espera subtemas cargados
    await waitFor(() => {
      expect(screen.getByText('Epitelio plano simple')).toBeInTheDocument();
      expect(screen.getByText('Epitelio cilíndrico')).toBeInTheDocument();
    });

    const generalInput = screen.getByLabelText('Cantidad de preguntas generales del tema');
    expect(generalInput).toHaveAttribute('max', '4');
    await user.clear(generalInput);
    await user.type(generalInput, '99');
    expect(generalInput).toHaveValue(4);

    await user.clear(generalInput);
    await user.type(generalInput, '2');

    const sub1Input = screen.getByLabelText('Cantidad de preguntas para Epitelio plano simple');
    expect(sub1Input).toHaveAttribute('max', '5');
    await user.clear(sub1Input);
    await user.type(sub1Input, '25');
    expect(sub1Input).toHaveValue(5);

    await user.clear(sub1Input);
    await user.type(sub1Input, '3');

    await user.click(screen.getByRole('button', { name: /Guardar configuración/i }));

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
        id: null,
        temaId: 1,
        bankConfig: expect.objectContaining({
          general_count: 2,
          subtema_counts: expect.objectContaining({ '101': 3 }),
        }),
      }));
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
