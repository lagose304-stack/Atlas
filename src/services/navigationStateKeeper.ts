/**
 * Servicio global para la retención y restauración del estado de navegación y scroll
 * en Atlas Histología.
 *
 * Permite que al recargar la página (F5 o botón de recarga del navegador),
 * el usuario mantenga el estado de la vista (placa abierta, pestaña seleccionada,
 * tema/subtema en edición, posición de scroll, etc.).
 */

const STORAGE_PREFIX = 'atlas_route_state:';
const SCROLL_PREFIX = 'atlas_route_scroll:';

export interface RoutePreservedState {
  searchParams?: Record<string, string>;
  scrollY?: number;
  lastUpdated?: number;
}

/**
 * Obtiene el estado preservado para una ruta determinada desde sessionStorage.
 */
export const getPreservedRouteState = (pathname: string): RoutePreservedState | null => {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${pathname}`);
    if (!raw) return null;
    return JSON.parse(raw) as RoutePreservedState;
  } catch {
    return null;
  }
};

/**
 * Guarda el estado preservado para una ruta en sessionStorage.
 */
export const setPreservedRouteState = (pathname: string, state: Partial<RoutePreservedState>): void => {
  try {
    const current = getPreservedRouteState(pathname) || {};
    const updated: RoutePreservedState = {
      ...current,
      ...state,
      lastUpdated: Date.now(),
    };
    sessionStorage.setItem(`${STORAGE_PREFIX}${pathname}`, JSON.stringify(updated));
  } catch {
    // Ignorar errores en modo incógnito o cuota excedida
  }
};

/**
 * Guarda la posición de scroll actual para la ruta activa.
 */
export const saveScrollPosition = (pathname: string): void => {
  try {
    const y = window.scrollY || window.pageYOffset || 0;
    sessionStorage.setItem(`${SCROLL_PREFIX}${pathname}`, String(Math.round(y)));
  } catch {
    // Ignorar
  }
};

/**
 * Restaura la posición de scroll guardada para la ruta dada.
 */
export const restoreScrollPosition = (pathname: string, behavior: ScrollBehavior = 'instant'): boolean => {
  try {
    const saved = sessionStorage.getItem(`${SCROLL_PREFIX}${pathname}`);
    if (saved !== null) {
      const y = Number.parseInt(saved, 10);
      if (Number.isFinite(y) && y > 0) {
        window.scrollTo({ top: y, behavior });
        return true;
      }
    }
  } catch {
    // Ignorar
  }
  return false;
};

/**
 * Limpia el scroll guardado para una ruta cuando se navega voluntariamente a otra distinta.
 */
export const clearPreservedScroll = (pathname: string): void => {
  try {
    sessionStorage.removeItem(`${SCROLL_PREFIX}${pathname}`);
  } catch {
    // Ignorar
  }
};

/**
 * Limpia el estado preservado de parámetros para una ruta en sessionStorage.
 */
export const clearPreservedRouteState = (pathname: string): void => {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${pathname}`);
  } catch {
    // Ignorar
  }
};

/**
 * Sincroniza un parámetro en la URL sin recargar la página ni contaminar
 * el historial hacia atrás (usando replaceState).
 */
export const syncUrlSearchParam = (key: string, value: string | number | null | undefined): void => {
  try {
    const url = new URL(window.location.href);
    const currentValue = url.searchParams.get(key);

    if (value === null || value === undefined || value === '') {
      if (currentValue !== null) {
        url.searchParams.delete(key);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    } else {
      const strVal = String(value);
      if (currentValue !== strVal) {
        url.searchParams.set(key, strVal);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    }

    // Respaldar también en sessionStorage por si se recarga antes de un evento
    const paramsMap: Record<string, string> = {};
    url.searchParams.forEach((val, k) => {
      paramsMap[k] = val;
    });
    setPreservedRouteState(url.pathname, { searchParams: paramsMap });
  } catch {
    // Fallback silencioso
  }
};

/**
 * Obtiene el valor de un parámetro ya sea desde la URL actual o desde sessionStorage como fallback.
 */
export const getPreservedSearchParam = (key: string, pathname?: string): string | null => {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get(key);
    if (param !== null) return param;

    const path = pathname || url.pathname;
    const stored = getPreservedRouteState(path);
    if (stored?.searchParams?.[key]) {
      return stored.searchParams[key];
    }
  } catch {
    // Fallback
  }
  return null;
};
