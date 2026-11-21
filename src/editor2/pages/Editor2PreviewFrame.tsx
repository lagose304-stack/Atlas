import { useEffect, useState } from 'react';
import { PublicPreviewAuthProvider } from '../../contexts/AuthContext';
import Editor2RealPreview from '../components/Editor2RealPreview';
import type { CanvasDoc } from '../domain/schema';
import { PREVIEW_DOCUMENT, PREVIEW_READY, type PreviewDocumentMessage } from '../public/previewFrame';
import '../styles/editor2.css';

export default function Editor2PreviewFrame() {
  const [doc, setDoc] = useState<CanvasDoc | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const receiveDocument = (event: MessageEvent<PreviewDocumentMessage>) => {
      if (event.origin === origin && event.source === window.parent && event.data?.type === PREVIEW_DOCUMENT) {
        setDoc(event.data.doc);
      }
    };
    window.addEventListener('message', receiveDocument);
    window.parent.postMessage(PREVIEW_READY, origin);
    return () => window.removeEventListener('message', receiveDocument);
  }, []);

  if (!doc) return <p className="editor2-scope e2-real-preview__loading" role="status">Preparando la vista previa…</p>;

  return (
    <PublicPreviewAuthProvider>
      <Editor2RealPreview doc={doc} />
    </PublicPreviewAuthProvider>
  );
}
