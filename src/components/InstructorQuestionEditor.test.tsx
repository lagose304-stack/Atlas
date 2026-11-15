import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorQuestionEditor from './InstructorQuestionEditor';
import type { InstructorQuestion } from '../types/instructorQuestions';

const legacy: InstructorQuestion = { id: 'q1', titulo: 'Tejido', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }], correct_option_id: 'a' };
function Editor({ initial = legacy }: { initial?: InstructorQuestion }) {
  const [question, setQuestion] = useState(initial);
  return <><InstructorQuestionEditor question={question} index={0} onChange={setQuestion} onRemove={vi.fn()} /><output data-testid="saved">{JSON.stringify(question)}</output></>;
}
const current = () => JSON.parse(screen.getByTestId('saved').textContent || '{}');

describe('Formatos de pregunta del editor de instructores', () => {
  beforeEach(() => {
    let id = 0;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => `generated-${++id}`) });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('abre una pregunta histórica como selección única sin modificar sus IDs ni respuestas', () => {
    render(<Editor />);
    expect(screen.getByLabelText('Formato de pregunta 1')).toHaveValue('single_choice');
    expect(screen.getByLabelText('Opción correcta 1 de pregunta 1')).toBeChecked();
    expect(current()).toEqual(legacy);
  });

  it('permite cancelar un cambio de formato sin perder las respuestas configuradas', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value: 'short_answer' } });
    expect(current()).toEqual(legacy);
  });

  it('configura variantes de respuesta breve y conserva ID y enunciado al cambiar de formato', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value: 'short_answer' } });
    fireEvent.change(screen.getByLabelText('Respuestas aceptadas de pregunta 1'), { target: { value: 'Músculo\nTejido muscular' } });
    expect(current()).toMatchObject({ id: 'q1', titulo: 'Tejido', type: 'short_answer', accepted_answers: ['Músculo', 'Tejido muscular'] });
    expect(current()).not.toHaveProperty('options');
  });

  it('añade huecos con identificadores independientes y retira el marcador al quitar el último', () => {
    render(<Editor initial={{ id: 'q1', type: 'completion', titulo: 'El {{1}}', blanks: [{ id: 'gap1', accepted_answers: ['epitelio'] }] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir hueco' }));
    fireEvent.change(screen.getByLabelText('Respuestas del hueco 2 de pregunta 1'), { target: { value: 'Células\nCélulas epiteliales' } });
    expect(current().blanks[0]).toEqual({ id: 'gap1', accepted_answers: ['epitelio'] });
    expect(current().blanks[1].accepted_answers).toEqual(['Células', 'Células epiteliales']);
    expect(current().titulo).toBe('El {{1}} {{2}}');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar último hueco' }));
    expect(current().titulo).not.toContain('{{2}}');
    expect(current().blanks).toHaveLength(1);
  });

  it('configura términos pareados con IDs de término y opción diferentes', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value: 'matching' } });
    fireEvent.change(screen.getByLabelText('Término 1 de pregunta 1'), { target: { value: 'Epitelio' } });
    fireEvent.change(screen.getByLabelText('Pareja 1 de pregunta 1'), { target: { value: 'Revestimiento' } });
    expect(current().pairs[0]).toMatchObject({ term: 'Epitelio', definition: 'Revestimiento' });
    expect(current().pairs[0].id).not.toBe(current().pairs[0].option_id);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir pareja' }));
    expect(current().pairs).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar última pareja' }));
    expect(current().pairs).toHaveLength(2);
  });
});
