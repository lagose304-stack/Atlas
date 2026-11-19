import { pageKeySchema } from '../domain/schema';
import { editor2Api, type Editor2PublicDoc } from '../services/editor2Api';

export type PublicDocLoader = (pageKey: string) => Promise<Editor2PublicDoc | null>;

type CacheEntry = {
  doc: Editor2PublicDoc | null;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30_000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Editor2PublicDoc | null>>();

function normalizePageKey(rawKey: string | null | undefined): string | null {
  if (!rawKey) return null;
  const parsed = pageKeySchema.safeParse(rawKey);
  return parsed.success ? parsed.data : null;
}

/**
 * Devuelve el resultado en caché síncronamente si aún está vigente.
 * `undefined` indica que no hay entrada vigente (cache miss); `null` indica
 * que se comprobó recientemente y no existe versión publicada en v2.
 */
export function getCachedPublicDoc(
  rawKey: string | null | undefined,
  now: number = Date.now(),
): Editor2PublicDoc | null | undefined {
  const key = normalizePageKey(rawKey);
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.doc;
}

/**
 * Carga el documento publicado de Editor 2.0 para `pageKey` con caché breve
 * y deduplicación de peticiones simultáneas. Nunca lanza excepciones: ante
 * ausencia de publicación o error de red/RPC devuelve `null` para permitir
 * fallback transparente al renderizador v1.
 */
export async function loadCachedPublicDoc(
  rawKey: string | null | undefined,
  loader: PublicDocLoader = (key) => editor2Api.getPublicDoc(key),
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Editor2PublicDoc | null> {
  const key = normalizePageKey(rawKey);
  if (!key) return null;

  const cached = getCachedPublicDoc(key);
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = Promise.resolve()
    .then(() => loader(key))
    .then((result) => {
      const normalized = result ?? null;
      cache.set(key, { doc: normalized, expiresAt: Date.now() + ttlMs });
      return normalized;
    })
    .catch(() => {
      // Fallback silencioso: si la RPC aún no existe o hay error transitorio,
      // no cacheamos por mucho tiempo y devolvemos null para mostrar v1.
      cache.set(key, { doc: null, expiresAt: Date.now() + Math.min(ttlMs, 5_000) });
      return null;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Invalida una clave puntual o toda la caché pública en memoria (útil tras
 * publicar o revertir una página desde Editor 2.0 en la misma sesión).
 */
export function invalidatePublicDocCache(rawKey?: string): void {
  if (!rawKey) {
    cache.clear();
    inFlight.clear();
    return;
  }
  const key = normalizePageKey(rawKey);
  if (!key) return;
  cache.delete(key);
  inFlight.delete(key);
}
