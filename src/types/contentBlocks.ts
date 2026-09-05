export type BlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'image'
  | 'text_image'
  | 'two_images'
  | 'three_images'
  | 'callout'
  | 'weekly_publication'
  | 'weekly_test'
  | 'exam_week'
  | 'list'
  | 'divider'
  | 'carousel'
  | 'text_carousel'
  | 'double_carousel'
  | 'section'
  | 'section_end'
  | 'columns_2'
  | 'histology_generalities'
  | 'histology_pillars'
  | 'histology_stains';

export type PageEntityType = 'subtemas_page' | 'placas_page' | 'home_page';

export interface ContentBlock {
  id: string;
  entity_type: PageEntityType | string;
  entity_id: number;
  block_type: BlockType;
  sort_order: number;
  content: Record<string, string>;
}
