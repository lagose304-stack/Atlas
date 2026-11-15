import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PruebaInstructores from './PruebaInstructores';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('../services/cloudinary', () => ({ uploadToCloudinary: mocks.upload }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/BackButton', () => ({ default: () => null }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));

const content = { nombre: 'Evaluación docente', instrucciones: 'Lee atentamente.', questions: [
  { id: 'q1', titulo: 'Identifica el tejido', correct_option_id: 'a', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }] },
] };
const test = { id: 'test1', content, estado: 'borrador', revision: 1, published_revision: null, has_code: true };

describe('Editor de prueba de instructores', () => {
  beforeEach(() => {
    mocks.upload.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => `id-${Math.random()}`) });
    mocks.rpc.mockReset().mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'atlas_list_instructor_tests') return { data: [{ ...test, nombre: content.nombre }], error: null };
      if (name === 'atlas_get_instructor_test') return { data: test, error: null };
      if (name === 'atlas_save_instructor_test') return { data: { ...test, content: args?.p_content, revision: 2 }, error: null };
      return { data: { ...test, estado: args?.p_publish ? 'publicada' : 'borrador', revision: args?.p_publish ? 2 : 3, published_revision: args?.p_publish ? 2 : null }, error: null };
    });
  });

  it('conserva el código existente sin descargarlo y exige guardar antes de publicar cambios', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Evaluación docente' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Datos de la prueba/ }));
    const input = await screen.findByLabelText('Código de acceso de 6 dígitos');
    expect(input).toHaveValue('');
    expect(screen.getByText(/Ya hay un código configurado/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre de la prueba'), { target: { value: 'Cambios docentes' } });
    expect(screen.queryByRole('button', { name: /Publicar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_test', expect.objectContaining({
      p_id: 'test1', p_revision: 1, p_code: null, p_content: { ...content, nombre: 'Cambios docentes' },
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Borrador guardado correctamente');
    expect(screen.queryByRole('heading', { name: 'Editor de prueba de instructores' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar Cambios docentes' })).toBeEnabled();
  });

  it('envía el código como texto de seis dígitos, preservando ceros iniciales, y limpia el campo al guardar', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Evaluación docente' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Datos de la prueba/ }));
    const input = await screen.findByLabelText('Código de acceso de 6 dígitos');
    fireEvent.change(input, { target: { value: '00123' } });
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '001234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_test', expect.objectContaining({ p_code: '001234' })));
    await waitFor(() => expect(screen.queryByLabelText('Código de acceso de 6 dígitos')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Editar Evaluación docente' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Datos de la prueba/ }));
    expect(await screen.findByLabelText('Código de acceso de 6 dígitos')).toHaveValue('');
  });

  it('publica explícitamente la revisión guardada y permite retirarla a borrador', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar Evaluación docente' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_publish_instructor_test', { p_id: 'test1', p_revision: 1, p_publish: true }));
    expect(screen.queryByLabelText('Nombre de la prueba')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Pasar a borrador Evaluación docente' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_publish_instructor_test', { p_id: 'test1', p_revision: 2, p_publish: false }));
    await waitFor(() => expect(screen.getByText('Borrador')).toBeInTheDocument());
    expect(mocks.rpc).not.toHaveBeenCalledWith('atlas_get_instructor_test', expect.anything());
  });

  it('no muestra éxito si el servidor rechaza una revisión vieja y conserva el contenido editado', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_save_instructor_test'
      ? { data: null, error: { code: '40001' } }
      : { data: name === 'atlas_list_instructor_tests' ? [{ ...test, nombre: content.nombre }] : test, error: null });
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Evaluación docente' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Datos de la prueba/ }));
    fireEvent.change(await screen.findByLabelText('Nombre de la prueba'), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona modificó');
    expect(screen.getByLabelText('Nombre de la prueba')).toHaveValue('Mi borrador');
    expect(screen.queryByText(/guardado correctamente/)).not.toBeInTheDocument();
  });

  it('muestra un listado y conserva el estado de las otras pruebas al publicar una', async () => {
    const second = { ...test, id: 'test2', nombre: 'Segunda evaluación', estado: 'publicada', published_revision: 1 };
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_list_instructor_tests'
      ? { data: [{ ...test, nombre: content.nombre }, second], error: null }
      : { data: { ...test, estado: 'publicada', revision: 2, published_revision: 2 }, error: null });
    render(<PruebaInstructores />);
    const list = await screen.findByRole('list', { name: 'Listado de pruebas guardadas' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('button', { name: 'Publicar Evaluación docente' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: 'Pasar a borrador Segunda evaluación' })).toBeInTheDocument();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Publicar Evaluación docente' }));
    await waitFor(() => expect(within(rows[0]).getByText('Publicada')).toBeInTheDocument());
    expect(within(rows[1]).getByRole('button', { name: 'Pasar a borrador Segunda evaluación' })).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('muestra Publicar cambios para una versión guardada pendiente de republicar', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...test, nombre: content.nombre, estado: 'publicada', revision: 3, published_revision: 2 }], error: null });
    render(<PruebaInstructores />);
    expect(await screen.findByRole('button', { name: 'Publicar cambios de Evaluación docente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pasar a borrador Evaluación docente' })).toBeInTheDocument();
    expect(screen.getByText('Cambios guardados pendientes de publicar.')).toBeInTheDocument();
  });

  it('conserva los cambios locales cuando se cancela volver al listado', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Evaluación docente' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Datos de la prueba/ }));
    fireEvent.change(await screen.findByLabelText('Nombre de la prueba'), { target: { value: 'Borrador sin guardar' } });
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(screen.getByLabelText('Nombre de la prueba')).toHaveValue('Borrador sin guardar');
    expect(screen.queryByRole('list', { name: 'Listado de pruebas guardadas' })).not.toBeInTheDocument();
  });

  it('mantiene el estado de la fila si falla la publicación y explica el error junto al listado', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'atlas_list_instructor_tests'
      ? { data: [{ ...test, nombre: content.nombre }], error: null }
      : { data: null, error: { code: '40001' } });
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar Evaluación docente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona modificó');
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.queryByText('Prueba publicada.')).not.toBeInTheDocument();
  });
  it('sube solo al guardar y reutiliza la URL si falla el guardado SQL', async () => {
    const briefTest = { ...test, content: { ...content, questions: [{ id: 'brief', type: 'short_answer', titulo: 'Identifica', accepted_answers: ['epitelio'] }] } };
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:staged-image') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const imageUrl = 'https://pub-49025e2296604f9db7de3c958d1fdd8e.r2.dev/test/upload.webp';
    mocks.upload.mockReset().mockResolvedValue({ secure_url: imageUrl });
    let failSave = true;
    mocks.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'atlas_list_instructor_tests') return { data: [{ ...test, nombre: content.nombre }], error: null };
      if (name === 'atlas_save_instructor_test') return failSave
        ? { data: null, error: { code: '40001' } }
        : { data: { ...briefTest, content: args?.p_content, revision: 2 }, error: null };
      return { data: briefTest, error: null };
    });
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: /^Editar / }));
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(await screen.findByLabelText('Archivo de imagen de respuesta breve'), { target: { files: [file] } });
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await screen.findByRole('alert');
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_test', expect.objectContaining({ p_content: expect.objectContaining({ questions: [expect.objectContaining({ image: { url: imageUrl, source: 'upload' } })] }) }));
    failSave = false;
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await screen.findByRole('status');
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:staged-image');
  });

});
