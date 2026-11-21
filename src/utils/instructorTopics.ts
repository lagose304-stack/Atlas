import type { CatalogTema } from '../services/catalogService';

export const PARCIAL_ORDER: Record<string, number> = {
  primer: 1,
  segundo: 2,
  tercer: 3,
};

export const PARCIAL_LABELS: Record<string, string> = {
  primer: 'Primer parcial',
  segundo: 'Segundo parcial',
  tercer: 'Tercer parcial',
};

export function sortInstructorTemas(temas: CatalogTema[]): CatalogTema[] {
  return [...temas].sort((a, b) => {
    const pa = PARCIAL_ORDER[a.parcial] ?? 99;
    const pb = PARCIAL_ORDER[b.parcial] ?? 99;
    if (pa !== pb) return pa - pb;
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
}

export function groupTemasByParcial(temas: CatalogTema[]): { parcial: string; label: string; temas: CatalogTema[] }[] {
  const sorted = sortInstructorTemas(temas);
  const map = new Map<string, CatalogTema[]>();
  sorted.forEach(tema => {
    const key = tema.parcial || 'otros';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tema);
  });
  return [...map.entries()].map(([parcial, list]) => ({
    parcial,
    label: PARCIAL_LABELS[parcial] ?? 'Otros temas',
    temas: list,
  }));
}
export function shuffleInstructorItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
