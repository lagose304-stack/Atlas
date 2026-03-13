import type { BlockType } from '../PageContentEditor';

export interface BlockMeta {
  label: string;
  icon: string;
  color: string;
}

export interface BlockDefinition {
  meta: BlockMeta;
  schemaVersion: number;
  defaultContent: Record<string, string>;
}

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  heading: {
    meta: { label: 'Titulo', icon: 'H1', color: '#6366f1' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  subheading: {
    meta: { label: 'Subtitulo', icon: 'H2', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  paragraph: {
    meta: { label: 'Parrafo', icon: 'P', color: '#0ea5e9' },
    schemaVersion: 1,
    defaultContent: { text: '' },
  },
  image: {
    meta: { label: 'Imagen', icon: 'IMG', color: '#10b981' },
    schemaVersion: 1,
    defaultContent: { url: '', caption: '', size: 'large', align: 'center' },
  },
  text_image: {
    meta: { label: 'Texto + Imagen', icon: 'T+I', color: '#f59e0b' },
    schemaVersion: 1,
    defaultContent: { text: '', image_url: '', image_position: 'right', image_caption: '' },
  },
  two_images: {
    meta: { label: 'Dos Imagenes', icon: '2IMG', color: '#ec4899' },
    schemaVersion: 1,
    defaultContent: {
      image_url_left: '',
      image_caption_left: '',
      image_url_right: '',
      image_caption_right: '',
    },
  },
  three_images: {
    meta: { label: 'Tres Imagenes', icon: '3IMG', color: '#a855f7' },
    schemaVersion: 1,
    defaultContent: {
      image_url_1: '',
      image_caption_1: '',
      image_url_2: '',
      image_caption_2: '',
      image_url_3: '',
      image_caption_3: '',
    },
  },
  callout: {
    meta: { label: 'Destacado', icon: 'CAL', color: '#f97316' },
    schemaVersion: 1,
    defaultContent: { text: '', variant: 'info' },
  },
  list: {
    meta: { label: 'Lista', icon: 'LIST', color: '#06b6d4' },
    schemaVersion: 1,
    defaultContent: { items: '', style: 'bullet' },
  },
  divider: {
    meta: { label: 'Separador', icon: 'DIV', color: '#94a3b8' },
    schemaVersion: 1,
    defaultContent: { style: 'gradient' },
  },
  carousel: {
    meta: { label: 'Galeria', icon: 'CAR', color: '#6366f1' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true' },
  },
  text_carousel: {
    meta: { label: 'Texto + Galeria', icon: 'TCAR', color: '#3b82f6' },
    schemaVersion: 1,
    defaultContent: { text: '', image_position: 'right', ti_text_align: 'left', interval: '4', auto: 'true' },
  },
  double_carousel: {
    meta: { label: 'Doble galeria', icon: '2CAR', color: '#8b5cf6' },
    schemaVersion: 1,
    defaultContent: { interval: '4', auto: 'true' },
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];

export const getBlockMeta = (type: BlockType): BlockMeta => BLOCK_REGISTRY[type].meta;

export const createDefaultBlockContent = (type: BlockType): Record<string, string> => {
  const def = BLOCK_REGISTRY[type];
  return {
    ...def.defaultContent,
    __schema_version: String(def.schemaVersion),
  };
};

export const normalizeBlockContent = (
  type: BlockType,
  rawContent: unknown
): Record<string, string> => {
  const base = createDefaultBlockContent(type);
  if (!rawContent || typeof rawContent !== 'object') return base;

  const entries = Object.entries(rawContent as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    if (v === undefined || v === null) return acc;
    acc[k] = typeof v === 'string' ? v : String(v);
    return acc;
  }, {});

  return {
    ...base,
    ...entries,
    __schema_version: String(BLOCK_REGISTRY[type].schemaVersion),
  };
};
