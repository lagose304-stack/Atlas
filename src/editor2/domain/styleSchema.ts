import { z } from 'zod';

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color hexadecimal inválido (#RRGGBB)');

export const httpsUrlSchema = z.url().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'La URL debe usar HTTPS');

export const gradientStyleSchema = z.strictObject({
  kind: z.enum(['linear', 'radial']),
  angle: z.number().min(0).max(360),
  stops: z.array(hexColorSchema).min(2).max(3),
});

export const backgroundStyleSchema = z.strictObject({
  type: z.enum(['none', 'solid', 'gradient', 'image']),
  color: hexColorSchema.optional(),
  gradient: gradientStyleSchema.optional(),
  imageUrl: httpsUrlSchema.optional(),
  overlayColor: hexColorSchema.optional(),
  overlayOpacity: z.number().min(0).max(1).optional(),
});

export const borderStyleSchema = z.strictObject({
  width: z.number().int().min(0).max(16),
  style: z.enum(['none', 'solid', 'dashed', 'dotted']),
  color: hexColorSchema,
  sides: z.enum(['all', 'top', 'bottom', 'left', 'right']).optional(),
});

export const radiusStyleSchema = z.strictObject({
  mode: z.enum(['uniform', 'custom']),
  value: z.number().int().min(0).max(64).optional(),
  tl: z.number().int().min(0).max(64).optional(),
  tr: z.number().int().min(0).max(64).optional(),
  br: z.number().int().min(0).max(64).optional(),
  bl: z.number().int().min(0).max(64).optional(),
});

export const paddingStyleSchema = z.strictObject({
  mode: z.enum(['uniform', 'axis', 'custom']),
  value: z.number().int().min(0).max(96).optional(),
  x: z.number().int().min(0).max(96).optional(),
  y: z.number().int().min(0).max(96).optional(),
  t: z.number().int().min(0).max(96).optional(),
  r: z.number().int().min(0).max(96).optional(),
  b: z.number().int().min(0).max(96).optional(),
  l: z.number().int().min(0).max(96).optional(),
});

export const shadowPresetSchema = z.enum(['none', 'soft', 'medium', 'elevated', 'glow']);

export const maxWidthSchema = z.enum(['full', '1200', '960', '760', '560']);

export const motionStyleSchema = z.strictObject({
  entrance: z.enum(['none', 'fade', 'slide-up', 'zoom']).optional(),
  hover: z.enum(['none', 'lift', 'glow', 'scale']).optional(),
});

export const blockStyleSchema = z.strictObject({
  background: backgroundStyleSchema.optional(),
  border: borderStyleSchema.optional(),
  radius: radiusStyleSchema.optional(),
  padding: paddingStyleSchema.optional(),
  maxWidth: maxWidthSchema.optional(),
  shadow: shadowPresetSchema.optional(),
  shadowColor: hexColorSchema.optional(),
  opacity: z.number().min(0.1).max(1).optional(),
  backdropBlur: z.number().int().min(0).max(24).optional(),
  motion: motionStyleSchema.optional(),
});

export type GradientStyle = z.infer<typeof gradientStyleSchema>;
export type BackgroundStyle = z.infer<typeof backgroundStyleSchema>;
export type BorderStyle = z.infer<typeof borderStyleSchema>;
export type RadiusStyle = z.infer<typeof radiusStyleSchema>;
export type PaddingStyle = z.infer<typeof paddingStyleSchema>;
export type ShadowPreset = z.infer<typeof shadowPresetSchema>;
export type MaxWidthPreset = z.infer<typeof maxWidthSchema>;
export type MotionStyle = z.infer<typeof motionStyleSchema>;
export type BlockStyle = z.infer<typeof blockStyleSchema>;

/**
 * Estilo inicial sobrio para una nueva Tarjeta / Caja (`box`).
 */
export const DEFAULT_BOX_STYLE: BlockStyle = {
  background: { type: 'solid', color: '#ffffff' },
  border: { width: 1, style: 'solid', color: '#dbe7f3', sides: 'all' },
  radius: { mode: 'uniform', value: 16 },
  padding: { mode: 'uniform', value: 20 },
  shadow: 'soft',
};

export function sanitizeBlockStyle(value: unknown): BlockStyle | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = blockStyleSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const keys = Object.keys(parsed.data);
  return keys.length > 0 ? parsed.data : undefined;
}

export const THEME_FONTS = [
  'Montserrat',
  'Playfair Display',
  'Fraunces',
  'IBM Plex Mono',
  'Georgia',
  'Arial',
] as const;

export const pageThemePaletteSchema = z.strictObject({
  primary: hexColorSchema,
  accent: hexColorSchema,
  surface: hexColorSchema,
  surfaceMuted: hexColorSchema,
  text: hexColorSchema,
  textMuted: hexColorSchema,
  border: hexColorSchema,
  pageBg: hexColorSchema,
});

export const pageThemeSchema = z.strictObject({
  presetId: z.string().max(48).optional(),
  palette: pageThemePaletteSchema,
  pageBgGradient: gradientStyleSchema.optional(),
  typography: z.strictObject({
    headingFont: z.enum(THEME_FONTS),
    bodyFont: z.enum(THEME_FONTS),
    scale: z.enum(['compact', 'balanced', 'editorial']),
  }),
  radiusScale: z.enum(['none', 'sm', 'md', 'lg', 'pill']),
  density: z.enum(['compact', 'comfortable', 'spacious']),
});

