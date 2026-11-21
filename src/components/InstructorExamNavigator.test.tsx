import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import InstructorExamNavigator from './InstructorExamNavigator';
import { buildInstructorPreviewQuestions } from './InstructorTestPreview';
import type { InstructorAnswers, PublicInstructorQuestion } from '../types/instructorQuestions';
const questions: PublicInstructorQuestion[] = [
  { id:'a',type:'short_answer',titulo:'Describe el tejido',group:{id:'g1',titulo:'',position:1,section:{id:'s1',tema_id:1,nombre:'Epitelial',position:1}} },
  { id:'b',type:'short_answer',titulo:'Describe el músculo',group:{id:'g2',titulo:'',position:2,section:{id:'s2',tema_id:2,nombre:'Muscular',position:2}} },
];
function Navigator({initial='g1', showTopics=true}:{initial?:string; showTopics?: boolean}) {
  const [current,setCurrent]=useState(initial),[answers,setAnswers]=useState<InstructorAnswers>({});
  return <InstructorExamNavigator questions={questions} answers={answers} currentId={current} onSelect={setCurrent} onAnswer={(id,answer)=>setAnswers(old=>({...old,[id]:answer}))} disabled={false} showTopics={showTopics}/>;
}
it('conserva respuestas al navegar y muestra progreso, tema y primera pendiente',()=>{
  render(<Navigator/>);
  expect(screen.getByRole('heading',{name:'Pregunta 1'})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Respuesta de inciso a de pregunta 1'),{target:{value:'Epitelio'}});
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
  fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
  expect(screen.getByRole('heading',{name:'Pregunta 2'})).toBeInTheDocument();
  expect(screen.queryByLabelText('Respuesta de inciso a de pregunta 1')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ir a un tema'),{target:{value:'s1'}});
  expect(screen.getByLabelText('Respuesta de inciso a de pregunta 1')).toHaveValue('Epitelio');
  fireEvent.click(screen.getByRole('button',{name:'Ir a la primera pendiente'}));
  expect(screen.getByRole('heading',{name:'Pregunta 2'})).toBeInTheDocument();
});
it('abre la pregunta recuperada y permite volver con los controles de navegación',()=>{
  render(<Navigator initial="g2"/>);
  expect(screen.getByRole('heading',{name:'Pregunta 2'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Ir a pregunta 2, pendiente'})).toHaveAttribute('aria-current','step');
  fireEvent.click(screen.getByRole('button',{name:'Anterior'}));
  expect(screen.getByRole('heading',{name:'Pregunta 1'})).toBeInTheDocument();
});
it('oculta nombres y navegación por tema durante el examen', () => {
  render(<Navigator showTopics={false} />);
  expect(screen.queryByLabelText('Ir a un tema')).not.toBeInTheDocument();
  expect(screen.queryByText('Epitelial')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ir a pregunta 1, pendiente' })).toHaveAttribute('title', 'Pregunta 1 · Sin responder');
});
it('presenta una consigna por placa y conserva el avance de cada respuesta', () => {
  const prompt = (slot: string) => ({ id: `versus-${slot}-test`, titulo: `Identifica ${slot}` });
  const image = (slot: string) => ({ url: `https://example.test/${slot}.png`, source: 'upload' as const });
  const projected = buildInstructorPreviewQuestions({ nombre: 'Versus', instrucciones: '', questions: [{
    id: 'comparison', titulo: 'Compara ambas placas', type: 'image_versus',
    image_a: image('a'), image_b: image('b'), prompts: { a: prompt('a1'), b: prompt('b1') },
  }] });
  const onAnswer = vi.fn();
  const renderExam = (answers: InstructorAnswers) => <InstructorExamNavigator questions={projected} answers={answers}
    currentId="legacy-comparison" onSelect={vi.fn()} onAnswer={onAnswer} disabled={false} />;
  const recovered = { 'versus-a1-test': 'Epitelio' };
  const { rerender } = render(renderExam(recovered));
  const comparison = screen.getByLabelText('Comparación de dos imágenes');
  expect(within(comparison).getAllByRole('textbox')).toHaveLength(2);
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
  expect(within(comparison).getByLabelText(/Placa A:/)).toHaveValue('Epitelio');
  expect(within(comparison).getByLabelText(/Placa B:/)).toHaveValue('');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  fireEvent.change(within(comparison).getByLabelText(/Placa B:/), { target: { value: 'Serosa' } });
  expect(onAnswer).toHaveBeenCalledWith('versus-b1-test', 'Serosa');
  rerender(renderExam({ ...recovered, 'versus-b1-test': 'Serosa' }));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});
it('marca vacío, parcial y completo, conserva el color al seleccionar y permite saltar con el cuadrado',()=>{
  const mixed:PublicInstructorQuestion[]=[
    {...questions[0]},
    {id:'c',type:'completion',titulo:'El {{1}} contiene {{2}}',blanks:[{id:'x'},{id:'y'}],group:questions[0].group},
    questions[1],
  ];
  function Exam(){const [id,setId]=useState('g1'),[answers,setAnswers]=useState<InstructorAnswers>({});
    return <InstructorExamNavigator questions={mixed} answers={answers} currentId={id} onSelect={setId} onAnswer={(key,value)=>setAnswers(old=>({...old,[key]:value}))} disabled={false}/>;
  }
  render(<Exam/>);
  const first=()=>screen.getByRole('button',{name:/Ir a pregunta 1,/});
  expect(first()).toHaveAttribute('data-answer-state','empty');
  fireEvent.change(screen.getByLabelText('Hueco 1 de inciso b de pregunta 1'),{target:{value:'epitelio'}});
  expect(first()).toHaveAttribute('data-answer-state','partial');
  expect(first()).toHaveAttribute('aria-current','step');
  fireEvent.change(screen.getByLabelText('Respuesta de inciso a de pregunta 1'),{target:{value:'Tejido'}});
  expect(first()).toHaveAttribute('data-answer-state','partial');
  fireEvent.change(screen.getByLabelText('Hueco 2 de inciso b de pregunta 1'),{target:{value:'células'}});
  expect(first()).toHaveAttribute('data-answer-state','complete');
  fireEvent.click(screen.getByRole('button',{name:'Ir a pregunta 2, pendiente'}));
  expect(screen.getByRole('heading',{name:'Pregunta 2'})).toBeInTheDocument();
  expect(first()).toHaveAttribute('data-answer-state','complete');
  fireEvent.click(first());
  fireEvent.change(screen.getByLabelText('Respuesta de inciso a de pregunta 1'),{target:{value:''}});
  expect(first()).toHaveAttribute('data-answer-state','partial');
  fireEvent.change(screen.getByLabelText('Hueco 1 de inciso b de pregunta 1'),{target:{value:''}});
  fireEvent.change(screen.getByLabelText('Hueco 2 de inciso b de pregunta 1'),{target:{value:' '}});
  expect(first()).toHaveAttribute('data-answer-state','empty');
});
