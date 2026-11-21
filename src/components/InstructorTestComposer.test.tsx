import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorTestComposer from './InstructorTestComposer';
import type { InstructorContent } from '../services/instructorTests';
import { groupPublicInstructorQuestions, incisoLetter } from '../types/instructorQuestions';

const initial: InstructorContent = {
  nombre: 'Evaluación docente', instrucciones: '', groups: [
    { id: 'g1', titulo: 'Primer contexto', item_ids: ['q1', 'q2'] },
    { id: 'g2', titulo: 'Segundo contexto', item_ids: ['q3'] },
  ], questions: [
    { id: 'q1', titulo: 'Tejido observado', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }], correct_option_id: 'a' },
    { id: 'q2', type: 'short_answer', titulo: 'Nombra una célula', accepted_answers: ['fibroblasto'] },
    { id: 'q3', type: 'short_answer', titulo: 'Función', accepted_answers: ['contracción'] },
  ],
};

function Composer({ start = initial }: { start?: InstructorContent }) {
  const [content, setContent] = useState(start);
  const [code, setCode] = useState('');
  return <><InstructorTestComposer content={content} code={code} hasCode existing busy={false} onChange={setContent} onCodeChange={setCode} />
    <output data-testid="content">{JSON.stringify(content)}</output><output data-testid="code">{code}</output></>;
}
const current = (): InstructorContent => JSON.parse(screen.getByTestId('content').textContent || '{}');

