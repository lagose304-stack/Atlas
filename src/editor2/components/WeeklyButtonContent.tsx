import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { renderAtlasIcon } from './IconPickerModal';

function WeeklyLens({ src, icon }: { src?: string; icon?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="e2-weekly-button__lens" aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : renderAtlasIcon(icon || 'microscope', 17)}
    </span>
  );
}

export default function WeeklyButtonContent({ thumbnailSrc, icon, children }: {
  thumbnailSrc?: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <>
      <WeeklyLens key={thumbnailSrc} src={thumbnailSrc} icon={icon} />
      {children}
      <span className="e2-weekly-button__arrow" aria-hidden="true"><ChevronRight size={16} /></span>
    </>
  );
}
