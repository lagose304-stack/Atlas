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
  descripcion?: string | null;
}

export interface CatalogPlaca {
  id: number;
  photo_url: string;
  subtema_id?: number | null;
  tema_id?: number | null;
  sort_order?: number | null;
  aumento?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<{
    label: string;
    x: number | null;
    y: number | null;
    startX?: number | null;
    startY?: number | null;
    regionPoints?: number[] | null;
    regionColor?: string | null;
    regionOpacity?: number | null;
  }> | null;
  comentario?: string | null;
  tincion?: string | null;
}

export interface SubtemaPlacasBundle {
  placas: CatalogPlaca[];
  placasConMapa: number[];
}

interface CacheState<T> {
  data: T | null;
  timestamp: number;
}

const TEMAS_CACHE_KEY = 'atlas_cached_temas_v1';
const SUBTEMAS_CACHE_KEY = 'atlas_cached_subtemas_v1';
const PLACAS_CACHE_PREFIX = 'atlas_cached_placas_subtema_';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

let temasInMemory: CacheState<CatalogTema[]> = {
  data: null,
  timestamp: 0,
};

let subtemasInMemory: CacheState<CatalogSubtema[]> = {
  data: null,
  timestamp: 0,
};

const placasInMemory = new Map<number, CacheState<SubtemaPlacasBundle>>();

let temasInFlightPromise: Promise<CatalogTema[]> | null = null;
let subtemasInFlightPromise: Promise<CatalogSubtema[]> | null = null;
const placasInFlightPromises = new Map<number, Promise<SubtemaPlacasBundle>>();

const readLocalStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheState<T>;
    if (parsed && parsed.data !== undefined && parsed.data !== null) {
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
 * Obtiene un tema sincrónicamente por su ID desde la caché en memoria/local (0 ms).
 */
export const getQuickTemaById = (temaId: number): CatalogTema | null => {
  const temas = getQuickTemas();
  if (!temas) return null;
  return temas.find((t) => t.id === temaId) ?? null;
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
 * Obtiene un subtema sincrónicamente por su ID desde la caché (0 ms).
 */
export const getQuickSubtemaById = (subtemaId: number): CatalogSubtema | null => {
  const subtemas = getQuickSubtemas();
  if (!subtemas) return null;
  return subtemas.find((s) => s.id === subtemaId) ?? null;
};

/**
 * Obtiene las placas y mapas interactivos de un subtema sincrónicamente de la caché (0 ms).
 */
export const getQuickPlacasForSubtema = (subtemaId: number): SubtemaPlacasBundle | null => {
  const inMem = placasInMemory.get(subtemaId);
  if (inMem && inMem.data) {
    return inMem.data;
  }
  const fromStorage = readLocalStorage<SubtemaPlacasBundle>(`${PLACAS_CACHE_PREFIX}${subtemaId}`);
  if (fromStorage) {
    placasInMemory.set(subtemaId, {
      data: fromStorage,
      timestamp: Date.now(),
    });
    return fromStorage;
  }
  return null;
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
          .select('id, nombre, descripcion, tema_id, sort_order, logo_url')
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
 * Carga las placas y mapas interactivos de un subtema con caché SWR en memoria y storage.
 */
export const getCachedPlacasForSubtema = async (
  subtemaId: number,
  options?: { forceRefresh?: boolean }
): Promise<SubtemaPlacasBundle> => {
  const force = options?.forceRefresh === true;
  const inMem = placasInMemory.get(subtemaId);
  const isFresh = !force && inMem?.data && Date.now() - inMem.timestamp < DEFAULT_TTL_MS;

  if (isFresh && inMem?.data) {
    return inMem.data;
  }

  const existingInFlight = placasInFlightPromises.get(subtemaId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const { data: placasData, error: placasError } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, senalados, senalados_meta, comentario, tincion, subtema_id, sort_order')
        .eq('subtema_id', subtemaId)
        .order('sort_order', { ascending: true });

      if (placasError) {
        throw placasError;
      }

      const placas = (placasData ?? []) as CatalogPlaca[];
      const placaIds = placas.map((p) => p.id).filter((id): id is number => typeof id === 'number');

      let placasConMapa: number[] = [];
      if (placaIds.length > 0) {
        const { data: mapsData, error: mapsError } = await supabase
          .from('interactive_maps')
          .select('placa_id, sections')
          .in('placa_id', placaIds);

        if (!mapsError && mapsData) {
          placasConMapa = (mapsData as Array<{ placa_id: number; sections: unknown[] | null }>)
            .filter((m) => Array.isArray(m.sections) && m.sections.length > 0)
            .map((m) => m.placa_id);
        }
      }

      const bundle: SubtemaPlacasBundle = {
        placas,
        placasConMapa,
      };

      placasInMemory.set(subtemaId, {
        data: bundle,
        timestamp: Date.now(),
      });
      writeLocalStorage(`${PLACAS_CACHE_PREFIX}${subtemaId}`, bundle);

      return bundle;
    } catch (err) {
      console.warn(`Advertencia al consultar placas del subtema ${subtemaId}:`, err);
      const fallback = getQuickPlacasForSubtema(subtemaId);
      if (fallback) return fallback;
      throw err;
    } finally {
      placasInFlightPromises.delete(subtemaId);
    }
  })();

  placasInFlightPromises.set(subtemaId, fetchPromise);
  return fetchPromise;
};

/**
 * Precarga en segundo plano tanto temas como subtemas.
 */
export const prefetchCatalog = (): void => {
  void getCachedTemas();
  void getCachedSubtemas();
};

/**
 * Precarga anticipada de un tema específico y sus subtemas al hacer hover.
 */
export const prefetchTema = (temaId: number): void => {
  void getCachedTemas();
  void getCachedSubtemas(temaId);
};

/**
 * Precarga anticipada de un subtema y sus placas al hacer hover sobre su tarjeta.
 */
export const prefetchSubtemaPlacas = (subtemaId: number): void => {
  void getCachedPlacasForSubtema(subtemaId);
};

/**
 * Invalida manualmente la caché de catálogo cuando se realiza una inserción,
 * actualización, eliminación o reordenamiento de temas o subtemas.
 */
export const invalidateCatalogCache = (): void => {
  temasInMemory = { data: null, timestamp: 0 };
  subtemasInMemory = { data: null, timestamp: 0 };
  placasInMemory.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TEMAS_CACHE_KEY);
      window.localStorage.removeItem(SUBTEMAS_CACHE_KEY);
      // Limpiar placas cacheadas
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(PLACAS_CACHE_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignorar errores en entornos aislados
    }
  }
};

/**
 * Invalida la caché de placas para un subtema específico.
 */
export const invalidatePlacasCache = (subtemaId?: number): void => {
  if (subtemaId !== undefined) {
    placasInMemory.delete(subtemaId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`${PLACAS_CACHE_PREFIX}${subtemaId}`);
      } catch {}
    }
  } else {
    placasInMemory.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith(PLACAS_CACHE_PREFIX)) {
            window.localStorage.removeItem(key);
          }
        });
      } catch {}
    }
  }
};
