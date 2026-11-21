import type { CanvasDoc } from '../domain/schema';

export const PREVIEW_FRAME_QUERY = 'editor2-preview';
export const PREVIEW_READY = 'atlas:editor2-preview-ready';
export const PREVIEW_DOCUMENT = 'atlas:editor2-preview-document';

export type PreviewDocumentMessage = {
  type: typeof PREVIEW_DOCUMENT;
  doc: CanvasDoc;
};

export function isEditor2PreviewFrame() {
  return typeof window !== 'undefined'
    && window.parent !== window
    && window.location.pathname === '/'
    && new URLSearchParams(window.location.search).has(PREVIEW_FRAME_QUERY);
}
