import React from 'react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup, toSafeHtml } from '../../services/richText';

export type BadgeColorVariant = 'amber' | 'emerald' | 'blue' | 'rose' | 'purple' | 'gray';

export interface HistologyHorizontalCardItem {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: BadgeColorVariant | string;
  description: string;
}

export interface HistologyHorizontalCardsProps {
  title?: string;
  text?: string;
  cards?: HistologyHorizontalCardItem[];
  titleColor?: string;
  lineColor?: string;
  cardLineColor?: string;
  cardTitleColor?: string;
  cardSubtitleColor?: string;
}

const BADGE_COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  amber: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  yellow: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  emerald: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  green: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  blue: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  rose: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  red: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  gray: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

const renderFormattedText = (content: string): React.ReactNode => {
  if (!content) return null;
  if (hasHtmlMarkup(content)) {
    return <div className="atlas-rich-rendered" dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }} />;
  }
  return (
    <>
      {content.split('\n\n').map((para, idx) => (
        <p key={idx} style={{ margin: idx === 0 ? 0 : '8px 0 0 0' }}>
          {renderBoldText(para)}
        </p>
      ))}
    </>
  );
};

export const HistologyHorizontalCardsBlock: React.FC<HistologyHorizontalCardsProps> = ({
  title,
  text,
  cards = [],
  titleColor,
  lineColor,
  cardLineColor,
  cardTitleColor,
  cardSubtitleColor,
}) => {
  const safeTitle = title?.trim() || '';
  const safeText = text?.trim() || '';
  const hasTitle = safeTitle !== '';
  const hasText = safeText !== '';

  const effectiveTitleColor = titleColor?.trim() || '#005953';
  const effectiveLineColor = lineColor?.trim() || '#99f6e4';
  const effectiveCardLineColor = cardLineColor?.trim() || '#99f6e4';
  const effectiveCardTitleColor = cardTitleColor?.trim() || '#005953';
  const effectiveCardSubtitleColor = cardSubtitleColor?.trim() || '#64748b';

  const validCards = cards.filter(
    card =>
      (card.title && card.title.trim() !== '') ||
      (card.subtitle && card.subtitle.trim() !== '') ||
      (card.badge && card.badge.trim() !== '') ||
      (card.description && card.description.trim() !== '')
  );

  if (!hasTitle && !hasText && validCards.length === 0) {
    return null;
  }

  return (
    <div
      className="histology-horizontal-cards-block"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '24px',
        background: 'radial-gradient(ellipse at 88% 18%, rgba(0, 89, 83, 0.04) 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f9fdfc 100%)',
        border: '1.5px solid rgba(153, 246, 228, 0.85)',
        boxShadow: '0 14px 38px -6px rgba(0, 89, 83, 0.07), 0 2px 8px -2px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#0f172a',
      }}
    >
      {/* ─── Barra Superior de Acento Personalizable ─── */}
      <div
        style={{
          height: '4px',
          width: '100%',
          background: effectiveLineColor.includes('gradient')
            ? effectiveLineColor
            : `linear-gradient(90deg, ${effectiveTitleColor} 0%, ${effectiveLineColor} 50%, #99f6e4 100%)`,
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
          backgroundImage: 'radial-gradient(#005953 0.75px, transparent 0.75px)',
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
          padding: 'clamp(20px, 2.8vw, 30px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* ─── 1. TÍTULO PRINCIPAL CON LÍNEA VERDE MENTA ─── */}
        {hasTitle && (
          <div style={{ marginBottom: hasText ? '4px' : '8px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: 'clamp(1.28rem, 2.2vw, 1.65rem)',
                fontWeight: 800,
                color: effectiveTitleColor,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}
            >
              {renderBoldText(safeTitle)}
            </h3>

            <div
              style={{
                height: '2px',
                width: '100%',
                background: effectiveLineColor,
                marginTop: '6px',
                borderRadius: '999px',
              }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* ─── 2. PÁRRAFO DE TEXTO EXPLICATIVO ─── */}
        {hasText && (
        <div
          style={{
            fontSize: 'clamp(0.93rem, 1.3vw, 0.98rem)',
            color: '#334155',
            lineHeight: 1.6,
            marginBottom: validCards.length > 0 ? '12px' : 0,
          }}
        >
          {renderFormattedText(safeText)}
        </div>
      )}

      {/* ─── 3. LISTA DE TARJETAS HORIZONTALES ─── */}
      {validCards.length > 0 && (
        <div
          className="histology-horizontal-cards-stack"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {validCards.map((card, idx) => {
            const badgeVariant = (card.badgeColor || 'amber').toLowerCase();
            const badgeStyle = BADGE_COLOR_STYLES[badgeVariant] || BADGE_COLOR_STYLES.amber;

            return (
              <div
                key={card.id || `hcard-${idx}`}
                className="histology-horizontal-card-item"
                style={{
                  position: 'relative',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: 'clamp(10px, 1.4vw, 14px) clamp(14px, 1.8vw, 18px)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 'clamp(12px, 1.6vw, 18px)',
                  boxSizing: 'border-box',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Columna Izquierda: Título, Subtítulo y Badge */}
                <div
                  className="histology-horizontal-card-left"
                  style={{
                    flex: '0 0 clamp(190px, 25%, 240px)',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: '2px',
                  }}
                >
                  {card.title && card.title.trim() !== '' && (
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 'clamp(1.02rem, 1.35vw, 1.12rem)',
                        fontWeight: 750,
                        color: effectiveCardTitleColor,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.3,
                      }}
                    >
                      {renderBoldText(card.title)}
                    </h4>
                  )}

                  {card.subtitle && card.subtitle.trim() !== '' && (
                    <span
                      style={{
                        fontSize: 'clamp(0.72rem, 0.95vw, 0.78rem)',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: effectiveCardSubtitleColor,
                        lineHeight: 1.3,
                        marginTop: '1px',
                      }}
                    >
                      {renderBoldText(card.subtitle)}
                    </span>
                  )}

                  {card.badge && card.badge.trim() !== '' && (
                    <span
                      style={{
                        marginTop: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: badgeStyle.bg,
                        color: badgeStyle.text,
                        border: `1px solid ${badgeStyle.border}`,
                        lineHeight: 1.25,
                      }}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>

                {/* Divisor Vertical Personalizable */}
                <div
                  className="histology-horizontal-card-divider"
                  style={{
                    flexShrink: 0,
                    width: '2px',
                    background: effectiveCardLineColor,
                    borderRadius: '999px',
                    alignSelf: 'stretch',
                  }}
                  aria-hidden="true"
                />

                {/* Columna Derecha: Descripción */}
                <div
                  className="histology-horizontal-card-right"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    fontSize: 'clamp(0.88rem, 1.2vw, 0.93rem)',
                    color: '#334155',
                    lineHeight: 1.6,
                  }}
                >
                  {renderFormattedText(card.description)}
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

export default HistologyHorizontalCardsBlock;
