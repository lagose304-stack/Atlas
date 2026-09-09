import React from 'react';
import { Sparkles } from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup } from '../../services/richText';

export interface HistologyCardItem {
  id?: string;
  title: string;
  desc: string;
  badge?: string;
}

export interface HistologyTextCardsProps {
  badgeText?: string;
  title?: string;
  text?: string;
  cards?: HistologyCardItem[];
  cardsAlign?: 'center' | 'left' | string;
}

export const HistologyTextCardsBlock: React.FC<HistologyTextCardsProps> = ({
  badgeText,
  title,
  text,
  cards = [],
  cardsAlign = 'center',
}) => {
  const validCards = cards.filter(
    c => (c.title && c.title.trim() !== '') || (c.desc && c.desc.trim() !== '')
  );
  const safeText = text?.trim() || '';
  const hasText = safeText !== '';
  const hasBadge = Boolean(badgeText && badgeText.trim() !== '');
  const hasTitle = Boolean(title && title.trim() !== '');

  if (!hasText && validCards.length === 0 && !hasTitle && !hasBadge) {
    return null;
  }

  return (
    <div
      className="histology-text-cards-block"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '24px',
        background: 'radial-gradient(ellipse at 88% 18%, rgba(2, 132, 199, 0.05) 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f9fcff 100%)',
        border: '1.5px solid rgba(186, 230, 253, 0.95)',
        boxShadow: '0 14px 38px -6px rgba(2, 132, 199, 0.07), 0 2px 8px -2px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ─── Barra Superior de Acento Azul / Zafiro ─── */}
      <div
        style={{
          height: '4px',
          width: '100%',
          background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #7dd3fc 100%)',
          flexShrink: 0,
        }}
      />

      {/* ─── Trama geométrica de laboratorio ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(#0284c7 0.75px, transparent 0.75px)',
          backgroundSize: '22px 22px',
          opacity: 0.035,
          pointerEvents: 'none',
        }}
      />

      {/* ─── Contenido Interior ─── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'clamp(20px, 3vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Cabecera Opcional: Badge y Título */}
        {(hasBadge || hasTitle) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hasBadge && (
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.70rem',
                    fontWeight: 850,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#0369a1',
                    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    border: '1.2px solid #7dd3fc',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)',
                  }}
                >
                  <Sparkles size={12} color="#0284c7" />
                  <span>{badgeText}</span>
                </span>
              </div>
            )}

            {hasTitle && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(1.25rem, 2.2vw, 1.55rem)',
                  fontWeight: 850,
                  color: '#0c4a6e',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.22,
                }}
              >
                {title}
              </h3>
            )}
          </div>
        )}

        {/* Párrafos de Texto Superior */}
        {hasText && (
          <div
            className="histology-text-cards-text"
            style={{
              fontSize: '0.96rem',
              lineHeight: 1.68,
              color: '#0f172a',
              fontWeight: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {hasHtmlMarkup(safeText) ? (
              renderBoldText(safeText)
            ) : (
              safeText.split(/\n\s*\n/).map((para, pIdx) => (
                <p key={pIdx} style={{ margin: 0, color: '#0f172a' }}>
                  {renderBoldText(para.trim())}
                </p>
              ))
            )}
          </div>
        )}

        {/* Fila / Grid de Tarjetas Esbeltas y Compactas (Centradas si la última fila tiene menos tarjetas) */}
        {validCards.length > 0 && (
          <div
            className="histology-text-cards-grid"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: cardsAlign === 'left' ? 'flex-start' : 'center',
              gap: 'clamp(12px, 1.6vw, 18px)',
              width: '100%',
            }}
          >
            {validCards.map((card, idx) => {
              const effectiveCols = validCards.length <= 2 ? validCards.length : validCards.length === 4 ? 4 : 3;
              const cardWidth = `calc((100% - ${(effectiveCols - 1) * 18}px) / ${effectiveCols})`;

              return (
                <div
                  key={card.id ?? idx}
                  className="histology-text-card-item"
                  style={{
                    position: 'relative',
                    borderRadius: '16px',
                    background: 'radial-gradient(ellipse at 94% 14%, rgba(56, 189, 248, 0.12) 0%, transparent 55%), linear-gradient(175deg, #ffffff 0%, #f8fbfe 60%, #f0f7ff 100%)',
                    border: '1.3px solid #dbeafe',
                    boxShadow: '0 4px 14px -2px rgba(2, 132, 199, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff',
                    padding: '12px 18px 12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    flex: `0 1 ${cardWidth}`,
                    maxWidth: cardWidth,
                    minWidth: 'min(100%, 250px)',
                    boxSizing: 'border-box',
                  }}
                >
                {/* Barra lateral azul redondeada con extremos libres */}
                <div
                  style={{
                    position: 'absolute',
                    left: '0px',
                    top: '10px',
                    bottom: '10px',
                    width: '4px',
                    borderRadius: '0 999px 999px 0',
                    background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 55%, #0369a1 100%)',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                  }}
                />

                {/* Badge opcional en la esquina superior derecha */}
                {card.badge && card.badge.trim() !== '' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '7px',
                      right: '10px',
                      fontSize: '0.64rem',
                      fontWeight: 850,
                      letterSpacing: '0.04em',
                      color: '#0284c7',
                      background: 'rgba(224, 242, 254, 0.85)',
                      border: '1px solid #bae6fd',
                      padding: '1px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {card.badge}
                  </span>
                )}

                {/* Contenido interno compacto */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingLeft: '4px',
                  }}
                >
                  {/* Título o Métrica destacada */}
                  {card.title && card.title.trim() !== '' && (
                    <div
                      style={{
                        fontSize: 'clamp(1.18rem, 1.7vw, 1.38rem)',
                        fontWeight: 850,
                        color: '#075985',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.18,
                      }}
                    >
                      {renderBoldText(card.title)}
                    </div>
                  )}

                  {/* Explicación o Detalle */}
                  {card.desc && card.desc.trim() !== '' && (
                    <div
                      style={{
                        fontSize: '0.86rem',
                        lineHeight: 1.38,
                        color: '#475569',
                        fontWeight: 500,
                      }}
                    >
                      {renderBoldText(card.desc)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};
