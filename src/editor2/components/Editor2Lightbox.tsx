import React, { useEffect, useState } from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

export type Editor2LightboxProps = {
  open: boolean;
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
};

const Editor2Lightbox: React.FC<Editor2LightboxProps> = ({ open, src, alt, caption, onClose }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="e2-zoom-modal"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Vista ampliada de imagen'}
      onClick={onClose}
    >
      <div className="e2-zoom-modal__bar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          aria-label="Alejar"
          disabled={scale <= 1}
          onClick={() => setScale((s) => Math.max(1, Number((s - 0.5).toFixed(1))))}
        >
          <ZoomOut size={15} aria-hidden="true" />
        </button>
        <span className="e2-zoom-modal__scale">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="e2-button e2-button--quiet"
          aria-label="Acercar"
          disabled={scale >= 3}
          onClick={() => setScale((s) => Math.min(3, Number((s + 0.5).toFixed(1))))}
        >
          <ZoomIn size={15} aria-hidden="true" />
        </button>
        {scale > 1 && (
          <button
            type="button"
            className="e2-button e2-button--quiet"
            aria-label="Restablecer zoom"
            onClick={() => setScale(1)}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="e2-button e2-button--quiet"
          aria-label="Cerrar imagen ampliada"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
          <span>Cerrar</span>
        </button>
      </div>
      <div className="e2-zoom-modal__viewport" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="e2-zoom-modal__img"
          style={{ transform: `scale(${scale})` }}
        />
      </div>
      {caption && <p className="e2-zoom-modal__caption">{caption}</p>}
    </div>
  );
};

export default Editor2Lightbox;
