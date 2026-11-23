import type { AccordionBlock, BadgeBlock, ButtonBlock, CalloutBlock, DividerBlock, IconBlock, TableBlock, TabsBlock, TextAppearance } from './schema';
import type { BlockStyle, BorderStyle, MediaAppearance } from './styleSchema';

type TemplateSurface = Pick<BlockStyle, 'background' | 'border' | 'radius' | 'padding' | 'shadow' | 'shadowColor' | 'backdropBlur'>;
type TemplateTypography = Pick<TextAppearance, 'font' | 'color'>;
export type IconTemplate = Required<Pick<IconBlock['props'], 'name' | 'size' | 'color' | 'frame'>> & Pick<IconBlock['props'], 'bgColor'>;
export type TableTemplate = Required<Pick<TableBlock['props'], 'accentColor' | 'striped' | 'compact' | 'bordered'>>;
export type CalloutTone = NonNullable<CalloutBlock['props']['tone']>;
export type ButtonTemplate = Required<Pick<ButtonBlock['props'], 'variant' | 'color'>> & Pick<ButtonBlock['props'], 'icon'>;
export const WEEKLY_BUTTON_TEMPLATE = { variant: 'weekly', color: '#604587', icon: 'eye' } satisfies ButtonTemplate;
export type DividerTemplate = Required<Pick<DividerBlock['props'], 'lineStyle' | 'color' | 'thickness' | 'widthPercent'>>;

function photo({
  paper, matte, edge, radius, aspect, caption, padding,
  stroke = 'solid', sides = 'all', wideAspect = aspect,
}: {
  paper: string;
  matte: string;
  edge: string;
  radius: number;
  aspect: NonNullable<MediaAppearance['aspect']>;
  caption: NonNullable<MediaAppearance['captionAlign']> | false;
  padding: number;
  stroke?: BorderStyle['style'];
  sides?: BorderStyle['sides'];
  wideAspect?: MediaAppearance['aspect'];
}) {
  return {
    surface: {
      background: { type: 'solid', color: paper },
      border: { width: stroke === 'none' ? 0 : sides === 'all' ? 1 : 2, style: stroke, sides, color: edge },
      radius: { mode: 'uniform', value: radius + (padding ? 3 : 0) },
      padding: { mode: 'uniform', value: padding },
    } satisfies TemplateSurface,
    media: { aspect, radius, showCaption: caption !== false, captionAlign: caption || 'center', stageBackground: matte } satisfies MediaAppearance,
    wideAspect,
  };
}

function exams(accentColor: string, background: string, borderColor: string, radius: number, compact = false) {
  return {
    accentColor,
    surface: {
      background: { type: 'solid', color: background },
      border: { width: 1, style: 'solid', sides: 'all', color: borderColor },
      radius: { mode: 'uniform', value: radius },
      padding: { mode: 'axis', x: compact ? 12 : 16, y: compact ? 10 : 14 },
    } satisfies TemplateSurface,
  };
}

function structure(accentColor: string, background: string, borderColor: string, radius: number,
  tabStyle: NonNullable<TabsBlock['props']['tabStyle']>, mode: NonNullable<AccordionBlock['props']['mode']> = 'default') {
  return {
    accentColor,
    tabStyle,
    mode,
    surface: {
      background: { type: 'solid', color: background },
      border: { width: 1, style: mode === 'reveal' ? 'dashed' : 'solid', color: borderColor, sides: 'all' },
      radius: { mode: 'uniform', value: radius },
      padding: { mode: 'uniform', value: radius < 8 ? 12 : 16 },
    } satisfies TemplateSurface,
  };
}

