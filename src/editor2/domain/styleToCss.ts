import type { CSSProperties } from 'react';
import type { BlockStyle, MediaAppearance, PageTheme, ShadowPreset } from './styleSchema';

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

function resolveShadow(preset: ShadowPreset, shadowColor?: string): string | undefined {
  switch (preset) {
    case 'none':
      return 'none';
    case 'soft':
      return '0 4px 16px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)';
    case 'medium':
      return '0 10px 28px rgba(15, 23, 42, 0.1), 0 2px 6px rgba(15, 23, 42, 0.06)';
    case 'elevated':
      return '0 20px 44px rgba(15, 23, 42, 0.16), 0 6px 14px rgba(15, 23, 42, 0.08)';
    case 'glow': {
      const base = shadowColor ?? '#0284c7';
      return `0 12px 32px ${hexToRgba(base, 0.24)}, 0 0 0 1px ${hexToRgba(base, 0.18)}`;
    }
    default:
      return undefined;
  }
}

export function hasVisualStyle(style?: BlockStyle): boolean {
  if (!style) return false;
  return Boolean(
    (style.background && style.background.type !== 'none') ||
      (style.border && style.border.style !== 'none' && style.border.width > 0) ||
      style.radius ||
      style.padding ||
      (style.maxWidth && style.maxWidth !== 'full') ||
      (style.shadow && style.shadow !== 'none') ||
      (style.opacity !== undefined && style.opacity < 1) ||
      (style.backdropBlur !== undefined && style.backdropBlur > 0),
  );
}

/**
 * Traduce un `BlockStyle` validado a propiedades CSS deterministas, compartidas
 * 1:1 entre el lienzo del editor y el renderizador público `Editor2Renderer`.
 */
export function blockStyleToCss(style?: BlockStyle): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};

  if (style.background) {
    const bg = style.background;
    if (bg.type === 'solid' && bg.color) {
      css.backgroundColor = bg.color;
    } else if (bg.type === 'gradient' && bg.gradient && bg.gradient.stops.length >= 2) {
      const stops = bg.gradient.stops.join(', ');
      css.backgroundImage =
        bg.gradient.kind === 'radial'
          ? `radial-gradient(circle, ${stops})`
          : `linear-gradient(${bg.gradient.angle}deg, ${stops})`;
    } else if (bg.type === 'image' && bg.imageUrl) {
      const overlayAlpha = bg.overlayOpacity ?? 0;
      const imageLayer = `url("${bg.imageUrl.replace(/"/g, '\\"')}")`;
      if (bg.overlayColor && overlayAlpha > 0) {
        const tint = hexToRgba(bg.overlayColor, overlayAlpha);
        css.backgroundImage = `linear-gradient(${tint}, ${tint}), ${imageLayer}`;
      } else {
        css.backgroundImage = imageLayer;
      }
      css.backgroundSize = 'cover';
      css.backgroundPosition = 'center';
      css.backgroundRepeat = 'no-repeat';
    }
  }

  if (style.border && style.border.style !== 'none' && style.border.width > 0) {
    const borderValue = `${style.border.width}px ${style.border.style} ${style.border.color}`;
    const sides = style.border.sides ?? 'all';
    if (sides === 'all') css.border = borderValue;
    else if (sides === 'top') css.borderTop = borderValue;
    else if (sides === 'bottom') css.borderBottom = borderValue;
    else if (sides === 'left') css.borderLeft = borderValue;
    else if (sides === 'right') css.borderRight = borderValue;
  }

  if (style.radius) {
    if (style.radius.mode === 'uniform') {
      css.borderRadius = `${style.radius.value ?? 0}px`;
    } else {
      const tl = style.radius.tl ?? 0;
      const tr = style.radius.tr ?? 0;
      const br = style.radius.br ?? 0;
      const bl = style.radius.bl ?? 0;
      css.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    }
  }

  if (style.padding) {
    if (style.padding.mode === 'uniform') {
      css.padding = `${style.padding.value ?? 0}px`;
    } else if (style.padding.mode === 'axis') {
      css.padding = `${style.padding.y ?? 0}px ${style.padding.x ?? 0}px`;
    } else {
      const t = style.padding.t ?? 0;
      const r = style.padding.r ?? 0;
      const b = style.padding.b ?? 0;
      const l = style.padding.l ?? 0;
      css.padding = `${t}px ${r}px ${b}px ${l}px`;
    }
  }

  if (style.maxWidth && style.maxWidth !== 'full') {
    css.maxWidth = `${style.maxWidth}px`;
    css.width = '100%';
    css.marginInline = 'auto';
  }

  if (style.shadow) {
    const resolved = resolveShadow(style.shadow, style.shadowColor);
    if (resolved) css.boxShadow = resolved;
  }

  if (style.opacity !== undefined) {
    css.opacity = style.opacity;
  }

  if (style.backdropBlur !== undefined && style.backdropBlur > 0) {
    const blur = `blur(${style.backdropBlur}px)`;
    css.backdropFilter = blur;
    css.WebkitBackdropFilter = blur;
  }

  return css;
}

