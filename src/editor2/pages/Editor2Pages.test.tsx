import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCatalog } from '../services/catalogIndex';
import { EDITOR2_RECENTS_KEY, readRecentPageKeys, rememberPage } from '../services/pageIndex';
import { createPlacedBlock, createNestedCanvasNode, createLeafPlacedBlock, createTextBlock } from '../domain/defaults';
import { clearEditor2Drafts } from '../store/draftCache';
import { useEditor2Store } from '../store/editor2Store';
import Editor2Home from './Editor2Home';
import Editor2Workspace from './Editor2Workspace';

const catalogState = vi.hoisted(() => ({
  temas: [] as Array<{ id: number; nombre: string; parcial: string; sort_order: number | null }>,
  subtemas: [] as Array<{ id: number; nombre: string; tema_id: number; sort_order: number | null }>,
}));

vi.mock('../services/catalogIndex', () => ({
  loadCatalog: vi.fn(async () => ({
    temas: catalogState.temas,
    subtemas: catalogState.subtemas,
  })),
}));

vi.mock('../services/editor2Api', () => ({
  editor2Api: {
    getWorkspace: vi.fn(async (pageKey: string) => ({
      pageKey,
      draft: null,
      versions: [],
      publication: null,
    })),
    saveDraft: vi.fn(),
    createVersion: vi.fn(),
    publishDraft: vi.fn(),
    publishVersion: vi.fn(),
    deleteVersion: vi.fn(),
    getPublicDoc: vi.fn(),
  },
}));

vi.mock('../components/Editor2Canvas', () => ({
  default: ({ doc }: { doc: { pageKey: string } }) => (
    <div data-testid="canvas" className="e2-canvas-root">Lienzo de {doc.pageKey}</div>
  ),
}));

vi.mock('../../components/Header', () => ({ default: () => null }));
vi.mock('../../components/Footer', () => ({ default: () => null }));
vi.mock('../../components/BackButton', () => ({ default: () => null }));
vi.mock('../../hooks/useSmartBackNavigation', () => ({ useSmartBackNavigation: () => vi.fn() }));

function installMemoryStorage(): void {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderEditor2 = (entry: string) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/editor-paginas-v2" element={<Editor2Home />} />
      <Route path="/editor-paginas-v2/p/:pageKey" element={<Editor2Workspace />} />
    </Routes>
    <LocationProbe />
  </MemoryRouter>,
);

