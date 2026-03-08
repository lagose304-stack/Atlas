import React, { useState } from 'react';
import type { ContentBlock, BlockType } from './PageContentEditor';
import ImageViewerModal from './ImageViewerModal';

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
}

/**
 * Renderizador de solo lectura para bloques de contenido.
 * Se usa en las páginas públicas (Subtemas, PlacasSubtema) para mostrar
 * el contenido editorial creado desde el panel de edición.
 */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ blocks }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!blocks || blocks.length === 0) return null;

  return (
    <>
      <div style={rs.container} className="cb-container">
        {blocks.map(block => (
          <BlockItem key={block.id} block={block} onZoom={setSelectedImage} />
        ))}
      </div>
      {selectedImage && (
        <ImageViewerModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </>
  );
};

const BlockItem: React.FC<{ block: ContentBlock; onZoom: (url: string) => void }> = ({ block, onZoom }) => {
  const [imgHovered, setImgHovered] = useState(false);
  const type = block.block_type as BlockType;
  const c = block.content;

  switch (type) {
    case 'heading': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return (
        <div>
          <h2 style={{ ...rs.heading, textAlign: align }}>{c.text}</h2>
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
        <h3 style={{
          ...rs.subheading,
          textAlign: align,
          paddingLeft: isCenter || isRight ? 0 : '14px',
          paddingRight: isRight ? '14px' : 0,
          borderLeft: isCenter || isRight ? 'none' : '4px solid #38bdf8',
          borderRight: isRight ? '4px solid #38bdf8' : 'none',
        }}>{c.text}</h3>
      );
    }

    case 'paragraph': {
      if (!c.text) return null;
      const align = (c.text_align as React.CSSProperties['textAlign']) ?? 'left';
      return <p className="cb-paragraph" style={{ ...rs.paragraph, textAlign: align }}>{c.text}</p>;
    }

    case 'image': {
      if (!c.url) return null;
      return (
        <figure style={rs.figure}>
          <div
            style={{ ...rs.imgClickWrap, ...(imgHovered ? rs.imgClickWrapHover : {}) }}
            onClick={() => onZoom(c.url)}
            onMouseEnter={() => setImgHovered(true)}
            onMouseLeave={() => setImgHovered(false)}
            title="Ver en grande"
          >
            <img
              src={c.url}
              alt={c.caption || 'Imagen ilustrativa'}
              style={rs.image}
              loading="lazy"
              draggable={false}
            />
            <div style={{ ...rs.zoomOverlay, opacity: imgHovered ? 1 : 0 }}>🔍</div>
          </div>
          {c.caption && <figcaption style={rs.caption}>{c.caption}</figcaption>}
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
                <img
                  src={c.image_url}
                  alt={c.image_caption || 'Imagen ilustrativa'}
                  style={rs.tiImage}
                  loading="lazy"
                  draggable={false}
                />
                <div style={{ ...rs.zoomOverlay, opacity: imgHovered ? 1 : 0 }}>🔍</div>
              </div>
              {c.image_caption && (
                <figcaption style={rs.caption}>{c.image_caption}</figcaption>
              )}
            </figure>
          )}
          {hasText && <p className="cb-ti-text" style={{ ...rs.tiText, textAlign: tiTextAlign }}>{c.text}</p>}
        </div>
      );
    }

    default:
      return null;
  }
};

// ── Estilos de renderizado ────────────────────────────────────────────────────
const rs: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    marginBottom: '36px',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
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
};

export { ContentBlockRenderer };
export default ContentBlockRenderer;
