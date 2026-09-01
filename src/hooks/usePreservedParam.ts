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
const defaultSerialize = (val: unknown): string => (val === null || val === undefined ? '' : String(val));

export function usePreservedParam<T>(
  key: string,
  defaultValue: T,
  options?: UsePreservedParamOptions<T>
): [T, (nextVal: T | ((prev: T) => T)) => void] {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const defaultDeserialize = useCallback(
    (raw: string): T => {
      if (typeof defaultValue === 'number' || (defaultValue === null && /^-?\d+$/.test(raw.trim()))) {
        const parsed = Number(raw);
        return (Number.isFinite(parsed) ? parsed : defaultValue) as unknown as T;
      }
      if (typeof defaultValue === 'boolean' || (defaultValue === null && (raw === 'true' || raw === 'false'))) {
        return (raw === 'true' || raw === '1') as unknown as T;
      }
      return raw as unknown as T;
    },
    [defaultValue]
  );

  const getDeserializeFn = useCallback(() => {
    return optionsRef.current?.deserialize ?? defaultDeserialize;
  }, [defaultDeserialize]);

  const [state, setState] = useState<T>(() => {
    const preserved = getPreservedSearchParam(key);
    if (preserved !== null && preserved !== '') {
      try {
        const deserializeFn = options?.deserialize ?? defaultDeserialize;
        return deserializeFn(preserved);
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

        const currentOptions = optionsRef.current;
        if (currentOptions?.syncUrl !== false) {
          const serializeFn = currentOptions?.serialize ?? defaultSerialize;
          const serialized = serializeFn(computed);
          syncUrlSearchParam(key, serialized);
        }
        return computed;
      });
    },
    [key]
  );

  // Escuchar si cambia externamente (por ejemplo navegación hacia atrás en el navegador)
  useEffect(() => {
    const handlePopState = () => {
      const currentParam = getPreservedSearchParam(key);
      if (currentParam !== null && currentParam !== '') {
        try {
          const parsed = getDeserializeFn()(currentParam);
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
  }, [key, defaultValue, getDeserializeFn]);

  return [state, setPreservedState];
}
