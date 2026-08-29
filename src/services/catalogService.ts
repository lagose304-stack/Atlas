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

const TEMAS_CACHE_KEY = 'atlas_cached_temas_v2';
const ALL_SUBTEMAS_CACHE_KEY = 'atlas_cached_all_subtemas_v2';
const SUBTEMA_PER_TEMA_PREFIX = 'atlas_cached_subtemas_tema_v2_';
const PLACAS_CACHE_PREFIX = 'atlas_cached_placas_subtema_v2_';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

let temasInMemory: CacheState<CatalogTema[]> = {
  data: null,
  timestamp: 0,
};

let allSubtemasInMemory: CacheState<CatalogSubtema[]> = {
  data: null,
  timestamp: 0,
};

const subtemasByTemaInMemory = new Map<number, CacheState<CatalogSubtema[]>>();
const placasInMemory = new Map<number, CacheState<SubtemaPlacasBundle>>();

let temasInFlightPromise: Promise<CatalogTema[]> | null = null;
let allSubtemasInFlightPromise: Promise<CatalogSubtema[]> | null = null;
const subtemasInFlightPromises = new Map<number, Promise<CatalogSubtema[]>>();
const placasInFlightPromises = new Map<number, Promise<SubtemaPlacasBundle>>();

const readLocalStorage = <T>(key: string, checkTtl = true): T | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheState<T>;
    if (!parsed || parsed.data === undefined || parsed.data === null) {
      return null;
    }
    if (checkTtl && parsed.timestamp && Date.now() - parsed.timestamp > DEFAULT_TTL_MS) {
      return null;
    }
    return parsed.data;
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
 * Retorna inmediatamente si existen datos cacheados válidos (0 ms).
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
  return temas.find((t) => Number(t.id) === Number(temaId)) ?? null;
};

/**
 * Obtiene los subtemas sincrónicamente desde la caché para un tema o globales (0 ms).
 */
export const getQuickSubtemas = (temaId?: number | null): CatalogSubtema[] | null => {
  if (temaId !== undefined && temaId !== null) {
    const numTemaId = Number(temaId);
    const inMem = subtemasByTemaInMemory.get(numTemaId);
    if (inMem && inMem.data && inMem.data.length > 0) {
      return inMem.data;
    }
    const fromStorage = readLocalStorage<CatalogSubtema[]>(`${SUBTEMA_PER_TEMA_PREFIX}${numTemaId}`);
    if (fromStorage && fromStorage.length > 0) {
      subtemasByTemaInMemory.set(numTemaId, {
        data: fromStorage,
        timestamp: Date.now(),
      });
      return fromStorage;
    }
  }

  // Si no está en la caché por tema, intentar desde la caché global
  let allSubtemas = allSubtemasInMemory.data;
  if (!allSubtemas || allSubtemas.length === 0) {
    allSubtemas = readLocalStorage<CatalogSubtema[]>(ALL_SUBTEMAS_CACHE_KEY);
    if (allSubtemas && allSubtemas.length > 0) {
      allSubtemasInMemory = {
        data: allSubtemas,
        timestamp: Date.now(),
      };
    }
  }

  if (!allSubtemas) return null;
  if (temaId !== undefined && temaId !== null) {
    const filtered = allSubtemas.filter((s) => Number(s.tema_id) === Number(temaId));
    return filtered.length > 0 ? filtered : null;
  }
  return allSubtemas;
};

/**
 * Obtiene un subtema sincrónicamente por su ID desde la caché (0 ms).
 */
export const getQuickSubtemaById = (subtemaId: number): CatalogSubtema | null => {
  const numSubtemaId = Number(subtemaId);
  // Buscar en los subtemas cacheados en memoria
  for (const entry of subtemasByTemaInMemory.values()) {
    if (entry.data) {
      const match = entry.data.find((s) => Number(s.id) === numSubtemaId);
      if (match) return match;
    }
  }

  const all = getQuickSubtemas();
  if (!all) return null;
  return all.find((s) => Number(s.id) === numSubtemaId) ?? null;
};

/**
 * Obtiene las placas y mapas interactivos de un subtema sincrónicamente de la caché (0 ms).
 */
