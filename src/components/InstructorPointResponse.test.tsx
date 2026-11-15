import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import InstructorPointResponse from './InstructorPointResponse';
import type { InstructorAnswers } from '../types/instructorQuestions';
vi.mock('./PlateAnnotationViewerEditor', () => ({ default: ({ answerPointMode, singlePickerMode, initialLocation, onSaveSingle, onCancel }: {
  answerPointMode: boolean; singlePickerMode: boolean; initialLocation: unknown; onSaveSingle: (point: unknown) => void; onCancel: () => void;
}) => <div role="dialog" data-reduced={answerPointMode && singlePickerMode} data-initial={JSON.stringify(initialLocation)}>
  <button onClick={() => onSaveSingle({ x: .4, y: .6, startX: .1, regionPoints: [0, 0] })}>Aplicar punto</button>
  <button onClick={() => onSaveSingle(null)}>Quitar punto</button><button onClick={onCancel}>Cancelar</button>
</div> }));
function Response() {
  const [answer, setAnswer] = useState<InstructorAnswers[string]>('');
  return <><InstructorPointResponse url="https://example.test/test.webp" instructions="Señala el núcleo" answer={answer} onChange={setAnswer} /><output>{JSON.stringify(answer)}</output></>;
}
it('usa el editor reducido, guarda solo una posición y permite reabrir y eliminarla', async () => {
  render(<Response />);
  fireEvent.click(screen.getByRole('button', { name: 'Señalar en la imagen' }));
  expect(await screen.findByRole('dialog')).toHaveAttribute('data-reduced', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar punto' }));
  expect(await screen.findByText('Señalado añadido a tu respuesta. Puedes editarlo antes de entregar.')).toBeInTheDocument();
  expect(screen.getByText('{"x":0.4,"y":0.6}')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar señalado de respuesta' }));
  expect(await screen.findByRole('dialog')).toHaveAttribute('data-initial', '{"x":0.4,"y":0.6}');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('button', { name: 'Editar señalado de respuesta' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar señalado de respuesta' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar punto' }));
  expect(screen.getByRole('button', { name: 'Señalar en la imagen' })).toBeInTheDocument();
});
