import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InstructorQuestionResponse from './InstructorQuestionResponse';
import { isInstructorAnswerComplete, type InstructorAnswers, type PublicInstructorQuestion } from '../types/instructorQuestions';

vi.mock('./ImageViewerModal', () => ({ default: ({ src, hideSidebar, senaladosMeta }: { src: string; hideSidebar: boolean; senaladosMeta: unknown }) => <div role="dialog" data-hide-sidebar={hideSidebar} data-markers={JSON.stringify(senaladosMeta)}><img src={src} alt="Imagen ampliada" /></div> }));

function Response({ question }: { question: PublicInstructorQuestion }) {
  const [answer, setAnswer] = useState<InstructorAnswers[string]>('');
  return <><InstructorQuestionResponse question={question} index={0} answer={answer} onChange={setAnswer} />
    <output data-testid="answer">{JSON.stringify(answer)}</output>
    <output data-testid="complete">{String(isInstructorAnswerComplete(question, answer))}</output></>;
}

describe('Responder formatos de instructores', () => {
  it('muestra las marcas propias sobre la imagen y en el visor sin revelar etiquetas privadas', async () => {
    render(<Response question={{ id: 'q', type: 'short_answer', titulo: 'Identifica', image: {
      url: 'https://example.test/marked.webp', annotations: [{ label: 'RESPUESTA_PRIVADA', x: .4, y: .6 }],
    } }} />);
    const img = screen.getByAltText('Imagen de referencia del inciso');
    Object.defineProperty(img, 'naturalWidth', { value: 640 }); Object.defineProperty(img, 'naturalHeight', { value: 400 });
    fireEvent.load(img);
    expect(screen.getByRole('img', { name: 'Señalado a identificar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar imagen de referencia' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-markers')).toContain('"x":0.4');
    expect(dialog.getAttribute('data-markers')).not.toContain('RESPUESTA_PRIVADA');
  });
  it('recoge una respuesta breve y considera incompleto un espacio en blanco', () => {
    render(<Response question={{ id: 'q', type: 'short_answer', titulo: 'Identifica' }} />);
    fireEvent.change(screen.getByLabelText('Respuesta de pregunta 1'), { target: { value: ' ' } });
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    fireEvent.change(screen.getByLabelText('Respuesta de pregunta 1'), { target: { value: 'Epitelio' } });
    expect(screen.getByTestId('answer')).toHaveTextContent('"Epitelio"');
    expect(screen.getByTestId('complete')).toHaveTextContent('true');
  });

  it('renderiza huecos en su posición y usa sus IDs al entregar respuestas', () => {
    render(<Response question={{ id: 'q', type: 'completion', titulo: 'El {{2}} contiene {{1}}.', blanks: [{ id: 'gap1' }, { id: 'gap2' }] }} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveAccessibleName('Hueco 2 de pregunta 1');
    fireEvent.change(screen.getByLabelText('Hueco 2 de pregunta 1'), { target: { value: 'epitelio' } });
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    fireEvent.change(screen.getByLabelText('Hueco 1 de pregunta 1'), { target: { value: 'células' } });
    expect(JSON.parse(screen.getByTestId('answer').textContent || '{}')).toEqual({ gap1: 'células', gap2: 'epitelio' });
    expect(screen.getByTestId('complete')).toHaveTextContent('true');
  });

  it('impide reutilizar una opción pareada y conserva asociaciones por ID', () => {
    const question: PublicInstructorQuestion = { id: 'q', type: 'matching', titulo: 'Relaciona', terms: [{ id: 't1', texto: 'Epitelio' }, { id: 't2', texto: 'Músculo' }], choices: [{ id: 'c2', texto: 'Contracción' }, { id: 'c1', texto: 'Revestimiento' }] };
    render(<Response question={question} />);
    fireEvent.change(screen.getByLabelText('Pareja del término 1 de pregunta 1'), { target: { value: 'c1' } });
    const second = screen.getByLabelText('Pareja del término 2 de pregunta 1');
    expect(within(second).getByRole('option', { name: 'Revestimiento' })).toBeDisabled();
    expect(screen.getByTestId('complete')).toHaveTextContent('false');
    fireEvent.change(second, { target: { value: 'c2' } });
    expect(screen.getByTestId('complete')).toHaveTextContent('true');
    expect(JSON.parse(screen.getByTestId('answer').textContent || '{}')).toEqual({ t1: 'c1', t2: 'c2' });
    expect(isInstructorAnswerComplete(question, { t1: 'c1', t2: 'c1' })).toBe(false);
  });
  it('muestra una imagen opcional ampliable y mantiene el campo de respuesta', async () => {
    render(<Response question={{ id: 'q', type: 'short_answer', titulo: 'Identifica', image: { url: 'https://example.test/plate.webp' } }} />);
    expect(screen.getByAltText('Imagen de referencia del inciso')).toHaveAttribute('src', 'https://example.test/plate.webp');
    fireEvent.change(screen.getByLabelText('Respuesta de pregunta 1'), { target: { value: 'epitelio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar imagen de referencia' }));
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-hide-sidebar', 'true');
    expect(screen.getByTestId('answer')).toHaveTextContent('epitelio');
  });

});
