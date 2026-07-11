import React, { useState, useEffect, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { ContentBlock, BlockType } from '../types/contentBlocks';
import ImageViewerModal from './ImageViewerModal';
import { renderBoldText } from './BoldField';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { hasHtmlMarkup, toSafeHtml } from '../services/richText';
import { normalizeBlockContent } from './blocks/blockRegistry';
import { supabase } from '../services/supabase';

const RichTextValue: React.FC<{ value: string; className?: string; style?: React.CSSProperties }> = ({ value, className, style }) => {
  if (!value) return null;
  if (hasHtmlMarkup(value)) {
    return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: toSafeHtml(value) }} />;
  }
  return <div className={className} style={style}>{renderBoldText(value)}</div>;
};

const TEXT_BLOCK_TYPES: BlockType[] = ['heading', 'subheading', 'paragraph', 'list', 'callout'];

const getBlockShellStyle = (content: Record<string, string>, blockType?: BlockType): React.CSSProperties => {
  const padding = Number(content.style_padding ?? 0);
  const radius = Number(content.style_radius ?? 0);
  const hasBg = Boolean(content.style_bg);
  const hasBorder = Boolean(content.style_border);

  // Padding más responsive
  const isAutoHeightTextBlock = blockType ? TEXT_BLOCK_TYPES.includes(blockType) : false;
  const effectivePadding = Number.isFinite(padding) && padding > 0
    ? isAutoHeightTextBlock
      ? `${Math.min(padding, 10)}px ${padding}px`
      : `${padding}px`
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
  const fontFamilyMap: Record<string, string> = {
    site: 'inherit',
    modern: 'Montserrat, Segoe UI, sans-serif',
    classic: 'Georgia, Times New Roman, serif',
    clean: 'Arial, Helvetica, sans-serif',
    friendly: 'Verdana, Geneva, sans-serif',
  };
  const lineHeightMap: Record<string, number> = { compact: 1.25, normal: 1.55, relaxed: 1.85 };
  const letterSpacingMap: Record<string, string> = { tight: '-0.02em', normal: 'normal', wide: '0.06em' };
  const linkStyle = content.style_link_decoration || 'always';

  const align = content.style_align || 'left';
  const requestedMaxWidth = maxWidthMap[content.style_max_width || 'full'] || '100%';
  const maxWidth = (align !== 'left' && (hasBg || hasBorder) && requestedMaxWidth === '100%')
    ? 'clamp(320px, 90vw, 760px)'
    : requestedMaxWidth;
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
    textAlign: align as React.CSSProperties['textAlign'],
    fontSize: fontSizeMap[content.style_font_size || 'default'] || 'inherit',
    fontWeight: content.style_font_weight && content.style_font_weight !== 'default'
      ? Number(content.style_font_weight)
      : undefined,
    fontFamily: fontFamilyMap[content.style_font_family || 'site'] || 'inherit',
    lineHeight: lineHeightMap[content.style_line_height || 'normal'] || 1.55,
    letterSpacing: letterSpacingMap[content.style_letter_spacing || 'normal'] || 'normal',
    textTransform: (content.style_text_transform || 'none') as React.CSSProperties['textTransform'],
    textIndent: `${Number(content.style_text_indent || 0)}px`,
    marginTop: `${Number(content.style_text_space_top || 0)}px`,
    marginBottom: `${Number(content.style_text_space_bottom || 0)}px`,
    ['--atlas-link-color' as string]: content.style_link_color || '#2563eb',
    ['--atlas-link-decoration' as string]: linkStyle === 'always' ? 'underline' : 'none',
    ['--atlas-link-hover-decoration' as string]: linkStyle === 'none' ? 'none' : 'underline',
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
  editorMode?: boolean;
  selectedBlockId?: string | null;
  onBlockSelect?: (blockId: string) => void;
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
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({
  blocks,
  editorMode = false,
  selectedBlockId = null,
  onBlockSelect,
}) => {
  const [selectedImage, setSelectedImage] = useState<{
    view: string; zoom: string; placaId?: string; temaNombre?: string; subtemaNombre?: string;
    aumento?: string | null; senalados?: string[] | null;
    senaladosMeta?: Array<{ label: string; x: number | null; y: number | null; startX?: number | null; startY?: number | null }> | null;
    comentario?: string | null; tincion?: string | null;
  } | null>(null);

  const handleZoom = async (url: string, placaId?: string) => {
    let resolvedPlacaId = placaId;
    if (!resolvedPlacaId) {
      const { data } = await supabase.from('placas').select('id').eq('photo_url', url).limit(1).maybeSingle();
      resolvedPlacaId = data?.id ? String(data.id) : undefined;
    }

    let details: Record<string, unknown> = {};
    if (resolvedPlacaId) {
      const { data: placa } = await supabase
        .from('placas')
        .select('id, tema_id, subtema_id, aumento, senalados, senalados_meta, comentario, tincion')
        .eq('id', Number(resolvedPlacaId))
        .maybeSingle();
      if (placa) {
        const [{ data: tema }, { data: subtema }] = await Promise.all([
          supabase.from('temas').select('nombre').eq('id', placa.tema_id).maybeSingle(),
          supabase.from('subtemas').select('nombre').eq('id', placa.subtema_id).maybeSingle(),
        ]);
        details = {
          temaNombre: tema?.nombre,
          subtemaNombre: subtema?.nombre,
          aumento: placa.aumento,
          senalados: placa.senalados,
          senaladosMeta: placa.senalados_meta,
          comentario: placa.comentario,
          tincion: placa.tincion,
        };
      }
    }

    setSelectedImage({
      view: getCloudinaryImageUrl(url, 'view'),
      zoom: getCloudinaryImageUrl(url, 'zoom'),
      placaId: resolvedPlacaId,
      ...details,
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
              <div
                key={group.block.id}
                style={getBlockShellStyle(normalizedContent, group.block.block_type)}
                className={`cb-shell cb-shell-${group.block.block_type} ${editorMode ? 'cb-editor-selectable' : ''} ${selectedBlockId === group.block.id ? 'is-editor-selected' : ''}`}
                data-editor-block-id={editorMode ? group.block.id : undefined}
                onClick={editorMode ? event => { event.stopPropagation(); onBlockSelect?.(group.block.id); } : undefined}
              >
                <BlockWithCtas block={group.block} onZoom={handleZoom} />
              </div>
            );
          }

          const sectionContent = normalizeBlockContent(group.section.block_type, group.section.content);
          return (
            <div key={group.section.id} style={rs.sectionGroup} className="cb-section-group">
              <div
                style={getBlockShellStyle(sectionContent, group.section.block_type)}
                className={`cb-shell cb-section-shell ${editorMode ? 'cb-editor-selectable' : ''} ${selectedBlockId === group.section.id ? 'is-editor-selected' : ''}`}
                onClick={editorMode ? event => { event.stopPropagation(); onBlockSelect?.(group.section.id); } : undefined}
              >
                <BlockWithCtas block={group.section} onZoom={handleZoom} />
              </div>
              {group.children.length > 0 && (
                <div style={rs.sectionChildren} className="cb-section-children">
                  {group.children.map(child => {
                    const childContent = normalizeBlockContent(child.block_type, child.content);
                    return (
                      <div
                        key={child.id}
                        style={getBlockShellStyle(childContent, child.block_type)}
                        className={`cb-shell cb-shell-${child.block_type} ${editorMode ? 'cb-editor-selectable' : ''} ${selectedBlockId === child.id ? 'is-editor-selected' : ''}`}
                        onClick={editorMode ? event => { event.stopPropagation(); onBlockSelect?.(child.id); } : undefined}
                      >
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
        <ImageViewerModal src={selectedImage.view} srcZoom={selectedImage.zoom} placaId={selectedImage.placaId} temaNombre={selectedImage.temaNombre} subtemaNombre={selectedImage.subtemaNombre} aumento={selectedImage.aumento} senalados={selectedImage.senalados} senaladosMeta={selectedImage.senaladosMeta} comentario={selectedImage.comentario} tincion={selectedImage.tincion} onClose={() => setSelectedImage(null)} />
      )}
    </>
  );
};

const BlockWithCtas: React.FC<{ block: ContentBlock; onZoom: (url: string, placaId?: string) => void }> = ({ block, onZoom }) => {
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
  onZoom: (url: string, placaId?: string) => void;
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
  const userTypographyStyle: React.CSSProperties = {
    fontFamily: shellStyle.fontFamily,
    lineHeight: shellStyle.lineHeight,
    letterSpacing: shellStyle.letterSpacing,
    textTransform: shellStyle.textTransform,
    textIndent: shellStyle.textIndent,
  };
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
      const decoration = c.title_decoration || 'none';
      const accent = c.title_accent || '#38bdf8';
      const decorationStyle: React.CSSProperties = decoration === 'soft-box'
        ? { padding: '0.35em 0.55em', borderRadius: '12px', background: `${accent}18` }
        : decoration === 'outline'
          ? { padding: '0.32em 0.5em', borderRadius: '12px', border: `2px solid ${accent}` }
          : decoration === 'side-line'
            ? { paddingLeft: '0.5em', borderLeft: `5px solid ${accent}` }
            : {};
      return (
        <div>
          <div style={{ ...rs.heading, ...userTypographyStyle, ...decorationStyle, paddingBlock: '0.18em', textAlign: align, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }}>
            <RichTextValue value={c.text} />
          </div>
          {decoration === 'underline' && <div style={{ ...rs.headingAccent, background: accent, margin: align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : undefined }} />}
        </div>
      );
    }

    case 'subheading': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      const isCenter = align === 'center';
      const isRight = align === 'right';
      const decoration = c.subtitle_decoration || 'side-line';
      const accent = c.subtitle_accent || '#38bdf8';
      return (
        <div style={{
           ...rs.subheading,
           ...userTypographyStyle,
          textAlign: align,
          padding: decoration === 'soft-box' ? '0.45em 0.65em' : undefined,
          borderRadius: decoration === 'soft-box' ? '10px' : undefined,
          background: decoration === 'soft-box' ? `${accent}18` : undefined,
          paddingLeft: decoration === 'side-line' && !isCenter && !isRight ? '14px' : 0,
          paddingRight: decoration === 'side-line' && isRight ? '14px' : 0,
          borderLeft: decoration === 'side-line' && !isCenter && !isRight ? `4px solid ${accent}` : 'none',
          borderRight: decoration === 'side-line' && isRight ? `4px solid ${accent}` : 'none',
          borderBottom: decoration === 'underline' ? `2px solid ${accent}` : undefined,
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
      const boxStyle = c.text_box_style || 'plain';
      const columns = Math.max(1, Math.min(3, Number(c.text_columns || 1)));
      const boxStyles: Record<string, React.CSSProperties> = {
        plain: {},
        card: { padding: 'clamp(16px, 2vw, 24px)', border: '1px solid #dbe5ef', borderRadius: '16px', background: '#ffffff', boxShadow: '0 10px 28px rgba(15,23,42,.08)' },
        soft: { padding: 'clamp(16px, 2vw, 24px)', borderRadius: '16px', background: '#f1f5f9' },
        quote: { padding: '0.7em 1.1em', borderLeft: `5px solid ${c.text_box_accent || '#38bdf8'}`, background: '#f8fafc', fontStyle: 'italic' },
      };
      return <RichTextValue className="cb-paragraph" style={{ ...rs.paragraph, ...userTypographyStyle, ...boxStyles[boxStyle], paddingBlock: boxStyle === 'plain' ? '0.3em' : undefined, columnCount: columns, columnGap: '2em', textAlign: align, ...(userTextColor ? { color: userTextColor } : {}), ...(userFontSize ? { fontSize: userFontSize } : {}), ...(userFontWeight ? { fontWeight: userFontWeight } : {}) }} value={c.text} />;
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

    case 'weekly_publication': {
      const accent = c.weekly_accent || '#1677b8';
      const bg = c.weekly_bg || '#eef8ff';
      const imageRight = (c.weekly_image_position || 'right') === 'right';
      const widthMap: Record<string, string> = { full: '100%', wide: '1050px', medium: '850px' };
      const style = c.weekly_style || 'premium';
      const weeklyTextStyle: React.CSSProperties = {
        textAlign: (c.weekly_text_align || 'left') as React.CSSProperties['textAlign'],
        fontFamily: c.weekly_font_family || '"Montserrat", "Segoe UI", sans-serif',
        lineHeight: Number(c.weekly_line_height || 1.2),
        letterSpacing: c.weekly_letter_spacing || 'normal',
        textTransform: (c.weekly_text_transform || 'none') as React.CSSProperties['textTransform'],
        fontStyle: (c.weekly_font_style || 'normal') as React.CSSProperties['fontStyle'],
        textDecoration: c.weekly_text_decoration || 'none',
      };
      const topics = [
        { id: c.topic_1_id, name: c.topic_1, logo: c.topic_1_logo },
        { id: c.topic_2_id, name: c.topic_2, logo: c.topic_2_logo },
      ].filter(topic => topic.name);
      return (
        <article className="cb-weekly-publication" style={{
          width: `min(100%, ${widthMap[c.weekly_width || 'full'] || '100%'})`,
          marginInline: 'auto', overflow: 'hidden', position: 'relative', boxSizing: 'border-box',
          borderRadius: 'clamp(18px, 2.4vw, 26px)',
          border: style === 'outline' ? `1px solid ${accent}` : '1px solid rgba(103,158,198,.28)',
          background: style === 'clean' ? '#ffffff' : style === 'outline' ? 'transparent' : `linear-gradient(138deg, ${bg} 0%, #fbfdff 58%, #edf8ff 100%)`,
          boxShadow: style === 'outline' ? 'none' : '0 16px 42px rgba(24,73,110,.11)',
        }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', width: '210px', height: '210px', left: '-95px', top: '-105px', borderRadius: '50%', border: `34px solid ${accent}0b`, boxShadow: `0 0 0 1px ${accent}0e` }} />
            <span style={{ position: 'absolute', width: '145px', height: '145px', left: '42%', bottom: '-105px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}12, transparent 68%)` }} />
            <span style={{ position: 'absolute', left: '22px', bottom: '20px', width: '76px', height: '48px', opacity: .26, backgroundImage: `radial-gradient(${accent} 1.4px, transparent 1.4px)`, backgroundSize: '11px 11px' }} />
          </div>
          <div aria-hidden style={{ position: 'absolute', zIndex: 2, inset: '0 0 auto', height: '3px', background: `linear-gradient(90deg, ${accent}, #74c9e9 58%, transparent)` }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.04fr) minmax(280px, .96fr)', gap: 'clamp(8px, 1vw, 14px)', padding: 'clamp(8px, 1vw, 13px)', direction: imageRight ? 'ltr' : 'rtl', minHeight: 'clamp(300px, 32vw, 405px)' }}>
            <div style={{ direction: 'ltr', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(24px, 4vw, 50px)', ...weeklyTextStyle }}>
              <div style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '34px auto minmax(30px,1fr)', alignItems: 'center', gap: '10px', color: accent, fontSize: '.7em', fontWeight: 780, letterSpacing: '.025em' }}>
                <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '9px', color: '#fff', background: `linear-gradient(145deg, ${accent}, #329aca)`, boxShadow: `0 6px 15px ${accent}28`, fontSize: '1.05em' }}>📅</span>
                <RichTextValue value={c.eyebrow || 'Esta semana en el laboratorio'} style={{ minWidth: 0 }} />
                <span aria-hidden style={{ height: '1px', background: `linear-gradient(90deg, ${accent}4d, transparent)` }} />
              </div>
              <div style={{ position: 'relative', width: '100%' }}><span aria-hidden style={{ position: 'absolute', left: '-17px', top: '19px', width: '6px', height: '30px', borderRadius: '999px', background: `linear-gradient(${accent}, #68c9ec)`, boxShadow: `0 5px 15px ${accent}38` }} /><RichTextValue value={c.title || 'Explora lo que estudiaremos esta semana'} style={{ width: '100%', margin: '17px 0 9px', color: c.weekly_title_color || c.style_text || '#071b31', fontSize: c.weekly_title_size || 'clamp(1.55rem, 2.7vw, 2.35rem)', fontWeight: Number(c.weekly_title_weight || 760), fontFamily: 'inherit', lineHeight: '1.08', letterSpacing: '-.025em', textTransform: 'inherit', fontStyle: 'inherit', textDecoration: 'inherit' }} /></div>
              <div style={{ alignSelf: c.weekly_text_align === 'center' ? 'center' : c.weekly_text_align === 'right' ? 'flex-end' : 'flex-start', width: '48px', height: '3px', borderRadius: '999px', background: `linear-gradient(90deg, ${accent}, #7dd3fc)`, marginBottom: '20px' }} />
              <div style={{ display: 'grid', gap: '9px' }}>
                {topics.map((topic, index) => <a className="cb-weekly-topic" key={topic.id || index} href={topic.id ? `/subtemas/${topic.id}` : undefined} style={{ ['--weekly-accent' as string]: accent, position: 'relative', display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) 32px', alignItems: 'center', gap: '12px', padding: '10px 11px 10px 14px', overflow: 'hidden', borderRadius: '14px', background: 'linear-gradient(100deg,rgba(255,255,255,.9),rgba(255,255,255,.62))', border: '1px solid rgba(137,181,215,.34)', boxShadow: '0 6px 18px rgba(29,78,120,.055)', color: c.weekly_topic_color || '#0b1f33', fontSize: c.weekly_topic_size || '.95rem', textDecoration: 'none', transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease' }}><span aria-hidden style={{ position: 'absolute', inset: '8px auto 8px 0', width: '3px', borderRadius: '0 99px 99px 0', background: `linear-gradient(${accent}, #77d1ec)` }} />{topic.logo ? <img src={getCloudinaryImageUrl(topic.logo, 'thumbSmall')} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '13px', border: '2px solid rgba(255,255,255,.88)', boxShadow: `0 4px 12px ${accent}25` }} /> : <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '44px', height: '44px', borderRadius: '13px', color: accent, background: `${accent}0d`, fontSize: '1.2em' }}>⌬</span>}<span style={{ display: 'grid', gap: '2px', minWidth: 0 }}><small style={{ color: accent, fontSize: '.63em', fontWeight: 850, letterSpacing: '.09em', textTransform: 'uppercase' }}>Tema {String(index + 1).padStart(2, '0')}</small><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: Number(c.weekly_topic_weight || 680), lineHeight: 1.2 }}>{topic.name}</strong></span><span className="cb-weekly-topic-arrow" aria-hidden style={{ display: 'grid', placeItems: 'center', width: '29px', height: '29px', borderRadius: '50%', color: accent, background: `${accent}0d`, border: `1px solid ${accent}1f`, fontSize: '1.15em', fontWeight: 650 }}>›</span></a>)}
              </div>
            </div>
            <figure className={c.image_url ? 'cb-zoom-trigger' : undefined} role={c.image_url ? 'button' : undefined} tabIndex={c.image_url ? 0 : undefined} onClick={c.image_url ? () => onZoom(c.image_url, c.weekly_placa_id || undefined) : undefined} onKeyDown={c.image_url ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onZoom(c.image_url, c.weekly_placa_id || undefined); } } : undefined} title={c.image_url ? 'Ver placa en grande' : undefined} style={{ direction: 'ltr', position: 'relative', margin: 0, minHeight: '280px', overflow: 'hidden', borderRadius: 'clamp(13px, 1.7vw, 19px)', cursor: c.image_url ? 'zoom-in' : 'default', background: `linear-gradient(145deg, ${accent}18, #dbeafe)`, boxShadow: '0 8px 24px rgba(20,67,103,.10)' }}>
              {c.image_url ? <img src={getCloudinaryImageUrl(c.image_url, 'view')} alt={c.image_caption || 'Placa semanal del laboratorio'} style={{ width: '100%', height: '100%', minHeight: '280px', objectFit: 'cover', display: 'block' }} /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: '280px', color: accent, fontWeight: 850 }}>Placa semanal</div>}
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(145deg, rgba(255,255,255,.11), transparent 38%, rgba(4,31,55,.10))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)' }} />
              {c.image_caption && <figcaption style={{ position: 'absolute', inset: 'auto clamp(9px, 1.5vw, 15px) clamp(9px, 1.5vw, 15px)', display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) 30px', alignItems: 'center', gap: '8px', padding: '7px 9px', borderRadius: '11px', color: '#fff', background: 'linear-gradient(115deg, rgba(20,83,126,.55), rgba(20,57,88,.46))', border: '1px solid rgba(205,235,250,.38)', boxShadow: '0 5px 15px rgba(8,48,82,.12)', backdropFilter: 'blur(10px) saturate(1.15)' }}>
                <span aria-hidden style={{ justifySelf: 'center', width: '7px', height: '7px', borderRadius: '50%', background: '#79d2f7', boxShadow: '0 0 0 4px rgba(121,210,247,.14)' }} />
                <RichTextValue value={c.image_caption} style={{ minWidth: 0, fontSize: 'clamp(.76rem, 1.1vw, .92rem)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }} />
                <span aria-hidden style={{ display: 'grid', placeItems: 'center', width: '28px', height: '28px', borderRadius: '9px', background: 'rgba(255,255,255,.9)', color: '#126da6', border: '1px solid rgba(255,255,255,.72)', fontSize: '.9em', fontWeight: 850 }}>↗</span>
              </figcaption>}
            </figure>
          </div>
        </article>
      );
    }

    case 'callout': {
      if (!c.text) return null;
      const align = ((c.text_align as React.CSSProperties['textAlign']) ?? (c.style_align as React.CSSProperties['textAlign']) ?? 'left');
      const variants: Record<string, { icon: string; label: string; bgStart: string; bgEnd: string; border: string; color: string; accent: string }> = {
        info:     { icon: 'ℹ️', label: 'Información', bgStart: '#dbeafe', bgEnd: '#f8fbff', border: '#60a5fa', color: '#1d4ed8', accent: '#2563eb' },
        tip:      { icon: '💡', label: 'Consejo', bgStart: '#dcfce7', bgEnd: '#f8fff8', border: '#4ade80', color: '#15803d', accent: '#16a34a' },
        warning:  { icon: '⚠️', label: 'Importante', bgStart: '#fef3c7', bgEnd: '#fffdf2', border: '#f59e0b', color: '#b45309', accent: '#d97706' },
        clinical: { icon: '🔬', label: 'Dato clínico', bgStart: '#f3e8ff', bgEnd: '#fff8ff', border: '#c084fc', color: '#7e22ce', accent: '#9333ea' },
      };
      const v = variants[(c.variant as string) ?? 'info'] ?? variants.info;
      const calloutStyle = c.callout_style || 'modern';
      const customBg = c.callout_bg || v.bgStart;
      const customBorder = c.callout_border || v.border;
      const showIcon = c.callout_show_icon !== 'false';
      const widthMap: Record<string, string> = { full: '100%', wide: '900px', medium: '700px', compact: '520px' };
      const requestedWidth = widthMap[c.callout_width || 'full'] || '100%';
      const surfaceMap: Record<string, React.CSSProperties> = {
        modern: { background: `linear-gradient(135deg, ${customBg} 0%, #ffffff 88%)`, border: `1px solid ${customBorder}`, boxShadow: '0 12px 30px rgba(25,74,120,.10)' },
        accent: { background: '#ffffff', border: `1px solid ${customBorder}`, boxShadow: `inset 7px 0 0 ${customBorder}, 0 10px 24px rgba(25,74,120,.09)` },
        tinted: { background: customBg, border: `1px solid ${customBorder}`, boxShadow: '0 8px 22px rgba(25,74,120,.08)' },
        outline: { background: 'transparent', border: `2px solid ${customBorder}`, boxShadow: 'none' },
      };
      return (
        <div style={{
          position: 'relative',
          ...(surfaceMap[calloutStyle] || surfaceMap.modern),
          borderRadius: 'clamp(14px, 1.8vw, 20px)',
          padding: 'clamp(16px, 2.2vw, 24px)',
          display: 'flex',
          gap: 'clamp(12px, 1.8vw, 18px)',
          alignItems: 'flex-start',
          textAlign: align,
          overflow: 'hidden',
          minHeight: '0',
          width: `min(100%, ${requestedWidth})`,
          boxSizing: 'border-box',
          marginInline: align === 'right' ? 'auto 0' : align === 'center' ? 'auto' : '0 auto 0 0',
        }}>
          {inlineCtas && inlineCtaPosition === 'before' && inlineCtas}
          <div style={{ display: 'grid', gridTemplateColumns: showIcon ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 'clamp(12px, 1.8vw, 18px)', alignItems: 'center', width: '100%' }}>
            {showIcon && <span aria-hidden style={{
              fontSize: 'clamp(1.15rem, 2vw, 1.45rem)',
              lineHeight: 1,
              width: '2.35em', height: '2.35em', borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#ffffffcc',
              border: `1px solid ${v.border}`,
              boxShadow: `0 7px 18px ${v.border}22`,
            }}>{v.icon}</span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: '5px', color: v.color, fontSize: '.7em', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>{v.label}</div>
              <RichTextValue style={{
                margin: 0,
                width: '100%',
                color: userTextColor || '#000000',
                fontSize: userFontSize || '1em',
                lineHeight: 1.6,
                fontWeight: userFontWeight || 500,
                whiteSpace: 'pre-wrap' as const,
                wordBreak: 'break-word' as const,
                fontFamily: '"Montserrat", "Segoe UI", sans-serif',
                textAlign: align,
                ...userTypographyStyle,
              }} value={c.text} />
            </div>
          </div>
          {inlineCtas && inlineCtaPosition === 'after' && inlineCtas}
        </div>
      );
    }

    case 'list': {
      if (!c.items) return null;
      const listSource = (c.items as string)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
        .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      const itemArr = listSource
        .split('\n')
        .map((s: string) => s.trim().replace(/^(?:[-*•✓→]|\d+[.)])\s+/, '').trim())
        .filter(Boolean);
      if (itemArr.length === 0) return null;
      const isNumbered = c.style === 'numbered';
      const columns = Math.max(1, Math.min(3, Number(c.list_columns || 1)));
      const marker = c.list_marker || (isNumbered ? 'number' : 'bullet');
      const itemStyle = c.list_item_style || 'plain';
      return (
        <div className="cb-list-grid" style={{ margin: 0, paddingBlock: '0.3em', display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 'clamp(7px, 1.5vw, 12px)' }}>
          {itemArr.map((item: string, i: number) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '9px', alignItems: 'start',
                padding: itemStyle === 'cards' ? '10px 12px' : itemStyle === 'soft' ? '8px 10px' : 0,
                border: itemStyle === 'cards' ? '1px solid #dbe5ef' : undefined,
                borderRadius: itemStyle !== 'plain' ? '10px' : undefined,
                background: itemStyle === 'cards' ? '#fff' : itemStyle === 'soft' ? '#f1f5f9' : undefined,
                fontSize: userFontSize || '0.9em',
                lineHeight: 1.8,
                color: userTextColor || '#000000',
                fontWeight: userFontWeight || 400,
                fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              }}
            >
              <strong aria-hidden style={{ color: c.list_accent || '#2563eb' }}>{marker === 'check' ? '✓' : marker === 'arrow' ? '→' : marker === 'number' ? `${i + 1}.` : '•'}</strong>
              <RichTextValue value={item} />
            </div>
          ))}
        </div>
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
    color: '#000000',
    letterSpacing: '0.015em',
    lineHeight: 1.3,
    margin: 0,
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
    color: '#000000',
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
    color: '#000000',
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
