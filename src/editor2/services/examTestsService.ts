import { supabase } from '../../services/supabase';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import type { ExamParcial } from '../domain/schema';

export type Editor2ExamTest = {
  id: string;
  nombre: string;
  parcialKey: string;
  thumbnailUrl: string | null;
  temaNombre: string | null;
};

type RawPruebaRow = {
  id?: unknown;
  nombre?: unknown;
  parcial_key?: unknown;
  image_url?: unknown;
  tema?: { nombre?: unknown; logo_url?: unknown } | Array<{ nombre?: unknown; logo_url?: unknown }> | null;
  subtema?: { nombre?: unknown; logo_url?: unknown } | Array<{ nombre?: unknown; logo_url?: unknown }> | null;
};

export const EXAM_PARCIAL_LABELS: Record<ExamParcial, string> = {
  all: 'Todos los parciales',
  primer: 'Primer parcial',
  segundo: 'Segundo parcial',
  tercer: 'Tercer parcial',
};

const cache = new Map<string, { items: Editor2ExamTest[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeTestRow(row: RawPruebaRow): Editor2ExamTest | null {
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.nombre !== 'string') {
    return null;
  }
  const tema = pickRelation(row.tema);
  const subtema = pickRelation(row.subtema);
  const rawImg =
    (typeof row.image_url === 'string' && row.image_url.trim()) ||
    (typeof subtema?.logo_url === 'string' && subtema.logo_url.trim()) ||
    (typeof tema?.logo_url === 'string' && tema.logo_url.trim()) ||
    null;

  return {
    id: String(row.id),
    nombre: row.nombre.trim(),
    parcialKey: typeof row.parcial_key === 'string' ? row.parcial_key : '',
    thumbnailUrl: rawImg ? getCloudinaryImageUrl(rawImg, 'cardWide') : null,
    temaNombre: typeof tema?.nombre === 'string' && tema.nombre.trim() ? tema.nombre.trim() : null,
  };
}

export function clearExamTestsCache(): void {
  cache.clear();
}

/**
 * Consulta en solo lectura las pruebas publicadas de Atlas para el parcial elegido.
 * Nunca lanza excepciones: ante fallo de red devuelve una lista vacía.
 */
export async function loadPublishedExamTests(
  parcial: ExamParcial = 'primer',
  maxItems = 8,
): Promise<Editor2ExamTest[]> {
  const key = `${parcial}:${maxItems}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  try {
    let query = supabase
      .from('pruebas')
      .select('id, nombre, parcial_key, image_url, tema:temas(nombre, logo_url), subtema:subtemas(nombre, logo_url)')
      .eq('estado', 'publicada')
      .order('created_at', { ascending: false })
      .limit(maxItems);

    if (parcial !== 'all') {
      query = query.eq('parcial_key', parcial);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return [];
    }

    const items = (data as RawPruebaRow[])
      .map(normalizeTestRow)
      .filter((item): item is Editor2ExamTest => item !== null);

    cache.set(key, { items, expiresAt: Date.now() + CACHE_TTL_MS });
    return items;
  } catch {
    return [];
  }
}
