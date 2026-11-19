import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export default function PageFrame({ width, children }: { width?: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const zoom = width && available ? Math.min(1, available / width) : 1;
  return <div className="e2-page-frame" ref={frame}>
    <div style={{ width: width ?? '100%', zoom, marginInline: 'auto' }}>{children}</div>
  </div>;
}
