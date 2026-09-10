import React from 'react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup, toSafeHtml } from '../../services/richText';

export interface HistologyBulletCardItem {
  id?: string;
  title: string;
  bullets: string[] | string;
}

export interface HistologyBulletCardsProps {
  title?: string;
  text?: string;
  cards?: HistologyBulletCardItem[];
  columns?: '2' | '3' | '4' | number | string;
  titleColor?: string;
  lineColor?: string;
  cardBorderColor?: string;
  cardTitleColor?: string;
}

/**
 * Parsea el contenido de viñetas ya sea array de strings o string multilínea
 */
export const parseBulletItems = (raw: string[] | string | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(item => item && item.trim() !== '');
  }
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(line => line.replace(/^([•\-\*]|\d+[\.\)])\s+/, ''));
};

/**
 * Renderiza una viñeta individual con soporte para negritas (ej: **Ubicación:** o Ubicación:)
 */
const renderBulletContent = (content: string): React.ReactNode => {
  if (!content) return null;

  if (hasHtmlMarkup(content)) {
    return <span className="atlas-rich-rendered" dangerouslySetInnerHTML={{ __html: toSafeHtml(content) }} />;
  }

  // Si ya contiene markdown **negrita**, usamos renderBoldText
  if (content.includes('**')) {
    return renderBoldText(content);
  }

  // Si tiene el patrón clásico "Etiqueta: Resto del texto", resaltamos automáticamente la etiqueta en negrita
  const match = content.match(/^([^:\n]{2,35}):\s+(.+)$/);
  if (match) {
    const [, label, rest] = match;
    return (
      <>
        <strong>{label}:</strong> {rest}
      </>
    );
  }

  return content;
};

export const HistologyBulletCardsBlock: React.FC<HistologyBulletCardsProps> = ({
  title,
  text,
  cards = [],
  columns = '2',
  titleColor,
  lineColor,
  cardBorderColor,
  cardTitleColor,
}) => {
  const safeTitle = title?.trim() || '';
  const safeText = text?.trim() || '';
  const hasTitle = safeTitle !== '';
  const hasText = safeText !== '';

  const effectiveTitleColor = titleColor?.trim() || '#005953';
  const effectiveLineColor = lineColor?.trim() || '#99f6e4';
  const effectiveCardBorderColor = cardBorderColor?.trim() || '#005953';
  const effectiveCardTitleColor = cardTitleColor?.trim() || '#005953';

  const validCards = cards
    .map(card => ({
      ...card,
      bullets: parseBulletItems(card.bullets),
    }))
    .filter(card => (card.title && card.title.trim() !== '') || (card.bullets && card.bullets.length > 0));

  if (!hasTitle && !hasText && validCards.length === 0) {
    return null;
  }

  const cols = Math.min(4, Math.max(1, Number(columns) || 2));

  return (
    <div
      className="histology-bullet-cards-block"
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
            : `linear-gradient(90deg, ${effectiveCardBorderColor} 0%, ${effectiveLineColor} 50%, #99f6e4 100%)`,
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
        {/* ─── 1. TÍTULO PRINCIPAL CON LÍNEA DIVISORIA VERDE / MENTA ─── */}
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

            {/* Línea horizontal en verde menta suave justo bajo el título */}
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

        {/* ─── 2. PÁRRAFO DE TEXTO EXPLICATIVO DEBAJO DEL TÍTULO ─── */}
        {hasText && (
        <div
          style={{
            fontSize: 'clamp(0.93rem, 1.3vw, 0.98rem)',
            color: '#334155',
            lineHeight: 1.6,
            marginBottom: validCards.length > 0 ? '12px' : 0,
          }}
        >
          {hasHtmlMarkup(safeText) ? (
            <div className="atlas-rich-rendered" dangerouslySetInnerHTML={{ __html: toSafeHtml(safeText) }} />
          ) : (
            safeText.split('\n\n').map((paragraph, idx) => (
              <p key={idx} style={{ margin: idx === 0 ? 0 : '6px 0 0 0' }}>
                {renderBoldText(paragraph)}
              </p>
            ))
          )}
        </div>
      )}

      {/* ─── 3. CUADRÍCULA DE TARJETAS CON TÍTULO Y VIÑETAS ─── */}
      {validCards.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 'clamp(12px, 1.8vw, 18px)',
            width: '100%',
            boxSizing: 'border-box',
          }}
          className="histology-bullet-cards-grid"
        >
          {validCards.map((card, idx) => (
            <div
              key={card.id || `card-${idx}`}
              className="histology-bullet-card-item"
              style={{
                position: 'relative',
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderTop: `4px solid ${effectiveCardBorderColor}`,
                borderRadius: '12px',
                padding: 'clamp(12px, 1.6vw, 16px) clamp(14px, 1.8vw, 18px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {/* Título de la tarjeta en color personalizable */}
              {card.title && card.title.trim() !== '' && (
                <h4
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 'clamp(1.08rem, 1.5vw, 1.2rem)',
                    fontWeight: 750,
                    color: effectiveCardTitleColor,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                  }}
                >
                  {renderBoldText(card.title)}
                </h4>
              )}

              {/* Lista de viñetas */}
              {card.bullets && card.bullets.length > 0 && (
                <ul
                  style={{
                    listStyleType: 'disc',
                    paddingLeft: '18px',
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    color: '#1e293b',
                  }}
                >
                  {card.bullets.map((bullet, bIdx) => (
                    <li
                      key={bIdx}
                      style={{
                        fontSize: 'clamp(0.9rem, 1.2vw, 0.95rem)',
                        lineHeight: 1.6,
                        color: '#1e293b',
                      }}
                    >
                      {renderBulletContent(bullet)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default HistologyBulletCardsBlock;
