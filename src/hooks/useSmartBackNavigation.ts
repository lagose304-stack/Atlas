import { useCallback } from 'react';

export const useSmartBackNavigation = (fallbackPath = '/edicion') => {
  return useCallback(() => {
    const isEditingDetailRoute = window.location.pathname.startsWith('/editar-');
    if (fallbackPath === '/edicion' || isEditingDetailRoute) {
      window.location.assign(fallbackPath);
      return;
    }

    const idx = typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0;

    const samePathReferrer = (() => {
      try {
        if (!document.referrer) return false;
        const ref = new URL(document.referrer);
        return ref.origin === window.location.origin && ref.pathname === window.location.pathname;
      } catch {
        return false;
      }
    })();

    if (idx > 0 && !samePathReferrer) {
      window.history.back();
      return;
    }

    window.location.assign(fallbackPath);
  }, [fallbackPath]);
};
