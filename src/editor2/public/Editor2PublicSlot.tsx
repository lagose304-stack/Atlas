import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { Editor2PublicDoc } from '../services/editor2Api';
import { useEditor2PreviewDoc } from './previewDoc';
import { getCachedPublicDoc, loadCachedPublicDoc, type PublicDocLoader } from './publicDocCache';

const LazyEditor2Renderer = lazy(() => import('../render/Editor2Renderer'));

export type Editor2PublicSlotProps = {
  /** Clave canónica de la página en Editor 2.0 (`home`, `temario`, `tema-1`, `subtema-5`, etc.). */
  pageKey: string | null | undefined;
  /** Contenido de respaldo (normalmente el renderizado v1 actual) cuando no hay publicación v2. */
  fallback?: React.ReactNode;
  /** Clase opcional aplicada al contenedor cuando renderiza v2. */
  className?: string;
  /** Etiqueta accesible opcional cuando el slot actúa como región editorial. */
  ariaLabel?: string;
  /** Notifica al consumidor si la página resolvió contenido v2 publicado (`true`) o cayó a v1 (`false`). */
  onResolved?: (hasV2: boolean) => void;
  /** Inyección opcional para pruebas unitarias. */
  loadPublicDoc?: PublicDocLoader;
};

/**
 * Puente público progresivo de Fase 3.
 * Consulta si existe una versión publicada en Editor 2.0 para `pageKey`:
 * - Si existe, carga `Editor2Renderer` de forma diferida (`React.lazy`) y pinta v2.
 * - Si no existe o ocurre cualquier error, muestra `fallback` (v1) sin bloqueos ni errores visibles.
 */
const Editor2PublicSlot: React.FC<Editor2PublicSlotProps> = ({
  pageKey,
  fallback = null,
  className,
  ariaLabel,
  onResolved,
  loadPublicDoc,
}) => {
  const previewDoc = useEditor2PreviewDoc(pageKey);
  const [publicDoc, setPublicDoc] = useState<Editor2PublicDoc | null>(() => {
    const cached = getCachedPublicDoc(pageKey);
    return cached ?? null;
  });

  useEffect(() => {
    if (previewDoc) return;
    let active = true;
    const cached = getCachedPublicDoc(pageKey);
    if (cached !== undefined) {
      setPublicDoc(cached);
      onResolved?.(cached !== null);
      return () => {
        active = false;
      };
    }

    setPublicDoc(null);
    void loadCachedPublicDoc(pageKey, loadPublicDoc).then((result) => {
      if (!active) return;
      setPublicDoc(result);
      onResolved?.(result !== null);
    });

    return () => {
      active = false;
    };
  }, [pageKey, loadPublicDoc, onResolved, previewDoc]);

  if (previewDoc) {
    return (
      <Suspense fallback={<>{fallback}</>}>
        <div
          className={className}
          aria-label={ariaLabel}
          data-editor2-public-slot={previewDoc.pageKey}
          data-editor2-preview=""
        >
          <LazyEditor2Renderer doc={previewDoc} variant="public" />
        </div>
      </Suspense>
    );
  }

  if (!publicDoc) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={<>{fallback}</>}>
      <div
        className={className}
        aria-label={ariaLabel}
        data-editor2-public-slot={publicDoc.pageKey}
        data-editor2-version={publicDoc.versionNumber}
      >
        <LazyEditor2Renderer doc={publicDoc.doc} variant="public" />
      </div>
    </Suspense>
  );
};

export default Editor2PublicSlot;
