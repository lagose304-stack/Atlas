import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorSubmissionReview from './InstructorSubmissionReview';

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), review: vi.fn(), remove: vi.fn() }));
vi.mock('../services/instructorTests', () => ({ listInstructorSubmissions: mocks.list, getInstructorSubmission: mocks.get, reviewInstructorSubmission: mocks.review, deleteInstructorSubmission:mocks.remove }));
vi.mock('./InstructorReferenceImageView', () => ({ default: ({ url, annotations }: { url: string; annotations: unknown }) => <div data-testid="image" data-markers={JSON.stringify(annotations)}>{url}</div> }));
const detail = { id: 'submission-1', participant_name: 'Ana Prueba', test_id: 'test', test_revision: 2, snapshot: { nombre: 'Prueba', questions: [
  { id: 'point', type: 'image_point', titulo: 'Señala el núcleo', image: { url: 'https://example.test/original.webp' } },
] }, answers: { point: { x: .3, y: .4 } }, reviews: {}, revision: 1, created_at: '2026-11-14T12:00:00Z', auto_correct: 1, total: 2 };
describe('Revisión manual de señalados', () => {
  beforeEach(() => {
    mocks.remove.mockReset().mockResolvedValue({ok:true});
    mocks.list.mockReset().mockResolvedValue([{ id: detail.id, participant_name: detail.participant_name, correct: 1, percentage: null, created_at: detail.created_at, test_revision: 2, total: 2, pending_review: 1, revision: 1 }]);
    mocks.get.mockReset().mockResolvedValue(detail);
    mocks.review.mockReset().mockResolvedValue({ ...detail, reviews: { point: true }, revision: 2 });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });
  it('abre la imagen histórica y guarda una decisión sin modificar la respuesta entregada', async () => {
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Entrega submissi/ }));
    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
    await screen.findByText('1. Señala el núcleo');
    expect(screen.getByTestId('image')).toHaveTextContent('original.webp');
    expect(screen.getByTestId('image').getAttribute('data-markers')).toContain('"x":0.3');
    fireEvent.click(screen.getByRole('button', { name: 'Correcto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith(detail, { point: true }));
    expect(await screen.findByText('Revisada')).toBeInTheDocument();
    expect(screen.getByText('Puntaje: 2/2 (100%)')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Revisión guardada');
    expect(screen.getByText(/Calificación: 100.00%/)).toBeInTheDocument();
    expect(detail.answers.point).toEqual({ x: .3, y: .4 });
  });
  it('conserva la decisión ante un conflicto y pide confirmar antes de descartarla', async () => {
    mocks.review.mockRejectedValue(new Error('Otra persona modificó esta revisión'));
    const close = vi.fn(); render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={close} />);
    fireEvent.click(await screen.findByRole('button', { name: /Entrega submissi/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Incorrecto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona modificó');
    expect(screen.getByRole('button', { name: 'Incorrecto' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a pruebas' }));
    expect(close).not.toHaveBeenCalled();
  });
  it('lista y abre una prueba totalmente automatica como revisada con nombre y puntaje', async () => {
    mocks.list.mockResolvedValue([{ id:'auto',participant_name:'Luis Prueba',created_at:detail.created_at,total:1,correct:1,percentage:100,pending_review:0,revision:1 }]);
    mocks.get.mockResolvedValue({...detail,id:'auto',participant_name:'Luis Prueba',total:1,snapshot:{nombre:'Prueba',questions:[{id:'q',type:'short_answer',titulo:'Tejido',accepted_answers:[]}]},answers:{q:'Epitelio'}});
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Luis Prueba/ }));
    expect(await screen.findByText('Epitelio')).toBeInTheDocument();
    expect(screen.getByText('Revisada')).toBeInTheDocument();
    expect(screen.getByText('Puntaje: 1/1 (100%)')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Correcto'})).not.toBeInTheDocument();
  });
  it('muestra la clave histórica de completación y la referencia junto a la entrega automática', async () => {
    mocks.get.mockResolvedValue({
      ...detail, total: 1, auto_correct: 0,
      snapshot: { nombre: 'Prueba', scoring_version: 2, questions: [
        { id: 'completion', type: 'completion', titulo: 'El {{1}} contiene {{2}}', blanks: [{ id: 'one' }, { id: 'two' }] },
      ], review_guides: { completion: { blanks: { one: ['Epitelio'], two: ['Células', 'Células epiteliales'] }, reference: 'Referencia del Atlas.' } } },
      answers: { completion: { one: 'Tejido', two: 'Células' } },
    });
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Entrega submissi/ }));
    expect(await screen.findByText('Hueco 1: Tejido')).toBeInTheDocument();
    expect(screen.getByText('Referencias para revisión').closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/Células \/ Células epiteliales/)).toBeInTheDocument();
    expect(screen.getByText('Referencia del Atlas.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Correcto' })).not.toBeInTheDocument();
  });
  it('revisa texto y posición con pesos iguales dentro de su pregunta y conserva decisiones parciales', async () => {
    const group = { id: 'g', titulo: '', position: 1 };
    const weighted = { ...detail, total: 1, auto_correct: 0, snapshot: { nombre: 'Prueba', scoring_version: 2, review_guides: { brief: ['Núcleo celular'] }, questions: [
      { id: 'brief', type: 'short_answer', titulo: 'Describe la estructura', group },
      { ...detail.snapshot.questions[0], group },
    ] }, answers: { brief: 'Descripción enviada por el instructor', point: detail.answers.point } };
    mocks.get.mockResolvedValue(weighted);
    mocks.list.mockResolvedValue([{ id: detail.id, participant_name: detail.participant_name, correct: 0, percentage: null, created_at: detail.created_at, test_revision: 2, total: 1, pending_review: 2, revision: 1 }]);
    mocks.review.mockResolvedValue({ ...weighted, reviews: { brief: true, point: false }, revision: 2 });
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Entrega submissi/ }));
    expect(await screen.findByText('Descripción enviada por el instructor')).toBeInTheDocument();
    expect(screen.getAllByText(/Valor del inciso: 0.5 puntos/)).toHaveLength(2);
    const textReview = screen.getByRole('group', { name: 'Calificar respuesta abierta 1' });
    fireEvent.click(within(textReview).getByRole('button', { name: 'Correcto' }));
    expect(screen.getByText('1 respuesta por revisar. Puntaje provisional: 0.5/1.')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Calificar respuesta abierta 2' })).getByRole('button', { name: 'Incorrecto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith(weighted, { brief: true, point: false }));
    expect(await screen.findByText('Puntaje: 0.5/1 (50%)')).toBeInTheDocument();
  });

  it('confirma con nombre y cuenta y elimina la entrega seleccionada y su detalle',async()=>{
    mocks.list.mockResolvedValueOnce([{id:detail.id,participant_name:'Ana Prueba',account_number:'001234567890',revision:1,created_at:detail.created_at,total:2,pending_review:1}]).mockResolvedValue([]);
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:/^Ana Prueba Entrega/}));
    await screen.findByText('1. Señala el núcleo');
    fireEvent.click(screen.getByRole('button',{name:'Eliminar esta entrega'}));
    const confirmation=screen.getByRole('alertdialog',{name:'¿Eliminar esta entrega?'});
    expect(confirmation).toHaveTextContent('001234567890');
    expect(confirmation).toHaveTextContent('Esta acción no se puede deshacer');
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(within(confirmation).getByRole('button',{name:'Cancelar'})).toHaveFocus();
    fireEvent.click(within(confirmation).getByRole('button',{name:'Eliminar definitivamente'}));
    await waitFor(()=>expect(mocks.remove).toHaveBeenCalledWith('test',expect.objectContaining({id:detail.id,revision:1})));
    expect(await screen.findByRole('status')).toHaveTextContent('Entrega eliminada correctamente');
    expect(screen.queryByText('1. Señala el núcleo')).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no hay pruebas enviadas.')).toBeInTheDocument();
  });
  it('cancelar no elimina y un fallo conserva la entrega y la revisión local',async()=>{
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()}/>);
    const deleteButton=await screen.findByRole('button',{name:/Eliminar entrega de Ana Prueba/});
    deleteButton.focus();
    fireEvent.click(deleteButton);
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Cancelar'}));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Eliminar entrega de Ana Prueba/})).toHaveFocus();
    fireEvent.click(screen.getByRole('button',{name:/^Ana Prueba Entrega/}));
    fireEvent.click(await screen.findByRole('button',{name:'Correcto'}));
    mocks.remove.mockRejectedValue(new Error('No autorizado'));
    fireEvent.click(screen.getByRole('button',{name:'Eliminar esta entrega'}));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('También se descartará la revisión');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Eliminar definitivamente'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado');
    expect(screen.getByRole('button',{name:'Correcto'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button',{name:'Guardar revisión'})).toBeEnabled();
  });

  it('Escape cancela el borrado sin solicitar eliminacion',async()=>{
    render(<InstructorSubmissionReview testId="test" name="Prueba" onClose={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:/Eliminar entrega de Ana Prueba/}));
    fireEvent.keyDown(screen.getByRole('alertdialog'),{key:'Escape'});
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

});
