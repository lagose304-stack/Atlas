import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PruebaInstructores from './PruebaInstructores';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), temas: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('../services/cloudinary', () => ({ uploadToCloudinary: mocks.upload }));
vi.mock('../services/catalogService', () => ({ getCachedTemas: mocks.temas }));
vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/BackButton', () => ({ default: () => null }));
vi.mock('../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));

const temas = [
  { id: 2, nombre: 'Tejido conectivo', parcial: 'primer', sort_order: 2, logo_url: null },
  { id: 1, nombre: 'Tejido epitelial', parcial: 'primer', sort_order: 1, logo_url: null },
  { id: 3, nombre: 'Tejido nervioso', parcial: 'segundo', sort_order: 1, logo_url: null },
];

const bankTopic1 = {
  tema_id: 1,
  revision: 1,
  content: {
    groups: [{ id: 'g1', titulo: '', item_ids: ['q1'] }],
    questions: [{ id: 'q1', titulo: 'Identifica el tejido', correct_option_id: 'a', options: [{ id: 'a', texto: 'Epitelio' }, { id: 'b', texto: 'Músculo' }] }],
  },
};

const bankTestSummary = {
  id: 'bank-test-1',
  nombre: 'Examen parcial 1',
  estado: 'borrador',
  revision: 1,
  published_revision: null,
  can_delete_draft: true,
  mode: 'bank',
  legacy_question_count: 0,
};

const bankTestDetail = {
  id: 'bank-test-1',
  estado: 'borrador',
  revision: 1,
  published_revision: null,
  has_code: true,
  can_delete_draft: true,
  content: { nombre: 'Examen parcial 1', instrucciones: 'Lee bien.', mode: 'bank', questions_per_topic: 2, questions: [], groups: [] },
};

describe('Banco de preguntas y configuración de pruebas de instructores', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  beforeEach(() => {
    mocks.upload.mockReset();
    mocks.temas.mockReset().mockResolvedValue(temas);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => `id-${Math.random()}`) });
    mocks.rpc.mockReset().mockImplementation(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'atlas_list_instructor_bank') return { data: [{ tema_id: 1, question_count: 3, inciso_count: 3, revision: 1 }, { tema_id: 3, question_count: 1, inciso_count: 1, revision: 1 }], error: null };
      if (name === 'atlas_list_instructor_tests') return { data: [bankTestSummary], error: null };
      if (name === 'atlas_get_instructor_bank_topic') return { data: args?.p_tema_id === 1 ? bankTopic1 : { tema_id: args?.p_tema_id, revision: 0, content: { groups: [], questions: [] } }, error: null };
      if (name === 'atlas_save_instructor_bank_topic') return { data: { tema_id: args?.p_tema_id, revision: Number(args?.p_revision ?? 0) + 1, content: args?.p_content }, error: null };
      if (name === 'atlas_get_instructor_test') return { data: bankTestDetail, error: null };
      if (name === 'atlas_save_instructor_test') return { data: { ...bankTestDetail, content: args?.p_content, revision: 2 }, error: null };
      if (name === 'atlas_publish_instructor_test') return { data: { ...bankTestDetail, estado: args?.p_publish ? 'publicada' : 'borrador', revision: 2, published_revision: args?.p_publish ? 2 : null }, error: null };
      if (name === 'atlas_delete_instructor_draft') return { data: { ok: true }, error: null };
      return { data: null, error: null };
    });
  });

  it('muestra el banco de preguntas ordenado por parcial y sort_order y permite editar un tema con autoguardado por acción', async () => {
    render(<PruebaInstructores />);
    expect(await screen.findByRole('heading', { name: 'Banco de preguntas por tema' })).toBeInTheDocument();
    const firstParcial = screen.getByRole('region', { name: 'Primer parcial' });
    const topicHeadings = Array.from(firstParcial.querySelectorAll('h4')).map(h => h.textContent);
    expect(topicHeadings).toEqual(['Tejido epitelial', 'Tejido conectivo']);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir banco de Tejido epitelial' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tejido epitelial' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Datos de la prueba/ })).not.toBeInTheDocument();

    // Crear nueva pregunta dispara autoguardado del banco del tema.
    fireEvent.click(screen.getByRole('button', { name: 'Agregar nueva pregunta' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_bank_topic', expect.objectContaining({
      p_tema_id: 1,
      p_revision: 1,
    })));
    expect(await screen.findByText(/Guardado automático ·/)).toBeInTheDocument();
  });

  it('configura una prueba desde el banco con cantidad global por tema y código de 6 dígitos', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('tab', { name: /Pruebas/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar Examen parcial 1' }));

    expect(await screen.findByText('3 preguntas por examen')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cantidad de preguntas por tema'), { target: { value: '1' } });
    expect(screen.getByText('2 preguntas por examen')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Código de acceso de 6 dígitos'), { target: { value: '004567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_test', expect.objectContaining({
      p_id: 'bank-test-1',
      p_code: '004567',
      p_content: expect.objectContaining({ mode: 'bank', questions_per_topic: 1 }),
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración y código guardados correctamente');
  });

  it('sube las dos imágenes una sola vez aunque cambien de posición al cambiar el formato', async () => {
    const createObjectURL = vi.fn().mockReturnValueOnce('blob:plate-a').mockReturnValueOnce('blob:plate-b');
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = vi.fn(); });
    mocks.upload.mockResolvedValueOnce({ secure_url: 'https://example.test/a.webp' }).mockResolvedValueOnce({ secure_url: 'https://example.test/b.webp' });
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir banco de Tejido epitelial' }));
    const fileA = new File(['a'], 'a.webp', { type: 'image/webp' });
    const fileB = new File(['b'], 'b.webp', { type: 'image/webp' });
    fireEvent.change(await screen.findByLabelText('Archivo de imagen de referencia del inciso'), { target: { files: [fileA] } });
    const change = (value: string) => fireEvent.change(screen.getByLabelText('Formato de inciso a de pregunta 1'), { target: { value } });
    change('image_versus');
    fireEvent.change(screen.getByLabelText('Archivo de imagen b del versus'), { target: { files: [fileB] } });
    change('image_point');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar banco' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_save_instructor_bank_topic', expect.objectContaining({
      p_content: expect.objectContaining({ questions: [expect.objectContaining({
        id: 'q1', type: 'image_point', image: { url: 'https://example.test/a.webp', source: 'upload' },
        alternate_image: { url: 'https://example.test/b.webp', source: 'upload' },
      })] }),
    })));
    expect(mocks.upload.mock.calls.map(([file]) => file)).toEqual([fileA, fileB]);
    await screen.findByRole('heading', { name: 'Banco de preguntas por tema' });
  });

  it('confirma la eliminación desde la configuración y retira el borrador del listado', async () => {
    render(<PruebaInstructores />);
    fireEvent.click(await screen.findByRole('tab', { name: /Pruebas/ }));
    const listDelete = await screen.findByRole('button', { name: 'Eliminar borrador Examen parcial 1' });
    listDelete.focus();
    fireEvent.click(listDelete);
    const dialog = () => screen.getByRole('alertdialog', { name: '¿Eliminar este borrador?' });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(listDelete).toHaveFocus();
    expect(mocks.rpc).not.toHaveBeenCalledWith('atlas_delete_instructor_draft', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Configurar Examen parcial 1' }));
    fireEvent.change(await screen.findByLabelText('Nombre de la prueba'), { target: { value: 'Nombre sin guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }));
    expect(dialog()).toHaveTextContent('Examen parcial 1');
    expect(dialog()).toHaveTextContent('También se descartarán los cambios sin guardar');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Eliminar definitivamente' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_delete_instructor_draft', { p_id: 'bank-test-1', p_revision: 1 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Borrador eliminado.');
    expect(screen.queryByRole('heading', { name: 'Examen parcial 1' })).not.toBeInTheDocument();
  });

  it('permite migrar preguntas de una prueba antigua al banco y oculta la sección al quedar vacía', async () => {
    const legacySummary = { id: 'legacy-1', nombre: 'Prueba vieja', estado: 'borrador', revision: 1, published_revision: null, mode: 'legacy', legacy_question_count: 1 };
    const legacyDetail = {
      id: 'legacy-1', estado: 'borrador', revision: 1, published_revision: null, has_code: true,
      content: { nombre: 'Prueba vieja', instrucciones: '', groups: [{ id: 'lg1', titulo: '', item_ids: ['lq1'] }], questions: [{ id: 'lq1', titulo: 'Pregunta heredada', options: [{ id: 'o1', texto: 'A' }, { id: 'o2', texto: 'B' }], correct_option_id: 'o1' }] },
    };
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'atlas_list_instructor_bank') return { data: [], error: null };
      if (name === 'atlas_list_instructor_tests') return { data: [legacySummary], error: null };
      if (name === 'atlas_get_instructor_test') return { data: legacyDetail, error: null };
      if (name === 'atlas_migrate_instructor_question_to_bank') {
        return {
          data: {
            test: { ...legacyDetail, revision: 2, content: { ...legacyDetail.content, groups: [], questions: [] } },
            bank: { tema_id: 2, revision: 1, content: { groups: legacyDetail.content.groups, questions: legacyDetail.content.questions } },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    render(<PruebaInstructores />);
    expect(await screen.findByRole('region', { name: 'Pruebas antiguas pendientes de migrar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Migrar preguntas de Prueba vieja' }));
    expect(await screen.findByText('Pregunta heredada')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tema destino para pregunta 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Migrar esta pregunta al banco' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('atlas_migrate_instructor_question_to_bank', {
      p_test_id: 'legacy-1', p_test_revision: 1, p_group_id: 'lg1', p_tema_id: 2,
    }));
    expect(await screen.findByText(/Todas las preguntas de esta prueba ya fueron migradas/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al panel' }));
    expect(screen.queryByRole('region', { name: 'Pruebas antiguas pendientes de migrar' })).not.toBeInTheDocument();
  });
});