export function mergeBlockStyle(layoutStyle: CSSProperties, blockStyle?: BlockStyle): CSSProperties {
  if (!blockStyle) return layoutStyle;
  return { ...layoutStyle, ...blockStyleToCss(blockStyle) };
}

const RADIUS_SCALE_PX: Record<PageTheme['radiusScale'], string> = {
  none: '0px',
  sm: '6px',
  md: '14px',
  lg: '22px',
  pill: '28px',
};

const DENSITY_GAP_PX: Record<PageTheme['density'], string> = {
  compact: '10px',
  comfortable: '16px',
  spacious: '24px',
};

const TYPO_SCALE_FACTOR: Record<PageTheme['typography']['scale'], string> = {
  compact: '0.94',
  balanced: '1',
  editorial: '1.08',
};

/**
 * Traduce un `PageTheme` a variables CSS acotadas (`--e2-page-*`) y fondo de página
 * para `.e2-canvas-root`, compartido entre el editor y el renderizador público.
 */
export function pageThemeToCssVars(theme?: PageTheme): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {
    '--e2-page-primary': theme.palette.primary,
    '--e2-page-accent': theme.palette.accent,
    '--e2-page-surface': theme.palette.surface,
    '--e2-page-surface-muted': theme.palette.surfaceMuted,
    '--e2-page-text': theme.palette.text,
    '--e2-page-text-muted': theme.palette.textMuted,
    '--e2-page-border': theme.palette.border,
    '--e2-page-bg': theme.palette.pageBg,
    '--e2-page-heading-font': `"${theme.typography.headingFont}", sans-serif`,
    '--e2-page-body-font': `"${theme.typography.bodyFont}", sans-serif`,
    '--e2-page-radius': RADIUS_SCALE_PX[theme.radiusScale],
    '--e2-page-gap': DENSITY_GAP_PX[theme.density],
    '--e2-page-scale': TYPO_SCALE_FACTOR[theme.typography.scale],
  };

  const css: CSSProperties = {
    ...(vars as unknown as CSSProperties),
    backgroundColor: theme.palette.pageBg,
    color: theme.palette.text,
    fontFamily: `"${theme.typography.bodyFont}", "Montserrat", sans-serif`,
  };

  if (theme.pageBgGradient && theme.pageBgGradient.stops.length >= 2) {
    const stops = theme.pageBgGradient.stops.join(', ');
    css.backgroundImage =
      theme.pageBgGradient.kind === 'radial'
        ? `radial-gradient(circle, ${stops})`
        : `linear-gradient(${theme.pageBgGradient.angle}deg, ${stops})`;
  }

  return css;
}

const MEDIA_FILTERS: Record<NonNullable<MediaAppearance['filter']>, string | undefined> = {
  none: undefined,
  vivid: 'saturate(1.22) contrast(1.04)',
  contrast: 'contrast(1.16)',
  warm: 'sepia(0.18) saturate(1.12)',
  grayscale: 'grayscale(1)',
};

export function mediaStageStyle(media?: MediaAppearance): CSSProperties {
  if (!media) return {};
  const css: CSSProperties = {};
  if (media.aspect && media.aspect !== 'auto') {
    css.aspectRatio = media.aspect.replace('/', ' / ');
  }
  if (media.radius !== undefined) {
    css.borderRadius = `${media.radius}px`;
    css.overflow = 'hidden';
  }
  return css;
}

export function mediaImageStyle(fit: 'cover' | 'contain', media?: MediaAppearance): CSSProperties {
  const css: CSSProperties = { objectFit: fit };
  if (media?.objectPosition) {
    css.objectPosition = media.objectPosition;
  }
  if (media?.filter && media.filter !== 'none') {
    css.filter = MEDIA_FILTERS[media.filter];
  }
  return css;
}

export function blockMotionClasses(style?: BlockStyle, editing = false): string {
  const classes: string[] = [];
  const entrance = style?.motion?.entrance;
  const hover = style?.motion?.hover;
  if (!editing && entrance && entrance !== 'none') {
    classes.push('e2-anim-in', `e2-anim-in--${entrance}`);
  }
  if (hover && hover !== 'none') {
    classes.push(`e2-hover--${hover}`);
  }
  return classes.join(' ');
}


