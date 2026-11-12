import type { ContentBlock } from '../../types/contentBlocks';

export type WeeklyHistologyFact = {
  topic: string;
  title: string;
  description: string;
  clue: string;
  illustration: 'liver' | 'henle' | 'none';
  imageUrl?: string;
  imageAlt?: string;
  imageFit?: 'contain' | 'cover';
};

export const WEEKLY_FACTS: [WeeklyHistologyFact, WeeklyHistologyFact] = [
  {
    topic: 'Tema 03 · Glándulas Anexas',
    title: 'Tres formas de ver el hígado',
    description: 'El lobulillo clásico es hexagonal y muestra cómo la sangre converge en la vena central. El lobulillo portal es triangular y agrupa el tejido que drena bilis hacia un mismo conducto biliar. El acino hepático es romboidal y distingue tres zonas según la distancia al aporte de sangre.',
    clue: 'En la placa, ubica una vena central y un espacio porta. La zona 1 del acino recibe primero la sangre y la zona 3 queda junto a la vena central.',
    illustration: 'liver',
  },
  {
    topic: 'Tema 04 · Sistema Urinario',
    title: 'Asas de Henle largas para ahorrar agua',
    description: 'En el dromedario, muchas asas de Henle son largas y penetran profundamente en la médula renal. Ayudan a establecer un gradiente de concentración que permite recuperar agua en los conductos colectores y producir una orina más concentrada.',
    clue: 'Sigue la rama descendente hacia la médula y luego la ascendente de vuelta hacia la corteza.',
    illustration: 'henle',
  },
];


export const WEEKLY_FACTS_CONTENT: Record<string, string> = {
  title: 'Datos histológicos de la semana',
  facts_count: '2',
  facts_visible: 'true',
  image_zoom: 'true',
};
WEEKLY_FACTS.forEach((fact, index) => {
  const prefix = 'fact_' + (index + 1) + '_';
  WEEKLY_FACTS_CONTENT[prefix + 'topic'] = fact.topic;
  WEEKLY_FACTS_CONTENT[prefix + 'title'] = fact.title;
  WEEKLY_FACTS_CONTENT[prefix + 'description'] = fact.description;
  WEEKLY_FACTS_CONTENT[prefix + 'clue'] = fact.clue;
  WEEKLY_FACTS_CONTENT[prefix + 'illustration'] = fact.illustration;
  WEEKLY_FACTS_CONTENT[prefix + 'image_url'] = '';
  WEEKLY_FACTS_CONTENT[prefix + 'image_alt'] = '';
  WEEKLY_FACTS_CONTENT[prefix + 'image_fit'] = 'contain';
});

export function readWeeklyFacts(content: Record<string, string>): WeeklyHistologyFact[] {
  return [1, 2].slice(0, content.facts_count === '1' ? 1 : 2).map(index => {
    const prefix = 'fact_' + index + '_';
    const illustration = content[prefix + 'illustration'];
    return {
      topic: content[prefix + 'topic'] || '',
      title: content[prefix + 'title'] || '',
      description: content[prefix + 'description'] || '',
      clue: content[prefix + 'clue'] || '',
      illustration: illustration === 'liver' || illustration === 'henle' ? illustration : 'none',
      imageUrl: content[prefix + 'image_url'] || '',
      imageAlt: content[prefix + 'image_alt'] || '',
      imageFit: content[prefix + 'image_fit'] === 'cover' ? 'cover' : 'contain',
    };
  });
}

export const LEGACY_HOME_FACTS_ID = 'a7c0f1ab-bc64-49fb-9718-3ed9437860a1';

export function includeHomeWeeklyFacts<T extends ContentBlock>(blocks: T[], entityType: string, entityId: number): ContentBlock[] {
  if (entityType !== 'home_page' || entityId !== 0 || blocks.some(block => block.block_type === 'weekly_histology_facts')) return blocks;
  const position = blocks.findIndex(block => block.block_type === 'exam_week' || block.block_type === 'weekly_publication');
  const result: ContentBlock[] = [...blocks];
  result.splice(position + 1, 0, { id: LEGACY_HOME_FACTS_ID, entity_type: 'home_page', entity_id: 0, block_type: 'weekly_histology_facts', sort_order: 0, content: { ...WEEKLY_FACTS_CONTENT } });
  return result.map((block, index) => ({ ...block, sort_order: index }));
}
