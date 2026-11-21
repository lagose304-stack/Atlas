import type { Gap } from './schema';
import type { BlockStyle, ResponsiveOverrides } from './styleSchema';

export const TABLET_WIDTH = 640;
export const DESKTOP_WIDTH = 1024;

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export const SCREEN_LABELS: Record<ScreenSize, string> = {
  mobile: 'Móvil',
  tablet: 'Tableta',
  desktop: 'Escritorio',
};

export function screenForWidth(width: number): ScreenSize {
  if (width >= DESKTOP_WIDTH) return 'desktop';
  return width >= TABLET_WIDTH ? 'tablet' : 'mobile';
}

export function responsiveValues(
  style: BlockStyle | undefined,
  screen: ScreenSize,
  gap: Gap = 'md',
): Required<ResponsiveOverrides> {
  const override = screen === 'desktop' ? undefined : style?.responsive?.[screen];
  return {
    direction: override?.direction ?? style?.flow?.direction ?? 'grid',
    align: override?.align ?? style?.flow?.align ?? 'stretch',
    gap: override?.gap ?? gap,
    textSize: override?.textSize ?? style?.textSize ?? 'theme',
  };
}

export function patchResponsiveOverride<K extends keyof ResponsiveOverrides>(
  responsive: BlockStyle['responsive'],
  screen: Exclude<ScreenSize, 'desktop'>,
  key: K,
  value: ResponsiveOverrides[K],
): BlockStyle['responsive'] {
  const next = { ...responsive };
  const override = { ...next[screen] };
  if (value === undefined) delete override[key];
  else override[key] = value;
  if (Object.keys(override).length) next[screen] = override;
  else delete next[screen];
  return Object.keys(next).length ? next : undefined;
}