export const getQuickPlacasForSubtema = (subtemaId: number): SubtemaPlacasBundle | null => {
  const numSubtemaId = Number(subtemaId);
  const inMem = placasInMemory.get(numSubtemaId);
  if (inMem && inMem.data && inMem.data.placas && inMem.data.placas.length > 0) {
    return inMem.data;
  }
  const fromStorage = readLocalStorage<SubtemaPlacasBundle>(`${PLACAS_CACHE_PREFIX}${numSubtemaId}`);
  if (fromStorage && fromStorage.placas && fromStorage.placas.length > 0) {
    placasInMemory.set(numSubtemaId, {
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
  const isFresh = !force && temasInMemory.data && temasInMemory.data.length > 0 && Date.now() - temasInMemory.timestamp < DEFAULT_TTL_MS;

  if (isFresh && temasInMemory.data) {
    return temasInMemory.data;
  }

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
      if (temas.length > 0) {
        temasInMemory = {
          data: temas,
          timestamp: Date.now(),
        };
        writeLocalStorage(TEMAS_CACHE_KEY, temas);
      }
      return temas;
    } catch (err) {
      console.warn('Advertencia al consultar temas de la base de datos:', err);
      const fallback = getQuickTemas() ?? readLocalStorage<CatalogTema[]>(TEMAS_CACHE_KEY, false);
      if (fallback && fallback.length > 0) return fallback;
      throw err;
    } finally {
      temasInFlightPromise = null;
    }
  })();

  return temasInFlightPromise;
};

/**
 * Carga los subtemas de un tema específico (o todos) con caché SWR segura por tema_id.
 */
export const getCachedSubtemas = async (
  temaId?: number | null,
  options?: { forceRefresh?: boolean }
): Promise<CatalogSubtema[]> => {
  const force = options?.forceRefresh === true;

  if (temaId !== undefined && temaId !== null) {
    const numTemaId = Number(temaId);
    const inMem = subtemasByTemaInMemory.get(numTemaId);
    const isFresh = !force && inMem?.data && inMem.data.length > 0 && Date.now() - inMem.timestamp < DEFAULT_TTL_MS;

    if (isFresh && inMem?.data) {
      return inMem.data;
    }

    const existingInFlight = subtemasInFlightPromises.get(numTemaId);
    if (existingInFlight) {
      return existingInFlight;
    }

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('subtemas')
          .select('id, nombre, descripcion, tema_id, sort_order, logo_url')
          .eq('tema_id', numTemaId)
          .order('sort_order', { ascending: true });

        if (error) {
          throw error;
        }

        const list = (data ?? []) as CatalogSubtema[];
        subtemasByTemaInMemory.set(numTemaId, {
          data: list,
          timestamp: Date.now(),
        });
        writeLocalStorage(`${SUBTEMA_PER_TEMA_PREFIX}${numTemaId}`, list);
        return list;
      } catch (err) {
        console.warn(`Advertencia al consultar subtemas del tema ${numTemaId}:`, err);
        const fallback = getQuickSubtemas(numTemaId) ?? readLocalStorage<CatalogSubtema[]>(`${SUBTEMA_PER_TEMA_PREFIX}${numTemaId}`, false);
        if (fallback) return fallback;
        throw err;
      } finally {
        subtemasInFlightPromises.delete(numTemaId);
      }
    })();

    subtemasInFlightPromises.set(numTemaId, fetchPromise);
    return fetchPromise;
  }

  // Carga global de todos los subtemas
  const isGlobalFresh = !force && allSubtemasInMemory.data && allSubtemasInMemory.data.length > 0 && Date.now() - allSubtemasInMemory.timestamp < DEFAULT_TTL_MS;

  if (isGlobalFresh && allSubtemasInMemory.data) {
    return allSubtemasInMemory.data;
  }

  if (allSubtemasInFlightPromise) {
    return allSubtemasInFlightPromise;
  }

  allSubtemasInFlightPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('subtemas')
        .select('id, nombre, descripcion, tema_id, sort_order, logo_url')
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const list = (data ?? []) as CatalogSubtema[];
      if (list.length > 0) {
        allSubtemasInMemory = {
          data: list,
          timestamp: Date.now(),
        };
        writeLocalStorage(ALL_SUBTEMAS_CACHE_KEY, list);
      }
      return list;
    } catch (err) {
      console.warn('Advertencia al consultar todos los subtemas:', err);
      const fallback = getQuickSubtemas() ?? readLocalStorage<CatalogSubtema[]>(ALL_SUBTEMAS_CACHE_KEY, false);
      if (fallback) return fallback;
      throw err;
    } finally {
      allSubtemasInFlightPromise = null;
    }
  })();

  return allSubtemasInFlightPromise;
};