describe('Editor2Home', () => {
  beforeEach(() => {
    installMemoryStorage();
    catalogState.temas = [];
    catalogState.subtemas = [];
  });

  it('carga el índice local y permite buscar', async () => {
    renderEditor2('/editor-paginas-v2');

    expect(await screen.findByRole('heading', { name: 'Editor de páginas 2.0' })).toBeInTheDocument();
    const input = await screen.findByRole('searchbox', { name: 'Buscar páginas' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);

    fireEvent.change(input, { target: { value: 'temario' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('muestra temas y subtemas del catálogo en el índice', async () => {
    catalogState.temas = [{ id: 7, nombre: 'Tejido epitelial', parcial: 'Primer parcial', sort_order: 1 }];
    catalogState.subtemas = [
      { id: 30, nombre: 'Epitelio simple', tema_id: 7, sort_order: 1 },
      { id: 31, nombre: 'Epitelio estratificado', tema_id: 7, sort_order: 2 },
    ];

    renderEditor2('/editor-paginas-v2');

    expect(await screen.findByRole('button', { name: /Tejido epitelial/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tejido epitelial' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Epitelio simple/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Epitelio estratificado/ })).toBeInTheDocument();
  });

  it('avisa si falla la carga del catálogo sin perder las páginas principales', async () => {
    vi.mocked(loadCatalog).mockRejectedValueOnce(new Error('catálogo no disponible'));

    renderEditor2('/editor-paginas-v2');

    expect(await screen.findByText(/No se pudo cargar el catálogo/)).toBeInTheDocument();
    expect(await screen.findByRole('searchbox', { name: 'Buscar páginas' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Créditos/ }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('muestra recientes y permite limpiarlos sin borrar contenido', async () => {
    rememberPage('creditos');
    renderEditor2('/editor-paginas-v2');

    expect(await screen.findByRole('link', { name: /Continuar.*Créditos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar recientes' }));

    expect(screen.queryByRole('link', { name: /Continuar.*Créditos/ })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(EDITOR2_RECENTS_KEY)).toBeNull();
  });

  it('aplica la búsqueda y la sección recibidas en la URL y enfoca si se pide', async () => {
    renderEditor2('/editor-paginas-v2?q=creditos&seccion=Cr%C3%A9ditos&foco=buscador');

    const input = await screen.findByRole('searchbox', { name: 'Buscar páginas' });
    expect(input).toHaveValue('creditos');
    expect(input).toHaveFocus();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});

describe('Editor2Workspace', () => {
  beforeEach(() => {
    installMemoryStorage();
    useEditor2Store.getState().reset();
    clearEditor2Drafts();
    catalogState.temas = [];
    catalogState.subtemas = [];
  });

  it('abre una página por clave, muestra el breadcrumb y la recuerda', async () => {
    renderEditor2('/editor-paginas-v2/p/temario');

    expect(await screen.findByRole('heading', { name: 'Temario' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Temario' })).toHaveAttribute('href', '/editor-paginas-v2?seccion=Temario');
    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2/p/temario');
    expect(readRecentPageKeys()).toEqual(['temario']);
  });

  it('abre el lienzo editable con su barra de guardado', async () => {
    renderEditor2('/editor-paginas-v2/p/home');

    expect(await screen.findByTestId('canvas')).toHaveTextContent('Lienzo de home');
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Borrador al día');
  });

  it('alterna entre edición y vista previa con el mismo documento', async () => {
    renderEditor2('/editor-paginas-v2/p/home');

    expect(screen.queryByRole('button', { name: 'Volver a editar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Vista previa/ }));
    const exit = screen.getByRole('button', { name: 'Volver a editar' });
    expect(exit).toHaveFocus();
    expect(screen.getAllByRole('button')).toEqual([exit]);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    const previewFrame = screen.getByTitle<HTMLIFrameElement>('Vista previa de la página');
    const previewWindow = previewFrame.contentWindow!;
    const sendDocument = vi.spyOn(previewWindow, 'postMessage');
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: previewWindow,
        origin: window.location.origin,
        data: 'atlas:editor2-preview-ready',
      }));
    });
    expect(sendDocument).toHaveBeenCalledWith(
      { type: 'atlas:editor2-preview-document', doc: useEditor2Store.getState().doc },
      window.location.origin,
    );
    fireEvent.click(exit);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(previewFrame).not.toBeInTheDocument();
    expect(exit).not.toBeInTheDocument();
  });

  it('conserva el borrador en memoria al volver a la misma página', async () => {
    const first = renderEditor2('/editor-paginas-v2/p/home');
    await screen.findByTestId('canvas');

    const current = useEditor2Store.getState().doc!;
    act(() => {
      useEditor2Store.getState().applyDoc({
        ...current,
        root: {
          ...current.root,
          slots: {
            children: [
              createPlacedBlock(
                createNestedCanvasNode({children: [createLeafPlacedBlock(createTextBlock({ id: '77777777-7777-4777-8777-777777777777', text: 'Persistente' }))]}),
              ),
            ],
          },
        },
      });
    });
    first.unmount();

    // Vaciar el store fuerza a que el borrador venga del caché por página.
    act(() => {
      useEditor2Store.getState().reset();
    });
    expect(useEditor2Store.getState().doc).toBeNull();

    renderEditor2('/editor-paginas-v2/p/home');

    expect(await screen.findByTestId('canvas')).toHaveTextContent('Lienzo de home');
    expect(useEditor2Store.getState().doc?.pageKey).toBe('home');
    expect(useEditor2Store.getState().doc?.root.slots.children).toHaveLength(1);
  });

  it('resuelve el título de un tema y el breadcrumb de un subtema', async () => {
    catalogState.temas = [{ id: 7, nombre: 'Tejido epitelial', parcial: 'Primer parcial', sort_order: 1 }];
    catalogState.subtemas = [{ id: 30, nombre: 'Epitelio simple', tema_id: 7, sort_order: 1 }];

    renderEditor2('/editor-paginas-v2/p/subtema-30');

    expect(await screen.findByRole('heading', { name: 'Epitelio simple' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tejido epitelial' })).toHaveAttribute(
      'href',
      '/editor-paginas-v2/p/tema-7',
    );
    expect(readRecentPageKeys()).toEqual(['subtema-30']);
  });

  it('rechaza una clave de página inválida sin grabar recientes', async () => {
    renderEditor2('/editor-paginas-v2/p/Clave%20Inv%C3%A1lida');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enlace de página no válido');
    expect(readRecentPageKeys()).toEqual([]);
  });

  it('avisa de un parámetro de versión inválido', async () => {
    renderEditor2('/editor-paginas-v2/p/home?version=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('no es válido');
  });

  it('muestra la revisión solicitada cuando el parámetro es válido', async () => {
    renderEditor2('/editor-paginas-v2/p/home?version=7');
    expect(await screen.findByText('Este enlace solicita la revisión n.º 7.')).toBeInTheDocument();
  });

  it('envía Ctrl+K al buscador del índice', async () => {
    renderEditor2('/editor-paginas-v2/p/home');

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByTestId('location')).toHaveTextContent('/editor-paginas-v2?foco=buscador');
    await screen.findByRole('searchbox', { name: 'Buscar páginas' });
  });
});
