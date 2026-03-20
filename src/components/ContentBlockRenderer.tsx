import React, { useState, useEffect } from 'react';
import type { ContentBlock, BlockType } from './PageContentEditor';
import ImageViewerModal from './ImageViewerModal';
import { renderBoldText } from './BoldField';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';
import { normalizeBlockContent } from './blocks/blockRegistry';

const RichTextValue: React.FC<{ value: string; className?: string; style?: React.CSSProperties }> = ({ value, className, style }) => {
  if (!value) return null;
  if (hasHtmlMarkup(value)) {
    return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: toSafeHtml(value) }} />;
  }
  return <div className={className} style={style}>{renderBoldText(value)}</div>;
};

const getBlockShellStyle = (content: Record<string, string>): React.CSSProperties => {
  const padding = Number(content.style_padding ?? 0);
  const radius = Number(content.style_radius ?? 0);
  const hasBg = Boolean(content.style_bg);
  const hasBorder = Boolean(content.style_border);
  const effectivePadding = Number.isFinite(padding) && padding > 0
    ? `${padding}px`
    : hasBg || hasBorder
    ? '14px'
    : undefined;
  const effectiveRadius = Number.isFinite(radius) && radius > 0
    ? `${radius}px`
    : hasBg || hasBorder
    ? '12px'
    : undefined;
  const maxWidthMap: Record<string, string> = {
    full: '100%',
    '900': '900px',
    '700': '700px',
    '560': '560px',
  };
  const shadowMap: Record<string, string> = {
    none: 'none',
    sm: '0 2px 10px rgba(15,23,42,0.08)',
    md: '0 10px 24px rgba(15,23,42,0.12)',
  };
  const fontSizeMap: Record<string, string> = {
    default: 'inherit',
    sm: '0.92em',
    md: '1em',
    lg: '1.08em',
  };
  const align = content.style_align || 'left';
  return {
    background: content.style_bg || 'transparent',
    color: content.style_text || undefined,
    border: content.style_border ? `1px solid ${content.style_border}` : undefined,
    borderRadius: effectiveRadius,
    padding: effectivePadding,
    boxShadow: shadowMap[content.style_shadow || 'none'],
    maxWidth: maxWidthMap[content.style_max_width || 'full'] || '100%',
    fontSize: fontSizeMap[content.style_font_size || 'default'] || 'inherit',
    fontWeight: content.style_font_weight && content.style_font_weight !== 'default'
      ? Number(content.style_font_weight)
      : undefined,
    marginLeft: align === 'right' ? 'auto' : align === 'center' ? 'auto' : 0,
    marginRight: align === 'left' ? 'auto' : align === 'center' ? 'auto' : 0,
    overflow: hasBg || hasBorder ? 'hidden' : undefined,
    boxSizing: 'border-box',
  };
};

// Imagen con fallback visual cuando la URL ya no existe
const BlockImg: React.FC<{
  src: string;
  alt?: string;
  style?: React.CSSProperties;
}> = ({ src, alt = '', style }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div style={{
        ...style,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8',
        fontSize: '0.82em', fontWeight: 600, borderRadius: 'inherit',
        minHeight: '80px', gap: '6px', textAlign: 'center', padding: '12px',
        boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: '1.8em', lineHeight: 1 }}>🖼️</span>
        <span>Imagen no disponible</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      draggable={false}
      onError={() => setError(true)}
    />
  );
};

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
}

