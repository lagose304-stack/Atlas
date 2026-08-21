import React, { useState } from 'react';
import { Zap, Wind, Droplets, ArrowRightLeft, Shield, ZoomIn, Info, CheckCircle2 } from 'lucide-react';
import { renderBoldText } from '../BoldField';

export interface FunctionFeature {
  id?: string;
  title: string;
  detail: string;
  icon?: 'wind' | 'droplets' | 'transcellular' | 'shield';
}

export interface HistologyFunctionProps {
  title?: string;
  badgeText?: string;
  description?: string;
  featsTitle?: string;
  features?: FunctionFeature[];
  clinicalNote?: string;
  imageUrl?: string;
  imageBadge?: string;
  onOpenImageViewer?: (url: string) => void;
}

export const HistologyFunctionBlock: React.FC<HistologyFunctionProps> = ({
  title,
  badgeText,
  description,
  featsTitle,
  features,
  clinicalNote,
  imageUrl,
  imageBadge = '⚡ Esquema Funcional de Difusión',
  onOpenImageViewer,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getFeatureIcon = (iconName?: string) => {
    switch (iconName) {
      case 'wind':
        return <Wind size={16} color="#0284c7" />;
      case 'droplets':
        return <Droplets size={16} color="#0369a1" />;
      case 'transcellular':
        return <ArrowRightLeft size={16} color="#0891b2" />;
      case 'shield':
      default:
        return <Shield size={16} color="#059669" />;
    }
  };

  const validFeatures = features?.filter(f => (f.title && f.title.trim() !== '') || (f.detail && f.detail.trim() !== '')) || [];
  const hasTopContent = (badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (description && description.trim() !== '') || (imageUrl && imageUrl.trim() !== '');
  const hasBottomContent = (featsTitle && featsTitle.trim() !== '') || validFeatures.length > 0 || (clinicalNote && clinicalNote.trim() !== '');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f4fbfd 100%)',
        border: '1.5px solid rgba(186, 230, 253, 0.95)',
        borderLeft: '6px solid #0284c7',
        padding: 'clamp(20px, 3vw, 32px)',
        boxShadow: '0 12px 34px rgba(2, 132, 199, 0.06), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}
    >
      {/* ─── FILA SUPERIOR: TEXTO DE FUNCIÓN (Y FOTO SI EXISTE) ─── */}
      {hasTopContent && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: imageUrl && imageUrl.trim() !== '' ? 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' : '1fr',
            alignItems: 'center',
            gap: 'clamp(18px, 2.5vw, 32px)',
          }}
        >
          {/* Columna Izquierda: Información de la Función */}
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
                    color: '#0284c7',
                    background: '#e0f2fe',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                  }}
                >
                  <Zap size={13} />
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
                  color: '#0f2a43',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
            )}

            {description && description.trim() !== '' && (
              <div
                style={{
                  fontSize: '0.94rem',
                  lineHeight: 1.7,
                  color: '#334155',
                  fontWeight: 450,
                }}
              >
                {renderBoldText(description)}
              </div>
            )}
          </div>

          {/* Columna Derecha: Marco para la Imagen de Función (Solo si hay imagen) */}
          {imageUrl && imageUrl.trim() !== '' && (
            <div
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #0c3852 0%, #12516f 60%, #18688c 100%)',
                border: '2px solid rgba(186, 230, 253, 0.85)',
                boxShadow: '0 12px 30px rgba(12, 56, 82, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                aspectRatio: '16 / 10',
                minHeight: '220px',
                maxHeight: '290px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onOpenImageViewer ? 'pointer' : 'default',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => {
                if (onOpenImageViewer) {
                  onOpenImageViewer(imageUrl);
                }
              }}
            >
              <img
                src={imageUrl}
                alt={title || 'Función'}
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.35s ease',
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
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
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 249, 255, 0.92))',
                    border: '1px solid rgba(186, 230, 253, 0.9)',
                    color: '#0284c7',
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
                  <Zap size={12} color="#0284c7" />
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
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  fontSize: '0.70rem',
                  fontWeight: 850,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  opacity: isHovered ? 1 : 0.85,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <ZoomIn size={13} />
                <span>Ampliar</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── FILA INFERIOR: CARACTERÍSTICAS Y MECANISMOS DE LA FUNCIÓN ─── */}
      {hasBottomContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: hasTopContent ? '10px' : '0', borderTop: hasTopContent ? '1px solid #e0f2fe' : 'none' }}>
          {featsTitle && featsTitle.trim() !== '' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#0284c7" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: '#0f2a43' }}>
                {featsTitle}
              </h4>
            </div>
          )}

          {/* Fichas Funcionales en Grid */}
          {validFeatures.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
              }}
            >
              {validFeatures.map((item, index) => (
                <div
                  key={item.id ?? index}
                  style={{
                    borderRadius: '14px',
                    background: '#ffffff',
                    border: '1.2px solid rgba(186, 230, 253, 0.8)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(2, 132, 199, 0.03)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(186, 230, 253, 0.8)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        background: '#f0f9ff',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getFeatureIcon(item.icon)}
                    </span>
                    {item.title && item.title.trim() !== '' && (
                      <strong style={{ fontSize: '0.86rem', color: '#0f2a43', fontWeight: 800 }}>
                        {item.title}
                      </strong>
                    )}
                  </div>
                  {item.detail && item.detail.trim() !== '' && (
                    <div style={{ fontSize: '0.80rem', lineHeight: 1.5, color: '#475569' }}>
                      {renderBoldText(item.detail)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nota Fisiológica Callout */}
          {clinicalNote && clinicalNote.trim() !== '' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#16a34a' }} />
              <div>{renderBoldText(clinicalNote)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistologyFunctionBlock;
