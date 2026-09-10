import React from 'react';
import { renderBoldText } from '../BoldField';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { hasHtmlMarkup, toSafeHtml } from '../../services/richText';

export interface HistologyExtraDataProps {
  title?: string;
  text?: string;
  imageUrl?: string;
  imageCaption?: string;
  barColor?: string;
  titleColor?: string;
  bgColor?: string;
  displayMode?: 'inline' | 'stacked' | string;
}

export const HistologyExtraDataBlock: React.FC<HistologyExtraDataProps> = ({
  title,
  text,
  imageUrl,
  imageCaption,
  barColor,
  titleColor,
  bgColor,
  displayMode,
}) => {
  const safeTitle = title?.trim() || '';
  const safeText = text?.trim() || '';
  const safeImage = imageUrl?.trim() || '';

  if (!safeTitle && !safeText && !safeImage) {
    return null;
  }

  const effectiveBarColor = barColor?.trim() || '#005953';
  const effectiveTitleColor = titleColor?.trim() || '#005953';
  const effectiveBgColor = bgColor?.trim() || '#f0fdfa';
  const isStacked = displayMode === 'stacked';

  return (
    <div
      className="histology-extra-data-block"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '10px',
        background: effectiveBgColor,
        border: '1px solid #ccfbf1',
        borderLeft: `5px solid ${effectiveBarColor}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
        padding: 'clamp(14px, 1.8vw, 18px) clamp(16px, 2.2vw, 22px)',
        fontFamily: '"Montserrat", "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          {isStacked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {safeTitle && (
                <h4
                  style={{
                    margin: 0,
                    fontSize: 'clamp(1.02rem, 1.4vw, 1.12rem)',
                    fontWeight: 800,
                    color: effectiveTitleColor,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.35,
                  }}
                >
                  {renderBoldText(safeTitle)}
                </h4>
              )}
              {safeText && (
                <div
                  className="histology-extra-data-text"
                  style={{
                    fontSize: 'clamp(0.92rem, 1.3vw, 0.96rem)',
                    color: '#334155',
                    lineHeight: 1.65,
                  }}
                >
                  {hasHtmlMarkup(safeText) ? (
                    <span className="atlas-rich-rendered" dangerouslySetInnerHTML={{ __html: toSafeHtml(safeText) }} />
                  ) : (
                    renderBoldText(safeText)
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className="histology-extra-data-text"
              style={{
                fontSize: 'clamp(0.92rem, 1.3vw, 0.96rem)',
                color: '#334155',
                lineHeight: 1.68,
              }}
            >
              {safeTitle && (
                <strong
                  style={{
                    color: effectiveTitleColor,
                    fontWeight: 800,
                    marginRight: '6px',
                  }}
                >
                  {renderBoldText(safeTitle.endsWith(':') ? safeTitle : `${safeTitle}:`)}
                </strong>
              )}
              {hasHtmlMarkup(safeText) ? (
                <span className="atlas-rich-rendered" dangerouslySetInnerHTML={{ __html: toSafeHtml(safeText) }} />
              ) : (
                renderBoldText(safeText)
              )}
            </div>
          )}
        </div>

        {safeImage && (
          <div
            style={{
              flex: '0 1 240px',
              minWidth: '200px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid #ccfbf1',
              boxShadow: '0 2px 10px rgba(0, 89, 83, 0.08)',
              background: '#ffffff',
            }}
          >
            <img
              src={getCloudinaryImageUrl(safeImage, 'view')}
              alt={imageCaption || safeTitle || 'Ilustración'}
              style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
              loading="lazy"
            />
            {imageCaption && imageCaption.trim() !== '' && (
              <div
                style={{
                  padding: '5px 8px',
                  background: '#f0fdfa',
                  borderTop: '1px solid #ccfbf1',
                  fontSize: '0.74rem',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                🔬 {renderBoldText(imageCaption)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistologyExtraDataBlock;

