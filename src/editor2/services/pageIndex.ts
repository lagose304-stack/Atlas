import { z } from 'zod';
import { pageKeySchema } from '../domain/schema';
import { loadCatalog, type Editor2CatalogSnapshot } from './catalogIndex';


const versionParamSchema = z.coerce.number().int().positive();
const pageKindSchema = z.enum(['fixed', 'tema', 'subtema']);

const pageSummarySchema = z.strictObject({
  pageKey: pageKeySchema,
  title: z.string().min(1),
  section: z.string().min(1),
  publicPath: z.string().min(1),
  description: z.string(),
  keywords: z.array(z.string()),
  kind: pageKindSchema.default('fixed'),
  parentPageKey: pageKeySchema.optional(),
  parcial: z.string().optional(),
});

const pageIndexSchema = z.array(pageSummarySchema);
const recentPageKeysSchema = z.array(pageKeySchema).max(5);

export type Editor2PageSummary = z.infer<typeof pageSummarySchema>;
export type Editor2CatalogSource = () => Promise<Editor2CatalogSnapshot>;

export interface PageIndexLoadResult {
  pages: Editor2PageSummary[];
  warning: string | null;
}

export const EDITOR2_HOME_PATH = '/editor-paginas-v2';
export const EDITOR2_RECENTS_KEY = 'atlas-editor2-recent-v1';
export const TEMARIO_SECTION = 'Temario';

const FIXED_PAGES: Editor2PageSummary[] = [
  {
    pageKey: 'home',
    title: 'Inicio',
    section: 'Inicio',
    publicPath: '/',
    description: 'Portada pública del atlas.',
    keywords: ['portada', 'atlas', 'bienvenida'],
    kind: 'fixed',
  },
  {
    pageKey: 'temario',
    title: 'Temario',
    section: TEMARIO_SECTION,
    publicPath: '/temario',
    description: 'Índice general de temas del atlas.',
    keywords: ['índice', 'temas', 'catálogo'],
    kind: 'fixed',
  },
  {
    pageKey: 'creditos',
    title: 'Créditos',
    section: 'Créditos',
    publicPath: '/creditos',
    description: 'Reconocimientos del sitio.',
    keywords: ['autores', 'agradecimientos'],
    kind: 'fixed',
  },
];

export function temaPageKey(id: number): string {
  return `tema-${id}`;
}

export function subtemaPageKey(id: number): string {
  return `subtema-${id}`;
}

export function catalogPagesFrom(catalog: Editor2CatalogSnapshot): Editor2PageSummary[] {
  const temasById = new Map(catalog.temas.map((tema) => [tema.id, tema]));

  const temas = catalog.temas.map((tema): Editor2PageSummary => ({
    pageKey: temaPageKey(tema.id),
    title: tema.nombre,
    section: TEMARIO_SECTION,
    publicPath: `/subtemas/${tema.id}`,
    description: `Página del tema ${tema.nombre}.`,
    keywords: ['tema', tema.nombre, tema.parcial].filter((value) => value.length > 0),
    kind: 'tema',
    parcial: tema.parcial,
  }));

  const subtemas = catalog.subtemas.map((subtema): Editor2PageSummary => {
    const tema = temasById.get(subtema.tema_id);
    const keywords = ['subtema', subtema.nombre];
    if (tema) keywords.push(tema.nombre, tema.parcial);
    return {
      pageKey: subtemaPageKey(subtema.id),
      title: subtema.nombre,
      section: TEMARIO_SECTION,
      publicPath: `/ver-placas/${subtema.id}`,
      description: tema ? `Subtema de ${tema.nombre}.` : 'Página de subtema.',
      keywords: keywords.filter((value) => value.length > 0),
      kind: 'subtema',
      parentPageKey: tema ? temaPageKey(tema.id) : undefined,
      parcial: tema?.parcial,
    };
  });

  return [...temas, ...subtemas];
}

