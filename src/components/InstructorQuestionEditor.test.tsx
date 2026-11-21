import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorQuestionEditor from './InstructorQuestionEditor';
import { newInstructorQuestion, type InstructorQuestion, type InstructorReferenceImage } from '../types/instructorQuestions';

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

  it('conserva las placas, sus identificadores y sus señalados al cambiar de formato', () => {
    const imageA: InstructorReferenceImage = { url: 'https://example.test/a.webp', source: 'catalog', plate_id: 24,
      annotations: [{ label: 'Núcleo', x: .2, y: .3, regionPoints: [.1, .2, .2, .4, .3, .2] }] };
    const imageB: InstructorReferenceImage = { url: 'https://example.test/b.webp', source: 'upload',
      annotations: [{ label: 'Membrana', x: .4, y: .5 }] };
    render(<Editor initial={{ id: 'v', titulo: 'Compara', type: 'image_versus', image_a: imageA, image_b: imageB }} />);
    const changeFormat = (value: string) => fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value } });
    for (const type of ['completion', 'single_choice', 'matching', 'short_answer', 'image_point']) {
      changeFormat(type);
      expect(current()).toMatchObject({ type, id: 'v', titulo: 'Compara', image: imageA, alternate_image: imageB });
    }
    expect(screen.getByText(/El participante verá la imagen limpia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar señalados (1)' })).not.toBeInTheDocument();
    changeFormat('image_versus');
    expect(current()).toMatchObject({ image_a: imageA, image_b: imageB });
    expect(current()).not.toHaveProperty('alternate_image');
    expect(screen.getAllByRole('button', { name: 'Editar señalados (1)' })).toHaveLength(2);
    expect(window.confirm).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByLabelText('Respuestas correctas del hueco 2 de pregunta 1'), { target: { value: 'Células\nCélulas epiteliales' } });
    fireEvent.change(screen.getByLabelText('Referencias para revisión de pregunta 1 (opcional)'), { target: { value: 'Consulta la lámina de referencia.' } });
    expect(current().blanks[0]).toEqual({ id: 'gap1', accepted_answers: ['epitelio'] });
    expect(current().blanks[1].accepted_answers).toEqual(['Células', 'Células epiteliales']);
    expect(current().review_reference).toBe('Consulta la lámina de referencia.');
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
    fireEvent.click(screen.getByRole('button', { name: 'Añadir opción incorrecta' }));
    fireEvent.change(screen.getByLabelText('Opción incorrecta 1'), { target: { value: 'Conducción' } });
    expect(current().distractors).toEqual([{ id: expect.any(String), texto: 'Conducción' }]);
    expect(current().pairs).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar opción incorrecta 1' }));
    expect(current().distractors).toEqual([]);
  });

  it('configura un inciso de versus de imágenes con Imagen A e Imagen B', () => {
    render(<Editor initial={{ id: 'v1', type: 'image_versus', titulo: 'Compara ambas placas' }} />);
    expect(screen.getByRole('region', { name: 'Imagen A del versus' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Imagen B del versus' })).toBeInTheDocument();
    expect(screen.getByText(/referencia comparativa, sin puntaje/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pedir una respuesta breve por placa' }));
    for (const plate of ['A', 'B']) {
      fireEvent.change(screen.getByLabelText(`Consigna de la placa ${plate}`), {
        target: { value: `Identifica ${plate}` },
      });
    }
    expect(screen.getAllByLabelText(/Consigna de la placa/)).toHaveLength(2);
    expect(current().prompts.a.titulo).toBe('Identifica A');
    expect(current().prompts.b.titulo).toBe('Identifica B');
  });

  it('ofrece imagen opcional del sitio o subida en selección única, completación y términos pareados', () => {
    const types: InstructorQuestion[] = [
      newInstructorQuestion('single_choice'),
      newInstructorQuestion('completion'),
      newInstructorQuestion('matching'),
    ];
    for (const initial of types) {
      const { unmount } = render(<Editor initial={initial} />);
      expect(screen.getByRole('region', { name: 'Imagen de referencia del inciso' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Elegir del sitio' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeInTheDocument();
      unmount();
    }
  });

  it('convierte entre selección única y múltiple con el botón y muestra prefijos A. B.', () => {
    render(<Editor />);
    expect(screen.getByText('A.')).toBeInTheDocument();
    expect(screen.getByText('B.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe la opción A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convertir a selección múltiple' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Convertir a selección múltiple' }));
    expect(current().correct_option_ids).toEqual(['a']);
    expect(screen.getByRole('button', { name: 'Convertir a selección única' })).toBeInTheDocument();

    // En selección múltiple los inputs de opción correcta son checkboxes
    const checkboxes = screen.getAllByRole('checkbox', { name: /Opción correcta/ });
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    expect(checkboxes[0]).toBeChecked();

    // Marcar una segunda opción
    fireEvent.click(checkboxes[1]);
    expect(current().correct_option_ids).toEqual(['a', 'b']);

    // Volver a selección única conserva la primera opción
    fireEvent.click(screen.getByRole('button', { name: 'Convertir a selección única' }));
    expect(current().correct_option_id).toBe('a');
    expect(current().correct_option_ids).toBeUndefined();
  });

  it('permite cambiar entre selección única y múltiple desde el selector de formato', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value: 'multiple_choice' } });
    expect(current().correct_option_ids).toEqual(['a']);
    fireEvent.change(screen.getByLabelText('Formato de pregunta 1'), { target: { value: 'single_choice' } });
    expect(current().correct_option_id).toBe('a');
    expect(current().correct_option_ids).toBeUndefined();
  });
});
