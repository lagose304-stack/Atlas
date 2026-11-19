import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpenCheck, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import type { BlockStyle, ExamParcial, LayoutIntent } from '../domain/schema';
import { layoutClasses } from '../domain/layout';
import { blockMotionClasses, mergeBlockStyle } from '../domain/styleToCss';
import {
  EXAM_PARCIAL_LABELS,
  loadPublishedExamTests,
  type Editor2ExamTest,
} from '../services/examTestsService';

export type ExamCarouselBlockViewProps = {
  layout: LayoutIntent;
  parcial: ExamParcial;
  title?: string;
  accentColor?: string;
  maxItems?: number;
  blockStyle?: BlockStyle;
  editing?: boolean;
  dragRef?: ((element: Element | null) => void) | null;
  rowStyleCss?: CSSProperties;
  resizeHandles?: React.ReactNode;
  loadTests?: (parcial: ExamParcial, maxItems: number) => Promise<Editor2ExamTest[]>;
};

const PARCIAL_SHORT_LABELS: Record<string, string> = {
  primer: '1.er parcial',
  segundo: '2.º parcial',
  tercer: '3.er parcial',
};

const ExamCarouselBlockView: React.FC<ExamCarouselBlockViewProps> = ({
  layout,
  parcial,
  title,
  accentColor = '#6d28d9',
  maxItems = 8,
  blockStyle,
  editing = false,
  dragRef,
  rowStyleCss,
  resizeHandles,
  loadTests = loadPublishedExamTests,
}) => {
  const [tests, setTests] = useState<Editor2ExamTest[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadTests(parcial, maxItems).then((items) => {
      if (!active) return;
      setTests(items);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [parcial, maxItems, loadTests]);

  const scrollTrack = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 280, behavior: 'smooth' });
  };

  const heading = title?.trim() || `Evaluaciones · ${EXAM_PARCIAL_LABELS[parcial]}`;

  return (
    <section
      ref={dragRef ?? undefined}
      className={`e2-block e2-block--exam-carousel ${blockMotionClasses(blockStyle, editing)} ${layoutClasses(layout)}`.trim()}
      style={{
        ...mergeBlockStyle(rowStyleCss ?? {}, blockStyle),
        ['--e2-exam-accent' as string]: accentColor,
      }}
      data-e2-area={Object.values(layout).some((intent) => intent.row || intent.rowSpan) || undefined}
      data-e2-block="examCarousel"
      aria-label={heading}
    >
      <header className="e2-exam-head">
        <div className="e2-exam-head__title">
          <span className="e2-exam-head__icon" aria-hidden="true">
            <ClipboardList size={15} />
          </span>
          <h3>{heading}</h3>
          <span className="e2-exam-head__pill">
            {loading ? 'Cargando...' : `${tests.length} ${tests.length === 1 ? 'prueba' : 'pruebas'}`}
          </span>
        </div>
        {tests.length > 2 && (
          <div className="e2-exam-head__nav">
            <button
              type="button"
              className="e2-exam-nav-btn"
              aria-label="Desplazar pruebas a la izquierda"
              onClick={() => scrollTrack(-1)}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="e2-exam-nav-btn"
              aria-label="Desplazar pruebas a la derecha"
              onClick={() => scrollTrack(1)}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <div className="e2-exam-empty" role="status">
          Consultando evaluaciones publicadas...
        </div>
      ) : tests.length === 0 ? (
        <div className="e2-exam-empty">
          <BookOpenCheck size={18} aria-hidden="true" />
          <span>
            No hay pruebas publicadas para <strong>{EXAM_PARCIAL_LABELS[parcial]}</strong> todavía.
          </span>
        </div>
      ) : (
        <div ref={trackRef} className="e2-exam-track">
          {tests.map((test) => (
            <article key={test.id} className="e2-exam-card">
              <div className="e2-exam-card__media">
                {test.thumbnailUrl ? (
                  <img src={test.thumbnailUrl} alt="" loading="lazy" decoding="async" draggable={false} />
                ) : (
                  <BookOpenCheck size={28} aria-hidden="true" />
                )}
                {PARCIAL_SHORT_LABELS[test.parcialKey] && (
                  <span className="e2-exam-card__badge">{PARCIAL_SHORT_LABELS[test.parcialKey]}</span>
                )}
              </div>
              <div className="e2-exam-card__body">
                {test.temaNombre && <span className="e2-exam-card__tema">{test.temaNombre}</span>}
                <h4 className="e2-exam-card__name">{test.nombre}</h4>
                <a
                  href={editing ? undefined : `/evaluaciones/ejecutar/${test.id}`}
                  className="e2-exam-card__cta"
                  onClick={editing ? (e) => e.preventDefault() : undefined}
                >
                  <span>Iniciar prueba</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && resizeHandles}
    </section>
  );
};

export default ExamCarouselBlockView;
