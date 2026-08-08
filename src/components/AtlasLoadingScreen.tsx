import React from 'react';
import laboratoryLogo from '../assets/logos/laboratorio.png';

interface AtlasLoadingScreenProps {
  label?: string;
  fullScreen?: boolean;
}

const AtlasLoadingScreen: React.FC<AtlasLoadingScreenProps> = ({
  label = 'Preparando el Atlas de Histología…',
  fullScreen = false,
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`atlas-loading-screen${fullScreen ? ' atlas-loading-screen--full' : ''}`}
  >
    <div className="atlas-loading-glow" aria-hidden="true" />
    <div className="atlas-loading-card">
      <div className="atlas-loading-logo-wrap" aria-hidden="true">
        <span className="atlas-loading-orbit"><i /></span>
        <img src={laboratoryLogo} alt="" className="atlas-loading-logo" />
      </div>
      <div className="atlas-loading-copy">
        <strong>Histolab UNAH</strong>
        <span>{label}</span>
      </div>
      <span className="atlas-loading-progress" aria-hidden="true"><i /></span>
    </div>
  </div>
);

export default AtlasLoadingScreen;
