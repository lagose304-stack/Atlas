import React from 'react';
import { Activity } from 'lucide-react';
import {
  HistologyTopicCategory,
  ORDERED_HISTOLOGY_TOPICS,
  HISTOLOGY_TOPIC_LABELS,
  HISTOLOGY_TOPIC_SYNONYMS,
  MedicalIconDefinition,
  MEDICAL_ICONS_CATALOG,
  ICONS_BY_ID,
  normalizeSearchTerm,
  getTermVariations,
} from './medicalIconCatalog';

// Re-exportar tipos, catálogo y helpers para compatibilidad con todo el proyecto
export type { HistologyTopicCategory, MedicalIconDefinition };
export {
  ORDERED_HISTOLOGY_TOPICS,
  HISTOLOGY_TOPIC_LABELS,
  HISTOLOGY_TOPIC_SYNONYMS,
  MEDICAL_ICONS_CATALOG,
  ICONS_BY_ID,
  normalizeSearchTerm,
  getTermVariations,
};

export interface MedicalIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export const MedicalIcon: React.FC<MedicalIconProps> = ({
  name,
  size = 18,
  color,
  className,
  style,
  fallback,
}) => {
  const iconDef = ICONS_BY_ID.get(name);

  if (iconDef) {
    return iconDef.render({ size, color, className, style });
  }

  // Fallback si el ID no existe en el catálogo
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Activity
      size={size}
      color={color || '#059669'}
      className={className}
      style={style}
    />
  );
};

export default MedicalIcon;
