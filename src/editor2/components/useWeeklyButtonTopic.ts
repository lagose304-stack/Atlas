import { useEffect, useState } from 'react';
import { getCachedSubtemas, getCachedTemas, getQuickSubtemaById, getQuickTemaById } from '../../services/catalogService';
import { getCloudinaryImageUrl } from '../../services/cloudinaryImages';
import { weeklyButtonDestination } from '../domain/weeklyButtonDestination';

export function useWeeklyButtonTopic(href: string, enabled: boolean) {
  const destination = enabled ? weeklyButtonDestination(href) : null;
  const kind = destination?.kind;
  const id = destination?.id;
  const key = kind && id ? `${kind}:${id}` : undefined;
  const [resolved, setResolved] = useState<{ key: string; name: string; logo?: string | null }>();

  useEffect(() => {
    if (!key || !id) return;
    let current = true;
    const load = kind === 'tema' ? getCachedTemas : getCachedSubtemas;
    void load().then(items => {
      if (!current) return;
      const item = items.find(entry => entry.id === id);
      setResolved(item ? { key, name: item.nombre, logo: item.logo_url } : undefined);
    }).catch(() => { /* El enlace conserva un rótulo genérico si el catálogo no está disponible. */ });
    return () => { current = false; };
  }, [id, key, kind]);

  if (!destination) return null;
  const cached = destination.kind === 'tema' ? getQuickTemaById(destination.id) : getQuickSubtemaById(destination.id);
  const match = resolved?.key === key ? resolved : cached ? { name: cached.nombre, logo: cached.logo_url } : undefined;
  return {
    name: match?.name || (destination.kind === 'tema' ? 'Ver tema' : 'Ver subtema'),
    thumbnailSrc: match?.logo ? getCloudinaryImageUrl(match.logo, 'thumbSmall') : undefined,
  };
}
