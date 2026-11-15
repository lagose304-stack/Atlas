import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import InstructorSectionScores from './InstructorSectionScores';
import { instructorSectionResults, type InstructorSubmissionSnapshot } from '../types/instructorQuestions';
it('desglosa temas con 1 punto por pregunta y actualiza el estado al completar revisión', () => {
  const s1 = { id:'s1',tema_id:1,nombre:'Epitelial' }, s2 = { id:'s2',tema_id:2,nombre:'Muscular' };
  const snapshot: InstructorSubmissionSnapshot = { nombre:'Prueba',scoring_version:2,questions:[
    ...Array.from({length:10},(_,i) => ({id:'q'+i,titulo:'Elige',type:'single_choice' as const,options:[],group:{id:'g'+i,titulo:'',position:i+1,section:s1}})),
    {id:'brief',titulo:'Describe',type:'short_answer',group:{id:'g11',titulo:'',position:11,section:s2}},
    {id:'point',titulo:'Señala',type:'image_point',image:{url:'x'},group:{id:'g11',titulo:'',position:11,section:s2}},
  ] };
  const auto = Object.fromEntries(Array.from({length:10},(_,i)=>['q'+i,i<5]));
  const provisional = instructorSectionResults(snapshot,auto,{brief:true});
  expect(provisional[0].correct).toBe(5); expect(provisional[0].total).toBe(10);
  expect(provisional[1].correct).toBe(.5); expect(provisional[1].pending_review).toBe(1);
  const { rerender } = render(<InstructorSectionScores sections={provisional} />);
  expect(screen.getByText('5 de 10')).toBeInTheDocument();
  expect(screen.getByText('Provisional · 1 por revisar')).toBeInTheDocument();
  rerender(<InstructorSectionScores sections={instructorSectionResults(snapshot,auto,{brief:true,point:false})} />);
  const row = screen.getByRole('row', { name: /Muscular/ });
  expect(within(row).getByText('0.5 de 1')).toBeInTheDocument();
  expect(within(row).getByText('50% · Revisada')).toBeInTheDocument();
});