describe('Editor por preguntas e incisos', () => {
  it('asigna preguntas completas a temas y conserva sus incisos al cambiar de sección', () => {
    const start: InstructorContent = { ...initial, sections: [{ id: 's1', tema_id: 1, nombre: 'Epitelial' }, { id: 's2', tema_id: 2, nombre: 'Muscular' }],
      groups: initial.groups!.map((group, index) => ({ ...group, section_id: index ? 's2' : 's1' })) };
    render(<Composer start={start} />);
    expect(screen.getByLabelText('Sección de la pregunta 1')).toHaveValue('s1');
    fireEvent.change(screen.getByLabelText('Sección de la pregunta 1'), { target: { value: 's2' } });
    expect(current().groups?.find(group => group.id === 'g1')).toMatchObject({ section_id: 's2', item_ids: ['q1', 'q2'] });
    expect(current().questions).toEqual(initial.questions);
  });
  beforeEach(() => {
    let next = 0;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => `new-${++next}`) });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('solo monta la pregunta y el inciso activos, y permite navegar sin modificar el borrador', () => {
    render(<Composer />);
    const numbers = screen.getAllByRole('button', { name: /Ir a pregunta/ });
    expect(numbers.map(button => button.textContent?.trim())).toEqual(['1', '2']);
    expect(numbers[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByLabelText(/Enunciado general/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Enunciado del inciso a de pregunta 1')).toHaveValue('Tejido observado');
    expect(screen.queryByLabelText('Enunciado del inciso b de pregunta 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Enunciado del inciso a de pregunta 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pregunta anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Pregunta siguiente' }));
    expect(screen.getByLabelText('Enunciado del inciso a de pregunta 2')).toHaveValue('Función');
    expect(screen.getByRole('button', { name: 'Pregunta siguiente' })).toBeDisabled();
    expect(current()).toEqual(initial);
  });

  it('conserva respuestas sin guardar al cambiar de inciso y de pregunta', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('tab', { name: /Inciso b/ }));
    fireEvent.change(screen.getByLabelText('Respuestas aceptadas de inciso b de pregunta 1'), { target: { value: 'fibroblasto\nFibrocito' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ir a pregunta 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir a pregunta 1' }));
    expect(screen.getByLabelText('Respuestas aceptadas de inciso b de pregunta 1')).toHaveValue('fibroblasto\nFibrocito');
    fireEvent.click(screen.getByRole('tab', { name: /Inciso a/ }));
    expect(screen.getByLabelText('Opción correcta 1 de inciso a de pregunta 1')).toBeChecked();
  });

  it('agrega una pregunta vacía y permite combinar varios formatos dentro de ella', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nueva pregunta' }));
    expect(screen.getByText('Agrega el primer inciso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso de completaci\u00f3n' }));
    expect(screen.getByLabelText('Formato de inciso a de pregunta 3')).toHaveValue('completion');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso de t\u00e9rminos pareados' }));
    expect(screen.getByLabelText('Formato de inciso b de pregunta 3')).toHaveValue('matching');
    expect(current().groups).toHaveLength(3);
    expect(current().groups![2].item_ids).toHaveLength(2);
    expect(current().questions).toHaveLength(5);
  });

  it('añade incisos a una pregunta previa manteniendo el orden de los grupos', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso de selecci\u00f3n \u00fanica' }));
    const saved = current();
    expect(saved.questions.map(q => q.id)).toEqual([...saved.groups![0].item_ids, ...saved.groups![1].item_ids]);
    expect(saved.questions[3].id).toBe('q3');
    expect(saved.questions[0].id).toBe('q1');
  });

  it('elimina solo el inciso elegido, conserva los demás y selecciona una pestaña válida', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('tab', { name: /Inciso b/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar inciso b' }));
    expect(current().groups![0].item_ids).toEqual(['q1']);
    expect(current().questions.map(q => q.id)).toEqual(['q1', 'q3']);
    expect(screen.getByLabelText('Enunciado del inciso a de pregunta 1')).toHaveValue('Tejido observado');
  });

  it('pide confirmar antes de borrar una pregunta completa con sus incisos', () => {
    render(<Composer />);
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta 1' }));
    expect(current()).toEqual(initial);
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta 1' }));
    expect(current().groups).toEqual([initial.groups![1]]);
    expect(current().questions.map(q => q.id)).toEqual(['q3']);
    expect(screen.getByLabelText('Enunciado del inciso a de pregunta 1')).toHaveValue('Función');
  });

  it('abre contenido histórico como una pregunta por inciso y conserva IDs al agruparlo', () => {
    render(<Composer start={{ ...initial, groups: undefined }} />);
    expect(screen.getAllByRole('button', { name: /Ir a pregunta/ })).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Enunciado del inciso a de pregunta 1'), { target: { value: 'Nuevo enunciado' } });
    expect(current().questions).toEqual([{ ...initial.questions[0], titulo: 'Nuevo enunciado' }, ...initial.questions.slice(1)]);
    expect(current().groups![0]).toMatchObject({ item_ids: ['q1'], titulo: '' });
  });

  it('mantiene datos generales y código al entrar y salir de las preguntas', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: /^Datos de la prueba/ }));
    fireEvent.change(screen.getByLabelText('Código de acceso de 6 dígitos'), { target: { value: '001234' } });
    fireEvent.change(screen.getByLabelText('Nombre de la prueba'), { target: { value: 'Nombre nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a preguntas' }));
    fireEvent.click(screen.getByRole('button', { name: /^Datos de la prueba/ }));
    expect(screen.getByLabelText('Nombre de la prueba')).toHaveValue('Nombre nuevo');
    expect(screen.getByLabelText('Código de acceso de 6 dígitos')).toHaveValue('001234');
  });

  it('cambia entre incisos usando flechas y conserva el foco de teclado', () => {
    render(<Composer />);
    const first = screen.getByRole('tab', { name: /Inciso a/ });
    first.focus(); fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Inciso b/ })).toHaveFocus();
    expect(screen.getByLabelText('Enunciado del inciso b de pregunta 1')).toBeInTheDocument();
  });

  it('abrir y cerrar el selector de formatos no crea un inciso ni modifica respuestas', () => {
    render(<Composer />);
    const add = screen.getByRole('button', { name: 'Agregar inciso' });
    fireEvent.click(add);
    expect(screen.getByRole('region', { name: 'Elegir formato del nuevo inciso' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Agregar inciso de/ })).toHaveLength(7);
    expect(current()).toEqual(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar selección de formato' }));
    expect(screen.queryByRole('region', { name: 'Elegir formato del nuevo inciso' })).not.toBeInTheDocument();
    expect(current()).toEqual(initial);
    expect(screen.getByLabelText('Enunciado del inciso a de pregunta 1')).toHaveValue('Tejido observado');
  });

  it('Escape cierra la elección de formato y devuelve el foco a Agregar inciso', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso' }));
    const choice = screen.getByRole('button', { name: 'Agregar inciso de respuesta breve' });
    choice.focus(); fireEvent.keyDown(choice, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Elegir formato del nuevo inciso' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar inciso' })).toHaveFocus();
    expect(current()).toEqual(initial);
  });

  it('ordena las preguntas públicas por su organización y conserva incisos y compatibilidad histórica', () => {
    const groups = groupPublicInstructorQuestions([
      { id: 'b', type: 'short_answer', titulo: 'B', group: { id: 'g2', titulo: 'Segundo', position: 2 } },
      { id: 'a', type: 'short_answer', titulo: 'A', group: { id: 'g1', titulo: 'Primero', position: 1 } },
      { id: 'c', type: 'short_answer', titulo: 'C', group: { id: 'g1', titulo: 'Primero', position: 1 } },
    ]);
    expect(groups.map(g => g.id)).toEqual(['g1', 'g2']);
    expect(groups[0].items.map(q => q.id)).toEqual(['a', 'c']);
    expect(incisoLetter(0)).toBe('a'); expect(incisoLetter(26)).toBe('aa');
  });

  it('cuenta las dos respuestas breves de un Versus y conserva el modo de referencia', () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar inciso de versus de imágenes' }));
    expect(screen.getByRole('region', { name: 'Imagen A del versus' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Imagen B del versus' })).toBeInTheDocument();
    expect(screen.getByText(/5 incisos \(4 con puntaje\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pedir una respuesta breve por placa' }));
    expect(screen.getByText(/3 incisos \(2 con puntaje\)/)).toBeInTheDocument();
  });
});