/**
 * Renderizador de solo lectura para bloques de contenido.
 * Se usa en las páginas públicas (Subtemas, PlacasSubtema) para mostrar
 * el contenido editorial creado desde el panel de edición.
 */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ blocks }) => {
  const [selectedImage, setSelectedImage] = useState<{ view: string; zoom: string } | null>(null);

  const handleZoom = (url: string) => {
    setSelectedImage({
      view: getCloudinaryImageUrl(url, 'view'),
      zoom: getCloudinaryImageUrl(url, 'zoom'),
    });
  };

  if (!blocks || blocks.length === 0) return null;

  return (
    <>
      <div style={rs.container} className="cb-container">
        {blocks.map(block => {
          const normalizedContent = normalizeBlockContent(block.block_type, block.content);
          return (
          <div key={block.id} style={getBlockShellStyle(normalizedContent)} className="cb-shell">
            <BlockItem block={block} onZoom={handleZoom} />
          </div>
          );
        })}
      </div>
      {selectedImage && (
        <ImageViewerModal src={selectedImage.view} srcZoom={selectedImage.zoom} onClose={() => setSelectedImage(null)} />
      )}
    </>
  );
};

const BlockItem: React.FC<{ block: ContentBlock; onZoom: (url: string) => void }> = ({ block, onZoom }) => {
  const [imgHovered, setImgHovered] = useState(false);
  const [imgHoveredLeft, setImgHoveredLeft] = useState(false);
  const [imgHoveredRight, setImgHoveredRight] = useState(false);
  const [imgHoveredIdx, setImgHoveredIdx] = useState<number>(-1);
  const type = block.block_type as BlockType;
  const c = normalizeBlockContent(type, block.content);

  switch (type) {
    case 'heading': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return (
        <div>
          <div style={{ ...rs.heading, textAlign: align }}>
            <RichTextValue value={c.text} />
          </div>
          <div style={{ ...rs.headingAccent, margin: align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : undefined }} />
        </div>
      );
    }

    case 'subheading': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      const isCenter = align === 'center';
      const isRight = align === 'right';
      return (
        <div style={{
          ...rs.subheading,
          textAlign: align,
          paddingLeft: isCenter || isRight ? 0 : '14px',
          paddingRight: isRight ? '14px' : 0,
          borderLeft: isCenter || isRight ? 'none' : '4px solid #38bdf8',
          borderRight: isRight ? '4px solid #38bdf8' : 'none',
        }}>
          <RichTextValue value={c.text} />
        </div>
      );
    }

    case 'paragraph': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return <RichTextValue className="cb-paragraph" style={{ ...rs.paragraph, textAlign: align }} value={c.text} />;
    }

    case 'image': {
      if (!c.url) return null;
      const sizeMap: Record<string, string> = { small: '340px', medium: '540px', large: '100%' };
      const maxW = sizeMap[(c.size as string) ?? 'large'] ?? '100%';
      const align = (c.align as string) ?? 'center';
      const figureStyle: React.CSSProperties = {
        ...rs.figure,
        maxWidth: maxW,
        marginLeft: align === 'right' ? 'auto' : align === 'center' ? 'auto' : 0,
        marginRight: align === 'left' ? 'auto' : align === 'center' ? 'auto' : 0,
      };
      return (
        <figure style={figureStyle}>
          <div
            style={{ ...rs.imgClickWrap, ...(imgHovered ? rs.imgClickWrapHover : {}) }}
            onClick={() => onZoom(c.url)}
            onMouseEnter={() => setImgHovered(true)}
            onMouseLeave={() => setImgHovered(false)}
            title="Ver en grande"
          >
            <BlockImg
                  src={getCloudinaryImageUrl(c.url, 'view')}
              alt={c.caption || 'Imagen ilustrativa'}
              style={rs.image}
            />
            <div style={{ ...rs.zoomOverlay, opacity: imgHovered ? 1 : 0 }}>🔍</div>
          </div>
          {c.caption && <figcaption style={rs.caption}><RichTextValue value={c.caption} /></figcaption>}
        </figure>
      );
    }

    case 'text_image': {
      const hasText = Boolean(c.text);
      const hasImage = Boolean(c.image_url);
      if (!hasText && !hasImage) return null;

      const isLeft = c.image_position !== 'right';
      const direction: React.CSSProperties['flexDirection'] = isLeft ? 'row' : 'row-reverse';
      const tiTextAlign = (c.ti_text_align as React.CSSProperties['textAlign']) ?? 'left';

      return (
        <div style={{ ...rs.tiRow, flexDirection: direction }} className="cb-ti-row">
          {hasImage && (
            <figure style={rs.tiFigure} className="cb-ti-figure">
              <div
                style={{ ...rs.imgClickWrap, ...(imgHovered ? rs.imgClickWrapHover : {}) }}
                onClick={() => onZoom(c.image_url)}
                onMouseEnter={() => setImgHovered(true)}
                onMouseLeave={() => setImgHovered(false)}
                title="Ver en grande"
              >
                <BlockImg
                  src={getCloudinaryImageUrl(c.image_url, 'view')}
                  alt={c.image_caption || 'Imagen ilustrativa'}
                  style={rs.tiImage}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHovered ? 1 : 0 }}>🔍</div>
              </div>
              {c.image_caption && (
                <figcaption style={rs.caption}><RichTextValue value={c.image_caption} /></figcaption>
              )}
            </figure>
          )}
          {hasText && <RichTextValue className="cb-ti-text" style={{ ...rs.tiText, textAlign: tiTextAlign }} value={c.text} />}
        </div>
      );
    }

    case 'two_images': {
      const hasLeft = Boolean(c.image_url_left);
      const hasRight = Boolean(c.image_url_right);
      if (!hasLeft && !hasRight) return null;

      return (
        <div style={rs.twoImgRow} className="cb-two-img-row">
          {hasLeft && (
            <figure style={rs.twoImgFigure}>
              <div
                style={{ ...rs.twoImgWrap, ...(imgHoveredLeft ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(c.image_url_left)}
                onMouseEnter={() => setImgHoveredLeft(true)}
                onMouseLeave={() => setImgHoveredLeft(false)}
                title="Ver en grande"
              >
                <BlockImg
                  src={getCloudinaryImageUrl(c.image_url_left, 'view')}
                  alt={c.image_caption_left || 'Imagen izquierda'}
                  style={rs.twoImgImage}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHoveredLeft ? 1 : 0 }}>🔍</div>
              </div>
              {c.image_caption_left && (
                <figcaption style={rs.caption}><RichTextValue value={c.image_caption_left} /></figcaption>
              )}
            </figure>
          )}
          {hasRight && (
            <figure style={rs.twoImgFigure}>
              <div
                style={{ ...rs.twoImgWrap, ...(imgHoveredRight ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(c.image_url_right)}
                onMouseEnter={() => setImgHoveredRight(true)}
                onMouseLeave={() => setImgHoveredRight(false)}
                title="Ver en grande"
              >
                <BlockImg
                  src={getCloudinaryImageUrl(c.image_url_right, 'view')}
                  alt={c.image_caption_right || 'Imagen derecha'}
                  style={rs.twoImgImage}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHoveredRight ? 1 : 0 }}>🔍</div>
              </div>
              {c.image_caption_right && (
                <figcaption style={rs.caption}><RichTextValue value={c.image_caption_right} /></figcaption>
              )}
            </figure>
          )}
        </div>
      );
    }

    case 'three_images': {
      const has1 = Boolean(c.image_url_1);
      const has2 = Boolean(c.image_url_2);
      const has3 = Boolean(c.image_url_3);
      if (!has1 && !has2 && !has3) return null;
      const items = [
        { url: c.image_url_1, cap: c.image_caption_1 },
        { url: c.image_url_2, cap: c.image_caption_2 },
        { url: c.image_url_3, cap: c.image_caption_3 },
      ].filter(x => x.url);
      return (
        <div style={rs.twoImgRow} className="cb-three-img-row">
          {items.map((item, idx) => (
            <figure key={idx} style={rs.twoImgFigure}>
              <div
                style={{ ...rs.twoImgWrap, ...(imgHoveredIdx === idx ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(item.url)}
                onMouseEnter={() => setImgHoveredIdx(idx)}
                onMouseLeave={() => setImgHoveredIdx(-1)}
                title="Ver en grande"
              >
                <BlockImg
                  src={getCloudinaryImageUrl(item.url, 'view')}
                  alt={item.cap || `Imagen ${idx + 1}`}
                  style={rs.twoImgImage}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHoveredIdx === idx ? 1 : 0 }}>🔍</div>
              </div>
              {item.cap && <figcaption style={rs.caption}>{renderBoldText(item.cap)}</figcaption>}
            </figure>
          ))}
        </div>
      );
    }

    case 'callout': {
      if (!c.text) return null;
      const variants: Record<string, { icon: string; bg: string; border: string; color: string }> = {
        info:     { icon: 'ℹ️',  bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
        tip:      { icon: '💡',  bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
        warning:  { icon: '⚠️',  bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
        clinical: { icon: '🔬',  bg: '#fdf4ff', border: '#d8b4fe', color: '#7e22ce' },
      };
      const v = variants[(c.variant as string) ?? 'info'] ?? variants.info;
      return (
        <div style={{ background: v.bg, border: `1.5px solid ${v.border}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.2em', flexShrink: 0, lineHeight: 1.6 }}>{v.icon}</span>
          <RichTextValue style={{ margin: 0, color: v.color, fontSize: '0.96em', lineHeight: 1.75, fontWeight: 500, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }} value={c.text} />
        </div>
      );
    }

    case 'list': {
      if (!c.items) return null;
      const itemArr = (c.items as string).split('\n').map((s: string) => s.trim()).filter(Boolean);
      if (itemArr.length === 0) return null;
      const isNumbered = c.style === 'numbered';
      const Tag = isNumbered ? 'ol' : 'ul';
      return (
        <Tag style={{ paddingLeft: '1.5em', margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
          {itemArr.map((item: string, i: number) => (
            <li key={i} style={{ fontSize: '1em', lineHeight: 1.75, color: '#334155' }}><RichTextValue value={item} /></li>
          ))}
        </Tag>
      );
    }

    case 'divider': {
      const divStlMap: Record<string, React.CSSProperties> = {
        gradient: { height: '3px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px', border: 'none' },
        simple:   { height: '1px', background: '#e2e8f0', border: 'none' },
        labeled:  { height: 0, border: 'none' },
      };
      const stl = (c.style as string) ?? 'gradient';
      if (stl === 'labeled') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#94a3b8' }} />)}
            </div>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>
        );
      }
      return <div style={{ ...(divStlMap[stl] ?? divStlMap.gradient), margin: '4px 0' }} />;
    }

    case 'carousel': {
      const slides = readCarouselSlides(c, 'image_', 8);
      if (slides.length === 0) return null;
      return (
        <figure style={{ margin: '0 auto', maxWidth: '700px', width: '100%' }}>
          <CarouselPlayer
            slides={slides}
            interval={Number(c.interval ?? 4)}
            auto={(c.auto as string) !== 'false'}
            onZoom={onZoom}
          />
        </figure>
      );
    }

    case 'text_carousel': {
      const slides = readCarouselSlides(c, 'image_', 6);
      const hasText = Boolean(c.text);
      if (!hasText && slides.length === 0) return null;
      const isLeft = c.image_position !== 'right';
      const direction: React.CSSProperties['flexDirection'] = isLeft ? 'row' : 'row-reverse';
      const tiTextAlign = (c.ti_text_align as React.CSSProperties['textAlign']) ?? 'left';
      return (
        <div style={{ ...rs.tiRow, flexDirection: direction }} className="cb-ti-row">
          {slides.length > 0 && (
            <div style={{ flexShrink: 0, width: '42%', minWidth: 0 }} className="cb-ti-figure">
              <CarouselPlayer
                slides={slides}
                interval={Number(c.interval ?? 4)}
                auto={(c.auto as string) !== 'false'}
                onZoom={onZoom}
              />
            </div>
          )}
          {hasText && (
            <p className="cb-ti-text" style={{ ...rs.tiText, textAlign: tiTextAlign }}>
              {renderBoldText(c.text as string)}
            </p>
          )}
        </div>
      );
    }

    case 'double_carousel': {
      const leftSlides = readCarouselSlides(c, 'left_image_', 5);
      const rightSlides = readCarouselSlides(c, 'right_image_', 5);
      if (leftSlides.length === 0 && rightSlides.length === 0) return null;
      const interval = Number(c.interval ?? 4);
      const autoPlay = (c.auto as string) !== 'false';
      return (
        <div style={rs.twoImgRow} className="cb-two-img-row">
          {leftSlides.length > 0 && (
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <CarouselPlayer slides={leftSlides} interval={interval} auto={autoPlay} onZoom={onZoom} />
            </div>
          )}
          {rightSlides.length > 0 && (
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <CarouselPlayer slides={rightSlides} interval={interval} auto={autoPlay} onZoom={onZoom} />
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};

// ── Reproductor de carrusel ───────────────────────────────────────────────────
const CarouselPlayer: React.FC<{
  slides: { url: string; caption?: string }[];
  interval: number;
  auto: boolean;
  onZoom?: (url: string) => void;
}> = ({ slides, interval, auto, onZoom }) => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imgH, setImgH] = useState(false);
  const [failedSlides, setFailedSlides] = useState<Set<number>>(new Set());
  const count = slides.length;

  useEffect(() => {
    if (!auto || count <= 1 || interval <= 0 || paused) return;
    const t = setTimeout(() => setCurrent(c => (c + 1) % count), interval * 1000);
    return () => clearTimeout(t);
  }, [current, paused, count, interval, auto]);

  if (count === 0) {
    return (
      <div style={{ height: '140px', background: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9em' }}>
        Sin imágenes
      </div>
    );
  }

  const slide = slides[current];
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent(c => (c - 1 + count) % count); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent(c => (c + 1) % count); };

  return (
    <div style={rs.carouselWrap} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        style={{ ...rs.carouselSlide, ...(imgH ? rs.imgClickWrapHover : {}) }}
        onClick={() => onZoom?.(slide.url)}
        onMouseEnter={() => setImgH(true)}
        onMouseLeave={() => setImgH(false)}
        title="Ver en grande"
      >
        {failedSlides.has(current) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '0.82em', fontWeight: 600, width: '100%', minHeight: '200px', gap: '6px' }}>
            <span style={{ fontSize: '1.8em', lineHeight: 1 }}>🖼️</span>
            <span>Imagen no disponible</span>
          </div>
        ) : (
          <img
            key={slide.url + current}
            src={getCloudinaryImageUrl(slide.url, 'view')}
            alt={slide.caption ?? ''}
            style={rs.carouselImage}
            loading="lazy"
            draggable={false}
            onError={() => setFailedSlides(prev => new Set([...prev, current]))}
          />
        )}
        <div style={{ ...rs.zoomOverlay, opacity: imgH ? 1 : 0 }}>🔍</div>
        {count > 1 && (
          <>
            <button style={{ ...rs.carouselArrow, left: '8px' }} onClick={prev} title="Anterior">❮</button>
            <button style={{ ...rs.carouselArrow, right: '8px' }} onClick={next} title="Siguiente">❯</button>
          </>
        )}
      </div>
      {slide.caption && <figcaption style={rs.caption}><RichTextValue value={slide.caption} /></figcaption>}
      {count > 1 && (
        <div style={rs.dotsRow}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{ ...rs.dot, ...(i === current ? rs.dotActive : {}) }}
              title={`Imagen ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Helpers para casos carousel ────────────────────────────────────────────────
function readCarouselSlides(
  c: Record<string, unknown>,
  prefix: string,
  max: number,
): { url: string; caption?: string }[] {
  const slides: { url: string; caption?: string }[] = [];
  for (let i = 1; i <= max; i++) {
    const url = (c[`${prefix}url_${i}`] as string) ?? '';
    if (!url) break;
    slides.push({ url, caption: (c[`${prefix}cap_${i}`] as string) || undefined });
  }
  return slides;
}

// ── Estilos de renderizado ────────────────────────────────────────────────────
const rs: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    marginBottom: 0,
    width: '100%',
    fontFamily: 'inherit',
  },

  // Título principal (H1 editorial)
  heading: {
    fontSize: 'clamp(1.35em, 3vw, 2em)',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
    margin: '0 0 8px',
  },
  headingAccent: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },

  // Subtítulo (H2 editorial)
  subheading: {
    fontSize: 'clamp(1.05em, 2.5vw, 1.35em)',
    fontWeight: 700,
    color: '#1e293b',
    lineHeight: 1.35,
    margin: 0,
    paddingLeft: '14px',
    borderLeft: '4px solid #38bdf8',
  },

  // Párrafo de texto
  paragraph: {
    fontSize: '1em',
    lineHeight: 1.85,
    color: '#334155',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    minWidth: 0,
  },

  // Wrapper clickeable de imagen
  imgClickWrap: {
    position: 'relative',
    cursor: 'zoom-in',
    borderRadius: '14px',
    overflow: 'hidden',
    display: 'block',
    width: '100%',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  imgClickWrapHover: {
    transform: 'scale(1.015)',
    boxShadow: '0 8px 32px rgba(14,165,233,0.22)',
  },
  zoomOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15,23,42,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2em',
    transition: 'opacity 0.2s',
    borderRadius: '14px',
    pointerEvents: 'none',
  },

  // Bloque de imagen centrada
  figure: {
    margin: '0 auto',
    maxWidth: '700px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  image: {
    width: '100%',
    maxHeight: '500px',
    objectFit: 'contain',
    borderRadius: '14px',
    display: 'block',
    boxShadow: '0 4px 24px rgba(15,23,42,0.12)',
  },
  caption: {
    fontSize: '0.83em',
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },

  // Bloque texto + imagen lado a lado
  tiRow: {
    display: 'flex',
    gap: '28px',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
  },
  tiFigure: {
    flexShrink: 0,
    width: '42%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: 0,
  },
  tiImage: {
    width: '100%',
    borderRadius: '12px',
    objectFit: 'cover',
    display: 'block',
    boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
  },
  tiText: {
    flex: '1 1 0',
    minWidth: 0,
    fontSize: '1em',
    lineHeight: 1.85,
    color: '#334155',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },

  // Bloque dos imágenes
  twoImgRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'stretch',
  },
  twoImgFigure: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    margin: 0,
  },
  twoImgWrap: {
    width: '100%',
    aspectRatio: '4 / 3',
    overflow: 'hidden',
    borderRadius: '12px',
    position: 'relative',
    cursor: 'zoom-in',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  twoImgWrapHover: {
    transform: 'scale(1.015)',
    boxShadow: '0 8px 32px rgba(14,165,233,0.22)',
  },
  twoImgImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
  },

  // Carrusel
  carouselWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
  carouselSlide: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    overflow: 'hidden',
    borderRadius: '14px',
    cursor: 'zoom-in',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'block',
    userSelect: 'none',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'opacity 0.3s ease',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(15,23,42,0.55)',
    border: 'none',
    color: '#fff',
    fontSize: '1.1em',
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 2,
    lineHeight: 1,
    transition: 'background 0.15s',
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '2px',
    paddingBottom: '2px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#cbd5e1',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.2s, transform 0.2s',
  },
  dotActive: {
    background: '#38bdf8',
    transform: 'scale(1.35)',
  },
};

export { ContentBlockRenderer };
export default ContentBlockRenderer;
