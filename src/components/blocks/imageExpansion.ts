import type { BlockType } from '../../types/contentBlocks';

export const IMAGE_EXPANSION_FIELDS: Partial<Record<BlockType, string>> = {
  image: 'image_zoom',
  text_image: 'ti_zoom',
  two_images: 'two_zoom',
  three_images: 'three_zoom',
  carousel: 'carousel_zoom',
  text_carousel: 'tc_zoom',
  double_carousel: 'dc_zoom',
  histology_generalities: 'image_zoom',
  histology_pillars: 'image_zoom',
  histology_stains: 'image_zoom',
  histology_extra_data: 'image_zoom',
  weekly_publication: 'image_zoom',
  weekly_histology_facts: 'image_zoom',
  exam_week: 'image_zoom',
};
