import { z } from 'zod';
import { richTextSchema, richTextV1Schema } from './richText';
import { GRID_COLUMNS, GRID_MAX_ROW, GRID_STEP, fromGridLine, fromGridSpan } from './gridResolution';
import { blockStyleSchema, mediaAppearanceSchema, pageThemeSchema, responsiveGapSchema } from './styleSchema';

export { richTextSchema, richTextV1Schema };
export type { RichTextV1, RichTextV2, RichTextValue, TextRun } from './richText';

export const EDITOR2_SCHEMA_VERSION = 2 as const;
export const LAYOUT_BREAKPOINTS = ['base', 'md', 'lg'] as const;

const uuidSchema = z.uuid();
const spanSchema = z.number().multipleOf(GRID_STEP).min(GRID_STEP).max(fromGridSpan(GRID_COLUMNS));
const startSchema = z.number().multipleOf(GRID_STEP).min(1).max(fromGridLine(GRID_COLUMNS));

export const imageSrcSchema = z.url().refine((value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'La URL de la imagen debe usar HTTPS');

export const spanIntentSchema = z
  .strictObject({
    span: spanSchema,
    anchor: z.enum(['stretch', 'top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']).optional(),
    flexSize: z.enum(['fit', 'fill', 'fixed']).optional(),
    widthPx: z.number().int().positive().max(4096).optional(),
    minWidthPx: z.number().int().positive().max(4096).optional(),
    maxWidthPx: z.number().int().positive().max(4096).optional(),
    start: startSchema.optional(),
    row: z.number().multipleOf(GRID_STEP).min(1).max(fromGridLine(GRID_MAX_ROW)).optional(),
    rowSpan: spanSchema.optional(),
    verticalAlign: z.enum(['start', 'center', 'end']).optional(),
  })
  .refine(({ minWidthPx, maxWidthPx }) => !minWidthPx || !maxWidthPx || minWidthPx <= maxWidthPx, {
    message: 'El ancho mínimo debe ser menor o igual al máximo',
    path: ['minWidthPx'],
  })
  .refine(({ span, start }) => start === undefined || start + span <= fromGridLine(GRID_COLUMNS + 1), {
    message: 'El bloque no puede exceder las 48 columnas',
    path: ['start'],
  });

export const layoutIntentSchema = z.strictObject({
  base: spanIntentSchema,
  md: spanIntentSchema.optional(),
  lg: spanIntentSchema.optional(),
});

const headingLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const gapSchema = responsiveGapSchema;
export const textSizePresetSchema = z.enum(['normal', 'large', 'extra-large']);
export type TextSizePreset = z.infer<typeof textSizePresetSchema>;
export const headingTextSizePresetSchema = z.enum([...textSizePresetSchema.options, 'jumbo', 'huge']);
export type HeadingTextSizePreset = z.infer<typeof headingTextSizePresetSchema>;

export const EDITOR_FONTS = ['Montserrat', 'Playfair Display', 'Fraunces', 'IBM Plex Mono'] as const;

export const textAppearanceSchema = z.strictObject({
  font: z.enum([...EDITOR_FONTS, 'Georgia', 'Arial']).optional(),
  size: z.number().int().min(8).max(160).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  uppercase: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  lineHeight: z.number().min(1).max(3).optional(),
  letterSpacing: z.number().min(-2).max(12).optional(),
  textStroke: z.boolean().optional(),
  bullets: z.boolean().optional(),
  numbered: z.boolean().optional(),
  bulletStyle: z.enum(['disc', 'check', 'arrow', 'circle-number']).optional(),
  bulletColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export type TextAppearance = z.infer<typeof textAppearanceSchema>;

export const headingBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('heading'),
  props: z.strictObject({
    level: headingLevelSchema,
    text: richTextSchema,
    textSizePreset: headingTextSizePresetSchema.optional(),
    appearance: textAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const textBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('text'),
  props: z.strictObject({
    text: richTextSchema,
    appearance: textAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const imageBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('image'),
  props: z.strictObject({
    src: imageSrcSchema,
    alt: z.string(),
    caption: richTextV1Schema.optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    zoom: z.boolean().optional(),
    media: mediaAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const dividerBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('divider'),
  props: z.strictObject({
    orientation: z.enum(['horizontal', 'vertical']).optional(),
    lineStyle: z.enum(['solid', 'dashed', 'gradient']).optional(),
    thickness: z.number().int().min(1).max(16).optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    label: z.string().max(80).optional(),
    widthPercent: z.number().int().min(20).max(100).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const BUTTON_VARIANTS = ['solid', 'outline', 'soft', 'gradient', 'pill', 'weekly'] as const;
export const buttonVariantSchema = z.enum(BUTTON_VARIANTS);

export const buttonBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('button'),
  props: z.strictObject({
    label: richTextV1Schema,
    href: z.string().max(500),
    textSizePreset: textSizePresetSchema.optional(),
    variant: buttonVariantSchema.optional(),
    newTab: z.boolean().optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    icon: z.string().max(40).optional(),
    thumbnailSrc: imageSrcSchema.optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const tableBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('table'),
  props: z.strictObject({
    headers: z.array(z.string()).min(1).max(12),
    rows: z.array(z.array(z.string()).min(1).max(12)).min(1).max(50),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    striped: z.boolean().optional(),
    compact: z.boolean().optional(),
    bordered: z.boolean().optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const carouselItemSchema = z.strictObject({
  src: imageSrcSchema,
  alt: z.string(),
  caption: z.string().optional(),
});

export const carouselBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('carousel'),
  props: z.strictObject({
    items: z.array(carouselItemSchema).min(1).max(20),
    fit: z.enum(['cover', 'contain']).optional(),
    autoplay: z.boolean().optional(),
    intervalSec: z.number().int().min(2).max(15).optional(),
    showArrows: z.boolean().optional(),
    showDots: z.boolean().optional(),
    zoom: z.boolean().optional(),
    media: mediaAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const videoAppearanceSchema = mediaAppearanceSchema.pick({
  showCaption: true,
  captionAlign: true,
  stageBackground: true,
  radius: true,
});

export const videoBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('video'),
  props: z.strictObject({
    url: z.string().max(1000),
    caption: richTextV1Schema.optional(),
    aspect: z.enum(['16/9', '4/3', '1/1']).optional(),
    media: videoAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const compareBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('compare'),
  props: z.strictObject({
    leftSrc: imageSrcSchema,
    leftLabel: z.string().max(120).optional(),
    rightSrc: imageSrcSchema,
    rightLabel: z.string().max(120).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    caption: z.string().max(500).optional(),
    media: mediaAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const calloutBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('callout'),
  props: z.strictObject({
    tone: z.enum(['info', 'clinical', 'tip', 'warning']).optional(),
    title: richTextV1Schema,
    text: richTextSchema,
    style: blockStyleSchema.optional(),
  }),
});

export const gifBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('gif'),
  props: z.strictObject({
    src: imageSrcSchema,
    alt: z.string(),
    caption: richTextV1Schema.optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    zoom: z.boolean().optional(),
    media: mediaAppearanceSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const badgeBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('badge'),
  props: z.strictObject({
    text: richTextV1Schema,
    variant: z.enum(['solid', 'soft', 'outline', 'glass', 'swatch']).optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    icon: z.string().max(40).optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const iconBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('icon'),
  props: z.strictObject({
    name: z.string().min(1).max(40),
    size: z.number().int().min(16).max(96).optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    bgColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    frame: z.enum(['none', 'circle', 'rounded']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    label: z.string().max(80).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const examParcialSchema = z.enum(['all', 'primer', 'segundo', 'tercer']);
export const examCarouselBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('examCarousel'),
  props: z.strictObject({
    parcial: examParcialSchema,
    title: z.string().max(120).optional(),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    maxItems: z.number().int().min(1).max(24).optional(),
    buttonTextSize: textSizePresetSchema.optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const leafBlockUnionSchema = z.union([
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  dividerBlockSchema,
  buttonBlockSchema,
  tableBlockSchema,
  carouselBlockSchema,
  videoBlockSchema,
  compareBlockSchema,
  calloutBlockSchema,
  gifBlockSchema,
  badgeBlockSchema,
  iconBlockSchema,
  examCarouselBlockSchema,
]);

export const leafPlacedBlockSchema = z.strictObject({
  block: leafBlockUnionSchema,
  layout: layoutIntentSchema,
});

export const innerBoxNodeSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('box'),
  props: z.strictObject({
    gap: gapSchema,
    boxDepth: z.literal(1),
    style: blockStyleSchema.optional(),
  }),
  slots: z.strictObject({
    children: z.array(leafPlacedBlockSchema),
  }),
});

export const innerBoxPlacedSchema = z.strictObject({
  block: innerBoxNodeSchema,
  layout: layoutIntentSchema,
});

export const boxChildPlacedBlockSchema = z.strictObject({
  block: z.union([leafBlockUnionSchema, innerBoxNodeSchema]),
  layout: layoutIntentSchema,
});

export const boxNodeSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('box'),
  props: z.strictObject({
    gap: gapSchema,
    boxDepth: z.literal(0).optional(),
    style: blockStyleSchema.optional(),
  }),
  slots: z.strictObject({
    children: z.array(boxChildPlacedBlockSchema),
  }),
});

export const boxPlacedSchema = z.strictObject({
  block: boxNodeSchema,
  layout: layoutIntentSchema,
});

export const innerCanvasChildPlacedBlockSchema = z.strictObject({
  block: z.union([leafBlockUnionSchema, boxNodeSchema]),
  layout: layoutIntentSchema,
});

export const innerCanvasNodeSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('canvas'),
  props: z.strictObject({
    gap: gapSchema,
    depth: z.literal(1),
    style: blockStyleSchema.optional(),
  }),
  slots: z.strictObject({
    children: z.array(innerCanvasChildPlacedBlockSchema),
  }),
});

export const nestedCanvasPlacedSchema = z.strictObject({
  block: innerCanvasNodeSchema,
  layout: layoutIntentSchema,
});

export const panelChildPlacedBlockSchema = z.union([nestedCanvasPlacedSchema, innerCanvasChildPlacedBlockSchema]);

export const tabItemSchema = z.strictObject({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(160).optional(),
  children: z.array(panelChildPlacedBlockSchema).optional(),
  content: z.string().optional(),
  imageSrc: imageSrcSchema.optional(),
  imageCaption: z.string().optional(),
});

export const tabsBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('tabs'),
  props: z.strictObject({
    items: z.array(tabItemSchema).min(1).max(10),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    tabStyle: z.enum(['underline', 'pills', 'cards']).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const accordionItemSchema = z.strictObject({
  title: z.string().min(1).max(160),
  openByDefault: z.boolean().optional(),
  children: z.array(panelChildPlacedBlockSchema).optional(),
});

export const accordionBlockSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('accordion'),
  props: z.strictObject({
    items: z.array(accordionItemSchema).min(1).max(12),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    mode: z.enum(['default', 'reveal']).optional(),
    style: blockStyleSchema.optional(),
  }),
});

export const canvasChildPlacedBlockSchema = z.strictObject({
  block: z.union([leafBlockUnionSchema, boxNodeSchema, tabsBlockSchema, accordionBlockSchema]),
  layout: layoutIntentSchema,
});

export const nestedCanvasNodeSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('canvas'),
  props: z.strictObject({
    gap: gapSchema,
    depth: z.literal(1),
    style: blockStyleSchema.optional(),
  }),
  slots: z.strictObject({
    children: z.array(canvasChildPlacedBlockSchema),
  }),
});

export const rootPlacedBlockSchema = z.strictObject({
  block: z.union([leafBlockUnionSchema, boxNodeSchema, nestedCanvasNodeSchema, tabsBlockSchema, accordionBlockSchema]),
  layout: layoutIntentSchema,
});

export const rootCanvasNodeSchema = z.strictObject({
  id: uuidSchema,
  type: z.literal('canvas'),
  props: z.strictObject({
    gap: gapSchema,
    depth: z.literal(0),
    minRows: z.number().int().min(1).max(GRID_MAX_ROW).optional(),
    style: blockStyleSchema.optional(),
  }),
  slots: z.strictObject({
    children: z.array(rootPlacedBlockSchema),
  }),
});

const currentDocSchema = z.strictObject({
  schemaVersion: z.literal(EDITOR2_SCHEMA_VERSION),
  pageKey: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'pageKey solo admite minúsculas, números y guiones'),
  pageTheme: pageThemeSchema.optional(),
  root: rootCanvasNodeSchema,
});

export const pageKeySchema = currentDocSchema.shape.pageKey;

// Zod gives the transform a parsed copy. Upgrade each legacy coordinate only once.
const legacyDocSchema = currentDocSchema.extend({ schemaVersion: z.literal(1) }).transform(doc => {
  function doubleGrid(layout: LayoutIntent) {
    for (const intent of Object.values(layout)) {
      intent.span *= 2;
      if (intent.start !== undefined) intent.start = 2 * intent.start - 1;
      if (intent.row !== undefined) intent.row = 2 * intent.row - 1;
      if (intent.rowSpan !== undefined) intent.rowSpan *= 2;
    }
  }
  for (const { block, layout } of doc.root.slots.children) {
    doubleGrid(layout);
    if (block.type === 'canvas') block.slots.children.forEach(child => doubleGrid(child.layout));
    if (block.type === 'tabs' || block.type === 'accordion') {
      block.props.items.forEach(sectionItem => {
        sectionItem.children?.forEach(section => {
          doubleGrid(section.layout);
          if (section.block.type === 'canvas') section.block.slots.children.forEach(child => doubleGrid(child.layout));
        });
      });
    }
  }
  return { ...doc, schemaVersion: EDITOR2_SCHEMA_VERSION };
}).pipe(currentDocSchema);

export const canvasDocSchema = z.union([currentDocSchema, legacyDocSchema]);

export type SpanIntent = z.infer<typeof spanIntentSchema>;
export type LayoutIntent = z.infer<typeof layoutIntentSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type DividerBlock = z.infer<typeof dividerBlockSchema>;
export type ButtonBlock = z.infer<typeof buttonBlockSchema>;
export type TableBlock = z.infer<typeof tableBlockSchema>;
export type CarouselItem = z.infer<typeof carouselItemSchema>;
export type CarouselBlock = z.infer<typeof carouselBlockSchema>;
export type VideoBlock = z.infer<typeof videoBlockSchema>;
export type CompareBlock = z.infer<typeof compareBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type GifBlock = z.infer<typeof gifBlockSchema>;
export type BadgeBlock = z.infer<typeof badgeBlockSchema>;
export type IconBlock = z.infer<typeof iconBlockSchema>;
export type ExamParcial = z.infer<typeof examParcialSchema>;
export type ExamCarouselBlock = z.infer<typeof examCarouselBlockSchema>;
export type TabItem = z.infer<typeof tabItemSchema>;
export type TabsBlock = z.infer<typeof tabsBlockSchema>;
export type AccordionItem = z.infer<typeof accordionItemSchema>;
export type AccordionBlock = z.infer<typeof accordionBlockSchema>;
export type LeafPlacedBlock = z.infer<typeof leafPlacedBlockSchema>;
export type InnerBoxNode = z.infer<typeof innerBoxNodeSchema>;
export type BoxNode = z.infer<typeof boxNodeSchema>;
export type BoxChildPlacedBlock = z.infer<typeof boxChildPlacedBlockSchema>;
export type InnerCanvasNode = z.infer<typeof innerCanvasNodeSchema>;
export type NestedCanvasNode = z.infer<typeof nestedCanvasNodeSchema>;
export type NestedCanvasPlaced = z.infer<typeof nestedCanvasPlacedSchema>;
export type PlacedBlock = z.infer<typeof rootPlacedBlockSchema>;
export type RootCanvasNode = z.infer<typeof rootCanvasNodeSchema>;
export type CanvasDoc = z.infer<typeof canvasDocSchema>;
export type CanvasNode = RootCanvasNode;
export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'gif'
  | 'video'
  | 'compare'
  | 'callout'
  | 'divider'
  | 'button'
  | 'table'
  | 'carousel'
  | 'badge'
  | 'icon'
  | 'examCarousel'
  | 'box'
  | 'tabs'
  | 'accordion'
  | 'canvas';
export type Breakpoint = (typeof LAYOUT_BREAKPOINTS)[number];
export type Gap = z.infer<typeof gapSchema>;
export type { BlockStyle, MediaAppearance, PageTheme } from './styleSchema';
