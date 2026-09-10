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
  | 'histology_stains'
  | 'histology_text_cards'
  | 'histology_text_table'
  | 'histology_text_simple_cards'
  | 'histology_bullet_cards'
  | 'histology_horizontal_cards'
  | 'histology_extra_data'
  | 'topic_divisions';

export type PageEntityType = 'subtemas_page' | 'placas_page' | 'home_page';

export interface ContentBlock {
  id: string;
  entity_type: PageEntityType | string;
  entity_id: number;
  block_type: BlockType;
  sort_order: number;
  content: Record<string, string>;
}