function relativeLuminance(color: string) {
  const channel = (start: number) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

export function structureTemplateForText(template: ReturnType<typeof structure>, textColor?: string) {
  const { accentColor, surface } = template;
  if (!textColor) return template;
  const textLight = relativeLuminance(textColor);
  const surfaceLight = relativeLuminance(surface.background.color);
  const contrast = (Math.max(textLight, surfaceLight) + 0.05) / (Math.min(textLight, surfaceLight) + 0.05);
  if (contrast >= 4.5) return template;

  const darkBackground = accentColor.replace(/[a-f0-9]{2}/gi, channel =>
    Math.round(parseInt(channel, 16) * 0.48).toString(16).padStart(2, '0'));
  return { ...template, surface: { ...surface, background: { ...surface.background, color: darkBackground } } };
}

function note(tone: CalloutTone, background: string, color: string, sides: NonNullable<BorderStyle['sides']>,
  stroke: 'solid' | 'dashed' | 'dotted' = 'solid', radius = 10) {
  return {
    tone,
    surface: {
      background: { type: 'solid', color: background },
      border: { width: sides === 'all' ? 1 : 2, style: stroke, sides, color },
      radius: { mode: 'uniform', value: radius },
      padding: { mode: 'axis', x: 14, y: 12 },
    } satisfies TemplateSurface,
  };
}

export const COMPONENT_TEMPLATE_FAMILIES: {
  label: string;
  surface: TemplateSurface;
  type: TemplateTypography;
  headingSurface?: TemplateSurface;
  badge: Required<Pick<BadgeBlock['props'], 'variant' | 'color' | 'size'>> & Pick<BadgeBlock['props'], 'icon'>;
  icon: IconTemplate;
  note: ReturnType<typeof note>;
  table: TableTemplate;
  button: ButtonTemplate;
  divider: DividerTemplate;
  examCarousel: ReturnType<typeof exams>;
  photo: ReturnType<typeof photo>;
  structure: ReturnType<typeof structure>;
}[] = [
  {
    label: 'Texto base', surface: {}, type: {}, badge: { variant: 'outline', color: '#334155', size: 'sm' },
    structure: structure('#334155', '#ffffff', '#cbd5e1', 8, 'underline'),
    photo: photo({ paper: '#ffffff', matte: '#eef2f5', edge: '#cbd5e1', radius: 0, aspect: 'auto',
      caption: 'left', padding: 0, stroke: 'none' }),
    button: { variant: 'outline', color: '#334155' },
    divider: { lineStyle: 'solid', color: '#94a3b8', thickness: 1, widthPercent: 100 },
    examCarousel: exams('#334155', '#ffffff', '#cbd5e1', 8),
    icon: { name: 'microscope', size: 28, frame: 'none', color: '#334155' },
    note: note('info', '#ffffff', '#cbd5e1', 'all'),
    table: { accentColor: '#f1f5f9', bordered: false, striped: false, compact: false },
  },
  {
    label: 'Introducción',
    structure: structure('#234c71', '#f3f8fd', '#b9d4e6', 12, 'cards'),
    photo: photo({ paper: '#f7fafc', matte: '#102a43', edge: '#30739e', radius: 10, aspect: '16/9',
      caption: false, padding: 0, stroke: 'none' }),
    button: { variant: 'solid', color: '#0b2545', icon: 'arrow-right' },
    divider: { lineStyle: 'gradient', color: '#456889', thickness: 2, widthPercent: 100 },
    examCarousel: exams('#234c71', '#f3f8fd', '#b9d4e6', 12),
    icon: { name: 'compass', size: 28, frame: 'circle', color: '#0b2545', bgColor: '#e8f0f8' },
    note: note('info', '#f8fcff', '#b9d4e6', 'top'),
    table: { accentColor: '#e3edf7', bordered: false, striped: true, compact: false },
    badge: { variant: 'soft', color: '#0b2545', size: 'md', icon: 'compass' },
    surface: {},
    type: { font: 'Fraunces', color: '#0b2545' },
    headingSurface: {
      border: { style: 'solid', sides: 'bottom', width: 1, color: '#b9d4e6' },
      padding: { mode: 'custom', b: 7 },
    },
  },
  {
    label: 'Nota de estudio',
    structure: structure('#0369a1', '#eaf6fc', '#9fcfe7', 8, 'underline'),
    photo: photo({ paper: '#f2f9fd', matte: '#e0edf5', edge: '#0284c7', radius: 2, aspect: '4/3',
      caption: 'left', padding: 8, sides: 'left' }),
    button: { variant: 'soft', color: '#0369a1', icon: 'bookmark' },
    divider: { lineStyle: 'solid', color: '#0284c7', thickness: 2, widthPercent: 60 },
    examCarousel: exams('#0369a1', '#eaf6fc', '#b2d9ef', 10, true),
    icon: { name: 'bookmark', size: 24, frame: 'rounded', color: '#0369a1', bgColor: '#e0f2fe' },
    note: note('tip', '#f2f9fd', '#0284c7', 'left'),
    table: { accentColor: '#d7edf9', bordered: true, striped: false, compact: true },
    badge: { variant: 'soft', color: '#0369a1', size: 'sm', icon: 'bookmark' },
    surface: {
      background: { type: 'solid', color: '#f2f9fd' },
      border: { style: 'solid', sides: 'left', width: 3, color: '#0284c7' },
      padding: { mode: 'axis', x: 18, y: 12 },
    },
    type: { color: '#0b2545' },
    headingSurface: {
      border: { style: 'solid', sides: 'bottom', width: 2, color: '#0284c7' },
      padding: { mode: 'custom', b: 6 },
    },
  },
  {
    label: 'Observación',
    structure: structure('#604587', '#f5f0fc', '#cbb9e7', 14, 'pills', 'reveal'),
    photo: photo({ paper: '#f3eff9', matte: '#272139', edge: '#b8a6dc', radius: 12, aspect: '4/3',
      caption: 'center', padding: 8 }),
    button: WEEKLY_BUTTON_TEMPLATE,
    divider: { lineStyle: 'dashed', color: '#765da1', thickness: 2, widthPercent: 80 },
    examCarousel: exams('#604587', '#f5f0fc', '#cbb9e7', 18),
    icon: { name: 'eye', size: 28, frame: 'circle', color: '#604587', bgColor: '#ece6fa' },
    note: note('info', '#f5f3ff', '#b8a6dc', 'all', 'solid', 14),
    table: { accentColor: '#ece6fa', bordered: false, striped: true, compact: true },
    badge: { variant: 'outline', color: '#604587', size: 'md', icon: 'eye' },
    surface: {
      background: { type: 'solid', color: '#f5f3ff' },
      border: { style: 'solid', width: 1, color: '#ddd6fe' },
      radius: { mode: 'uniform', value: 12 },
      padding: { mode: 'uniform', value: 16 },
    },
    type: { color: '#322655' },
    headingSurface: {
      background: { type: 'solid', color: '#ece6fa' },
      border: { style: 'solid', sides: 'left', width: 2, color: '#765da1' },
      padding: { mode: 'axis', x: 12, y: 8 },
    },
  },
  {
    label: 'Idea clave',
    structure: structure('#27634f', '#edf8f3', '#abcdbf', 18, 'pills', 'reveal'),
    photo: photo({ paper: '#eff8f4', matte: '#dbece4', edge: '#43846e', radius: 18, aspect: '1/1',
      wideAspect: '4/3', caption: false, padding: 0, stroke: 'none' }),
    button: { variant: 'pill', color: '#27634f', icon: 'lightbulb' },
    divider: { lineStyle: 'solid', color: '#43846e', thickness: 3, widthPercent: 40 },
    examCarousel: exams('#27634f', '#edf8f3', '#abcdbf', 14),
    icon: { name: 'lightbulb', size: 32, frame: 'rounded', color: '#27634f', bgColor: '#d7eee4' },
    note: note('tip', '#eff8f4', '#43846e', 'top'),
    table: { accentColor: '#d7eee4', bordered: false, striped: true, compact: false },
    badge: { variant: 'solid', color: '#27634f', size: 'sm', icon: 'lightbulb' },
    surface: {
      background: { type: 'solid', color: '#eff8f4' },
      border: { style: 'solid', sides: 'top', width: 2, color: '#43846e' },
      padding: { mode: 'axis', x: 18, y: 14 },
    },
    type: { font: 'Fraunces', color: '#173e31' },
    headingSurface: {
      background: { type: 'solid', color: '#d7eee4' },
      radius: { mode: 'uniform', value: 4 },
      padding: { mode: 'axis', x: 14, y: 8 },
    },
  },
  {
    label: 'Lectura enmarcada',
    structure: structure('#425f79', '#f8fafc', '#91a9bd', 4, 'cards'),
    photo: photo({ paper: '#ffffff', matte: '#edf1f4', edge: '#72859a', radius: 0, aspect: 'auto',
      caption: 'center', padding: 14 }),
    button: { variant: 'outline', color: '#425f79', icon: 'book-open' },
    divider: { lineStyle: 'solid', color: '#5c7791', thickness: 1, widthPercent: 80 },
    examCarousel: exams('#425f79', '#f8fafc', '#91a9bd', 4, true),
    icon: { name: 'book-open', size: 24, frame: 'rounded', color: '#425f79', bgColor: '#ffffff' },
    note: note('info', '#ffffff', '#5c7791', 'all', 'solid', 4),
    table: { accentColor: '#eff3f7', bordered: true, striped: false, compact: false },
    badge: { variant: 'outline', color: '#425f79', size: 'sm', icon: 'book-open' },
    surface: {
      background: { type: 'solid', color: '#ffffff' },
      border: { style: 'solid', width: 1, color: '#5c7791' },
      radius: { mode: 'uniform', value: 4 },
      padding: { mode: 'uniform', value: 16 },
    },
    type: { color: '#173654' },
    headingSurface: {
      border: { style: 'solid', sides: 'top', width: 1, color: '#5c7791' },
      padding: { mode: 'custom', t: 8 },
    },
  },
  {
    label: 'Guía práctica',
    structure: structure('#825515', '#fff8e7', '#d6b77f', 10, 'cards', 'reveal'),
    photo: photo({ paper: '#fff8e9', matte: '#f4e6c9', edge: '#9a6a25', radius: 4, aspect: '4/3',
      wideAspect: '16/9', caption: 'left', padding: 7, stroke: 'dashed' }),
    button: { variant: 'solid', color: '#825515', icon: 'clipboard-list' },
    divider: { lineStyle: 'dashed', color: '#9a6a25', thickness: 2, widthPercent: 100 },
    examCarousel: exams('#825515', '#fff8e7', '#e3c992', 10),
    icon: { name: 'clipboard-list', size: 28, frame: 'rounded', color: '#825515', bgColor: '#fff1d2' },
    note: note('warning', '#fffbeb', '#9a6a25', 'all', 'dashed', 8),
    table: { accentColor: '#fff1d2', bordered: true, striped: true, compact: false },
    badge: { variant: 'soft', color: '#825515', size: 'md', icon: 'clipboard-list' },
    surface: {
      background: { type: 'solid', color: '#fffbeb' },
      border: { style: 'dashed', width: 1, color: '#9a6a25' },
      radius: { mode: 'uniform', value: 8 },
      padding: { mode: 'axis', x: 18, y: 12 },
    },
    type: { color: '#593815' },
    headingSurface: {
      background: { type: 'solid', color: '#fff1d2' },
      border: { style: 'solid', sides: 'left', width: 2, color: '#9a6a25' },
      padding: { mode: 'axis', x: 12, y: 8 },
    },
  },
  {
    label: 'Detalle de lámina',
    structure: structure('#865370', '#fdf4f9', '#e3bccf', 16, 'pills'),
    photo: photo({ paper: '#fff3f6', matte: '#f3e1e7', edge: '#be5677', radius: 2, aspect: '3/4',
      wideAspect: '4/3', caption: 'right', padding: 6, stroke: 'dotted', sides: 'bottom' }),
    button: { variant: 'soft', color: '#865370', icon: 'scan-eye' },
    divider: { lineStyle: 'dashed', color: '#986181', thickness: 1, widthPercent: 60 },
    examCarousel: exams('#865370', '#fdf4f9', '#e3bccf', 16, true),
    icon: { name: 'scan-eye', size: 32, frame: 'circle', color: '#865370', bgColor: '#f8e8f2' },
    note: note('info', '#fdf6fa', '#986181', 'bottom', 'dotted', 8),
    table: { accentColor: '#f8e8f2', bordered: false, striped: false, compact: true },
    badge: { variant: 'swatch', color: '#986181', size: 'md', icon: 'scan-eye' },
    surface: {
      background: { type: 'solid', color: '#fdf6fa' },
      border: { style: 'dotted', sides: 'bottom', width: 2, color: '#986181' },
      padding: { mode: 'axis', x: 14, y: 10 },
    },
    type: { color: '#59334b' },
    headingSurface: {
      border: { style: 'dotted', sides: 'top', width: 2, color: '#986181' },
      padding: { mode: 'custom', t: 8 },
    },
  },
  {
    label: 'Cita',
    structure: structure('#6b5035', '#faf5ed', '#dac7b1', 6, 'underline'),
    photo: photo({ paper: '#faf5ec', matte: '#312923', edge: '#a9895f', radius: 8, aspect: '1/1',
      wideAspect: '16/9', caption: false, padding: 12, sides: 'bottom' }),
    button: { variant: 'soft', color: '#6b5035', icon: 'file-text' },
    divider: { lineStyle: 'gradient', color: '#aa8663', thickness: 1, widthPercent: 40 },
    examCarousel: exams('#6b5035', '#faf5ed', '#dac7b1', 6),
    icon: { name: 'file-text', size: 24, frame: 'none', color: '#6b5035' },
    note: note('info', '#faf7f2', '#aa8663', 'left', 'solid', 4),
    table: { accentColor: '#f1e7db', bordered: false, striped: false, compact: false },
    badge: { variant: 'glass', color: '#6b5035', size: 'sm', icon: 'file-text' },
    surface: {
      background: { type: 'solid', color: '#faf7f2' },
      border: { style: 'solid', sides: 'right', width: 1, color: '#aa8663' },
      padding: { mode: 'axis', x: 20, y: 14 },
    },
    type: { font: 'Playfair Display', color: '#493829' },
    headingSurface: {
      border: { style: 'solid', sides: 'left', width: 1, color: '#aa8663' },
      padding: { mode: 'custom', l: 12 },
    },
  },
  {
    label: 'Definición',
    structure: structure('#255a83', '#e8f2fa', '#a9c9e3', 12, 'cards'),
    photo: photo({ paper: '#eaf6fa', matte: '#daeaf0', edge: '#047e99', radius: 6, aspect: '16/9',
      caption: 'right', padding: 5, sides: 'right' }),
    button: { variant: 'gradient', color: '#255a83', icon: 'layers' },
    divider: { lineStyle: 'solid', color: '#6089ad', thickness: 4, widthPercent: 60 },
    examCarousel: exams('#255a83', '#e8f2fa', '#a9c9e3', 12, true),
    icon: { name: 'layers', size: 28, frame: 'rounded', color: '#255a83', bgColor: '#cfe6f6' },
    note: note('clinical', '#e8f0f8', '#6089ad', 'bottom'),
    table: { accentColor: '#cfe6f6', bordered: true, striped: true, compact: true },
    badge: { variant: 'solid', color: '#255a83', size: 'sm', icon: 'layers' },
    surface: {
      background: { type: 'solid', color: '#e8f0f8' },
      radius: { mode: 'custom', tl: 14, tr: 14, br: 14, bl: 2 },
      padding: { mode: 'uniform', value: 16 },
    },
    type: { color: '#163c60' },
    headingSurface: {
      background: { type: 'solid', color: '#cfe6f6' },
      border: { style: 'solid', sides: 'bottom', width: 1, color: '#6089ad' },
      padding: { mode: 'axis', x: 12, y: 7 },
    },
  },
];
