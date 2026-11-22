import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type TemplateCard = {
  label: string;
  active: boolean;
  sample: ReactNode;
  sampleStyle?: CSSProperties;
  onSelect: () => void;
};

export default function BlockTemplateGallery({ label, variant, templates }: {
  label: string;
  variant: 'heading' | 'paragraph' | 'badge' | 'icon' | 'callout' | 'table' | 'button' | 'divider' | 'examCarousel' |
    'image' | 'carousel' | 'compare';
  templates: TemplateCard[];
}) {
  const list = useRef<HTMLDivElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const updateNavigation = useCallback(() => {
    const element = list.current;
    if (!element) return;
    setCanGoBack(element.scrollLeft > 1);
    setCanGoForward(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    updateNavigation();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateNavigation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateNavigation]);

  function scrollTemplates(direction: -1 | 1) {
    const element = list.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth });
  }

  return (
    <div className="e2-text-templates" data-variant={variant} role="group" aria-label={label}>
      <div className="e2-text-templates__header">
        <span className="e2-text-templates__title" aria-hidden="true">{label}</span>
        {(canGoBack || canGoForward) && (
          <div className="e2-text-templates__nav">
            <button type="button" className="e2-button e2-button--quiet e2-settings__icon-button"
              aria-label="Plantillas anteriores" disabled={!canGoBack} onClick={() => scrollTemplates(-1)}>
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <button type="button" className="e2-button e2-button--quiet e2-settings__icon-button"
              aria-label="Plantillas siguientes" disabled={!canGoForward} onClick={() => scrollTemplates(1)}>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className="e2-text-templates__list" ref={list} onScroll={updateNavigation}>
        {templates.map(({ label, active, sample, sampleStyle, onSelect }) => (
          <button key={label} type="button" className="e2-text-template" aria-pressed={active}
            onClick={() => { if (!active) onSelect(); }}>
            <span className="e2-text-template__sample" aria-hidden="true" style={sampleStyle}>{sample}</span>
            <span className="e2-text-template__label">
              {label}
              {active && <Check size={14} aria-hidden="true" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
