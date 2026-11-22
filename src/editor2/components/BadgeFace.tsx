import type { CSSProperties, ReactNode } from 'react';
import type { BadgeBlock } from '../domain/schema';
import { renderAtlasIcon } from './IconPickerModal';

export type BadgeAppearance = Pick<BadgeBlock['props'], 'variant' | 'color' | 'size' | 'icon'>;

export const BADGE_VARIANTS = [
  { label: 'Suave', value: 'soft' },
  { label: 'Sólida', value: 'solid' },
  { label: 'Contorno', value: 'outline' },
  { label: 'Cristal', value: 'glass' },
  { label: 'Muestra de color', value: 'swatch' },
] as const;

export const BADGE_SIZES = [
  { label: 'Pequeña', value: 'sm' },
  { label: 'Mediana', value: 'md' },
  { label: 'Grande', value: 'lg' },
] as const;

export default function BadgeFace({
  variant = 'soft', color = '#0284c7', size = 'md', icon, children,
}: BadgeAppearance & { children: ReactNode }) {
  const style: CSSProperties =
    variant === 'solid'
      ? { backgroundColor: color, borderColor: color, color: '#ffffff' }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderColor: color, color }
        : variant === 'glass'
          ? {
              backgroundColor: `color-mix(in srgb, ${color} 16%, rgba(255,255,255,0.7))`,
              borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
              color,
              backdropFilter: 'blur(8px)',
            }
          : variant === 'swatch'
            ? { backgroundColor: 'var(--e2-panel)', borderColor: 'var(--e2-line-strong)', color: 'var(--e2-ink)' }
            : {
                backgroundColor: `color-mix(in srgb, ${color} 14%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                color,
              };

  return (
    <span className={`e2-badge e2-badge--${size} e2-badge--${variant}`} style={style}>
      {variant === 'swatch' && (
        <span className="e2-badge__swatch-dot" style={{ backgroundColor: color }} aria-hidden="true" />
      )}
      {icon && renderAtlasIcon(icon, size === 'lg' ? 15 : size === 'sm' ? 11 : 13)}
      {children}
    </span>
  );
}
