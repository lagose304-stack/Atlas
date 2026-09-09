import React from 'react';
import { renderBoldText } from '../BoldField';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';

export interface HistologyExtraDataProps {
  title?: string;
  text?: string;
  imageUrl?: string;
  imageCaption?: string;
}

export const HistologyExtraDataBlock: React.FC<HistologyExtraDataProps> = ({
  title,
  text,
  imageUrl,
  imageCaption,
}) => {
  const safeTitle = title?.trim() || '';
  const safeText = text?.trim() || '';
  const safeImage = imageUrl?.trim() || '';

  if (!safeTitle && !safeText && !safeImage) {
    return null;
  }

  return (
    <div
      className="histology-extra-data-block"
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '18px',
        background: 'linear-gradient(180deg, #f8fbff 0%, #f0f7ff 100%)',
        border: '1.5px solid #bae6fd',
        boxShadow: '0 4px 18px -2px rgba(2, 132, 199, 0.05)',
        padding: 'clamp(18px, 2.5vw, 24px)',
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
          gap: '20px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {safeTitle && (
            <h3
              style={{
                margin: 0,
                fontSize: 'clamp(1.1rem, 1.8vw, 1.28rem)',
                fontWeight: 850,
                color: '#1e3a8a',
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}
            >
              {renderBoldText(safeTitle)}
            </h3>
          )}

          {safeText && (
            <div
              className="histology-extra-data-text"
              style={{
                fontSize: 'clamp(0.92rem, 1.35vw, 0.96rem)',
                color: '#334155',
                lineHeight: 1.62,
                fontWeight: 450,
              }}
            >
              {renderBoldText(safeText)}
            </div>
          )}
        </div>

        {safeImage && (
          <div
            style={{
              flex: '0 1 280px',
              minWidth: '220px',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1.2px solid #bae6fd',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)',
              background: '#ffffff',
            }}
          >
            <img
              src={getCloudinaryImageUrl(safeImage, 'view')}
              alt={imageCaption || safeTitle || 'Ilustración'}
              style={{ width: '100%', height: 'auto', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
              loading="lazy"
            />
            {imageCaption && imageCaption.trim() !== '' && (
              <div
                style={{
                  padding: '6px 10px',
                  background: '#f8fbff',
                  borderTop: '1px solid #e0f2fe',
                  fontSize: '0.76rem',
                  color: '#64748b',
                  fontWeight: 500,
                }}
              >
                🔬 {imageCaption}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistologyExtraDataBlock;