export type PageThemePalette = z.infer<typeof pageThemePaletteSchema>;
export type PageTheme = z.infer<typeof pageThemeSchema>;

export type AtlasPageThemePreset = {
  id: string;
  name: string;
  description: string;
  theme: PageTheme;
};

export const ATLAS_PAGE_THEMES: readonly AtlasPageThemePreset[] = [
  {
    id: 'atlas-clinico',
    name: 'Atlas Clínico',
    description: 'Azul limpio de laboratorio con superficies claras.',
    theme: {
      presetId: 'atlas-clinico',
      palette: {
        primary: '#0284c7',
        accent: '#06b6d4',
        surface: '#ffffff',
        surfaceMuted: '#f2f9fd',
        text: '#0b2545',
        textMuted: '#57708f',
        border: '#d3e4f1',
        pageBg: '#f8fcff',
      },
      typography: { headingFont: 'Montserrat', bodyFont: 'Montserrat', scale: 'balanced' },
      radiusScale: 'md',
      density: 'comfortable',
    },
  },
  {
    id: 'editorial-violeta',
    name: 'Editorial H&E',
    description: 'Tonos hematoxilina y eosina con títulos serif.',
    theme: {
      presetId: 'editorial-violeta',
      palette: {
        primary: '#6d28d9',
        accent: '#db2777',
        surface: '#ffffff',
        surfaceMuted: '#f5f3ff',
        text: '#1e1b4b',
        textMuted: '#5b537a',
        border: '#ddd6fe',
        pageBg: '#faf8ff',
      },
      typography: { headingFont: 'Fraunces', bodyFont: 'Montserrat', scale: 'editorial' },
      radiusScale: 'lg',
      density: 'comfortable',
    },
  },
  {
    id: 'lamina-laboratorio',
    name: 'Lámina de Laboratorio',
    description: 'Verde esmeralda sobrio con detalles monoespaciados.',
    theme: {
      presetId: 'lamina-laboratorio',
      palette: {
        primary: '#0f766e',
        accent: '#0284c7',
        surface: '#ffffff',
        surfaceMuted: '#ecfdf5',
        text: '#0f2926',
        textMuted: '#476b66',
        border: '#bbf7d0',
        pageBg: '#f4fbf9',
      },
      typography: { headingFont: 'Fraunces', bodyFont: 'Montserrat', scale: 'balanced' },
      radiusScale: 'md',
      density: 'comfortable',
    },
  },
  {
    id: 'microscopia-oscura',
    name: 'Microscopía Oscura',
    description: 'Fondo oscuro de alto enfoque para micrografías.',
    theme: {
      presetId: 'microscopia-oscura',
      palette: {
        primary: '#38bdf8',
        accent: '#22d3ee',
        surface: '#12233d',
        surfaceMuted: '#1b3152',
        text: '#f1f5f9',
        textMuted: '#94a3b8',
        border: '#2a4365',
        pageBg: '#0b1628',
      },
      typography: { headingFont: 'Montserrat', bodyFont: 'Montserrat', scale: 'balanced' },
      radiusScale: 'md',
      density: 'comfortable',
    },
  },
  {
    id: 'papel-academico',
    name: 'Papel Académico',
    description: 'Superficie cálida editorial para lecturas extensas.',
    theme: {
      presetId: 'papel-academico',
      palette: {
        primary: '#9a3412',
        accent: '#b45309',
        surface: '#ffffff',
        surfaceMuted: '#fef7ed',
        text: '#1f2937',
        textMuted: '#57534e',
        border: '#e7e5e4',
        pageBg: '#faf7f2',
      },
      typography: { headingFont: 'Playfair Display', bodyFont: 'Georgia', scale: 'editorial' },
      radiusScale: 'sm',
      density: 'spacious',
    },
  },
  {
    id: 'contraste-alto',
    name: 'Contraste Alto',
    description: 'Máxima legibilidad y bordes nítidos.',
    theme: {
      presetId: 'contraste-alto',
      palette: {
        primary: '#0369a1',
        accent: '#1d4ed8',
        surface: '#ffffff',
        surfaceMuted: '#f1f5f9',
        text: '#020617',
        textMuted: '#334155',
        border: '#0f172a',
        pageBg: '#ffffff',
      },
      typography: { headingFont: 'Montserrat', bodyFont: 'Montserrat', scale: 'balanced' },
      radiusScale: 'sm',
      density: 'compact',
    },
  },
];

export function sanitizePageTheme(value: unknown): PageTheme | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = pageThemeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export const mediaAppearanceSchema = z.strictObject({
  aspect: z.enum(['auto', '16/9', '4/3', '1/1', '3/4']).optional(),
  objectPosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
  radius: z.number().int().min(0).max(48).optional(),
  filter: z.enum(['none', 'vivid', 'contrast', 'warm', 'grayscale']).optional(),
  overlayBadge: z.string().max(60).optional(),
  overlayPosition: z.enum(['tl', 'tr', 'bl', 'br']).optional(),
});

export type MediaAppearance = z.infer<typeof mediaAppearanceSchema>;

export function sanitizeMediaAppearance(value: unknown): MediaAppearance | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = mediaAppearanceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return Object.keys(parsed.data).length > 0 ? parsed.data : undefined;
}


