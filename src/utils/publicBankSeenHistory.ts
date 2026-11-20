import type { PublicBankConfig, StartedPublicBankQuestion } from '../types/publicQuestionBank';

const STORAGE_PREFIX = 'atlas_public_bank_seen_v1:';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SeenBuckets = Record<string, string[]>;

function getBucketKey(subtemaId: number | null | undefined): string {
  return subtemaId == null ? 'general' : `subtema:${subtemaId}`;
}

function readBuckets(pruebaId: string): SeenBuckets {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pruebaId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: SeenBuckets = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const ids = value.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id));
        if (ids.length > 0) clean[key] = ids;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function writeBuckets(pruebaId: string, buckets: SeenBuckets): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pruebaId}`, JSON.stringify(buckets));
  } catch {
    // Ignorar errores de cuota o modo privado sin almacenamiento
  }
}

/** Devuelve todos los UUIDs vistos previamente en esta computadora para una prueba. */
export function getSeenQuestionIds(pruebaId: string): string[] {
  const buckets = readBuckets(pruebaId);
  const unique = new Set<string>();
  Object.values(buckets).forEach(ids => ids.forEach(id => unique.add(id)));
  return Array.from(unique);
}

/**
 * Registra las preguntas que acaban de salir en un intento, separadas por
 * Generales del tema y por cada Subtema. Si en un rubro (general o un subtema)
 * el sorteo ya tuvo que repetir alguna pregunta porque se agotaron las nuevas,
 * inicia un nuevo ciclo para ese rubro conservando solo las del intento actual.
 */
export function recordDrawnQuestions(
  pruebaId: string,
  drawn: Array<{ id: string; subtema_id?: number | null }>,
): void {
  if (!pruebaId || drawn.length === 0) return;

  const buckets = readBuckets(pruebaId);
  const byBucket = new Map<string, string[]>();

  drawn.forEach(item => {
    if (!UUID_RE.test(item.id)) return;
    const key = getBucketKey(item.subtema_id);
    const list = byBucket.get(key) ?? [];
    list.push(item.id);
    byBucket.set(key, list);
  });

  byBucket.forEach((currentIds, bucketKey) => {
    const previousIds = buckets[bucketKey] ?? [];
    const previousSet = new Set(previousIds);
    const hadRepeat = currentIds.some(id => previousSet.has(id));

    if (hadRepeat) {
      // Ya dio la vuelta completa a las preguntas de este rubro:
      // iniciamos un ciclo nuevo partiendo de las preguntas que salieron ahora.
      buckets[bucketKey] = Array.from(new Set(currentIds));
    } else {
      buckets[bucketKey] = Array.from(new Set([...previousIds, ...currentIds]));
    }
  });

  writeBuckets(pruebaId, buckets);
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawPublicBankQuestions(
  historyKey: string,
  pool: StartedPublicBankQuestion[],
  config: PublicBankConfig,
): StartedPublicBankQuestion[] {
  const seen = readBuckets(historyKey);
  const groups = new Map<number | null, StartedPublicBankQuestion[]>();
  for (const question of pool) {
    const group = groups.get(question.subtema_id) ?? [];
    group.push(question);
    groups.set(question.subtema_id, group);
  }

  const selected = new Set<string>();
  for (const [subtema, candidates] of groups) {
    const limit = subtema === null ? config.general_count : config.subtema_counts[subtema];
    const previous = new Set(seen[getBucketKey(subtema)]);
    const randomized = shuffled(candidates);
    const fresh = randomized.filter(q => !previous.has(q.id));
    const repeats = randomized.filter(q => previous.has(q.id));
    for (const question of [...fresh, ...repeats].slice(0, limit ?? 0)) selected.add(question.id);
  }

  // La consulta entrega el orden del banco para las pruebas sin mezcla.
  const chosen = pool.filter(q => selected.has(q.id));
  recordDrawnQuestions(historyKey, chosen);
  return (config.shuffle_questions ? shuffled(chosen) : chosen).map((q, sort_order) => ({
    ...q,
    sort_order,
    options: (config.shuffle_options ? shuffled(q.options) : q.options)
      .map((option, index) => ({ ...option, sort_order: index })),
  }));
}
