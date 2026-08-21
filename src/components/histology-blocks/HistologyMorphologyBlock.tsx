import React from 'react';
import { Microscope, CheckCircle2, ZoomIn } from 'lucide-react';
import { renderBoldText } from '../BoldField';

export interface MorphologyCriterion {
  id?: string;
  number?: string;
  title: string;
  description: string;
}

export interface HistologyMorphologyProps {
  title?: string;
  badgeText?: string;
  introText?: string;
  criteriaTitle?: string;
  items?: MorphologyCriterion[];
  examTip?: string;
  imageUrl?: string;
  imageBadge?: string;
  onOpenImageViewer?: (url: string) => void;
}

export const HistologyMorphologyBlock: React.FC<HistologyMorphologyProps> = ({
  title,
  badgeText,
  introText,
  criteriaTitle,
  items,
  examTip,
  imageUrl,
  imageBadge = '🔬 Micrografía Morfológica de Referencia',
  onOpenImageViewer,
}) => {
  const validItems = items?.filter(item => (item.title && item.title.trim() !== '') || (item.description && item.description.trim() !== '')) || [];
  const hasTopContent = (badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (introText && introText.trim() !== '') || (imageUrl && imageUrl.trim() !== '');
  const hasBottomContent = (criteriaTitle && criteriaTitle.trim() !== '') || validItems.length > 0 || (examTip && examTip.trim() !== '');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)',
        border: '1.5px solid rgba(186, 230, 253, 0.95)',
        borderLeft: '6px solid #0284c7',
        padding: 'clamp(20px, 3vw, 32px)',
        boxShadow: '0 12px 34px rgba(2, 132, 199, 0.06), inset 0 1px 0 #ffffff',
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
          {/* Lado Izquierdo: Badge, Título e Introducción */}
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
                  <Microscope size={13} />
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

          {/* Lado Derecho: Marco de la Imagen Morfológica (Solo si hay imagen) */}
          {imageUrl && imageUrl.trim() !== '' && (
            <div
              style={{
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #0c3852 0%, #12516f 60%, #18688c 100%)',
                border: '2px solid rgba(186, 230, 253, 0.9)',
                boxShadow: '0 12px 30px rgba(12, 56, 82, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
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
                alt={title || 'Morfología'}
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
                  <Microscope size={12} color="#0284c7" />
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
                }}
              >
                <ZoomIn size={13} />
                <span>Ampliar</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── FILA INFERIOR: CRITERIOS DIAGNÓSTICOS EN GRID ─── */}
      {hasBottomContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: hasTopContent ? '10px' : '0', borderTop: hasTopContent ? '1px solid #e0f2fe' : 'none' }}>
          {criteriaTitle && criteriaTitle.trim() !== '' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Microscope size={16} color="#0284c7" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: '#0f2a43' }}>
                {criteriaTitle}
              </h4>
            </div>
          )}

          {/* Grid de 5 Criterios */}
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
                    border: '1.5px solid rgba(186, 230, 253, 0.85)',
                    padding: '16px 18px',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    boxShadow: '0 3px 10px rgba(2, 132, 199, 0.04)',
                    transition: 'border-color 0.2s ease, transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#38bdf8';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(186, 230, 253, 0.85)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Badge Número */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    {item.number ?? String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Texto */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    {item.title && item.title.trim() !== '' && (
                      <strong style={{ fontSize: '0.92rem', fontWeight: 850, color: '#0f2a43' }}>
                        {item.title}
                      </strong>
                    )}

                    {item.description && item.description.trim() !== '' && (
                      <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: '#475569' }}>
                        {renderBoldText(item.description)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tip de Examen Callout a ancho completo */}
          {examTip && examTip.trim() !== '' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '0.84rem',
                lineHeight: 1.55,
                fontWeight: 500,
                marginTop: '4px',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#16a34a' }} />
              <div>{renderBoldText(examTip)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistologyMorphologyBlock;
