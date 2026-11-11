import { useEffect, useRef, useState } from 'react';
import IdentificationAnnotationOverlay from './IdentificationAnnotationOverlay';
import type { IdentificationAnnotation } from '../utils/identificationAnnotations';

export default function IdentificationRoundImage({ src, onReady, annotation, imageClassName = 'desafio-plate-img' }: { src: string; onReady: () => void; annotation?: IdentificationAnnotation | null; imageClassName?: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'visible' | 'error'>('loading');
  const [slow, setSlow] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    let cancelled = false;
    let started = false;
    let decoding = false;
    let frame = 0;
    setStatus('loading');
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), 12000);
    const fail = () => { if (!cancelled) setStatus('error'); };
    const ready = async () => {
      if (decoding || started || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return;
      decoding = true;
      try {
        if (image.decode) await image.decode();
        if (cancelled) return;
        setSize({ width: image.naturalWidth, height: image.naturalHeight });
        setStatus('visible');
        // El reloj arranca después de pintar la imagen, también si venía de caché.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (cancelled || started) return;
            started = true;
            window.clearTimeout(slowTimer);
            onReadyRef.current();
          });
        });
      } catch { fail(); }
    };
    image.addEventListener('load', ready);
    image.addEventListener('error', fail);
    if (image.complete) {
      if (image.naturalWidth > 0) void ready();
      else fail();
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(slowTimer);
      image.removeEventListener('load', ready);
      image.removeEventListener('error', fail);
    };
  }, [src, attempt]);

  return <>
    {status !== 'visible' && <div className="desafio-plate-loading-overlay" role="status">
      {status === 'loading' && <div className="desafio-plate-spinner" />}
      <strong>{status === 'error' ? 'No se pudo cargar la placa' : slow ? 'La imagen está tardando en cargar' : 'Preparando placa histológica…'}</strong>
      <span>El tiempo está detenido. No perderás vidas durante la carga.</span>
      {(status === 'error' || slow) && <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>Reintentar carga</button>}
    </div>}
    <img key={attempt} ref={imageRef} src={src} alt="Placa histológica a identificar" className={imageClassName} style={{ opacity: status === 'visible' ? 1 : 0 }} />
    {annotation && status === 'visible' && size.width > 0 && <IdentificationAnnotationOverlay marker={annotation} width={size.width} height={size.height} />}
  </>;
}
