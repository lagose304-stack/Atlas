import React from 'react';
import { Sparkles } from 'lucide-react';
import { renderBoldText } from '../BoldField';
import { hasHtmlMarkup } from '../../services/richText';

export interface HistologyTextSimpleCardsProps {
  badgeText?: string;
  title?: string;
  text?: string;
  cards?: string[];
  columns?: '2' | '3' | '4' | number | string;
  cardsAlign?: 'center' | 'left' | string;
}

export const HistologyTextSimpleCardsBlock: React.FC<HistologyTextSimpleCardsProps> = ({
  badgeText,
  title,
  text,
  cards = [],
  columns = '3',
  cardsAlign = 'center',
}) => {
  const validCards = cards.filter(c => c && c.trim() !== '');
  const safeText = text?.trim() || '';
  const hasText = safeText !== '';
  const hasBadge = Boolean(badgeText && badgeText.trim() !== '');
  const hasTitle = Boolean(title && title.trim() !== '');

  if (!hasText && validCards.length === 0 && !hasTitle && !hasBadge) {
    return null;
  }

  // Máximo 4 columnas por fila en pantallas grandes
  const cols = Math.min(4, Math.max(1, Number(columns) || 3));
  const cardWidth = `calc((100% - ${(cols - 1) * 14}px) / ${cols})`;

  return (
    <div
      className="histology-text-simple-cards-block"
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
                  lineHeight: 1.25,
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
            className="histology-text-simple-cards-text"
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

        {/* ─── Cuadrícula de Tarjetas Simples (Centrada cuando hay filas incompletas) ─── */}
        {validCards.length > 0 && (
          <div
            className="histology-text-simple-cards-grid"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: cardsAlign === 'left' ? 'flex-start' : 'center',
              gap: '14px',
              width: '100%',
            }}
          >
            {validCards.map((cardContent, idx) => (
              <div
                key={idx}
                className="histology-simple-card-item"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '52px',
                  padding: '13px 20px',
                  borderRadius: '12px',
                  background: 'linear-gradient(180deg, #ffffff 0%, #f9fcfe 100%)',
                  border: '1.4px solid #e0f2fe',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  flex: `0 1 ${cardWidth}`,
                  maxWidth: cardWidth,
                  minWidth: 'min(100%, 200px)',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    fontSize: '0.96rem',
                    fontWeight: 750,
                    color: '#0f172a',
                    lineHeight: 1.35,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {renderBoldText(cardContent)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
