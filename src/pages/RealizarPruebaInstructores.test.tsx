import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RealizarPruebaInstructores from './RealizarPruebaInstructores';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
const meta = { id: 't1', nombre: 'Evaluación docente', instrucciones: 'Lee atentamente.', question_count: 1 };
const publicContent = { nombre: meta.nombre, instrucciones: meta.instrucciones, questions: [
  { id: 'q1', titulo: 'Identifica el tejido', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }] },
] };
const renderPage = () => render(<MemoryRouter initialEntries={['/evaluaciones/instructores/t1']}><Routes>
  <Route path="/evaluaciones/instructores/:pruebaId" element={<RealizarPruebaInstructores />} />
</Routes></MemoryRouter>);
const enter = async (start = true) => {
  fireEvent.change(await screen.findByLabelText('Código de acceso'), { target: { value: '001234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Comenzar prueba' }));
  if (start) {
    const backend = mocks.rpc.getMockImplementation();
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'atlas_begin_instructor_test') return { data: { ok:true,participant_name:args?.p_name,account_number:args?.p_account,answers:{},current_question_id:null,progress_revision:1 },error:null };
      if (name === 'atlas_save_instructor_progress') return { data:{ok:true,progress_revision:Number(args?.p_revision)+1},error:null };
      return backend?.(name,args);
    });
    fireEvent.change(await screen.findByLabelText('N\u00famero de cuenta'), { target:{value:'001234567890'} });
    fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'Persona de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a las preguntas' }));
  }
};

