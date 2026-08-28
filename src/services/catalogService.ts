import { supabase } from './supabase';

export interface CatalogTema {
  id: number;
  nombre: string;
  parcial: string;
  sort_order: number;
  logo_url?: string | null;
}

export interface CatalogSubtema {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
  logo_url?: string | null;
}

interface CacheState<T> {
  data: T | null;
  timestamp: number;
}

const TEMAS_CACHE_KEY = 'atlas_cached_temas_v1';
const SUBTEMAS_CACHE_KEY = 'atlas_cached_subtemas_v1';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

let temasInMemory: CacheState<CatalogTema[]> = {
  data: null,
  timestamp: 0,
};

let subtemasInMemory: CacheState<CatalogSubtema[]> = {
  data: null,
  timestamp: 0,
};

let temasInFlightPromise: Promise<CatalogTema[]> | null = null;
let subtemasInFlightPromise: Promise<CatalogSubtema[]> | null = null;

const readLocalStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheState<T>;
    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
};

const writeLocalStorage = <T>(key: string, data: T): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: CacheState<T> = {
      data,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignorar cuotas excedidas o entornos restringidos
  }
};

/**
 * Obtiene los temas sincrónicamente desde la caché (memoria o localStorage).
 * Retorna inmediatamente si existen datos cacheados sin esperar a la red (0 ms).
 */
export const getQuickTemas = (): CatalogTema[] | null => {
  if (temasInMemory.data && temasInMemory.data.length > 0) {
    return temasInMemory.data;
  }
  const fromStorage = readLocalStorage<CatalogTema[]>(TEMAS_CACHE_KEY);
  if (fromStorage && fromStorage.length > 0) {
    temasInMemory = {
      data: fromStorage,
      timestamp: Date.now(),
    };
    return fromStorage;
  }
  return null;
};

/**
 * Obtiene los subtemas sincrónicamente desde la caché (memoria o localStorage).
 */
export const getQuickSubtemas = (temaId?: number | null): CatalogSubtema[] | null => {
  let allSubtemas = subtemasInMemory.data;
  if (!allSubtemas || allSubtemas.length === 0) {
    allSubtemas = readLocalStorage<CatalogSubtema[]>(SUBTEMAS_CACHE_KEY);
    if (allSubtemas && allSubtemas.length > 0) {
      subtemasInMemory = {
        data: allSubtemas,
        timestamp: Date.now(),
      };
    }
  }

  if (!allSubtemas) return null;
  if (temaId !== undefined && temaId !== null) {
    return allSubtemas.filter((s) => s.tema_id === temaId);
  }
  return allSubtemas;
};

/**
 * Carga temas con patrón SWR (Stale-While-Revalidate):
 * - Si hay datos frescos en memoria, los retorna inmediatamente.
 * - Deduplica peticiones en vuelo entre múltiples componentes.
 * - En caso de error, entrega los datos cacheados en lugar de fallar.
 */
export const getCachedTemas = async (options?: { forceRefresh?: boolean }): Promise<CatalogTema[]> => {
  const force = options?.forceRefresh === true;
  const isFresh = !force && temasInMemory.data && Date.now() - temasInMemory.timestamp < DEFAULT_TTL_MS;

  if (isFresh && temasInMemory.data) {
    return temasInMemory.data;
  }

  // Deduplicación de peticiones en vuelo
  if (temasInFlightPromise) {
    return temasInFlightPromise;
  }

  temasInFlightPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order, logo_url')
        .order('parcial')
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const temas = (data ?? []) as CatalogTema[];
      temasInMemory = {
        data: temas,
        timestamp: Date.now(),
      };
      writeLocalStorage(TEMAS_CACHE_KEY, temas);
      return temas;
    } catch (err) {
      console.warn('Advertencia al consultar temas de la base de datos:', err);
      // Fallback a caché local si la red falla
      const fallback = getQuickTemas();
      if (fallback) return fallback;
      throw err;
    } finally {
      temasInFlightPromise = null;
    }
  })();

  return temasInFlightPromise;
};

/**
 * Carga todos los subtemas o filtra por tema_id, aprovechando la caché unificada.
 */
export const getCachedSubtemas = async (
  temaId?: number | null,
  options?: { forceRefresh?: boolean }
): Promise<CatalogSubtema[]> => {
  const force = options?.forceRefresh === true;
  const isFresh = !force && subtemasInMemory.data && Date.now() - subtemasInMemory.timestamp < DEFAULT_TTL_MS;

  let allSubtemas: CatalogSubtema[];

  if (isFresh && subtemasInMemory.data) {
    allSubtemas = subtemasInMemory.data;
  } else if (subtemasInFlightPromise) {
    allSubtemas = await subtemasInFlightPromise;
  } else {
    subtemasInFlightPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('subtemas')
          .select('id, nombre, tema_id, sort_order, logo_url')
          .order('sort_order', { ascending: true });

        if (error) {
          throw error;
        }

        const list = (data ?? []) as CatalogSubtema[];
        subtemasInMemory = {
          data: list,
          timestamp: Date.now(),
        };
        writeLocalStorage(SUBTEMAS_CACHE_KEY, list);
        return list;
      } catch (err) {
        console.warn('Advertencia al consultar subtemas de la base de datos:', err);
        const fallback = getQuickSubtemas();
        if (fallback) return fallback;
        throw err;
      } finally {
        subtemasInFlightPromise = null;
      }
    })();

    allSubtemas = await subtemasInFlightPromise;
  }

  if (temaId !== undefined && temaId !== null) {
    return allSubtemas.filter((s) => s.tema_id === temaId);
  }
  return allSubtemas;
};

/**
 * Precarga en segundo plano tanto temas como subtemas para que cualquier página posterior
 * responda a 0 ms.
 */
export const prefetchCatalog = (): void => {
  void getCachedTemas();
  void getCachedSubtemas();
};

/**
 * Invalida manualmente la caché de catálogo cuando se realiza una inserción,
 * actualización, eliminación o reordenamiento de temas o subtemas.
 */
export const invalidateCatalogCache = (): void => {
  temasInMemory = { data: null, timestamp: 0 };
  subtemasInMemory = { data: null, timestamp: 0 };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TEMAS_CACHE_KEY);
      window.localStorage.removeItem(SUBTEMAS_CACHE_KEY);
    } catch {
      // Ignorar errores en entornos aislados
    }
  }
};
