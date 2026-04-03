interface ScrollLockStyleSnapshot {
  bodyOverflow: string;
  bodyOverflowX: string;
  htmlOverflow: string;
  htmlOverflowX: string;
}

interface AtlasScrollLockWindow extends Window {
  __atlasScrollLockCount?: number;
  __atlasScrollLockSnapshot?: ScrollLockStyleSnapshot;
}

const getWindowWithAtlasScrollLock = (): AtlasScrollLockWindow | null => {
  if (typeof window === 'undefined') return null;
  return window as AtlasScrollLockWindow;
};

export const acquireAtlasScrollLock = (): void => {
  if (typeof document === 'undefined') return;

  const scopedWindow = getWindowWithAtlasScrollLock();
  if (!scopedWindow) return;

  const currentCount = scopedWindow.__atlasScrollLockCount ?? 0;
  const body = document.body;
  const html = document.documentElement;

  if (currentCount === 0) {
    scopedWindow.__atlasScrollLockSnapshot = {
      bodyOverflow: body.style.overflow,
      bodyOverflowX: body.style.overflowX,
      htmlOverflow: html.style.overflow,
      htmlOverflowX: html.style.overflowX,
    };

    body.style.overflow = 'hidden';
    body.style.overflowX = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overflowX = 'hidden';
  }

  scopedWindow.__atlasScrollLockCount = currentCount + 1;
};

export const releaseAtlasScrollLock = (): void => {
  if (typeof document === 'undefined') return;

  const scopedWindow = getWindowWithAtlasScrollLock();
  if (!scopedWindow) return;

  const currentCount = scopedWindow.__atlasScrollLockCount ?? 0;
  if (currentCount <= 1) {
    const snapshot = scopedWindow.__atlasScrollLockSnapshot;
    const body = document.body;
    const html = document.documentElement;

    if (snapshot) {
      body.style.overflow = snapshot.bodyOverflow;
      body.style.overflowX = snapshot.bodyOverflowX;
      html.style.overflow = snapshot.htmlOverflow;
      html.style.overflowX = snapshot.htmlOverflowX;
    } else {
      body.style.overflow = '';
      body.style.overflowX = '';
      html.style.overflow = '';
      html.style.overflowX = '';
    }

    scopedWindow.__atlasScrollLockCount = 0;
    delete scopedWindow.__atlasScrollLockSnapshot;
    return;
  }

  scopedWindow.__atlasScrollLockCount = currentCount - 1;
};
