import React from 'react';
import { ZoomIn } from 'lucide-react';
import '../../styles/blockPhotoFrame.css';

interface BlockPhotoFrameProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onOpen?: () => void;
  showZoom?: boolean;
}

export default function BlockPhotoFrame({ children, style, onOpen, showZoom = false }: BlockPhotoFrameProps) {
  return (
    <div
      className="atlas-block-photo-frame"
      style={style}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      } : undefined}
    >
      {children}
      <span className="atlas-block-photo-corners" aria-hidden="true" />
      {(onOpen || showZoom) && <span className="atlas-block-photo-zoom" aria-hidden="true"><ZoomIn size={12} />Ampliar</span>}
    </div>
  );
}