export async function loadPageIndex(source: Editor2CatalogSource = loadCatalog): Promise<PageIndexLoadResult> {
  let catalog: Editor2CatalogSnapshot = { temas: [], subtemas: [] };
  let warning: string | null = null;

  try {
    catalog = await source();
  } catch {
    warning = 'No se pudo cargar el catálogo de temas y subtemas. Se muestran solo las páginas principales.';
  }

  const pages = pageIndexSchema.parse([...FIXED_PAGES, ...catalogPagesFrom(catalog)]).map((page) => ({
    ...page,
    keywords: [...page.keywords],
  }));

  return { pages, warning };
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function matchesSection(page: Editor2PageSummary, section: string): boolean {
  const normalizedSection = normalizeSearchValue(section);
  return !normalizedSection
    || normalizedSection === 'todas'
    || normalizeSearchValue(page.section) === normalizedSection;
}

function matchesQuery(page: Editor2PageSummary, query: string): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const searchable = [
    page.title,
    page.pageKey,
    page.section,
    page.publicPath,
    ...page.keywords,
  ].map(normalizeSearchValue).join(' ');

  return normalizedQuery.split(/\s+/).every((term) => searchable.includes(term));
}

export function filterPages(
  pages: Editor2PageSummary[],
  query: string,
  section: string,
): Editor2PageSummary[] {
  if (!normalizeSearchValue(query)) {
    return pages.filter((page) => matchesSection(page, section));
  }

  const byKey = new Map(pages.map((page) => [page.pageKey, page]));
  const matched = pages.filter((page) => matchesSection(page, section) && matchesQuery(page, query));
  const visibleKeys = new Set(matched.map((page) => page.pageKey));

  // Un subtema coincidente arrastra a su tema; un tema coincidente muestra sus subtemas.
  for (const page of matched) {
    if (page.kind === 'subtema' && page.parentPageKey && byKey.has(page.parentPageKey)) {
      visibleKeys.add(page.parentPageKey);
    }
    if (page.kind === 'tema') {
      for (const child of pages) {
        if (child.parentPageKey === page.pageKey) visibleKeys.add(child.pageKey);
      }
    }
  }

  return pages.filter((page) => visibleKeys.has(page.pageKey) && matchesSection(page, section));
}

export function sectionsFor(pages: Editor2PageSummary[]): string[] {
  return [...new Set(pages.map((page) => page.section))];
}

export function groupPagesBySection(pages: Editor2PageSummary[]): Array<[string, Editor2PageSummary[]]> {
  const groups = new Map<string, Editor2PageSummary[]>();
  for (const page of pages) {
    const group = groups.get(page.section) ?? [];
    group.push(page);
    groups.set(page.section, group);
  }
  return [...groups.entries()];
}

export function childrenByParent(pages: Editor2PageSummary[]): Map<string, Editor2PageSummary[]> {
  const children = new Map<string, Editor2PageSummary[]>();
  for (const page of pages) {
    if (!page.parentPageKey) continue;
    const group = children.get(page.parentPageKey) ?? [];
    group.push(page);
    children.set(page.parentPageKey, group);
  }
  return children;
}

export function workspacePath(pageKey: string): string {
  const parsed = pageKeySchema.safeParse(pageKey);
  return parsed.success ? `${EDITOR2_HOME_PATH}/p/${parsed.data}` : EDITOR2_HOME_PATH;
}

export function sectionPath(section: string): string {
  return `${EDITOR2_HOME_PATH}?seccion=${encodeURIComponent(section)}`;
}

export function focusSearchPath(): string {
  return `${EDITOR2_HOME_PATH}?foco=buscador`;
}

export function readVersionParam(value: string | null | undefined): {
  version: number | null;
  invalid: boolean;
} {
  if (value === null || value === undefined || value === '') {
    return { version: null, invalid: false };
  }
  const parsed = versionParamSchema.safeParse(value);
  return parsed.success ? { version: parsed.data, invalid: false } : { version: null, invalid: true };
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRecentPageKeys(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = recentPageKeysSchema.safeParse(JSON.parse(storage.getItem(EDITOR2_RECENTS_KEY) ?? '[]'));
    return parsed.success ? [...new Set(parsed.data)] : [];
  } catch {
    return [];
  }
}

export function rememberPage(pageKey: string): void {
  const parsed = pageKeySchema.safeParse(pageKey);
  if (!parsed.success) return;
  const storage = getStorage();
  if (!storage) return;
  const next = [parsed.data, ...readRecentPageKeys().filter((key) => key !== parsed.data)].slice(0, 5);
  try {
    storage.setItem(EDITOR2_RECENTS_KEY, JSON.stringify(next));
  } catch {
    // La navegación sigue funcionando aunque el almacenamiento local falle.
  }
}

export function clearRecentPages(): void {
  try {
    getStorage()?.removeItem(EDITOR2_RECENTS_KEY);
  } catch {
    // No hay nada que recuperar si el almacenamiento local no está disponible.
  }
}
