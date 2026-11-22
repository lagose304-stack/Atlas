import type { Data } from '@puckeditor/core';
import {
  canvasDocSchema,
  buttonVariantSchema,
  headingTextSizePresetSchema,
  textSizePresetSchema,
  imageSrcSchema,
  type AccordionItem,
  type BlockStyle,
  type ButtonBlock,
  type CanvasDoc,
  type CarouselItem,
  type Gap,
  type HeadingTextSizePreset,
  type LayoutIntent,
  type MediaAppearance,
  type PageTheme,
  type RichTextV1,
  type RichTextV2,
  type RichTextValue,
  type TabItem,
  type TextAppearance,
  type TextSizePreset,
} from '../domain/schema';
import { richTextToPlain, sanitizeRichTextV2 } from '../domain/richText';
import { sanitizeBlockStyle, sanitizeMediaAppearance, sanitizePageTheme } from '../domain/styleSchema';

export const EDITOR2_PUCK_TYPES = [
  'heading',
  'text',
  'image',
  'gif',
  'video',
  'compare',
  'callout',
  'divider',
  'button',
  'table',
  'carousel',
  'badge',
  'icon',
  'examCarousel',
  'box',
  'tabs',
  'accordion',
  'canvas',
] as const;
export type Editor2PuckType = (typeof EDITOR2_PUCK_TYPES)[number];

export type Editor2PuckRootProps = {
  rootId: string;
  pageKey: string;
  gap: Gap;
  minRows?: number;
  pageTheme?: PageTheme;
};

export type PuckHeadingData = {
  type: 'heading';
  props: {
    id: string;
    layout: LayoutIntent;
    level: 1 | 2 | 3;
    text: string;
    textSizePreset?: HeadingTextSizePreset;
    richText?: RichTextV2;
    appearance?: TextAppearance;
    style?: BlockStyle;
  };
};

export type PuckTextData = {
  type: 'text';
  props: {
    id: string;
    layout: LayoutIntent;
    text: string;
    richText?: RichTextV2;
    appearance?: TextAppearance;
    style?: BlockStyle;
  };
};

export type PuckImageData = {
  type: 'image';
  props: {
    id: string;
    layout: LayoutIntent;
    src: string;
    alt: string;
    caption?: string;
    fit?: 'cover' | 'contain';
    zoom?: boolean;
    media?: MediaAppearance;
    style?: BlockStyle;
  };
};

export type PuckDividerData = {
  type: 'divider';
  props: {
    id: string;
    layout: LayoutIntent;
    orientation?: 'horizontal' | 'vertical';
    lineStyle?: 'solid' | 'dashed' | 'gradient';
    thickness?: number;
    color?: string;
    label?: string;
    widthPercent?: number;
    style?: BlockStyle;
  };
};

export type PuckButtonData = {
  type: 'button';
  props: {
    id: string;
    layout: LayoutIntent;
    label: string;
    href: string;
    textSizePreset?: TextSizePreset;
    variant?: ButtonBlock['props']['variant'];
    newTab?: boolean;
    color?: string;
    icon?: string;
    thumbnailSrc?: string;
    align?: 'left' | 'center' | 'right';
    style?: BlockStyle;
  };
};

export type PuckTableData = {
  type: 'table';
  props: {
    id: string;
    layout: LayoutIntent;
    headers: string[];
    rows: string[][];
    accentColor?: string;
    striped?: boolean;
    compact?: boolean;
    bordered?: boolean;
    style?: BlockStyle;
  };
};

export type PuckCarouselData = {
  type: 'carousel';
  props: {
    id: string;
    layout: LayoutIntent;
    items: CarouselItem[];
    fit?: 'cover' | 'contain';
    autoplay?: boolean;
    intervalSec?: number;
    showArrows?: boolean;
    showDots?: boolean;
    zoom?: boolean;
    media?: MediaAppearance;
    style?: BlockStyle;
  };
};

export type PuckVideoData = {
  type: 'video';
  props: {
    id: string;
    layout: LayoutIntent;
    url: string;
    caption?: string;
    aspect?: '16/9' | '4/3' | '1/1';
    style?: BlockStyle;
  };
};

export type PuckCompareData = {
  type: 'compare';
  props: {
    id: string;
    layout: LayoutIntent;
    leftSrc: string;
    leftLabel?: string;
    rightSrc: string;
    rightLabel?: string;
    fit?: 'cover' | 'contain';
    caption?: string;
    media?: MediaAppearance;
    style?: BlockStyle;
  };
};

export type PuckCalloutData = {
  type: 'callout';
  props: {
    id: string;
    layout: LayoutIntent;
    tone?: 'info' | 'clinical' | 'tip' | 'warning';
    title: string;
    text: string;
    richText?: RichTextV2;
    style?: BlockStyle;
  };
};

export type PuckGifData = {
  type: 'gif';
  props: {
    id: string;
    layout: LayoutIntent;
    src: string;
    alt: string;
    caption?: string;
    fit?: 'cover' | 'contain';
    zoom?: boolean;
    media?: MediaAppearance;
    style?: BlockStyle;
  };
};

