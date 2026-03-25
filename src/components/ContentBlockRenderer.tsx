import React, { useState, useEffect, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
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

  // Padding más responsive
  const effectivePadding = Number.isFinite(padding) && padding > 0
    ? `${padding}px`
    : hasBg || hasBorder
    ? 'clamp(12px, 2.5vw, 20px)'
    : undefined;

  // Border radius más responsive
  const effectiveRadius = Number.isFinite(radius) && radius > 0
    ? `${radius}px`
    : hasBg || hasBorder
    ? 'clamp(10px, 1.5vw, 14px)'
    : undefined;

  const maxWidthMap: Record<string, string> = {
    full: '100%',
    '900': '900px',
    '700': '700px',
    '560': 'clamp(340px, 90vw, 560px)',
  };

  const shadowMap: Record<string, string> = {
    none: 'none',
    sm: '0 2px 8px rgba(14,165,233,0.07)',
    md: '0 6px 20px rgba(15,23,42,0.12)',
  };

  const fontSizeMap: Record<string, string> = {
    default: 'inherit',
    sm: '0.88em',
    md: '0.96em',
    lg: '1.06em',
  };

  const align = content.style_align || 'left';
  const maxWidth = maxWidthMap[content.style_max_width || 'full'] || '100%';
  const alignSelf: React.CSSProperties['alignSelf'] = align === 'right'
    ? 'flex-end'
    : align === 'center'
    ? 'center'
    : 'flex-start';

  return {
    background: content.style_bg || 'transparent',
    color: content.style_text || undefined,
    border: content.style_border ? `1.5px solid ${content.style_border}` : undefined,
    borderRadius: effectiveRadius,
    padding: effectivePadding,
    boxShadow: shadowMap[content.style_shadow || 'none'],
    width: '100%',
    maxWidth,
    alignSelf,
    fontSize: fontSizeMap[content.style_font_size || 'default'] || 'inherit',
    fontWeight: content.style_font_weight && content.style_font_weight !== 'default'
      ? Number(content.style_font_weight)
      : undefined,
    marginLeft: 0,
    marginRight: 0,
    overflow: hasBg || hasBorder ? 'hidden' : undefined,
    boxSizing: 'border-box',
    transition: 'all 0.28s ease',
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
        justifyContent: 'center', background: '#f1f5f9', color: '#57708f',
        fontSize: 'clamp(0.8em, 2vw, 0.9em)', fontWeight: 500, borderRadius: 'inherit',
        minHeight: '100px', gap: 'clamp(6px, 1.5vw, 10px)', textAlign: 'center', padding: 'clamp(10px, 2vw, 16px)',
        boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: '2em', lineHeight: 1 }}>🖼️</span>
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
      decoding="async"
      sizes="(max-width: 560px) 100vw, (max-width: 900px) 85vw, 70vw"
      draggable={false}
      onError={() => setError(true)}
    />
  );
};

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
}

type RenderGroup =
  | { kind: 'single'; block: ContentBlock }
  | { kind: 'section'; section: ContentBlock; children: ContentBlock[] };

const buildRenderGroups = (blocks: ContentBlock[]): RenderGroup[] => {
  const groups: RenderGroup[] = [];
  let idx = 0;

  while (idx < blocks.length) {
    const current = blocks[idx];
    if (current.block_type !== 'section') {
      groups.push({ kind: 'single', block: current });
      idx += 1;
      continue;
    }

    const children: ContentBlock[] = [];
    let cursor = idx + 1;
    while (cursor < blocks.length && blocks[cursor].block_type !== 'section') {
      children.push(blocks[cursor]);
      cursor += 1;
    }

    groups.push({ kind: 'section', section: current, children });
    idx = cursor;
  }

  return groups;
};

