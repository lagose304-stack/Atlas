import React from 'react';
import { Palette, Info, ZoomIn } from 'lucide-react';
import { renderBoldText } from '../BoldField';

export interface HistologyStainItem {
  id?: string;
  number?: string;
  name: string;
  category: string;
  colorLabels?: string;
  result: string;
  utility?: string;
}

export interface HistologyStainsProps {
  title?: string;
  badgeText?: string;
  introText?: string;
  stainsTitle?: string;
  items?: HistologyStainItem[];
  colorKeyTip?: string;
  imageUrl?: string;
  imageBadge?: string;
  onOpenImageViewer?: (url: string) => void;
}

export const HistologyStainsBlock: React.FC<HistologyStainsProps> = ({
  title,
  badgeText,
  introText,
  stainsTitle,
  items,
  colorKeyTip,
  imageUrl,
  imageBadge = '🎨 Micrografía con Tinción Específica',
  onOpenImageViewer,
}) => {
  const validItems = items?.filter(item => (item.name && item.name.trim() !== '') || (item.result && item.result.trim() !== '') || (item.category && item.category.trim() !== '')) || [];
  const hasTopContent = (badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (introText && introText.trim() !== '') || (imageUrl && imageUrl.trim() !== '');
  const hasBottomContent = (stainsTitle && stainsTitle.trim() !== '') || validItems.length > 0 || (colorKeyTip && colorKeyTip.trim() !== '');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, #ffffff 0%, #fbf6fd 100%)',
        border: '1.5px solid rgba(233, 213, 255, 0.95)',
        borderLeft: '6px solid #a855f7',
        padding: 'clamp(20px, 3vw, 32px)',
        boxShadow: '0 12px 34px rgba(168, 85, 247, 0.06), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* ─── FILA SUPERIOR: INTRODUCCIÓN (Y FOTO SI EXISTE) ─── */}
      {hasTopContent && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: imageUrl && imageUrl.trim() !== '' ? 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' : '1fr',
            alignItems: 'center',
            gap: 'clamp(18px, 2.5vw, 32px)',
          }}
        >
          {/* Lado Izquierdo: Badge, Título e Intro */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {badgeText && badgeText.trim() !== '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#9333ea',
                    background: '#f3e8ff',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(192, 132, 252, 0.4)',
                  }}
                >
                  <Palette size={13} />
                  <span>{badgeText}</span>
                </span>
              </div>
            )}

            {title && title.trim() !== '' && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(1.2rem, 2.2vw, 1.55rem)',
                  fontWeight: 850,
                  color: '#3b0764',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
            )}

            {introText && introText.trim() !== '' && (
              <div
                style={{
                  fontSize: '0.94rem',
                  lineHeight: 1.7,
                  color: '#334155',
                  fontWeight: 450,
                }}
              >
                {renderBoldText(introText)}
              </div>
            )}
          </div>

          {/* Lado Derecho: Marco de la Imagen de Tinción (Solo si hay imagen) */}
          {imageUrl && imageUrl.trim() !== '' && (
            <div
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #2e1065 0%, #581c87 60%, #7e22ce 100%)',
                border: '2px solid rgba(233, 213, 255, 0.85)',
                boxShadow: '0 12px 30px rgba(168, 85, 247, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                aspectRatio: '16 / 10',
                minHeight: '220px',
                maxHeight: '290px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onOpenImageViewer ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (onOpenImageViewer) {
                  onOpenImageViewer(imageUrl);
                }
              }}
            >
              <img
                src={imageUrl}
                alt={title || 'Tinción histológica'}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Badge Flotante Superior */}
              {imageBadge && imageBadge.trim() !== '' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(250, 245, 255, 0.92))',
                    border: '1px solid rgba(233, 213, 255, 0.9)',
                    color: '#9333ea',
                    fontSize: '0.70rem',
                    fontWeight: 850,
                    letterSpacing: '0.04em',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    pointerEvents: 'none',
                  }}
                >
                  <Palette size={12} color="#9333ea" />
                  <span>{imageBadge}</span>
                </div>
              )}

              {/* Botón Flotante para Ampliar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  padding: '5px 11px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                  color: '#ffffff',
                  fontSize: '0.70rem',
                  fontWeight: 850,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.35)',
                }}
              >
                <ZoomIn size={13} />
                <span>Ampliar</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── FILA INFERIOR: TINCIONES EN GRID ─── */}
      {hasBottomContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: hasTopContent ? '10px' : '0', borderTop: hasTopContent ? '1px solid #f3e8ff' : 'none' }}>
          {stainsTitle && stainsTitle.trim() !== '' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={16} color="#9333ea" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: '#3b0764' }}>
                {stainsTitle}
              </h4>
            </div>
          )}

          {/* Grid de Tinciones */}
          {validItems.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {validItems.map((item, index) => (
                <div
                  key={item.id ?? index}
                  style={{
                    borderRadius: '16px',
                    background: '#ffffff',
                    border: '1.5px solid rgba(233, 213, 255, 0.85)',
                    padding: '16px 18px',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    boxShadow: '0 3px 10px rgba(168, 85, 247, 0.04)',
                    transition: 'border-color 0.2s ease, transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#c084fc';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(233, 213, 255, 0.85)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Badge Número */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 10px rgba(168, 85, 247, 0.25)',
                    }}
                  >
                    {item.number ?? String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Texto */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {item.name && item.name.trim() !== '' && (
                      <strong style={{ fontSize: '0.92rem', fontWeight: 850, color: '#3b0764' }}>
                        {item.name}
                      </strong>
                    )}

                    {item.category && item.category.trim() !== '' && (
                      <span style={{ fontSize: '0.74rem', color: '#9333ea', fontWeight: 750 }}>
                        {item.category}
                      </span>
                    )}

                    {item.result && item.result.trim() !== '' && (
                      <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: '#475569', marginTop: '2px' }}>
                        {renderBoldText(item.result)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tip de Colorimetría Callout a ancho completo */}
          {colorKeyTip && colorKeyTip.trim() !== '' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                border: '1px solid #e9d5ff',
                color: '#6b21a8',
                fontSize: '0.84rem',
                lineHeight: 1.55,
                fontWeight: 500,
                marginTop: '4px',
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#9333ea' }} />
              <div>{renderBoldText(colorKeyTip)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistologyStainsBlock;
