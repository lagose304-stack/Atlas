import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AtlasLoadingScreen from './AtlasLoadingScreen';
import { IMAGE_VIEWER_VISIBILITY_EVENT, type ImageViewerVisibilityDetail } from '../constants/uiEvents';
import './viewerInteraction.css';

/** Conserva la página y su scroll, pero excluye su contenido del render del navegador. */
export default function ViewerPageSuspension() {
  const [restoring, setRestoring] = useState(false);
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    let count = 0;
    let frame = 0;
    let timeout = 0;
    const wasInert = root.hasAttribute('inert');
    const cancel = () => { cancelAnimationFrame(frame); window.clearTimeout(timeout); };
    const restore = () => {
      root.removeAttribute('data-viewer-suspended');
      root.style.removeProperty('--viewer-page-height');
      if (!wasInert) root.removeAttribute('inert');
    };
    const onVisibility = (event: Event) => {
      const previous = count;
      count = Math.max(0, count + (event as CustomEvent<ImageViewerVisibilityDetail>).detail.delta);
      cancel();
      if (count > 0) {
        setRestoring(false);
        if (previous === 0) {
          root.style.setProperty('--viewer-page-height', `${root.getBoundingClientRect().height}px`);
          root.setAttribute('data-viewer-suspended', '');
          root.setAttribute('inert', '');
        }
      } else if (previous > 0) {
        setRestoring(true);
        restore();
        // Permitir layout y un repintado de la página bajo la pantalla de espera.
        const finish = () => { cancel(); setRestoring(false); };
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finish); });
        timeout = window.setTimeout(finish, 1000);
      }
    };
    window.addEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, onVisibility);
    return () => { cancel(); restore(); window.removeEventListener(IMAGE_VIEWER_VISIBILITY_EVENT, onVisibility); };
  }, []);
  return restoring ? createPortal(<AtlasLoadingScreen fullScreen label="Cargando sitio…" />, document.body) : null;
}
