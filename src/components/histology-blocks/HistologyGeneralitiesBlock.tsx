import React, { useState } from 'react';
import { BookOpen, Sparkles, Compass, ShieldCheck, Dna, Info, ZoomIn } from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup } from '../../services/richText';

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
  keyIdea?: string;
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
  keyIdea,
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
  const hasImage = Boolean(imageUrl && imageUrl.trim() !== '');
  const hasKeyIdea = Boolean(keyIdea && keyIdea.trim() !== '');
  const hasTopContent = (badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (introText && introText.trim() !== '') || (pills && pills.length > 0) || hasImage || hasKeyIdea;
  const hasBottomContent = (pointsTitle && pointsTitle.trim() !== '') || validKeyPoints.length > 0 || (labTip && labTip.trim() !== '');

  // Determinar columnas dinámicamente:
  let gridColumns = '1fr';
  const hasLeftText = Boolean((badgeText && badgeText.trim() !== '') || (title && title.trim() !== '') || (introText && introText.trim() !== '') || (pills && pills.length > 0));
  if ((hasImage || hasKeyIdea) && hasLeftText) {
    gridColumns = 'repeat(auto-fit, minmax(310px, 1fr))';
  }

  return (
    <div
      className="histology-generalities-block"
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'radial-gradient(ellipse at 88% 18%, rgba(99, 102, 241, 0.06) 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
        border: '1.5px solid rgba(199, 210, 254, 0.95)',
        boxShadow: '0 14px 38px -6px rgba(79, 70, 229, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Barra superior de acento índigo */}
      <div style={{ height: '4px', width: '100%', background: 'linear-gradient(90deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)', flexShrink: 0 }} />

      {/* Trama de cuadrícula geométrica sutil (estilo laboratorio) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(#6366f1 0.75px, transparent 0.75px)',
          backgroundSize: '22px 22px',
          opacity: 0.045,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(20px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* ─── FILA SUPERIOR: TEXTO INTRODUCTORIO + FOTO CENTRAL + TARJETA IDEA CLAVE ─── */}
        {hasTopContent && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              alignItems: 'stretch',
              gap: 'clamp(16px, 2vw, 24px)',
            }}
          >
            {/* Columna 1 (Izquierda): Cabecera, Título e Introducción */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '12px' }}>
              {/* Badge de sección (Solo si tiene texto) */}
              {badgeText && badgeText.trim() !== '' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 850,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: '#4338ca',
                      background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      border: '1.2px solid #c4b5fd',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
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
                    fontSize: 'clamp(1.25rem, 2.3vw, 1.6rem)',
                    fontWeight: 900,
                    color: '#1e1b4b',
                    letterSpacing: '-0.028em',
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </h3>
              )}

              {/* Introducción Editorial con espina de acento lateral (Solo si tiene texto) */}
              {introText && introText.trim() !== '' && (
                <div
                  style={{
                    fontSize: '0.93rem',
                    lineHeight: 1.68,
                    color: '#0f172a',
                    fontWeight: 500,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    borderLeft: '3px solid #818cf8',
                    paddingLeft: '14px',
                    margin: '2px 0',
                  }}
                >
                  {hasHtmlMarkup(introText) ? (
                    renderBoldText(introText)
                  ) : (
                    introText.split(/\n\s*\n/).map((para, pIdx) => (
                      <p key={pIdx} style={{ margin: 0, color: '#0f172a' }}>
                        {renderBoldText(para.trim())}
                      </p>
                    ))
                  )}
                </div>
              )}

              {/* Micro-píldoras de taxonomía histológica */}
              {pills && pills.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {pills.map((pill, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        padding: '4px 12px',
                        borderRadius: '999px',
                        background: pill.bg || 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
                        color: pill.color || '#0369a1',
                        border: '1.2px solid rgba(0, 0, 0, 0.08)',
                        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        letterSpacing: '0.01em',
                      }}
                    >
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: pill.color || '#0369a1', display: 'inline-block' }} />
                      <span>{pill.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Columna 2 (Derecha): Marco Microscópico de la Imagen y Tarjeta Idea Clave debajo */}
            {(hasImage || hasKeyIdea) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                {/* Marco Microscópico de la Imagen de Referencia (Auto-adaptable a la altura del texto) */}
                {hasImage && (
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      background: 'linear-gradient(145deg, #0c3852 0%, #172554 60%, #1e1b4b 100%)',
                      border: '2px solid rgba(199, 210, 254, 0.95)',
                      boxShadow: '0 12px 30px rgba(79, 70, 229, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                      flex: hasKeyIdea ? '1 1 0px' : 'none',
                      minHeight: '110px',
                      maxHeight: hasKeyIdea ? undefined : '260px',
                      aspectRatio: hasKeyIdea ? undefined : '16 / 10',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: onOpenImageViewer ? 'pointer' : 'default',
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => {
                      if (onOpenImageViewer && imageUrl) {
                        onOpenImageViewer(imageUrl);
                      }
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt={title || 'Micrografía'}
                      draggable={false}
                      style={{
                        position: hasKeyIdea ? 'absolute' : 'relative',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.35s ease',
                        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                      }}
                    />

                    {/* Retículo óptico de microscopio (4 esquinas de precisión de encuadre) */}
                    <div style={{ position: 'absolute', top: '8px', left: '8px', width: '13px', height: '13px', borderTop: '2.5px solid rgba(255,255,255,0.85)', borderLeft: '2.5px solid rgba(255,255,255,0.85)', pointerEvents: 'none', zIndex: 3, borderRadius: '2px 0 0 0' }} />
                    <div style={{ position: 'absolute', top: '8px', right: '8px', width: '13px', height: '13px', borderTop: '2.5px solid rgba(255,255,255,0.85)', borderRight: '2.5px solid rgba(255,255,255,0.85)', pointerEvents: 'none', zIndex: 3, borderRadius: '0 2px 0 0' }} />
                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', width: '13px', height: '13px', borderBottom: '2.5px solid rgba(255,255,255,0.85)', borderLeft: '2.5px solid rgba(255,255,255,0.85)', pointerEvents: 'none', zIndex: 3, borderRadius: '0 0 0 2px' }} />
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '13px', height: '13px', borderBottom: '2.5px solid rgba(255,255,255,0.85)', borderRight: '2.5px solid rgba(255,255,255,0.85)', pointerEvents: 'none', zIndex: 3, borderRadius: '0 0 2px 0' }} />

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
                          fontSize: '0.68rem',
                          fontWeight: 850,
                          letterSpacing: '0.03em',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          pointerEvents: 'none',
                          zIndex: 4,
                        }}
                      >
                        <BookOpen size={11} color="#6366f1" />
                        <span>{imageBadge}</span>
                      </div>
                    )}

                    {/* Botón Flotante para Ampliar */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        color: '#ffffff',
                        fontSize: '0.70rem',
                        fontWeight: 850,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                        opacity: isHovered ? 1 : 0.92,
                        transition: 'opacity 0.2s ease',
                        zIndex: 4,
                      }}
                    >
                      <ZoomIn size={12} />
                      <span>Ampliar</span>
                    </div>
                  </div>
                )}

                {/* Tarjeta de Conclusión/Idea Clave destacada (Ubicada debajo de la imagen) */}
                {hasKeyIdea && (
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #fbf9ff 50%, #f3efff 100%)',
                      border: '1.5px solid #c7d2fe',
                      borderLeft: '4.5px solid #6366f1',
                      padding: '13px 18px 15px 18px',
                      boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.10), 0 2px 6px -1px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {/* Marca de agua decorativa de comillas editoriales */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '12px',
                        bottom: '-14px',
                        fontSize: '4.4rem',
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        lineHeight: 1,
                        color: '#6366f1',
                        opacity: 0.11,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ”
                    </div>

                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        fontSize: '0.88rem',
                        lineHeight: 1.62,
                        color: '#1e1b4b',
                        fontWeight: 550,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {renderBoldText(keyIdea || '')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── FILA INFERIOR: CONTENIDO QUE FLUYE DEBAJO DE LA IMAGEN A ANCHO COMPLETO ─── */}
        {hasBottomContent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {hasTopContent && (
              <div
                style={{
                  height: '1.5px',
                  width: '100%',
                  background: 'linear-gradient(90deg, transparent 0%, #c7d2fe 20%, #818cf8 50%, #c7d2fe 80%, transparent 100%)',
                  margin: '4px 0',
                }}
              />
            )}

            {/* Cabecera de los Puntos Clave */}
            {pointsTitle && pointsTitle.trim() !== '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #ede9fe 0%, #c7d2fe 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={14} color="#6366f1" />
                </div>
                <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 850, color: '#1e1b4b', letterSpacing: '-0.015em' }}>
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
                      borderRadius: '16px',
                      background: 'linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
                      border: '1.5px solid #e0e7ff',
                      padding: '16px 16px 14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.04), inset 0 1px 0 #ffffff',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Barra superior de acento con gradiente */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366f1 0%, #a5b4fc 100%)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
                            border: '1.2px solid #c7d2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.12)',
                          }}
                        >
                          {getIcon(point.icon)}
                        </div>
                        {point.label && point.label.trim() !== '' && (
                          <strong style={{ fontSize: '0.88rem', color: '#1e1b4b', fontWeight: 800 }}>
                            {point.label}
                          </strong>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          color: '#6366f1',
                          background: '#f5f3ff',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          border: '1px solid #e0e7ff',
                          flexShrink: 0,
                          letterSpacing: '0.04em',
                        }}
                      >
                        0{index + 1}
                      </span>
                    </div>
                    {point.content && point.content.trim() !== '' && (
                      <div style={{ fontSize: '0.83rem', lineHeight: 1.55, color: '#1e293b' }}>
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
                  gap: '14px',
                  padding: '16px 20px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f6ff 50%, #ede9fe 100%)',
                  border: '1.5px solid #a5b4fc',
                  color: '#1e1b4b',
                  boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.08), inset 0 1px 0 #ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  <Info size={18} color="#ffffff" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <span
                    style={{
                      fontSize: '0.70rem',
                      fontWeight: 850,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#4f46e5',
                    }}
                  >
                    Tip de Laboratorio y Reconocimiento Práctico
                  </span>
                  <div style={{ fontSize: '0.86rem', lineHeight: 1.6, color: '#1e1b4b', fontWeight: 500 }}>
                    {renderBoldText(labTip)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistologyGeneralitiesBlock;
