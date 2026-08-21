import React, { useState } from 'react';
import { BookOpen, Sparkles, Compass, ShieldCheck, Dna, Info, ZoomIn } from 'lucide-react';
import { renderBoldText } from '../BoldField';

export interface GeneralitiesPoint {
  id?: string;
  label: string;
  content: string;
  icon?: 'dna' | 'shield' | 'compass' | 'sparkles' | 'info';
}

export interface HistologyGeneralitiesProps {
  title?: string;
  badgeText?: string;
  introText?: string;
  pointsTitle?: string;
  pills?: Array<{ label: string; bg?: string; color?: string }>;
  keyPoints?: GeneralitiesPoint[];
  labTip?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageBadge?: string;
  onOpenImageViewer?: (url: string) => void;
}

export const HistologyGeneralitiesBlock: React.FC<HistologyGeneralitiesProps> = ({
  title,
  badgeText,
  introText,
  pills,
  pointsTitle,
  keyPoints,
  labTip,
  imageUrl,
  imageBadge = '🔬 Micrografía de Referencia · H&E',
  onOpenImageViewer,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'dna':
        return <Dna size={16} color="#6366f1" />;
      case 'shield':
        return <ShieldCheck size={16} color="#0284c7" />;
      case 'compass':
        return <Compass size={16} color="#059669" />;
      case 'sparkles':
      default:
        return <Sparkles size={16} color="#d97706" />;
    }
  };

  const validKeyPoints = keyPoints?.filter(p => (p.label && p.label.trim() !== '') || (p.content && p.content.trim() !== '')) || [];
  const hasTopContent = (badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (introText && introText.trim() !== '') || (pills && pills.length > 0) || (imageUrl && imageUrl.trim() !== '');
  const hasBottomContent = (pointsTitle && pointsTitle.trim() !== '') || validKeyPoints.length > 0 || (labTip && labTip.trim() !== '');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
        border: '1.5px solid rgba(199, 210, 254, 0.9)',
        padding: 'clamp(20px, 3vw, 32px)',
        boxShadow: '0 12px 34px rgba(99, 102, 241, 0.05), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* ─── FILA SUPERIOR: TEXTO INTRODUCTORIO (Y FOTO SI EXISTE) ─── */}
      {hasTopContent && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: imageUrl && imageUrl.trim() !== '' ? 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' : '1fr',
            alignItems: 'center',
            gap: 'clamp(18px, 2.5vw, 32px)',
          }}
        >
          {/* Lado Izquierdo: Cabecera, Título e Introducción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Badge de sección (Solo si tiene texto) */}
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
                    color: '#4f46e5',
                    background: '#ede9fe',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(199, 210, 254, 0.8)',
                  }}
                >
                  <BookOpen size={13} />
                  <span>{badgeText}</span>
                </span>
              </div>
            )}

            {/* Título Principal (Solo si tiene texto) */}
            {title && title.trim() !== '' && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(1.2rem, 2.2vw, 1.55rem)',
                  fontWeight: 850,
                  color: '#1e1b4b',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
            )}

            {/* Introducción Editorial (Solo si tiene texto) */}
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

            {/* Micro-píldoras de taxonomía histológica */}
            {pills && pills.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                {pills.map((pill, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 750,
                      padding: '3px 9px',
                      borderRadius: '6px',
                      background: pill.bg || '#e0f2fe',
                      color: pill.color || '#0369a1',
                    }}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Lado Derecho: Marco Microscópico de la Imagen de Referencia (Solo si hay imagen) */}
          {imageUrl && imageUrl.trim() !== '' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  position: 'relative',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  background: 'linear-gradient(145deg, #0c3852 0%, #172554 60%, #1e1b4b 100%)',
                  border: '2px solid rgba(199, 210, 254, 0.9)',
                  boxShadow: '0 12px 30px rgba(79, 70, 229, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
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
                  alt={title || 'Micrografía'}
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
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 243, 255, 0.92))',
                      border: '1px solid rgba(199, 210, 254, 0.9)',
                      color: '#4338ca',
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
                    <BookOpen size={12} color="#6366f1" />
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
            </div>
          )}
        </div>
      )}

      {/* ─── FILA INFERIOR: CONTENIDO QUE FLUYE DEBAJO DE LA IMAGEN A ANCHO COMPLETO ─── */}
      {hasBottomContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: hasTopContent ? '10px' : '0', borderTop: hasTopContent ? '1px solid #e0e7ff' : 'none' }}>
          {/* Cabecera de los Puntos Clave */}
          {pointsTitle && pointsTitle.trim() !== '' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#6366f1" />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: '#1e1b4b' }}>
                {pointsTitle}
              </h4>
            </div>
          )}

          {/* Grid de Pilares Clave */}
          {validKeyPoints.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
              }}
            >
              {validKeyPoints.map((point, index) => (
                <div
                  key={index}
                  style={{
                    borderRadius: '14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getIcon(point.icon)}
                    </div>
                    {point.label && point.label.trim() !== '' && (
                      <strong style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800 }}>
                        {point.label}
                      </strong>
                    )}
                  </div>
                  {point.content && point.content.trim() !== '' && (
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: '#475569' }}>
                      {renderBoldText(point.content)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tip de Laboratorio a ancho completo */}
          {labTip && labTip.trim() !== '' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                border: '1px solid #c7d2fe',
                color: '#3730a3',
                fontSize: '0.84rem',
                lineHeight: 1.55,
                fontWeight: 500,
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#6366f1' }} />
              <div>{renderBoldText(labTip)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistologyGeneralitiesBlock;
