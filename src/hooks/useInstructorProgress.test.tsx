import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInstructorProgress from './useInstructorProgress';
import type { InstructorAnswers } from '../types/instructorQuestions';
const mocks=vi.hoisted(()=>({save:vi.fn()}));
vi.mock('../services/instructorTests',()=>({saveInstructorProgress:mocks.save}));
describe('Guardado del progreso de instructores',()=>{
  beforeEach(()=>{mocks.save.mockReset().mockImplementation(async(_id,_token,revision)=>({ok:true,progress_revision:revision+1}));});
  it('serializa cambios durante una petición y usa la revisión devuelta al guardar lo más reciente',async()=>{
    let finish!: (value:unknown)=>void;
    mocks.save.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const {result,rerender}=renderHook(({answers})=>useInstructorProgress('test','token',true,1,answers,'g2'),{initialProps:{answers:{} as InstructorAnswers}});
    rerender({answers:{q:'Primera'}});
    let first!:Promise<void>;
    act(()=>{first=result.current.flush();});
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
    rerender({answers:{q:'Última'}});
    let second!:Promise<void>;
    act(()=>{second=result.current.flush();});
    await act(async()=>{finish({ok:true,progress_revision:2});await first;await second;});
    expect(mocks.save).toHaveBeenNthCalledWith(2,'test','token',2,{q:'Última'},'g2');
    expect(result.current.status).toBe('saved');
  });
  it('conserva respuestas y permite reintentar cuando falla el guardado',async()=>{
    mocks.save.mockRejectedValueOnce(new Error('Sin conexión'));
    const {result,rerender}=renderHook(({answers})=>useInstructorProgress('test','token',true,4,answers,'g1'),{initialProps:{answers:{} as InstructorAnswers}});
    rerender({answers:{q:'No perder'}});
    await act(async()=>{await result.current.flush().catch(()=>{});});
    expect(result.current.status).toBe('error');expect(result.current.error).toBe('Sin conexión');
    await act(async()=>{await result.current.flush();});
    expect(mocks.save).toHaveBeenLastCalledWith('test','token',4,{q:'No perder'},'g1');
    expect(result.current.status).toBe('saved');
  });
});
