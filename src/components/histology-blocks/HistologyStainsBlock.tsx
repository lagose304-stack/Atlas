import React from 'react';
import { Palette, ZoomIn, Sparkles, FlaskConical } from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { MedicalIcon } from '../common/MedicalIcon';

export interface HistologyStainItem {
  id?: string;
  number?: string;
  name: string;
  category?: string;
  nucleus?: string;
  cytoplasm?: string;
  highlights?: string;
  result?: string;
  utility?: string;
  imageUrl?: string;
  icon?: string;
}

export interface HistologyStainsProps {
  title?: string;
  badgeText?: string;
  introText?: string;
  items?: HistologyStainItem[];
  colorKeyTip?: string;
  imageUrl?: string;
  imageBadge?: string;
  stainsTitle?: string;
  onOpenImageViewer?: (url: string) => void;
}

export const HistologyStainsBlock: React.FC<HistologyStainsProps> = ({
  title = '5. Tinciones Histológicas',
  badgeText = 'Tinciones Histológicas',
  introText,
  items = [],
  colorKeyTip,
  onOpenImageViewer,
}) => {
  const validItems = items.filter(
    item =>
      (item.name && item.name.trim() !== '') ||
      (item.result && item.result.trim() !== '') ||
      (item.utility && item.utility.trim() !== '') ||
      (item.nucleus && item.nucleus.trim() !== '') ||
      (item.highlights && item.highlights.trim() !== '')
  );

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '24px',
        background: 'linear-gradient(180deg, #ffffff 0%, #faf6fd 100%)',
        border: '1.5px solid rgba(233, 213, 255, 0.95)',
        padding: 'clamp(20px, 3vw, 32px)',
        boxShadow: '0 12px 34px rgba(168, 85, 247, 0.05), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* ─── CABECERA: BADGE Y TÍTULO ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {badgeText && badgeText.trim() !== '' && (
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.70rem',
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
              <Palette size={12} />
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
              fontSize: '0.90rem',
              lineHeight: 1.6,
              color: '#475569',
              fontWeight: 450,
            }}
          >
            {renderBoldText(introText)}
          </div>
        )}
      </div>

      {/* ─── GRID DE MICRO-TARJETAS DE TINCIÓN ─── */}
      {validItems.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '14px',
          }}
        >
          {validItems.map((item, index) => {
            const hasImg = Boolean(item.imageUrl && item.imageUrl.trim() !== '');

            return (
              <div
                key={item.id ?? index}
                style={{
                  borderRadius: '18px',
                  background: '#ffffff',
                  border: '1.5px solid rgba(233, 213, 255, 0.85)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.04)',
                  transition: 'border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#c084fc';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(168, 85, 247, 0.09)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(233, 213, 255, 0.85)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(168, 85, 247, 0.04)';
                }}
              >
                {/* Header de la tarjeta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#f3e8ff',
                      color: '#9333ea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MedicalIcon name={item.icon || 'flask'} size={15} color="#9333ea" fallback={<FlaskConical size={14} />} />
                  </div>
                  <strong
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      color: '#2e1065',
                      lineHeight: 1.25,
                    }}
                  >
                    {item.name}
                  </strong>
                </div>

                {/* Contenido en 2 columnas: Datos a la izquierda, Imagen a la derecha */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: hasImg ? 'minmax(0, 1fr) 76px' : '1fr',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  {/* Textos clave */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.76rem', color: '#475569' }}>
                    {item.nucleus && (
                      <div>
                        <strong style={{ color: '#0f172a', fontWeight: 750 }}>Núcleo: </strong>
                        <span>{item.nucleus}</span>
                      </div>
                    )}

                    {item.cytoplasm && (
                      <div>
                        <strong style={{ color: '#0f172a', fontWeight: 750 }}>Citoplasma: </strong>
                        <span>{item.cytoplasm}</span>
                      </div>
                    )}

                    {item.highlights && (
                      <div>
                        <strong style={{ color: '#9333ea', fontWeight: 750 }}>Resalta: </strong>
                        <span>{item.highlights}</span>
                      </div>
                    )}

                    {item.result && (
                      <div>{renderBoldText(item.result)}</div>
                    )}

                    {item.utility && (
                      <div style={{ marginTop: '2px', color: '#64748b', fontSize: '0.73rem', lineHeight: 1.35 }}>
                        <strong style={{ color: '#1e293b', fontWeight: 700 }}>Utilidad: </strong>
                        <span>{item.utility}</span>
                      </div>
                    )}
                  </div>

                  {/* Imagen de muestra con zoom */}
                  {hasImg && (
                    <div
                      style={{
                        position: 'relative',
                        width: '76px',
                        height: '76px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1.5px solid #e9d5ff',
                        flexShrink: 0,
                        cursor: onOpenImageViewer ? 'pointer' : 'default',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      }}
                      onClick={() => {
                        if (onOpenImageViewer && item.imageUrl) {
                          onOpenImageViewer(item.imageUrl);
                        }
                      }}
                      title="Ampliar micrografía con esta tinción"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          right: '3px',
                          background: 'rgba(59, 7, 100, 0.75)',
                          color: '#ffffff',
                          borderRadius: '4px',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ZoomIn size={10} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Callout opcional */}
      {colorKeyTip && colorKeyTip.trim() !== '' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '1px solid #e9d5ff',
            color: '#6b21a8',
            fontSize: '0.80rem',
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0, color: '#9333ea' }} />
          <div>{renderBoldText(colorKeyTip)}</div>
        </div>
      )}
    </div>
  );
};

export default HistologyStainsBlock;
