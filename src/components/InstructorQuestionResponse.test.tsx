import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InstructorQuestionResponse from './InstructorQuestionResponse';
import { isInstructorAnswerComplete, instructorIncisoWeight, type InstructorAnswers, type PublicInstructorQuestion } from '../types/instructorQuestions';

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

  it('muestra un versus de imágenes lado a lado con Imagen A e Imagen B sin exigir respuesta ni puntaje', () => {
    const versus: PublicInstructorQuestion = {
      id: 'v1',
      type: 'image_versus',
      titulo: 'Compara ambos epitelios',
      image_a: { url: 'https://example.test/a.webp' },
      image_b: { url: 'https://example.test/b.webp' },
      group: { id: 'g1', titulo: '', position: 1 },
    };
    const sibling: PublicInstructorQuestion = {
      id: 'q1',
      type: 'short_answer',
      titulo: 'Indica la diferencia principal',
      group: { id: 'g1', titulo: '', position: 1 },
    };
    render(<Response question={versus} />);
    expect(screen.getByText('Imagen A')).toBeInTheDocument();
    expect(screen.getByText('Imagen B')).toBeInTheDocument();
    const images = screen.getAllByAltText('Imagen de referencia del inciso');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://example.test/a.webp');
    expect(images[1]).toHaveAttribute('src', 'https://example.test/b.webp');
    expect(isInstructorAnswerComplete(versus, undefined)).toBe(true);
    const snapshot = { nombre: 'Prueba', scoring_version: 2, questions: [versus, sibling] };
    expect(instructorIncisoWeight(snapshot, versus)).toBe(0);
    expect(instructorIncisoWeight(snapshot, sibling)).toBe(1);
  });

  it('muestra la imagen opcional debajo del enunciado en selección única, completación y términos pareados', () => {
    const cases: [PublicInstructorQuestion, string][] = [
      [{ id: 'c1', type: 'single_choice', titulo: 'Elige el epitelio', options: [{ id: 'o1', texto: 'Plano' }, { id: 'o2', texto: 'Cúbico' }], image: { url: 'https://example.test/choice.webp' } }, 'https://example.test/choice.webp'],
      [{ id: 'f1', type: 'completion', titulo: 'Tejido {{1}}', blanks: [{ id: 'b1' }], image: { url: 'https://example.test/completion.webp' } }, 'https://example.test/completion.webp'],
      [{ id: 'm1', type: 'matching', titulo: 'Relaciona', terms: [{ id: 't1', texto: 'A' }], choices: [{ id: 'c1', texto: '1' }], image: { url: 'https://example.test/matching.webp' } }, 'https://example.test/matching.webp'],
    ];
    for (const [question, url] of cases) {
      const { unmount } = render(<Response question={question} />);
      expect(screen.getByAltText('Imagen de referencia del inciso')).toHaveAttribute('src', url);
      unmount();
    }
  });

  it('usa el señalador negro en miniaturas y numera los señalados en orden cuando son varios', () => {
    const { container } = render(<Response question={{
      id: 'q-multi',
      type: 'short_answer',
      titulo: 'Identifica las estructuras',
      image: {
        url: 'https://example.test/multi.webp',
        annotations: [
          { x: 0.25, y: 0.3, label: 'Primero' },
          { x: 0.7, y: 0.65, label: 'Segundo' },
        ],
      },
    }} />);
    const img = screen.getByAltText('Imagen de referencia del inciso');
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 800 });
    fireEvent.load(img);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(container.querySelectorAll('polygon[fill="#0a0a0a"]').length).toBe(2);
    expect(container.innerHTML).not.toContain('#facc15');
  });

});
