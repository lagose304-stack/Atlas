import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPreservedRouteState,
  setPreservedRouteState,
  saveScrollPosition,
  restoreScrollPosition,
  syncUrlSearchParam,
  getPreservedSearchParam,
} from './navigationStateKeeper';

describe('navigationStateKeeper', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('guarda y recupera el estado de una ruta en sessionStorage', () => {
    const pathname = '/ver-placas/12';
    setPreservedRouteState(pathname, {
      searchParams: { placa: '45' },
    });

    const restored = getPreservedRouteState(pathname);
    expect(restored?.searchParams?.placa).toBe('45');
  });

  it('guarda y restaura la posición de scroll', () => {
    const pathname = '/subtemas/3';
    // Simular scroll en window
    Object.defineProperty(window, 'scrollY', { value: 350, writable: true });
    saveScrollPosition(pathname);

    let scrolledTop = 0;
    window.scrollTo = ((options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options !== null) {
        scrolledTop = options.top ?? 0;
      }
    }) as typeof window.scrollTo;

    const restored = restoreScrollPosition(pathname);
    expect(restored).toBe(true);
    expect(scrolledTop).toBe(350);
  });

  it('sincroniza y lee parámetros de URL y sessionStorage', () => {
    syncUrlSearchParam('placa', 99);
    expect(window.location.search).toContain('placa=99');
    expect(getPreservedSearchParam('placa')).toBe('99');

    // Al eliminarlo con null se limpia de la URL
    syncUrlSearchParam('placa', null);
    expect(window.location.search).not.toContain('placa');
  });
});
