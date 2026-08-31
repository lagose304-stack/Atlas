import React, { useState, useMemo, useEffect } from 'react';
import { Microscope } from 'lucide-react';
import { getCloudinaryImageUrl, getImageCandidateUrls, type CloudinaryImageProfile } from '../services/cloudinaryImages';

interface ResilientPlacaThumbProps {
  photoUrl: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  profile?: CloudinaryImageProfile;
  subtemaLogo?: string | null;
  temaLogo?: string | null;
  draggable?: boolean;
}

export const ResilientPlacaThumb: React.FC<ResilientPlacaThumbProps> = ({
  photoUrl,
  alt = 'Placa histológica',
  style,
  className,
  profile = 'thumb',
  subtemaLogo,
  temaLogo,
  draggable = false,
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [invalidationTick, setInvalidationTick] = useState(0);

  // Reiniciar estado si la prop photoUrl cambia
  useEffect(() => {
    setCandidateIndex(0);
    setLoaded(false);
  }, [photoUrl]);

  // Escuchar invalidación de imágenes para actualizar en vivo
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ url?: string; timestamp?: number }>;
      if (!custom.detail?.url || !photoUrl) {
        setInvalidationTick(t => t + 1);
        return;
      }
      const target = custom.detail.url.toLowerCase();
      const current = photoUrl.toLowerCase();
      if (current.includes(target) || target.includes(current)) {
        setCandidateIndex(0);
        setLoaded(false);
        setInvalidationTick(t => t + 1);
      }
    };

    window.addEventListener('atlas:image-invalidated', handler);
    return () => window.removeEventListener('atlas:image-invalidated', handler);
  }, [photoUrl]);

  // Generar lista de URLs candidatas en cascada
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (!photoUrl) return list;

    // 1. URLs candidatas en cascada desde getImageCandidateUrls
    const baseList = getImageCandidateUrls(photoUrl, profile);
    baseList.forEach(url => {
      if (url && !list.includes(url)) list.push(url);
    });

    // 2. Fallback URL limpia directa sin query string
    const cleanUrl = photoUrl.trim().split('?')[0];
    if (cleanUrl && !list.includes(cleanUrl)) {
      list.push(cleanUrl);
    }

    // 3. Fallback con subtema logo
    if (subtemaLogo) {
      const subtemaResolved = getCloudinaryImageUrl(subtemaLogo, 'thumb');
      if (subtemaResolved && !list.includes(subtemaResolved)) {
        list.push(subtemaResolved);
      }
    }

    // 4. Fallback con tema logo
    if (temaLogo) {
      const temaResolved = getCloudinaryImageUrl(temaLogo, 'thumb');
      if (temaResolved && !list.includes(temaResolved)) {
        list.push(temaResolved);
      }
    }

    return list;
  }, [photoUrl, profile, subtemaLogo, temaLogo, invalidationTick]);

  const currentSrc = candidates[candidateIndex] || '';

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
    }
  };

  const isAllFailed = candidateIndex >= candidates.length;

  if (isAllFailed || !currentSrc) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          boxSizing: 'border-box',
          padding: '8px',
          color: '#64748b',
          gap: '6px',
          ...style,
        }}
        className={className}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Microscope size={18} color="#0284c7" />
        </div>
        <span style={{ fontSize: '0.68em', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>
          Histología
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#f1f5f9',
      }}
    >
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            zIndex: 1,
          }}
        />
      )}
      <img
        src={currentSrc}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          display: 'block',
          transition: 'opacity 0.2s ease-in-out',
          opacity: loaded ? 1 : 0,
          ...style,
        }}
        className={className}
        loading="lazy"
        draggable={draggable}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </div>
  );
};

export default ResilientPlacaThumb;