export type PuckBadgeData = {
  type: 'badge';
  props: {
    id: string;
    layout: LayoutIntent;
    text: string;
    variant?: 'solid' | 'soft' | 'outline' | 'glass' | 'swatch';
    color?: string;
    icon?: string;
    size?: 'sm' | 'md' | 'lg';
    align?: 'left' | 'center' | 'right';
    style?: BlockStyle;
  };
};

export type PuckIconData = {
  type: 'icon';
  props: {
    id: string;
    layout: LayoutIntent;
    name: string;
    size?: number;
    color?: string;
    bgColor?: string;
    frame?: 'none' | 'circle' | 'rounded';
    align?: 'left' | 'center' | 'right';
    label?: string;
    style?: BlockStyle;
  };
};

export type PuckExamCarouselData = {
  type: 'examCarousel';
  props: {
    id: string;
    layout: LayoutIntent;
    parcial: 'all' | 'primer' | 'segundo' | 'tercer';
    title?: string;
    accentColor?: string;
    maxItems?: number;
    buttonTextSize?: TextSizePreset;
    style?: BlockStyle;
  };
};

export type PuckTabItem = {
  title: string;
  subtitle?: string;
  content: PuckBlockData[];
};

export type PuckTabsData = {
  type: 'tabs';
  props: {
    id: string;
    layout: LayoutIntent;
    items: PuckTabItem[];
    accentColor?: string;
    tabStyle?: 'underline' | 'pills' | 'cards';
    style?: BlockStyle;
  };
};

export type PuckAccordionItem = {
  title: string;
  openByDefault?: boolean;
  content: PuckBlockData[];
};

export type PuckAccordionData = {
  type: 'accordion';
  props: {
    id: string;
    layout: LayoutIntent;
    items: PuckAccordionItem[];
    accentColor?: string;
    mode?: 'default' | 'reveal';
    style?: BlockStyle;
  };
};

export type PuckBoxData = {
  type: 'box';
  props: {
    id: string;
    layout: LayoutIntent;
    gap: Gap;
    style?: BlockStyle;
    content: PuckBlockData[];
  };
};

export type PuckCanvasData = {
  type: 'canvas';
  props: {
    id: string;
    layout: LayoutIntent;
    gap: Gap;
    style?: BlockStyle;
    content: PuckBlockData[];
  };
};

export type PuckBlockData =
  | PuckHeadingData
  | PuckTextData
  | PuckImageData
  | PuckGifData
  | PuckVideoData
  | PuckCompareData
  | PuckCalloutData
  | PuckDividerData
  | PuckButtonData
  | PuckTableData
  | PuckCarouselData
  | PuckBadgeData
  | PuckIconData
  | PuckExamCarouselData
  | PuckBoxData
  | PuckTabsData
  | PuckAccordionData
  | PuckCanvasData;

export type Editor2PuckData = {
  root: { props: Editor2PuckRootProps };
  content: PuckBlockData[];
};

