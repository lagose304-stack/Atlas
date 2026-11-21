import { createContext, useContext } from 'react';
import type { CanvasDoc } from '../domain/schema';

export type Editor2PreviewDoc = {
  pageKey: string;
  doc: CanvasDoc;
};

/**
 * Documento de borrador que la vista previa del editor inyecta en la página
 * pública real. Fuera de la vista previa el contexto es `null` y los slots
 * siguen leyendo únicamente la versión publicada.
 */
const PreviewDocContext = createContext<Editor2PreviewDoc | null>(null);

export const Editor2PreviewDocProvider = PreviewDocContext.Provider;

export function useEditor2PreviewDoc(pageKey: string | null | undefined): CanvasDoc | null {
  const preview = useContext(PreviewDocContext);
  if (!preview || preview.pageKey !== pageKey) return null;
  return preview.doc;
}
