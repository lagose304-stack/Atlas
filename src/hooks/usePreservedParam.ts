import { useState, useEffect, useCallback, useRef } from 'react';
import { getPreservedSearchParam, syncUrlSearchParam } from '../services/navigationStateKeeper';

export interface UsePreservedParamOptions<T> {
  serialize?: (val: T) => string;
  deserialize?: (raw: string) => T;
  syncUrl?: boolean;
}

/**
 * Hook para sincronizar una variable de estado con los parámetros de la URL
 * y la persistencia de sesión. Al recargar la página, el valor se restaura
 * inmediatamente en el primer render o tan pronto esté disponible.
 */
export function usePreservedParam<T>(
  key: string,
  defaultValue: T,
  options?: UsePreservedParamOptions<T>
): [T, (nextVal: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? ((val: T) => (val === null || val === undefined ? '' : String(val)));
  const deserialize =
    options?.deserialize ??
    ((raw: string): T => {
      if (typeof defaultValue === 'number') {
        const parsed = Number(raw);
        return (Number.isFinite(parsed) ? parsed : defaultValue) as unknown as T;
      }
      if (typeof defaultValue === 'boolean') {
        return (raw === 'true' || raw === '1') as unknown as T;
      }
      return raw as unknown as T;
    });

  const [state, setState] = useState<T>(() => {
    const preserved = getPreservedSearchParam(key);
    if (preserved !== null && preserved !== '') {
      try {
        return deserialize(preserved);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const setPreservedState = useCallback(
    (nextVal: T | ((prev: T) => T)) => {
      setState((current) => {
        const computed = typeof nextVal === 'function' ? (nextVal as (prev: T) => T)(current) : nextVal;
        stateRef.current = computed;

        if (options?.syncUrl !== false) {
          const serialized = serialize(computed);
          syncUrlSearchParam(key, serialized);
        }
        return computed;
      });
    },
    [key, options?.syncUrl, serialize]
  );

  // Escuchar si cambia externamente (por ejemplo navegación hacia atrás en el navegador)
  useEffect(() => {
    const handlePopState = () => {
      const currentParam = getPreservedSearchParam(key);
      if (currentParam !== null && currentParam !== '') {
        try {
          const parsed = deserialize(currentParam);
          setState(parsed);
        } catch {
          // Ignorar
        }
      } else if (defaultValue !== null && defaultValue !== undefined) {
        setState(defaultValue);
      } else {
        setState(null as unknown as T);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [key, defaultValue, deserialize]);

  return [state, setPreservedState];
}
