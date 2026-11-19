import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import InstructorPointResponse from './InstructorPointResponse';
import { isInstructorAnswerComplete, type InstructorAnswers } from '../types/instructorQuestions';

vi.mock('./PlateAnnotationViewerEditor', () => ({ default: ({ answerPointMode, showMarkerNumbers, initialSenalados, initialSenaladosPos, onSaveAll, onCancel }: {
  answerPointMode: boolean; showMarkerNumbers?: boolean; initialSenalados: string[]; initialSenaladosPos: unknown[]; onSaveAll: (labels: string[], positions: unknown[]) => void; onCancel: () => void;
}) => <div role="dialog" data-reduced={answerPointMode && showMarkerNumbers} data-initial={JSON.stringify(initialSenaladosPos)} data-labels={JSON.stringify(initialSenalados)}>
  <button onClick={() => onSaveAll([''], [{ x: .4, y: .6 }])}>Aplicar punto</button>
  <button onClick={() => onSaveAll(['Núcleo', ''], [{ x: .2, y: .3 }, { x: .7, y: .8 }])}>Aplicar varios puntos</button>
  <button onClick={() => onSaveAll([], [])}>Quitar punto</button><button onClick={onCancel}>Cancelar</button>
</div> }));

function Response() {
  const [answer, setAnswer] = useState<InstructorAnswers[string]>('');
  const complete = isInstructorAnswerComplete({ id: 'p1', type: 'image_point', titulo: 'Señala', image: { url: 'https://example.test/test.webp' } }, answer);
  return <>
    <InstructorPointResponse url="https://example.test/test.webp" instructions="Señala el núcleo" answer={answer} onChange={setAnswer} />
    <output data-testid="answer">{JSON.stringify(answer)}</output>
    <output data-testid="complete">{String(complete)}</output>
  </>;
}

it('permite colocar uno o varios señalados, exige respuesta breve ligada a cada número y permite eliminar', async () => {
  render(<Response />);
  fireEvent.click(screen.getByRole('button', { name: 'Señalar en la imagen' }));
  expect(await screen.findByRole('dialog')).toHaveAttribute('data-reduced', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar punto' }));
  expect(screen.getByTestId('complete')).toHaveTextContent('false');
  fireEvent.change(screen.getByLabelText('Respuesta del señalado 1'), { target: { value: 'Núcleo' } });
  expect(screen.getByTestId('complete')).toHaveTextContent('true');
  expect(screen.getByTestId('answer')).toHaveTextContent('{"x":0.4,"y":0.6,"text":"Núcleo"}');

  fireEvent.click(screen.getByRole('button', { name: 'Editar señalado de respuesta' }));
  expect(await screen.findByRole('dialog')).toHaveAttribute('data-labels', '["Núcleo"]');
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar varios puntos' }));
  expect(screen.getByTestId('complete')).toHaveTextContent('false');
  fireEvent.change(screen.getByLabelText('Respuesta del señalado 2'), { target: { value: 'Membrana' } });
  expect(screen.getByTestId('complete')).toHaveTextContent('true');
  expect(screen.getByTestId('answer')).toHaveTextContent('[{"x":0.2,"y":0.3,"text":"Núcleo"},{"x":0.7,"y":0.8,"text":"Membrana"}]');

  const img = screen.getByAltText('Imagen para señalar');
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 800 });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 600 });
  fireEvent.load(img);
  expect(screen.getByRole('img', { name: 'Señalado 1 a identificar' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Señalado 2 a identificar' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Eliminar señalado 1' }));
  expect(screen.getByTestId('answer')).toHaveTextContent('{"x":0.7,"y":0.8,"text":"Membrana"}');
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar señalado 1' }));
  expect(screen.getByRole('button', { name: 'Señalar en la imagen' })).toBeInTheDocument();
});

it('cierra el editor abierto y bloquea cambios al finalizar el horario', async () => {
  const props = { url: 'https://example.test/test.webp', instructions: 'Señala', answer: '', onChange: vi.fn() };
  const { rerender } = render(<InstructorPointResponse {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Señalar en la imagen' }));
  await screen.findByRole('dialog');
  rerender(<InstructorPointResponse {...props} disabled />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Señalar en la imagen' })).toBeDisabled();
  expect(props.onChange).not.toHaveBeenCalled();
});