type AnyBlockLike =
  | { id: string; type: 'heading'; props: { level: 1 | 2 | 3; text: RichTextValue; textSizePreset?: HeadingTextSizePreset; appearance?: TextAppearance; style?: BlockStyle } }
  | { id: string; type: 'text'; props: { text: RichTextValue; appearance?: TextAppearance; style?: BlockStyle } }
  | {
      id: string;
      type: 'image';
      props: { src: string; alt: string; caption?: RichTextV1; fit?: 'cover' | 'contain'; zoom?: boolean; media?: MediaAppearance; style?: BlockStyle };
    }
  | {
      id: string;
      type: 'divider';
      props: {
        orientation?: 'horizontal' | 'vertical';
        lineStyle?: 'solid' | 'dashed' | 'gradient';
        thickness?: number;
        color?: string;
        label?: string;
        widthPercent?: number;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'button';
      props: {
        label: RichTextV1;
        href: string;
        textSizePreset?: TextSizePreset;
        variant?: ButtonBlock['props']['variant'];
        newTab?: boolean;
        color?: string;
        icon?: string;
        thumbnailSrc?: string;
        align?: 'left' | 'center' | 'right';
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'table';
      props: {
        headers: string[];
        rows: string[][];
        accentColor?: string;
        striped?: boolean;
        compact?: boolean;
        bordered?: boolean;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'carousel';
      props: {
        items: CarouselItem[];
        fit?: 'cover' | 'contain';
        autoplay?: boolean;
        intervalSec?: number;
        showArrows?: boolean;
        showDots?: boolean;
        zoom?: boolean;
        media?: MediaAppearance;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'video';
      props: {
        url: string;
        caption?: RichTextV1;
        aspect?: '16/9' | '4/3' | '1/1';
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'compare';
      props: {
        leftSrc: string;
        leftLabel?: string;
        rightSrc: string;
        rightLabel?: string;
        fit?: 'cover' | 'contain';
        caption?: string;
        media?: MediaAppearance;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'callout';
      props: {
        tone?: 'info' | 'clinical' | 'tip' | 'warning';
        title: RichTextV1;
        text: RichTextValue;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'gif';
      props: {
        src: string;
        alt: string;
        caption?: RichTextV1;
        fit?: 'cover' | 'contain';
        zoom?: boolean;
        media?: MediaAppearance;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'badge';
      props: {
        text: RichTextV1;
        variant?: 'solid' | 'soft' | 'outline' | 'glass' | 'swatch';
        color?: string;
        icon?: string;
        size?: 'sm' | 'md' | 'lg';
        align?: 'left' | 'center' | 'right';
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'icon';
      props: {
        name: string;
        size?: number;
        color?: string;
        bgColor?: string;
        frame?: 'none' | 'circle' | 'rounded';
        align?: 'left' | 'center' | 'right';
        label?: string;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'examCarousel';
      props: {
        parcial: 'all' | 'primer' | 'segundo' | 'tercer';
        title?: string;
        accentColor?: string;
        maxItems?: number;
        buttonTextSize?: TextSizePreset;
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'tabs';
      props: {
        items: TabItem[];
        accentColor?: string;
        tabStyle?: 'underline' | 'pills' | 'cards';
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'accordion';
      props: {
        items: AccordionItem[];
        accentColor?: string;
        mode?: 'default' | 'reveal';
        style?: BlockStyle;
      };
    }
  | {
      id: string;
      type: 'box';
      props: { gap: Gap; boxDepth?: 0 | 1; style?: BlockStyle };
      slots: { children: AnyPlacedLike[] };
    }
  | {
      id: string;
      type: 'canvas';
      props: { gap: Gap; depth: 1; style?: BlockStyle };
      slots: { children: AnyPlacedLike[] };
    };

type AnyPlacedLike = {
  block: AnyBlockLike;
  layout: LayoutIntent;
};

function expectedUuidLength(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Puck exige ids con el prefijo del tipo (`heading-<uuid>`) para su árbol
 * interno. El documento de Atlas conserva solo el UUID.
 */
export function toPuckId(type: Editor2PuckType, id: string): string {
  return `${type}-${id}`;
}

export function toAtlasId(type: Editor2PuckType, puckId: string): string {
  const prefix = `${type}-`;
  if (!puckId.startsWith(prefix)) return puckId;
  const candidate = puckId.slice(prefix.length);
  return expectedUuidLength(candidate) ? candidate : puckId;
}

function textFromRichText(text: RichTextValue): string {
  return richTextToPlain(text);
}

function richTextFromPuck(text: unknown, richText: unknown): RichTextValue {
  const cleanRich = sanitizeRichTextV2(richText);
  if (cleanRich && cleanRich.runs.length > 0) return cleanRich;
  return richTextFromPlain(text);
}

function richTextFromPlain(value: unknown): RichTextV1 {
  return { format: 'plain', value: typeof value === 'string' ? value : '' };
}

function normalizeLevel(value: unknown): 1 | 2 | 3 {
  const num = typeof value === 'string' ? Number(value) : value;
  return num === 1 || num === 3 ? num : 2;
}

function normalizeHexColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function normalizeThickness(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && Number.isInteger(num) && num >= 1 && num <= 16 ? num : undefined;
}

function puckFromPlaced(item: AnyPlacedLike): PuckBlockData {
  const layout = item.layout;
  const styleProp = item.block.props.style ? { style: item.block.props.style } : {};

  switch (item.block.type) {
    case 'heading':
      return {
        type: 'heading',
        props: {
          id: toPuckId('heading', item.block.id),
          layout,
          level: item.block.props.level,
          ...(item.block.props.textSizePreset ? { textSizePreset: item.block.props.textSizePreset } : {}),
          text: textFromRichText(item.block.props.text),
          ...(item.block.props.text.format === 'rich' ? { richText: item.block.props.text } : {}),
          ...(item.block.props.appearance && { appearance: item.block.props.appearance }),
          ...styleProp,
        },
      };
    case 'text':
      return {
        type: 'text',
        props: {
          id: toPuckId('text', item.block.id),
          layout,
          text: textFromRichText(item.block.props.text),
          ...(item.block.props.text.format === 'rich' ? { richText: item.block.props.text } : {}),
          ...(item.block.props.appearance && { appearance: item.block.props.appearance }),
          ...styleProp,
        },
      };
    case 'image':
      return {
        type: 'image',
        props: {
          id: toPuckId('image', item.block.id),
          layout,
          src: item.block.props.src,
          alt: item.block.props.alt,
          ...(item.block.props.caption === undefined
            ? {}
            : { caption: textFromRichText(item.block.props.caption) }),
          ...(item.block.props.fit ? { fit: item.block.props.fit } : {}),
          ...(item.block.props.zoom !== undefined ? { zoom: item.block.props.zoom } : {}),
          ...(item.block.props.media ? { media: item.block.props.media } : {}),
          ...styleProp,
        },
      };
    case 'divider':
      return {
        type: 'divider',
        props: {
          id: toPuckId('divider', item.block.id),
          layout,
          ...(item.block.props.orientation ? { orientation: item.block.props.orientation } : {}),
          ...(item.block.props.lineStyle ? { lineStyle: item.block.props.lineStyle } : {}),
          ...(item.block.props.thickness ? { thickness: item.block.props.thickness } : {}),
          ...(item.block.props.color ? { color: item.block.props.color } : {}),
          ...(item.block.props.label ? { label: item.block.props.label } : {}),
          ...(item.block.props.widthPercent ? { widthPercent: item.block.props.widthPercent } : {}),
          ...styleProp,
        },
      };
    case 'button':
      return {
        type: 'button',
        props: {
          id: toPuckId('button', item.block.id),
          layout,
          label: textFromRichText(item.block.props.label),
          href: item.block.props.href,
          ...(item.block.props.textSizePreset ? { textSizePreset: item.block.props.textSizePreset } : {}),
          ...(item.block.props.thumbnailSrc ? { thumbnailSrc: item.block.props.thumbnailSrc } : {}),
          ...(item.block.props.variant ? { variant: item.block.props.variant } : {}),
          ...(item.block.props.newTab !== undefined ? { newTab: item.block.props.newTab } : {}),
          ...(item.block.props.color ? { color: item.block.props.color } : {}),
          ...(item.block.props.icon ? { icon: item.block.props.icon } : {}),
          ...(item.block.props.align ? { align: item.block.props.align } : {}),
          ...styleProp,
        },
      };
    case 'table':
      return {
        type: 'table',
        props: {
          id: toPuckId('table', item.block.id),
          layout,
          headers: item.block.props.headers,
          rows: item.block.props.rows,
          ...(item.block.props.accentColor ? { accentColor: item.block.props.accentColor } : {}),
          ...(item.block.props.striped !== undefined ? { striped: item.block.props.striped } : {}),
          ...(item.block.props.compact !== undefined ? { compact: item.block.props.compact } : {}),
          ...(item.block.props.bordered !== undefined ? { bordered: item.block.props.bordered } : {}),
          ...styleProp,
        },
      };
    case 'carousel':
      return {
        type: 'carousel',
        props: {
          id: toPuckId('carousel', item.block.id),
          layout,
          items: item.block.props.items,
          ...(item.block.props.fit ? { fit: item.block.props.fit } : {}),
          ...(item.block.props.autoplay !== undefined ? { autoplay: item.block.props.autoplay } : {}),
          ...(item.block.props.intervalSec !== undefined ? { intervalSec: item.block.props.intervalSec } : {}),
          ...(item.block.props.showArrows !== undefined ? { showArrows: item.block.props.showArrows } : {}),
          ...(item.block.props.showDots !== undefined ? { showDots: item.block.props.showDots } : {}),
          ...(item.block.props.zoom !== undefined ? { zoom: item.block.props.zoom } : {}),
          ...(item.block.props.media ? { media: item.block.props.media } : {}),
          ...styleProp,
        },
      };
    case 'video':
      return {
        type: 'video',
        props: {
          id: toPuckId('video', item.block.id),
          layout,
          url: item.block.props.url,
          ...(item.block.props.caption === undefined
            ? {}
            : { caption: textFromRichText(item.block.props.caption) }),
          ...(item.block.props.aspect ? { aspect: item.block.props.aspect } : {}),
          ...styleProp,
        },
      };
    case 'compare':
      return {
        type: 'compare',
        props: {
          id: toPuckId('compare', item.block.id),
          layout,
          leftSrc: item.block.props.leftSrc,
          ...(item.block.props.leftLabel ? { leftLabel: item.block.props.leftLabel } : {}),
          rightSrc: item.block.props.rightSrc,
          ...(item.block.props.fit ? { fit: item.block.props.fit } : {}),
          ...(item.block.props.rightLabel ? { rightLabel: item.block.props.rightLabel } : {}),
          ...(item.block.props.caption ? { caption: item.block.props.caption } : {}),
          ...(item.block.props.media ? { media: item.block.props.media } : {}),
          ...styleProp,
        },
      };
    case 'callout':
      return {
        type: 'callout',
        props: {
          id: toPuckId('callout', item.block.id),
          layout,
          ...(item.block.props.tone ? { tone: item.block.props.tone } : {}),
          title: textFromRichText(item.block.props.title),
          text: textFromRichText(item.block.props.text),
          ...(item.block.props.text.format === 'rich' ? { richText: item.block.props.text } : {}),
          ...styleProp,
        },
      };
    case 'gif':
      return {
        type: 'gif',
        props: {
          id: toPuckId('gif', item.block.id),
          layout,
          src: item.block.props.src,
          alt: item.block.props.alt,
          ...(item.block.props.caption === undefined
            ? {}
            : { caption: textFromRichText(item.block.props.caption) }),
          ...(item.block.props.fit ? { fit: item.block.props.fit } : {}),
          ...(item.block.props.zoom !== undefined ? { zoom: item.block.props.zoom } : {}),
          ...(item.block.props.media ? { media: item.block.props.media } : {}),
          ...styleProp,
        },
      };
    case 'badge':
      return {
        type: 'badge',
        props: {
          id: toPuckId('badge', item.block.id),
          layout,
          text: textFromRichText(item.block.props.text),
          ...(item.block.props.variant ? { variant: item.block.props.variant } : {}),
          ...(item.block.props.color ? { color: item.block.props.color } : {}),
          ...(item.block.props.icon ? { icon: item.block.props.icon } : {}),
          ...(item.block.props.size ? { size: item.block.props.size } : {}),
          ...(item.block.props.align ? { align: item.block.props.align } : {}),
          ...styleProp,
        },
      };
    case 'icon':
      return {
        type: 'icon',
        props: {
          id: toPuckId('icon', item.block.id),
          layout,
          name: item.block.props.name,
          ...(item.block.props.size !== undefined ? { size: item.block.props.size } : {}),
          ...(item.block.props.color ? { color: item.block.props.color } : {}),
          ...(item.block.props.bgColor ? { bgColor: item.block.props.bgColor } : {}),
          ...(item.block.props.frame ? { frame: item.block.props.frame } : {}),
          ...(item.block.props.align ? { align: item.block.props.align } : {}),
          ...(item.block.props.label ? { label: item.block.props.label } : {}),
          ...styleProp,
        },
      };
    case 'examCarousel':
      return {
        type: 'examCarousel',
        props: {
          id: toPuckId('examCarousel', item.block.id),
          layout,
          parcial: item.block.props.parcial,
          ...(item.block.props.title ? { title: item.block.props.title } : {}),
          ...(item.block.props.accentColor ? { accentColor: item.block.props.accentColor } : {}),
          ...(item.block.props.maxItems !== undefined ? { maxItems: item.block.props.maxItems } : {}),
          ...(item.block.props.buttonTextSize ? { buttonTextSize: item.block.props.buttonTextSize } : {}),
          ...styleProp,
        },
      };
    case 'tabs':
      return {
        type: 'tabs',
        props: {
          id: toPuckId('tabs', item.block.id),
          layout,
          items: item.block.props.items.map((tab) => ({
            title: tab.title,
            ...(tab.subtitle ? { subtitle: tab.subtitle } : {}),
            content: Array.isArray(tab.children)
              ? tab.children.map(puckFromPlaced)
              : [],
          })),
          ...(item.block.props.accentColor ? { accentColor: item.block.props.accentColor } : {}),
          ...(item.block.props.tabStyle ? { tabStyle: item.block.props.tabStyle } : {}),
          ...styleProp,
        },
      };
    case 'accordion':
      return {
        type: 'accordion',
        props: {
          id: toPuckId('accordion', item.block.id),
          layout,
          items: item.block.props.items.map((sectionItem) => ({
            title: sectionItem.title,
            ...(sectionItem.openByDefault !== undefined ? { openByDefault: sectionItem.openByDefault } : {}),
            content: Array.isArray(sectionItem.children)
              ? sectionItem.children.map(puckFromPlaced)
              : [],
          })),
          ...(item.block.props.accentColor ? { accentColor: item.block.props.accentColor } : {}),
          ...(item.block.props.mode ? { mode: item.block.props.mode } : {}),
          ...styleProp,
        },
      };
    case 'box':
      return {
        type: 'box',
        props: {
          id: toPuckId('box', item.block.id),
          layout,
          gap: item.block.props.gap,
          ...styleProp,
          content: item.block.slots.children.map(puckFromPlaced),
        },
      };
    case 'canvas':
      return {
        type: 'canvas',
        props: {
          id: toPuckId('canvas', item.block.id),
          layout,
          gap: item.block.props.gap,
          ...styleProp,
          content: item.block.slots.children.map(puckFromPlaced),
        },
      };
    default:
      throw new Error(`Tipo de bloque no soportado por Puck: ${String((item.block as { type: string }).type)}`);
  }
}

function placedFromPuck(item: PuckBlockData, insideBox = false): AnyPlacedLike {
  const layout = item.props.layout;
  const cleanStyle = sanitizeBlockStyle((item.props as { style?: unknown }).style);
  const styleProp = cleanStyle ? { style: cleanStyle } : {};

  switch (item.type) {
    case 'heading': {
      const textSizePreset = headingTextSizePresetSchema.safeParse(item.props.textSizePreset).data;
      return {
        block: {
          id: toAtlasId('heading', item.props.id),
          type: 'heading',
          props: {
            level: normalizeLevel(item.props.level),
            ...(textSizePreset ? { textSizePreset } : {}),
            text: richTextFromPuck(item.props.text, item.props.richText),
            ...(item.props.appearance && { appearance: item.props.appearance }),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'text':
      return {
        block: {
          id: toAtlasId('text', item.props.id),
          type: 'text',
          props: {
            text: richTextFromPuck(item.props.text, item.props.richText),
            ...(item.props.appearance && { appearance: item.props.appearance }),
            ...styleProp,
          },
        },
        layout,
      };
    case 'image': {
      const zoom = normalizeBoolean(item.props.zoom);
      const media = sanitizeMediaAppearance(item.props.media);
      return {
        block: {
          id: toAtlasId('image', item.props.id),
          type: 'image',
          props: {
            src: item.props.src,
            alt: typeof item.props.alt === 'string' ? item.props.alt : '',
            ...(typeof item.props.caption === 'string'
              ? { caption: richTextFromPlain(item.props.caption) }
              : {}),
            ...(item.props.fit === 'cover' || item.props.fit === 'contain' ? { fit: item.props.fit } : {}),
            ...(zoom !== undefined ? { zoom } : {}),
            ...(media ? { media } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'divider': {
      const thickness = normalizeThickness(item.props.thickness);
      const color = normalizeHexColor(item.props.color);
      const rawWidth = typeof item.props.widthPercent === 'string' ? Number(item.props.widthPercent) : item.props.widthPercent;
      const widthPercent =
        typeof rawWidth === 'number' && Number.isInteger(rawWidth) && rawWidth >= 20 && rawWidth <= 100
          ? rawWidth
          : undefined;
      const label = typeof item.props.label === 'string' && item.props.label.trim() ? item.props.label.trim().slice(0, 80) : undefined;
      return {
        block: {
          id: toAtlasId('divider', item.props.id),
          type: 'divider',
          props: {
            ...(item.props.orientation === 'horizontal' || item.props.orientation === 'vertical'
              ? { orientation: item.props.orientation }
              : {}),
            ...(item.props.lineStyle === 'solid' ||
            item.props.lineStyle === 'dashed' ||
            item.props.lineStyle === 'gradient'
              ? { lineStyle: item.props.lineStyle }
              : {}),
            ...(thickness !== undefined ? { thickness } : {}),
            ...(color ? { color } : {}),
            ...(label ? { label } : {}),
            ...(widthPercent !== undefined ? { widthPercent } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'button': {
      const variant = buttonVariantSchema.safeParse(item.props.variant).data;
      const textSizePreset = textSizePresetSchema.safeParse(item.props.textSizePreset).data;
      const thumbnailSrc = imageSrcSchema.safeParse(item.props.thumbnailSrc).data;
      const newTab = normalizeBoolean(item.props.newTab);
      const color = normalizeHexColor(item.props.color);
      const icon = typeof item.props.icon === 'string' && item.props.icon.trim() ? item.props.icon.trim().slice(0, 40) : undefined;
      const align =
        item.props.align === 'left' || item.props.align === 'center' || item.props.align === 'right'
          ? item.props.align
          : undefined;
      return {
        block: {
          id: toAtlasId('button', item.props.id),
          type: 'button',
          props: {
            label: richTextFromPlain(item.props.label),
            href: typeof item.props.href === 'string' ? item.props.href : '/temario',
            ...(textSizePreset ? { textSizePreset } : {}),
            ...(variant ? { variant } : {}),
            ...(thumbnailSrc ? { thumbnailSrc } : {}),
            ...(newTab !== undefined ? { newTab } : {}),
            ...(color ? { color } : {}),
            ...(icon ? { icon } : {}),
            ...(align ? { align } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'table': {
      const accentColor = normalizeHexColor(item.props.accentColor);
      const striped = normalizeBoolean(item.props.striped);
      const compact = normalizeBoolean(item.props.compact);
      const bordered = normalizeBoolean(item.props.bordered);
      return {
        block: {
          id: toAtlasId('table', item.props.id),
          type: 'table',
          props: {
            headers: Array.isArray(item.props.headers) && item.props.headers.length > 0 ? item.props.headers : ['Columna 1'],
            rows: Array.isArray(item.props.rows) && item.props.rows.length > 0 ? item.props.rows : [['']],
            ...(accentColor ? { accentColor } : {}),
            ...(striped !== undefined ? { striped } : {}),
            ...(compact !== undefined ? { compact } : {}),
            ...(bordered !== undefined ? { bordered } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'carousel': {
      const autoplay = normalizeBoolean(item.props.autoplay);
      const showArrows = normalizeBoolean(item.props.showArrows);
      const showDots = normalizeBoolean(item.props.showDots);
      const zoom = normalizeBoolean(item.props.zoom);
      const rawInt = typeof item.props.intervalSec === 'string' ? Number(item.props.intervalSec) : item.props.intervalSec;
      const intervalSec =
        typeof rawInt === 'number' && Number.isInteger(rawInt) && rawInt >= 2 && rawInt <= 15
          ? rawInt
          : undefined;
      const media = sanitizeMediaAppearance(item.props.media);
      return {
        block: {
          id: toAtlasId('carousel', item.props.id),
          type: 'carousel',
          props: {
            items: Array.isArray(item.props.items) && item.props.items.length > 0 ? item.props.items : [],
            ...(item.props.fit === 'cover' || item.props.fit === 'contain' ? { fit: item.props.fit } : {}),
            ...(autoplay !== undefined ? { autoplay } : {}),
            ...(intervalSec !== undefined ? { intervalSec } : {}),
            ...(showArrows !== undefined ? { showArrows } : {}),
            ...(showDots !== undefined ? { showDots } : {}),
            ...(zoom !== undefined ? { zoom } : {}),
            ...(media ? { media } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'video':
      return {
        block: {
          id: toAtlasId('video', item.props.id),
          type: 'video',
          props: {
            url: typeof item.props.url === 'string' ? item.props.url : '',
            ...(typeof item.props.caption === 'string'
              ? { caption: richTextFromPlain(item.props.caption) }
              : {}),
            ...(item.props.aspect === '16/9' || item.props.aspect === '4/3' || item.props.aspect === '1/1'
              ? { aspect: item.props.aspect }
              : {}),
            ...styleProp,
          },
        },
        layout,
      };
    case 'compare': {
      const media = sanitizeMediaAppearance(item.props.media);
      return {
        block: {
          id: toAtlasId('compare', item.props.id),
          type: 'compare',
          props: {
            leftSrc: item.props.leftSrc,
            ...(typeof item.props.leftLabel === 'string' && item.props.leftLabel
              ? { leftLabel: item.props.leftLabel }
              : {}),
            rightSrc: item.props.rightSrc,
            ...(item.props.fit === 'cover' || item.props.fit === 'contain' ? { fit: item.props.fit } : {}),
            ...(typeof item.props.rightLabel === 'string' && item.props.rightLabel
              ? { rightLabel: item.props.rightLabel }
              : {}),
            ...(typeof item.props.caption === 'string' && item.props.caption.trim()
              ? { caption: item.props.caption.slice(0, 500) }
              : {}),
            ...(media ? { media } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'callout':
      return {
        block: {
          id: toAtlasId('callout', item.props.id),
          type: 'callout',
          props: {
            ...(item.props.tone === 'info' ||
            item.props.tone === 'clinical' ||
            item.props.tone === 'tip' ||
            item.props.tone === 'warning'
              ? { tone: item.props.tone }
              : {}),
            title: richTextFromPlain(item.props.title),
            text: richTextFromPuck(item.props.text, item.props.richText),
            ...styleProp,
          },
        },
        layout,
      };
    case 'gif': {
      const zoom = normalizeBoolean(item.props.zoom);
      const media = sanitizeMediaAppearance(item.props.media);
      return {
        block: {
          id: toAtlasId('gif', item.props.id),
          type: 'gif',
          props: {
            src: item.props.src,
            alt: typeof item.props.alt === 'string' ? item.props.alt : '',
            ...(typeof item.props.caption === 'string'
              ? { caption: richTextFromPlain(item.props.caption) }
              : {}),
            ...(item.props.fit === 'cover' || item.props.fit === 'contain' ? { fit: item.props.fit } : {}),
            ...(zoom !== undefined ? { zoom } : {}),
            ...(media ? { media } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'badge': {
      const color = normalizeHexColor(item.props.color);
      const icon = typeof item.props.icon === 'string' && item.props.icon.trim() ? item.props.icon.trim().slice(0, 40) : undefined;
      return {
        block: {
          id: toAtlasId('badge', item.props.id),
          type: 'badge',
          props: {
            text: richTextFromPlain(item.props.text),
            ...(item.props.variant === 'solid' ||
            item.props.variant === 'soft' ||
            item.props.variant === 'outline' ||
            item.props.variant === 'glass' ||
            item.props.variant === 'swatch'
              ? { variant: item.props.variant }
              : {}),
            ...(color ? { color } : {}),
            ...(icon ? { icon } : {}),
            ...(item.props.size === 'sm' || item.props.size === 'md' || item.props.size === 'lg'
              ? { size: item.props.size }
              : {}),
            ...(item.props.align === 'left' || item.props.align === 'center' || item.props.align === 'right'
              ? { align: item.props.align }
              : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'icon': {
      const color = normalizeHexColor(item.props.color);
      const bgColor = normalizeHexColor(item.props.bgColor);
      const rawSize = typeof item.props.size === 'string' ? Number(item.props.size) : item.props.size;
      const size =
        typeof rawSize === 'number' && Number.isInteger(rawSize) && rawSize >= 16 && rawSize <= 96
          ? rawSize
          : undefined;
      const label =
        typeof item.props.label === 'string' && item.props.label.trim()
          ? item.props.label.trim().slice(0, 80)
          : undefined;
      return {
        block: {
          id: toAtlasId('icon', item.props.id),
          type: 'icon',
          props: {
            name: typeof item.props.name === 'string' && item.props.name.trim() ? item.props.name.trim().slice(0, 40) : 'microscope',
            ...(size !== undefined ? { size } : {}),
            ...(color ? { color } : {}),
            ...(bgColor ? { bgColor } : {}),
            ...(item.props.frame === 'none' || item.props.frame === 'circle' || item.props.frame === 'rounded'
              ? { frame: item.props.frame }
              : {}),
            ...(item.props.align === 'left' || item.props.align === 'center' || item.props.align === 'right'
              ? { align: item.props.align }
              : {}),
            ...(label ? { label } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'examCarousel': {
      const buttonTextSize = textSizePresetSchema.safeParse(item.props.buttonTextSize).data;
      const parcial =
        item.props.parcial === 'all' ||
        item.props.parcial === 'primer' ||
        item.props.parcial === 'segundo' ||
        item.props.parcial === 'tercer'
          ? item.props.parcial
          : 'primer';
      const title =
        typeof item.props.title === 'string' && item.props.title.trim()
          ? item.props.title.trim().slice(0, 120)
          : undefined;
      const accentColor = normalizeHexColor(item.props.accentColor);
      const rawMax = typeof item.props.maxItems === 'string' ? Number(item.props.maxItems) : item.props.maxItems;
      const maxItems =
        typeof rawMax === 'number' && Number.isInteger(rawMax) && rawMax >= 1 && rawMax <= 24 ? rawMax : undefined;
      return {
        block: {
          id: toAtlasId('examCarousel', item.props.id),
          type: 'examCarousel',
          props: {
            parcial,
            ...(title ? { title } : {}),
            ...(accentColor ? { accentColor } : {}),
            ...(maxItems !== undefined ? { maxItems } : {}),
            ...(buttonTextSize ? { buttonTextSize } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'tabs': {
      const accentColor = normalizeHexColor(item.props.accentColor);
      const tabStyle =
        item.props.tabStyle === 'underline' ||
        item.props.tabStyle === 'pills' ||
        item.props.tabStyle === 'cards'
          ? item.props.tabStyle
          : undefined;
      const rawItems =
        Array.isArray(item.props.items) && item.props.items.length > 0
          ? item.props.items
          : [{ title: 'Sección 1', content: [] }];
      return {
        block: {
          id: toAtlasId('tabs', item.props.id),
          type: 'tabs',
          props: {
            items: rawItems.map((tab, idx) => ({
              title:
                typeof tab?.title === 'string' && tab.title.trim()
                  ? tab.title
                  : `Sección ${idx + 1}`,
              ...(typeof tab?.subtitle === 'string' && tab.subtitle.trim()
                ? { subtitle: tab.subtitle.trim().slice(0, 160) }
                : {}),
              children: (Array.isArray(tab?.content) ? tab.content : [])
                .filter((child) => child && child.type !== 'tabs' && child.type !== 'accordion')
                .map((child) => placedFromPuck(child, false) as unknown as NonNullable<TabItem['children']>[number]),
            })),
            ...(accentColor ? { accentColor } : {}),
            ...(tabStyle ? { tabStyle } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'accordion': {
      const accentColor = normalizeHexColor(item.props.accentColor);
      const mode =
        item.props.mode === 'default' || item.props.mode === 'reveal' ? item.props.mode : undefined;
      const rawItems =
        Array.isArray(item.props.items) && item.props.items.length > 0
          ? item.props.items
          : [{ title: 'Sección desplegable 1', openByDefault: true, content: [] }];
      return {
        block: {
          id: toAtlasId('accordion', item.props.id),
          type: 'accordion',
          props: {
            items: rawItems.map((sectionItem, idx) => {
              const openByDefault = normalizeBoolean(sectionItem?.openByDefault);
              return {
                title:
                  typeof sectionItem?.title === 'string' && sectionItem.title.trim()
                    ? sectionItem.title
                    : `Sección ${idx + 1}`,
                ...(openByDefault !== undefined ? { openByDefault } : {}),
                children: (Array.isArray(sectionItem?.content) ? sectionItem.content : [])
                  .filter((child) => child && child.type !== 'tabs' && child.type !== 'accordion')
                  .map(
                    (child) =>
                      placedFromPuck(child, false) as unknown as NonNullable<AccordionItem['children']>[number],
                  ),
              };
            }),
            ...(accentColor ? { accentColor } : {}),
            ...(mode ? { mode } : {}),
            ...styleProp,
          },
        },
        layout,
      };
    }
    case 'box': {
      const rawChildren = Array.isArray(item.props.content) ? item.props.content : [];
      const allowedChildren = insideBox
        ? rawChildren.filter((child) => child.type !== 'box' && child.type !== 'canvas' && child.type !== 'tabs' && child.type !== 'accordion')
        : rawChildren.filter((child) => child.type !== 'canvas' && child.type !== 'tabs' && child.type !== 'accordion');
      return {
        block: {
          id: toAtlasId('box', item.props.id),
          type: 'box',
          props: {
            gap: item.props.gap ?? 'md',
            boxDepth: insideBox ? 1 : 0,
            ...styleProp,
          },
          slots: {
            children: allowedChildren.map((child) => placedFromPuck(child, true)),
          },
        },
        layout,
      };
    }
    case 'canvas':
      return {
        block: {
          id: toAtlasId('canvas', item.props.id),
          type: 'canvas',
          props: {
            gap: item.props.gap,
            depth: 1,
            ...styleProp,
          },
          slots: {
            children: (Array.isArray(item.props.content) ? item.props.content : []).map((child) =>
              placedFromPuck(child, false),
            ),
          },
        },
        layout,
      };
    default:
      throw new Error(`Tipo de dato de Puck desconocido: ${String((item as { type: string }).type)}`);
  }
}

export function toPuckData(doc: CanvasDoc): Editor2PuckData {
  const validDoc = canvasDocSchema.parse(doc);

  return {
    root: {
      props: {
        rootId: validDoc.root.id,
        pageKey: validDoc.pageKey,
        gap: validDoc.root.props.gap,
        ...(validDoc.root.props.minRows !== undefined ? { minRows: validDoc.root.props.minRows } : {}),
        ...(validDoc.pageTheme ? { pageTheme: validDoc.pageTheme } : {}),
      },
    },
    content: validDoc.root.slots.children.map((item) => puckFromPlaced(item as AnyPlacedLike)),
  };
}

export function toPuckCompatibleData(doc: CanvasDoc): Data {
  return toPuckData(doc) as unknown as Data;
}

export function fromPuckData(data: Editor2PuckData): CanvasDoc {
  const rootProps = data?.root?.props;
  if (!rootProps || typeof rootProps.rootId !== 'string' || typeof rootProps.pageKey !== 'string') {
    throw new Error('Los datos de Puck no contienen las propiedades raíz de Atlas Editor 2.');
  }
  const cleanTheme = sanitizePageTheme(rootProps.pageTheme);

  return canvasDocSchema.parse({
    schemaVersion: 2,
    pageKey: rootProps.pageKey,
    ...(cleanTheme ? { pageTheme: cleanTheme } : {}),
    root: {
      id: rootProps.rootId,
      type: 'canvas',
      props: {
        gap: rootProps.gap,
        depth: 0,
        ...(rootProps.minRows !== undefined ? { minRows: rootProps.minRows } : {}),
      },
      slots: {
        children: (data.content ?? []).map((item) => placedFromPuck(item, false)),
      },
    },
  });
}
