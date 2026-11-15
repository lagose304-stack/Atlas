import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import InstructorParticipantResults from './InstructorParticipantResults';
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../services/instructorTests',()=>({getInstructorParticipantResult:mocks.get,isInstructorAccount:(s:string)=>/^[0-9]{10,13}$/.test(s),isSixDigitCode:(s:string)=>/^[0-9]{6}$/.test(s)}));
beforeEach(()=>mocks.get.mockReset());
async function consult(){
  fireEvent.change(screen.getByLabelText('Código para consultar resultados'),{target:{value:'001234'}});
  fireEvent.change(screen.getByLabelText('Cuenta para consultar resultados'),{target:{value:'001234567890'}});
  fireEvent.click(screen.getByRole('button',{name:'Ver mis respuestas y calificación'}));
}
it('muestra respuestas enviadas y calificación solo si la entrega está revisada',async()=>{
  mocks.get.mockResolvedValue({ok:true,participant_name:'Ana',account_number:'001234567890',created_at:'2026-11-14',snapshot:{nombre:'Prueba',scoring_version:2,questions:[{id:'brief',type:'short_answer',titulo:'Describe'}]},answers:{brief:'Respuesta original'},auto_results:{},reviews:{brief:true},result:{ok:true,correct:1,total:1,percentage:100}});
  render(<InstructorParticipantResults testId="test"/>);await consult();
  expect(await screen.findByText('Respuesta original')).toBeInTheDocument();
  expect(screen.getByText('100%')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Correcto'})).not.toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledWith('test','001234','001234567890');
  fireEvent.click(screen.getByRole('button',{name:'Cerrar resultado'}));
  expect(screen.queryByText('Respuesta original')).not.toBeInTheDocument();
});
it('una entrega pendiente no muestra preguntas ni respuestas',async()=>{
  mocks.get.mockResolvedValue({ok:false,status:'pending'});
  render(<InstructorParticipantResults testId="test"/>);await consult();
  expect(await screen.findByRole('alert')).toHaveTextContent('pendiente de revisión');
  expect(screen.queryByText('Respuesta original')).not.toBeInTheDocument();
});
