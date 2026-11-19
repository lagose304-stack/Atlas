import { beforeEach, describe, expect, it } from 'vitest';
import type { Editor2CatalogSnapshot } from './catalogIndex';
import {
  EDITOR2_HOME_PATH,
  EDITOR2_RECENTS_KEY,
  catalogPagesFrom,
  childrenByParent,
  clearRecentPages,
  filterPages,
  focusSearchPath,
  groupPagesBySection,
  loadPageIndex,
  normalizeSearchValue,
  readRecentPageKeys,
  readVersionParam,
  rememberPage,
  sectionPath,
  workspacePath,
} from './pageIndex';

const emptyCatalog: Editor2CatalogSnapshot = { temas: [], subtemas: [] };

const sampleCatalog: Editor2CatalogSnapshot = {
  temas: [
    { id: 7, nombre: 'Tejido epitelial', parcial: 'Primer parcial', sort_order: 1 },
    { id: 12, nombre: 'Tejido conectivo', parcial: 'Segundo parcial', sort_order: 2 },
  ],
  subtemas: [
    { id: 30, nombre: 'Epitelio simple', tema_id: 7, sort_order: 1 },
    { id: 31, nombre: 'Epitelio estratificado', tema_id: 7, sort_order: 2 },
    { id: 44, nombre: 'Colágeno', tema_id: 12, sort_order: 1 },
  ],
};

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

describe('índice del editor 2.0', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('devuelve una copia válida de las páginas principales', async () => {
    const first = await loadPageIndex(async () => emptyCatalog);
    expect(first.warning).toBeNull();
    expect(first.pages.map((page) => page.pageKey)).toEqual(['home', 'temario', 'creditos']);

    first.pages[0].title = 'Modificado';
    const second = await loadPageIndex(async () => emptyCatalog);
    expect(second.pages[0].title).toBe('Inicio');
  });

  it('conserva las páginas principales y avisa si falla el catálogo', async () => {
    const result = await loadPageIndex(async () => { throw new Error('catálogo no disponible'); });

    expect(result.pages.map((page) => page.pageKey)).toEqual(['home', 'temario', 'creditos']);
    expect(result.warning).toContain('No se pudo cargar el catálogo');
  });

  it('convierte temas y subtemas en páginas con su jerarquía', () => {
    const pages = catalogPagesFrom(sampleCatalog);

    expect(pages.map((page) => page.pageKey)).toEqual([
      'tema-7', 'tema-12', 'subtema-30', 'subtema-31', 'subtema-44',
    ]);
    expect(pages[0]).toMatchObject({
      title: 'Tejido epitelial',
      section: 'Temario',
      publicPath: '/subtemas/7',
      kind: 'tema',
      parcial: 'Primer parcial',
    });
    expect(pages[2]).toMatchObject({
      title: 'Epitelio simple',
      publicPath: '/ver-placas/30',
      kind: 'subtema',
      parentPageKey: 'tema-7',
    });
    expect(pages[2].keywords).toContain('Tejido epitelial');
    expect([...childrenByParent(pages).keys()]).toEqual(['tema-7', 'tema-12']);
  });

  it('busca sin acentos por título, sección, clave y palabras clave', async () => {
    const { pages } = await loadPageIndex(async () => emptyCatalog);

    expect(normalizeSearchValue('Créditos')).toBe('creditos');
    expect(filterPages(pages, 'creditos', 'Todas').map((page) => page.pageKey)).toEqual(['creditos']);
    expect(filterPages(pages, 'indice', 'Todas').map((page) => page.pageKey)).toEqual(['temario']);
    expect(filterPages(pages, '/temario', 'Todas').map((page) => page.pageKey)).toEqual(['temario']);
    expect(filterPages(pages, 'atlas portada', 'Todas').map((page) => page.pageKey)).toEqual(['home']);
  });

  it('muestra el tema padre cuando solo coincide un subtema', async () => {
    const { pages } = await loadPageIndex(async () => sampleCatalog);

    expect(filterPages(pages, 'colageno', 'Todas').map((page) => page.pageKey)).toEqual([
      'tema-12', 'subtema-44',
    ]);
    expect(filterPages(pages, 'epitelio simple', 'Todas').map((page) => page.pageKey)).toEqual([
      'tema-7', 'subtema-30',
    ]);
    expect(filterPages(pages, 'tejido', 'Todas').map((page) => page.pageKey)).toEqual([
      'tema-7', 'tema-12', 'subtema-30', 'subtema-31', 'subtema-44',
    ]);
  });

  it('filtra por sección y agrupa conservando el orden del índice', async () => {
    const { pages } = await loadPageIndex(async () => sampleCatalog);
    const temario = filterPages(pages, '', 'Temario');

    expect(temario.map((page) => page.pageKey)).toEqual([
      'temario', 'tema-7', 'tema-12', 'subtema-30', 'subtema-31', 'subtema-44',
    ]);
    expect(groupPagesBySection(pages).map(([section, items]) => [section, items.length])).toEqual([
      ['Inicio', 1],
      ['Temario', 6],
      ['Créditos', 1],
    ]);
  });

  it('construye rutas compartibles y rutas filtradas', () => {
    expect(workspacePath('tema-12')).toBe('/editor-paginas-v2/p/tema-12');
    expect(workspacePath('Clave Inválida')).toBe(EDITOR2_HOME_PATH);
    expect(sectionPath('Temario')).toBe('/editor-paginas-v2?seccion=Temario');
    expect(focusSearchPath()).toBe('/editor-paginas-v2?foco=buscador');
  });

  it('interpreta el parámetro de versión sin confundirlo con ausencia', () => {
    expect(readVersionParam(null)).toEqual({ version: null, invalid: false });
    expect(readVersionParam('')).toEqual({ version: null, invalid: false });
    expect(readVersionParam('7')).toEqual({ version: 7, invalid: false });
    expect(readVersionParam('abc')).toEqual({ version: null, invalid: true });
    expect(readVersionParam('0')).toEqual({ version: null, invalid: true });
  });

  it('guarda hasta cinco recientes, sin duplicados ni claves inválidas', () => {
    rememberPage('home');
    rememberPage('temario');
    rememberPage('home');
    rememberPage('creditos');
    rememberPage('tema-1');
    rememberPage('subtema-87');
    rememberPage('clave inválida');

    expect(readRecentPageKeys()).toEqual(['subtema-87', 'tema-1', 'creditos', 'home', 'temario']);
  });

  it('ignora recientes corruptos y permite limpiarlos', () => {
    window.localStorage.setItem(EDITOR2_RECENTS_KEY, '{"no":"es un array"}');
    expect(readRecentPageKeys()).toEqual([]);

    rememberPage('tema-7');
    expect(readRecentPageKeys()).toEqual(['tema-7']);
    clearRecentPages();
    expect(readRecentPageKeys()).toEqual([]);
  });
});