describe('Acceso público a prueba de instructores', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.rpc.mockReset().mockImplementation(async (name: string) => {
      if (name === 'atlas_begin_instructor_test') return { data: { ok:true,participant_name:'Ana Prueba',account_number:'001234567890',answers:{},current_question_id:null,progress_revision:1 },error:null };
      if (name === 'atlas_public_instructor_tests') return { data: [meta], error: null };
      if (name === 'atlas_unlock_instructor_test') return { data: { ok: true, token: 'opaque-token', test: publicContent }, error: null };
      return { data: { ok: true, correct: 1, total: 1, percentage: 100 }, error: null };
    });
  });

  it('pide nombre solo tras validar codigo y espera a registrarlo antes de mostrar preguntas', async () => {
    renderPage();
    await screen.findByLabelText('Código de acceso');
    expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
    await enter(false);
    const input = await screen.findByLabelText('Nombre completo');
    expect(screen.queryByText('1. Identifica el tejido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar a las preguntas' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '  Ana Prueba  ' } });
    fireEvent.change(screen.getByLabelText('N\u00famero de cuenta'), { target:{value:'001234567890'} });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a las preguntas' }));
    expect(await screen.findByText('1. Identifica el tejido')).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('atlas_begin_instructor_test', { p_id:'t1', p_token:'opaque-token', p_name:'Ana Prueba',p_account:'001234567890' });
  });
  it('exige cuenta de 10 a 13 dígitos y recupera sin pedir nombre ni perder la respuesta anterior', async () => {
    const backend = mocks.rpc.getMockImplementation();
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'atlas_resume_instructor_test') return { data: { ok:true, participant_name:'Nombre recuperado',account_number:'001234567890',answers:{q1:'b'},current_question_id:null,progress_revision:7 },error:null };
      if (name === 'atlas_save_instructor_progress') return { data:{ok:true,progress_revision:8},error:null };
      return backend?.(name,args);
    });
    renderPage(); await enter(false);
    fireEvent.click(await screen.findByRole('button', {name:'Continuar prueba'}));
    expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
    const account = screen.getByLabelText('Número de cuenta');
    fireEvent.change(account,{target:{value:'123456789'}});
    expect(screen.getByRole('button',{name:'Recuperar y continuar'})).toBeDisabled();
    fireEvent.change(account,{target:{value:'12345678901234'}});
    expect(screen.getByRole('button',{name:'Recuperar y continuar'})).toBeDisabled();
    fireEvent.change(account,{target:{value:'001234567890'}});
    fireEvent.click(screen.getByRole('button',{name:'Recuperar y continuar'}));
    expect(await screen.findByText('Nombre recuperado')).toBeInTheDocument();
    expect(screen.getByLabelText('Músculo')).toBeChecked();
    expect(mocks.rpc).toHaveBeenCalledWith('atlas_resume_instructor_test',{p_id:'t1',p_token:'opaque-token',p_account:'001234567890'});
    expect(mocks.rpc.mock.calls.some(([name])=>name==='atlas_begin_instructor_test')).toBe(false);
  });
  it.each(['not_found','locked','submitted'])('explica una recuperación %s sin mostrar preguntas', async status => {
    const backend=mocks.rpc.getMockImplementation();
    mocks.rpc.mockImplementation(async(name: string,args?: Record<string,unknown>)=>name==='atlas_resume_instructor_test'?{data:{ok:false,status},error:null}:backend?.(name,args));
    renderPage();await enter(false);
    fireEvent.click(await screen.findByRole('button',{name:'Continuar prueba'}));
    fireEvent.change(screen.getByLabelText('Número de cuenta'),{target:{value:'1234567890'}});
    fireEvent.click(screen.getByRole('button',{name:'Recuperar y continuar'}));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Finalizar prueba'})).not.toBeInTheDocument();
  });

  it('solo pide metadatos antes del código y entrega respuestas al servidor sin calificar en cliente', async () => {
    renderPage();
    await screen.findByLabelText('Código de acceso');
    expect(screen.queryByText('Identifica el tejido')).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await enter();
    expect(await screen.findByText('1. Identifica el tejido')).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('atlas_unlock_instructor_test', { p_id: 't1', p_code: '001234' });
    fireEvent.click(screen.getByLabelText('Epitelio'));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar prueba' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_grade_instructor_test', {
      p_id: 't1', p_token: 'opaque-token', p_answers: { q1: 'a' },
    }));
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar prueba' })).not.toBeInTheDocument();
  });

  it.each([
    { status: 'invalid_code', message: 'El código no es correcto' },
    { status: 'locked', message: 'Demasiados intentos' },
  ])('no muestra preguntas con acceso $status', async ({ status, message }) => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'atlas_public_instructor_tests' ? [meta] : { ok: false, status }, error: null }));
    renderPage(); await enter(false);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('1. Identifica el tejido')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Código de acceso')).toHaveValue('');
  });

  it('no permite comenzar una prueba que no está publicada aunque se entre por URL', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('no está publicada');
    expect(screen.queryByLabelText('Código de acceso')).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('solicita todas las respuestas y conserva las selecciones si la calificación falla por conexión', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_grade_instructor_test'
      ? { data: null, error: { code: 'FETCH_ERROR' } }
      : { data: name === 'atlas_public_instructor_tests' ? [meta] : { ok: true, token: 'opaque-token', test: publicContent }, error: null });
    renderPage(); await enter();
    const submit = await screen.findByRole('button', { name: 'Finalizar prueba' });
    fireEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Responde todas');
    fireEvent.click(screen.getByLabelText('Epitelio'));
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Comprueba tu conexión'));
    expect(screen.getByLabelText('Epitelio')).toBeChecked();
    expect(screen.queryByText('Resultado de la prueba')).not.toBeInTheDocument();
  });

  it('oculta las preguntas y vuelve a pedir código si el acceso caducó', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'atlas_public_instructor_tests' ? [meta]
      : name === 'atlas_unlock_instructor_test' ? { ok: true, token: 'opaque-token', test: publicContent }
        : name === 'atlas_start_instructor_test' ? { ok: true, participant_name: 'Persona de prueba' } : { ok: false, status: 'expired' }, error: null }));
    renderPage(); await enter();
    fireEvent.click(await screen.findByLabelText('Epitelio'));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar prueba' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu acceso caducó');
    expect(screen.getByLabelText('Código de acceso')).toBeInTheDocument();
    expect(screen.queryByText('1. Identifica el tejido')).not.toBeInTheDocument();
  });

  it('muestra preguntas con incisos y conserva los IDs originales al calificar', async () => {
    const grouped = { ...publicContent, questions: [
      { ...publicContent.questions[0], group: { id: 'g1', titulo: 'Contexto común', position: 1 } },
      { id: 'q2', type: 'short_answer', titulo: 'Nombre del tejido', group: { id: 'g1', titulo: 'Contexto común', position: 1 } },
    ] };
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'atlas_public_instructor_tests' ? [meta]
      : name === 'atlas_unlock_instructor_test' ? { ok: true, token: 'opaque-token', test: grouped }
        : { ok: true, correct: 2, total: 2, percentage: 100 }, error: null }));
    renderPage(); await enter();
    expect(await screen.findByRole('heading', { name: 'Pregunta 1' })).toBeInTheDocument();
    expect(screen.getByText('Contexto común')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pregunta 2' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Epitelio'));
    fireEvent.change(screen.getByLabelText('Respuesta de inciso b de pregunta 1'), { target: { value: 'Epitelio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar prueba' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_grade_instructor_test', {
      p_id: 't1', p_token: 'opaque-token', p_answers: { q1: 'a', q2: 'Epitelio' },
    }));
    expect(await screen.findByText('2 puntos obtenidos de 2.')).toBeInTheDocument();
  });
  it.each(['scheduled','closed'])('no permite introducir codigo fuera de horario %s y permite consultar resultados', async state => {
    const now=Date.now();
    const scheduled={...meta,opens_at:new Date(now+(state==='scheduled'?3600000:-7200000)).toISOString(),closes_at:new Date(now+(state==='scheduled'?7200000:-3600000)).toISOString(),server_time:new Date(now).toISOString()};
    mocks.rpc.mockResolvedValue({data:[scheduled],error:null});
    renderPage();await screen.findByRole('region',{name:'Prueba fuera de horario'});
    expect(screen.queryByLabelText('C\u00f3digo de acceso')).not.toBeInTheDocument();
    expect(mocks.rpc.mock.calls.some(([name])=>name==='atlas_unlock_instructor_test')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'Consultar resultados'}));
    expect(await screen.findByLabelText('Cuenta para consultar resultados')).toBeInTheDocument();
    expect(screen.queryByLabelText('C\u00f3digo de acceso')).not.toBeInTheDocument();
  });

  it('bloquea edici?n y entrega al llegar el cierre conservando la respuesta visible',async()=>{
    const original=mocks.rpc.getMockImplementation();
    const clock=Date.now();
    const timed={...meta,opens_at:new Date(clock-3600000).toISOString(),closes_at:new Date(clock+1800).toISOString(),server_time:new Date(clock).toISOString()};
    mocks.rpc.mockImplementation(async(name:string,args?:Record<string,unknown>)=>name==='atlas_public_instructor_tests'?{data:[timed],error:null}:original?.(name,args));
    renderPage();await enter();
    fireEvent.click(await screen.findByLabelText('Epitelio'));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('El horario de la prueba finalizó'),{timeout:3500});
    expect(screen.getByLabelText('Epitelio')).toBeChecked();
    expect(screen.getByLabelText('Epitelio')).toBeDisabled();
    expect(screen.getByRole('button',{name:'Finalizar prueba'})).toBeDisabled();
    expect(mocks.rpc.mock.calls.some(([name])=>name==='atlas_grade_instructor_test')).toBe(false);
  });

});
