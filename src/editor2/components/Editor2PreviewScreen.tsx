import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { CanvasDoc } from '../domain/schema';
import { PREVIEW_DOCUMENT, PREVIEW_FRAME_QUERY, PREVIEW_READY, type PreviewDocumentMessage } from '../public/previewFrame';

export default function Editor2PreviewScreen({ doc, onExit }: { doc: CanvasDoc; onExit: () => void }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const [frameVersion, setFrameVersion] = useState(0);

  useLayoutEffect(() => {
    exitButton.current?.focus();
    const receiveReady = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === iframe.current?.contentWindow && event.data === PREVIEW_READY) {
        setFrameVersion((version) => version + 1);
      }
    };
    window.addEventListener('message', receiveReady);
    return () => window.removeEventListener('message', receiveReady);
  }, []);

  useEffect(() => {
    if (!frameVersion) return;
    const message: PreviewDocumentMessage = { type: PREVIEW_DOCUMENT, doc };
    iframe.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [doc, frameVersion]);

  return (
    <div className="editor2-scope e2-preview-screen">
      <button className="e2-button e2-preview-exit" type="button" onClick={onExit} ref={exitButton}>
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a editar
      </button>
      <iframe
        className="e2-preview-iframe"
        ref={iframe}
        src={`/?${PREVIEW_FRAME_QUERY}`}
        title="Vista previa de la página"
      />
    </div>
  );
}