/**
 * Carga las placas y mapas interactivos de un subtema con caché SWR en memoria y storage.
 */
export const getCachedPlacasForSubtema = async (
  subtemaId: number,
  options?: { forceRefresh?: boolean }
): Promise<SubtemaPlacasBundle> => {
  const numSubtemaId = Number(subtemaId);
  const force = options?.forceRefresh === true;
  const inMem = placasInMemory.get(numSubtemaId);
  const isFresh = !force && inMem?.data && inMem.data.placas && inMem.data.placas.length > 0 && Date.now() - inMem.timestamp < DEFAULT_TTL_MS;

  if (isFresh && inMem?.data) {
    return inMem.data;
  }

  const existingInFlight = placasInFlightPromises.get(numSubtemaId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const { data: placasData, error: placasError } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, senalados, senalados_meta, comentario, tincion, subtema_id, sort_order')
        .eq('subtema_id', numSubtemaId)
        .order('sort_order', { ascending: true });

      if (placasError) {
        throw placasError;
      }

      const placas = (placasData ?? []) as CatalogPlaca[];
      const placaIds = placas.map((p) => p.id).filter((id): id is number => typeof id === 'number');

      let placasConMapa: number[] = [];
      if (placaIds.length > 0) {
        try {
          const { data: mapsData, error: mapsError } = await supabase
            .from('interactive_maps')
            .select('placa_id, sections')
            .in('placa_id', placaIds);

          if (!mapsError && mapsData) {
            placasConMapa = (mapsData as Array<{ placa_id: number; sections: unknown[] | null }>)
              .filter((m) => Array.isArray(m.sections) && m.sections.length > 0)
              .map((m) => m.placa_id);
          }
        } catch {
          // Si falla la consulta de mapas interactivos, las placas se muestran sin mapa interactivo
        }
      }

      const bundle: SubtemaPlacasBundle = {
        placas,
        placasConMapa,
      };

      placasInMemory.set(numSubtemaId, {
        data: bundle,
        timestamp: Date.now(),
      });
      writeLocalStorage(`${PLACAS_CACHE_PREFIX}${numSubtemaId}`, bundle);

      return bundle;
    } catch (err) {
      console.warn(`Advertencia al consultar placas del subtema ${numSubtemaId}:`, err);
      const fallback = getQuickPlacasForSubtema(numSubtemaId) ?? readLocalStorage<SubtemaPlacasBundle>(`${PLACAS_CACHE_PREFIX}${numSubtemaId}`, false);
      if (fallback) return fallback;
      throw err;
    } finally {
      placasInFlightPromises.delete(numSubtemaId);
    }
  })();

  placasInFlightPromises.set(numSubtemaId, fetchPromise);
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
  void getCachedSubtemas(Number(temaId));
};

/**
 * Precarga anticipada de un subtema y sus placas al hacer hover sobre su tarjeta.
 */
export const prefetchSubtemaPlacas = (subtemaId: number): void => {
  void getCachedPlacasForSubtema(Number(subtemaId));
};

/**
 * Invalida manualmente la caché de catálogo cuando se realiza una inserción,
 * actualización, eliminación o reordenamiento de temas o subtemas.
 */
export const invalidateCatalogCache = (): void => {
  temasInMemory = { data: null, timestamp: 0 };
  allSubtemasInMemory = { data: null, timestamp: 0 };
  subtemasByTemaInMemory.clear();
  placasInMemory.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TEMAS_CACHE_KEY);
      window.localStorage.removeItem(ALL_SUBTEMAS_CACHE_KEY);
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(SUBTEMA_PER_TEMA_PREFIX) || key.startsWith(PLACAS_CACHE_PREFIX)) {
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
    const num = Number(subtemaId);
    placasInMemory.delete(num);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`${PLACAS_CACHE_PREFIX}${num}`);
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