const toButtonHref = (rawUrl: string): string => {
  const value = rawUrl.trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  return `/${value}`;
};

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
  const renderGroups = useMemo(() => buildRenderGroups(blocks), [blocks]);

  return (
    <>
      <div style={rs.container} className="cb-container">
        {renderGroups.map(group => {
          if (group.kind === 'single') {
            const normalizedContent = normalizeBlockContent(group.block.block_type, group.block.content);
            return (
              <div key={group.block.id} style={getBlockShellStyle(normalizedContent)} className="cb-shell">
                <BlockWithCtas block={group.block} onZoom={handleZoom} />
              </div>
            );
          }

          const sectionContent = normalizeBlockContent(group.section.block_type, group.section.content);
          return (
            <div key={group.section.id} style={rs.sectionGroup} className="cb-section-group">
              <div style={getBlockShellStyle(sectionContent)} className="cb-shell cb-section-shell">
                <BlockWithCtas block={group.section} onZoom={handleZoom} />
              </div>
              {group.children.length > 0 && (
                <div style={rs.sectionChildren} className="cb-section-children">
                  {group.children.map(child => {
                    const childContent = normalizeBlockContent(child.block_type, child.content);
                    return (
                      <div key={child.id} style={getBlockShellStyle(childContent)} className="cb-shell">
                        <BlockWithCtas block={child} onZoom={handleZoom} />
                      </div>
                    );
                  })}
                </div>
              )}
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

const BlockWithCtas: React.FC<{ block: ContentBlock; onZoom: (url: string) => void }> = ({ block, onZoom }) => {
  const c = normalizeBlockContent(block.block_type, block.content);
  const ctaPosition = (c.cta_position as 'before' | 'after') ?? 'after';
  const renderInlineCtas = block.block_type === 'callout' || block.block_type === 'section';
  const ctas = <BlockCtas content={c} />;
  const body = (
    <BlockItem
      block={block}
      onZoom={onZoom}
      inlineCtas={renderInlineCtas ? ctas : null}
      inlineCtaPosition={ctaPosition}
    />
  );

  if (!body && !ctas) return null;
  if (!ctas || renderInlineCtas) return body;
  if (!body) return ctas;

  return (
    <>
      {ctaPosition === 'before' ? ctas : body}
      {ctaPosition === 'before' ? body : ctas}
    </>
  );
};

const BlockCtas: React.FC<{ content: Record<string, string> }> = ({ content }) => {
  const layout = (content.cta_layout as 'row' | 'column') ?? 'row';
  const align = (content.cta_align as 'left' | 'center' | 'right') ?? 'left';
  const style = (content.cta_style as 'solid' | 'outline' | 'soft') ?? 'solid';
  const size = (content.cta_size as 'sm' | 'md' | 'lg') ?? 'md';
  const shape = (content.cta_shape as 'rounded' | 'pill' | 'square') ?? 'rounded';
  const gapRaw = Number(content.cta_gap ?? 12);
  const gap = Number.isFinite(gapRaw) ? Math.max(0, Math.min(32, gapRaw)) : 12;
  const baseColor = content.cta_color || '#2563eb';
  const textColor = content.cta_text_color || '#ffffff';

  const links = [1, 2, 3, 4]
    .map(idx => {
      const text = (content[`cta_${idx}_text`] ?? '').trim();
      const href = toButtonHref(content[`cta_${idx}_url`] ?? '');
      const newTab = (content[`cta_${idx}_new_tab`] ?? 'false') === 'true';
      return { text, href, newTab };
    })
    .filter(item => item.text && item.href);

  if (links.length === 0) return null;

  const sizeMap: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
    sm: { fontSize: '0.82em', padding: '8px 12px' },
    md: { fontSize: '0.9em', padding: '10px 16px' },
    lg: { fontSize: '0.98em', padding: '12px 18px' },
  };
  const shapeMap: Record<'rounded' | 'pill' | 'square', string> = {
    rounded: '10px',
    pill: '999px',
    square: '4px',
  };
  const variantMap: Record<'solid' | 'outline' | 'soft', React.CSSProperties> = {
    solid: { background: baseColor, color: textColor, border: '1px solid transparent' },
    outline: { background: 'transparent', color: baseColor, border: `1.5px solid ${baseColor}` },
    soft: { background: `${baseColor}1A`, color: baseColor, border: `1px solid ${baseColor}66` },
  };
  const justifyMap: Record<'left' | 'center' | 'right', React.CSSProperties['justifyContent']> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  return (
    <div style={rs.buttonsWrap}>
      <div
        style={{
          display: 'flex',
          flexDirection: layout === 'column' ? 'column' : 'row',
          flexWrap: 'wrap',
          gap: `${gap}px`,
          justifyContent: justifyMap[align],
          alignItems: layout === 'column' ? (align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end') : 'center',
        }}
      >
        {links.map((item, idx) => (
          <a
            key={`${item.href}-${idx}`}
            href={item.href}
            target={item.newTab ? '_blank' : undefined}
            rel={item.newTab ? 'noopener noreferrer' : undefined}
            style={{
              ...rs.buttonLink,
              ...sizeMap[size],
              ...variantMap[style],
              borderRadius: shapeMap[shape],
              width: layout === 'column' ? 'min(100%, 460px)' : undefined,
            }}
          >
            {renderBoldText(item.text)}
          </a>
        ))}
      </div>
    </div>
  );
};

const BlockItem: React.FC<{
  block: ContentBlock;
  onZoom: (url: string) => void;
  inlineCtas?: React.ReactNode;
  inlineCtaPosition?: 'before' | 'after';
}> = ({ block, onZoom, inlineCtas, inlineCtaPosition = 'after' }) => {
  const [imgHovered, setImgHovered] = useState(false);
  const [imgHoveredLeft, setImgHoveredLeft] = useState(false);
  const [imgHoveredRight, setImgHoveredRight] = useState(false);
  const [imgHoveredIdx, setImgHoveredIdx] = useState<number>(-1);
  const type = block.block_type as BlockType;
  const c = normalizeBlockContent(type, block.content);

  // Estilos personalizados del usuario (si los cambió en la edición)
  const shellStyle = getBlockShellStyle(c);
  const userTextColor = shellStyle.color || undefined;
  const userFontSize = shellStyle.fontSize || undefined;
  const userFontWeight = shellStyle.fontWeight || undefined;
  const onZoomKeyDown = (e: React.KeyboardEvent<HTMLElement>, url: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(url);
    }
  };

  switch (type) {
    case 'heading': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return (
        <div>
          <div style={{ ...rs.heading, textAlign: align, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }}>
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
          ...(userTextColor ? { color: userTextColor } : {}),
          ...(userFontSize ? { fontSize: userFontSize } : {}),
          ...(userFontWeight ? { fontWeight: userFontWeight } : {}),
        }}>
          <RichTextValue value={c.text} />
        </div>
      );
    }

    case 'paragraph': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return <RichTextValue className="cb-paragraph" style={{ ...rs.paragraph, textAlign: align, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }} value={c.text} />;
    }

    case 'section': {
      const tone = (c.tone as 'neutral' | 'info' | 'accent') ?? 'neutral';
      const toneStyleMap: Record<'neutral' | 'info' | 'accent', React.CSSProperties> = {
        neutral: { background: '#f8fafc', border: '1px solid #e2e8f0' },
        info: { background: '#eff6ff', border: '1px solid #bfdbfe' },
        accent: { background: '#ecfeff', border: '1px solid #99f6e4' },
      };
      if (!c.title && !c.subtitle) {
        return <div style={rs.sectionPlaceholder}>Seccion</div>;
      }
      return (
        <div style={{ ...rs.sectionWrap, ...toneStyleMap[tone] }}>
          {inlineCtas && inlineCtaPosition === 'before' && inlineCtas}
          {c.title && <RichTextValue style={{ ...rs.sectionTitle, ...(userTextColor ? { color: userTextColor } : {}) }} value={c.title} />}
          {c.subtitle && <RichTextValue style={{ ...rs.sectionSubtitle, ...(userTextColor ? { color: userTextColor } : {}) }} value={c.subtitle} />}
          {inlineCtas && inlineCtaPosition === 'after' && inlineCtas}
        </div>
      );
    }

    case 'columns_2': {
      const columnsRaw = Number(c.columns ?? 2);
      const columns = Number.isFinite(columnsRaw) ? Math.max(2, Math.min(4, columnsRaw)) : 2;
      const values = [
        c.col_1 || c.left || '',
        c.col_2 || c.right || '',
        c.col_3 || '',
        c.col_4 || '',
      ].slice(0, columns);
      if (values.every(v => !v)) return null;
      const ratio = (c.ratio as '1:1' | '2:1' | '1:2') ?? '1:1';
      const templateMap: Record<'1:1' | '2:1' | '1:2', string> = {
        '1:1': '1fr 1fr',
        '2:1': '2fr 1fr',
        '1:2': '1fr 2fr',
      };
      const gridTemplateColumns = columns === 2
        ? templateMap[ratio]
        : `repeat(${columns}, minmax(0, 1fr))`;
      return (
        <div className="cb-columns-row" style={{ ...rs.columnsRow, gridTemplateColumns }}>
          {values.map((value, idx) => (
            <div key={idx} style={rs.columnsCell}>
              <RichTextValue className="cb-paragraph" style={{ ...rs.paragraph, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }} value={value} />
            </div>
          ))}
        </div>
      );
    }

    case 'image': {
      if (!c.url) return null;
      const sizeMap: Record<string, string> = {
        small: 'min(100%, 360px)',
        medium: 'min(100%, 620px)',
        large: '100%',
      };
      const maxW = sizeMap[(c.size as string) ?? 'large'] ?? '100%';
      const align = (c.align as string) ?? 'center';
      const widthRaw = Number(c.image_width ?? 100);
      const widthPct = Number.isFinite(widthRaw) ? Math.max(20, Math.min(100, widthRaw)) : 100;
      const heightRaw = Number(c.image_height ?? 0);
      const fixedHeight = Number.isFinite(heightRaw) && heightRaw > 0 ? `${Math.min(1200, heightRaw)}px` : undefined;
      const imageFit = (c.image_fit as 'contain' | 'cover') === 'cover' ? 'cover' : 'contain';
      const alignSelfMap: Record<'left' | 'center' | 'right', React.CSSProperties['alignSelf']> = {
        left: 'flex-start',
        center: 'center',
        right: 'flex-end',
      };
      const figureStyle: React.CSSProperties = {
        ...rs.figure,
        maxWidth: maxW,
        marginLeft: align === 'right' ? 'auto' : align === 'center' ? 'auto' : 0,
        marginRight: align === 'left' ? 'auto' : align === 'center' ? 'auto' : 0,
      };
      return (
        <figure style={figureStyle}>
          <div
            className="cb-zoom-trigger"
            role="button"
            tabIndex={0}
            style={{ ...rs.imgClickWrap, ...(imgHovered ? rs.imgClickWrapHover : {}) }}
            onClick={() => onZoom(c.url)}
            onKeyDown={e => onZoomKeyDown(e, c.url)}
            onMouseEnter={() => setImgHovered(true)}
            onMouseLeave={() => setImgHovered(false)}
            title="Ver en grande"
          >
            <BlockImg
              src={getCloudinaryImageUrl(c.url, 'view')}
              alt={c.caption || 'Imagen ilustrativa'}
              style={{
                ...rs.image,
                width: `${widthPct}%`,
                maxWidth: '100%',
                height: fixedHeight ?? rs.image.height,
                objectFit: imageFit,
                alignSelf: alignSelfMap[(align as 'left' | 'center' | 'right') ?? 'center'],
                background: imageFit === 'contain' ? '#f8fafc' : undefined,
              }}
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
      const tiVerticalAlign = (c.ti_vertical_align as 'start' | 'center' | 'end') ?? 'start';
      const tiAlignItems: React.CSSProperties['alignItems'] =
        tiVerticalAlign === 'center' ? 'center' : tiVerticalAlign === 'end' ? 'flex-end' : 'flex-start';
      const widthRaw = Number(c.ti_image_width ?? 42);
      const imageWidth = Number.isFinite(widthRaw) ? Math.max(20, Math.min(70, widthRaw)) : 42;
      const heightRaw = Number(c.ti_image_height ?? 0);
      const fixedHeight = Number.isFinite(heightRaw) && heightRaw > 0 ? `${Math.min(1000, heightRaw)}px` : undefined;
      const tiImageFit = (c.ti_image_fit as 'contain' | 'cover') === 'contain' ? 'contain' : 'cover';

      return (
        <div style={{ ...rs.tiRow, flexDirection: direction, alignItems: tiAlignItems }} className="cb-ti-row">
          {hasImage && (
            <figure style={{ ...rs.tiFigure, flex: `0 0 ${imageWidth}%` }} className="cb-ti-figure">
              <div
                className="cb-zoom-trigger"
                role="button"
                tabIndex={0}
                style={{ ...rs.imgClickWrap, ...(imgHovered ? rs.imgClickWrapHover : {}) }}
                onClick={() => onZoom(c.image_url)}
                onKeyDown={e => onZoomKeyDown(e, c.image_url)}
                onMouseEnter={() => setImgHovered(true)}
                onMouseLeave={() => setImgHovered(false)}
                title="Ver en grande"
              >
                <BlockImg
                  src={getCloudinaryImageUrl(c.image_url, 'view')}
                  alt={c.image_caption || 'Imagen ilustrativa'}
                  style={{
                    ...rs.tiImage,
                    height: fixedHeight ?? rs.tiImage.height,
                    objectFit: tiImageFit,
                    background: tiImageFit === 'contain' ? '#f8fafc' : undefined,
                  }}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHovered ? 1 : 0 }}>🔍</div>
              </div>
              {c.image_caption && (
                <figcaption style={rs.caption}><RichTextValue value={c.image_caption} /></figcaption>
              )}
            </figure>
          )}
          {hasText && <RichTextValue className="cb-ti-text" style={{ ...rs.tiText, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }} value={c.text} />}
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
                className="cb-zoom-trigger"
                role="button"
                tabIndex={0}
                style={{ ...rs.twoImgWrap, ...(imgHoveredLeft ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(c.image_url_left)}
                onKeyDown={e => onZoomKeyDown(e, c.image_url_left)}
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
                className="cb-zoom-trigger"
                role="button"
                tabIndex={0}
                style={{ ...rs.twoImgWrap, ...(imgHoveredRight ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(c.image_url_right)}
                onKeyDown={e => onZoomKeyDown(e, c.image_url_right)}
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
        <div style={rs.threeImgRow} className="cb-three-img-row">
          {items.map((item, idx) => (
            <figure key={idx} style={rs.twoImgFigure}>
              <div
                className="cb-zoom-trigger"
                role="button"
                tabIndex={0}
                style={{ ...rs.twoImgWrap, ...(imgHoveredIdx === idx ? rs.twoImgWrapHover : {}) }}
                onClick={() => onZoom(item.url)}
                onKeyDown={e => onZoomKeyDown(e, item.url)}
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
        <div style={{ background: v.bg, border: `1.5px solid ${v.border}`, borderRadius: 'clamp(10px, 1.5vw, 14px)', padding: 'clamp(12px, 2vw, 18px) clamp(14px, 2.5vw, 22px)', display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vw, 16px)' }}>
          {inlineCtas && inlineCtaPosition === 'before' && inlineCtas}
          <div style={{ display: 'flex', gap: 'clamp(10px, 2vw, 16px)', alignItems: 'center' }}>
            <span
              aria-hidden
              style={{ fontSize: 'clamp(1em, 1.5vw, 1.3em)', flexShrink: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              {v.icon}
            </span>
            <RichTextValue
              style={{
                margin: 0,
                color: userTextColor || v.color,
                fontSize: userFontSize || '0.9em',
                lineHeight: 1.8,
                fontWeight: userFontWeight || 500,
                whiteSpace: 'pre-wrap' as const,
                wordBreak: 'break-word' as const,
                fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              }}
              value={c.text}
            />
            <span
              aria-hidden
              style={{ fontSize: 'clamp(1em, 1.5vw, 1.3em)', flexShrink: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              {v.icon}
            </span>
          </div>
          {inlineCtas && inlineCtaPosition === 'after' && inlineCtas}
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
        <Tag style={{ paddingLeft: 'clamp(20px, 4vw, 28px)', margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 'clamp(6px, 1.5vw, 10px)' }}>
          {itemArr.map((item: string, i: number) => (
            <li
              key={i}
              style={{
                fontSize: userFontSize || '0.9em',
                lineHeight: 1.8,
                color: userTextColor || '#536b88',
                fontWeight: userFontWeight || 400,
                fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              }}
            >
              <RichTextValue value={item} />
            </li>
          ))}
        </Tag>
      );
    }

    case 'divider': {
      const divStlMap: Record<string, React.CSSProperties> = {
        gradient: { height: '3px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px', border: 'none' },
        simple:   { height: '1px', background: '#cbd5e1', border: 'none' },
        labeled:  { height: 0, border: 'none' },
      };
      const stl = (c.style as string) ?? 'gradient';
      if (stl === 'labeled') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)', margin: 'clamp(12px, 2vw, 20px) 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />)}
            </div>
            <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
          </div>
        );
      }
      return <div style={{ ...(divStlMap[stl] ?? divStlMap.gradient), margin: 'clamp(12px, 2vw, 20px) 0' }} />;
    }

    case 'carousel': {
      const slides = readCarouselSlides(c, 'image_', 8);
      if (slides.length === 0) return null;
      return (
        <figure style={{ margin: '0 auto', maxWidth: 'clamp(280px, 80vw, 700px)', width: '100%' }}>
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
            <div style={{ flexShrink: 0, width: 'clamp(200px, 42%, 360px)', minWidth: 0 }} className="cb-ti-figure">
              <CarouselPlayer
                slides={slides}
                interval={Number(c.interval ?? 4)}
                auto={(c.auto as string) !== 'false'}
                onZoom={onZoom}
              />
            </div>
          )}
          {hasText && (
            <p className="cb-ti-text" style={{ ...rs.tiText, textAlign: tiTextAlign, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }}>
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
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: slides.length > 1,
    align: 'start',
    containScroll: 'trimSnaps',
  });
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [failedSlides, setFailedSlides] = useState<Set<number>>(new Set());
  const count = slides.length;
  const onZoomKeyDown = (e: React.KeyboardEvent<HTMLElement>, url: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom?.(url);
    }
  };

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrent(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !auto || count <= 1 || interval <= 0 || paused) return;
    const t = window.setInterval(() => emblaApi.scrollNext(), interval * 1000);
    return () => window.clearInterval(t);
  }, [emblaApi, auto, count, interval, paused]);

  if (count === 0) {
    return (
      <div style={{ height: '140px', background: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9em' }}>
        Sin imágenes
      </div>
    );
  }

  const slide = slides[current] ?? slides[0];
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    emblaApi?.scrollPrev();
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    emblaApi?.scrollNext();
  };

  return (
    <div style={rs.carouselWrap} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={rs.carouselViewport} ref={emblaRef}>
        <div style={rs.carouselTrack}>
          {slides.map((item, idx) => (
            <div key={item.url + idx} style={rs.carouselCell}>
              <div
                className="cb-zoom-trigger"
                role="button"
                tabIndex={0}
                style={{ ...rs.carouselSlide, ...(hoveredIdx === idx ? rs.imgClickWrapHover : {}) }}
                onClick={() => onZoom?.(item.url)}
                onKeyDown={e => onZoomKeyDown(e, item.url)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                title="Ver en grande"
              >
                {failedSlides.has(idx) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '0.82em', fontWeight: 600, width: '100%', minHeight: '200px', gap: '6px' }}>
                    <span style={{ fontSize: '1.8em', lineHeight: 1 }}>🖼️</span>
                    <span>Imagen no disponible</span>
                  </div>
                ) : (
                  <img
                    src={getCloudinaryImageUrl(item.url, 'view')}
                    alt={item.caption ?? ''}
                    style={rs.carouselImage}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 560px) 100vw, (max-width: 900px) 90vw, 70vw"
                    draggable={false}
                    onError={() => setFailedSlides(prev => new Set([...prev, idx]))}
                  />
                )}
                <div style={{ ...rs.zoomOverlay, opacity: hoveredIdx === idx ? 1 : 0 }}>🔍</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <>
          <button type="button" style={{ ...rs.carouselArrow, left: '8px' }} onClick={prev} title="Anterior">❮</button>
          <button type="button" style={{ ...rs.carouselArrow, right: '8px' }} onClick={next} title="Siguiente">❯</button>
        </>
      )}
      {slide.caption && <figcaption style={rs.caption}><RichTextValue value={slide.caption} /></figcaption>}
      {count > 1 && (
        <div style={rs.dotsRow}>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
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
    gap: 'clamp(16px, 3vw, 28px)',
    marginBottom: 0,
    width: '100%',
    fontFamily: 'inherit',
  },

  // Título principal (H1 editorial) — sincronizado con atlas-typo-title
  heading: {
    fontSize: 'clamp(1.02rem, 1.2vw + 0.56rem, 1.28rem)',
    fontWeight: 800,
    color: '#1d3656',
    letterSpacing: '0.015em',
    lineHeight: 1.3,
    margin: '0 0 12px',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  headingAccent: {
    width: '56px',
    height: '4px',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    borderRadius: '4px',
  },

  // Subtítulo (H2 editorial) — sincronizado con atlas-typo-section-title
  subheading: {
    fontSize: 'clamp(0.88rem, 0.72vw + 0.54rem, 1rem)',
    fontWeight: 700,
    color: '#173654',
    letterSpacing: '0.01em',
    lineHeight: 1.4,
    margin: 0,
    paddingLeft: 'clamp(12px, 2vw, 16px)',
    borderLeft: '4px solid #38bdf8',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },

  // Párrafo de texto — sincronizado con atlas-typo-body
  paragraph: {
    fontSize: 'clamp(0.82rem, 0.52vw + 0.52rem, 0.92rem)',
    lineHeight: 1.8,
    color: '#536b88',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    minWidth: 0,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 400,
  },
  sectionWrap: {
    borderRadius: 'clamp(12px, 1.8vw, 16px)',
    padding: 'clamp(14px, 2.4vw, 22px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 'clamp(0.92rem, 0.9vw + 0.52rem, 1.08rem)',
    fontWeight: 800,
    lineHeight: 1.35,
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
  },
  sectionSubtitle: {
    margin: 0,
    fontSize: 'clamp(0.82rem, 0.52vw + 0.52rem, 0.92rem)',
    lineHeight: 1.75,
    color: '#475569',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 500,
  },
  sectionPlaceholder: {
    margin: 0,
    fontSize: '0.86em',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(10px, 2vw, 16px)',
  },
  sectionChildren: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(12px, 2.5vw, 18px)',
    paddingLeft: 'clamp(8px, 1.2vw, 14px)',
    borderLeft: '2px dashed #bae6fd',
    marginLeft: 'clamp(4px, 1vw, 8px)',
  },
  columnsRow: {
    display: 'grid',
    gap: 'clamp(12px, 2.5vw, 24px)',
    alignItems: 'start',
  },
  columnsCell: {
    minWidth: 0,
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    padding: 'clamp(10px, 1.8vw, 14px)',
  },

  // Wrapper clickeable de imagen
  imgClickWrap: {
    position: 'relative',
    cursor: 'zoom-in',
    borderRadius: 'clamp(12px, 1.6vw, 16px)',
    overflow: 'hidden',
    display: 'block',
    width: '100%',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease',
  },
  imgClickWrapHover: {
    transform: 'scale(1.02)',
    boxShadow: '0 18px 34px rgba(14,165,233,0.22)',
  },
  zoomOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15,23,42,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.2em',
    transition: 'opacity 0.28s ease',
    borderRadius: 'inherit',
    pointerEvents: 'none',
  },

  // Bloque de imagen centrada
  figure: {
    margin: '0 auto',
    maxWidth: 'clamp(280px, 80vw, 700px)',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(8px, 2vw, 14px)',
  },
  image: {
    width: '100%',
    maxHeight: '540px',
    objectFit: 'contain',
    objectPosition: 'center center',
    borderRadius: 'clamp(12px, 1.6vw, 16px)',
    display: 'block',
    boxShadow: '0 6px 20px rgba(15,23,42,0.12)',
  },
  caption: {
    fontSize: '0.86rem',
    color: '#57708f',
    fontStyle: 'italic',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.6,
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 400,
  },

  // Bloque texto + imagen lado a lado
  tiRow: {
    display: 'flex',
    gap: 'clamp(16px, 3vw, 32px)',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
  },
  tiFigure: {
    flex: '0 0 clamp(220px, 42%, 380px)',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(6px, 1vw, 10px)',
    margin: 0,
  },
  tiImage: {
    width: '100%',
    borderRadius: 'clamp(10px, 1.5vw, 14px)',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    boxShadow: '0 6px 20px rgba(15,23,42,0.12)',
  },
  tiText: {
    flex: '1 1 320px',
    minWidth: 0,
    fontSize: 'clamp(0.82rem, 0.52vw + 0.52rem, 0.92rem)',
    lineHeight: 1.8,
    color: '#536b88',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 400,
  },

  // Bloque dos imágenes
  twoImgRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 'clamp(12px, 2.5vw, 20px)',
    alignItems: 'stretch',
  },
  threeImgRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 'clamp(10px, 2.2vw, 18px)',
    alignItems: 'stretch',
  },
  twoImgFigure: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(6px, 1.5vw, 12px)',
    margin: 0,
  },
  twoImgWrap: {
    width: '100%',
    aspectRatio: '4 / 3',
    overflow: 'hidden',
    borderRadius: 'clamp(10px, 1.5vw, 14px)',
    position: 'relative',
    cursor: 'zoom-in',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease',
  },
  twoImgWrapHover: {
    transform: 'scale(1.02)',
    boxShadow: '0 18px 34px rgba(14,165,233,0.22)',
  },
  twoImgImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    boxShadow: '0 2px 8px rgba(14,165,233,0.12)',
  },

  // Carrusel
  carouselWrap: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(8px, 1.5vw, 12px)',
    width: '100%',
  },
  carouselViewport: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 'clamp(12px, 1.6vw, 16px)',
  },
  carouselTrack: {
    display: 'flex',
    touchAction: 'pan-y',
  },
  carouselCell: {
    flex: '0 0 100%',
    minWidth: 0,
  },
  carouselSlide: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    overflow: 'hidden',
    borderRadius: 'clamp(12px, 1.6vw, 16px)',
    cursor: 'zoom-in',
    transition: 'transform 0.28s ease, box-shadow 0.28s ease',
    display: 'block',
    userSelect: 'none',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    transition: 'opacity 0.3s ease',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(15,23,42,0.6)',
    border: 'none',
    color: '#fff',
    fontSize: 'clamp(1em, 2vw, 1.2em)',
    padding: 'clamp(6px, 1.5vw, 12px) clamp(8px, 2vw, 14px)',
    borderRadius: '10px',
    cursor: 'pointer',
    zIndex: 2,
    lineHeight: 1,
    transition: 'background 0.28s ease, transform 0.28s ease',
    fontFamily: 'inherit',
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 'clamp(4px, 1vw, 8px)',
    marginTop: '4px',
    paddingBottom: '2px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#cbd5e1',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.28s ease, transform 0.28s ease',
  },
  dotActive: {
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    transform: 'scale(1.4)',
  },
  buttonsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '2px',
  },
  buttonLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    textDecoration: 'none',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    fontWeight: 700,
    letterSpacing: '0.01em',
    transition: 'transform 0.18s ease, box-shadow 0.2s ease, filter 0.2s ease',
    boxSizing: 'border-box',
    minHeight: '40px',
  },
};

export { ContentBlockRenderer };
export default ContentBlockRenderer;
