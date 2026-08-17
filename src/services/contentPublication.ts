import { supabase } from './supabase';
import { BLOCK_TYPES, normalizeBlockContent } from '../components/blocks/blockRegistry';
import type { BlockType, PageEntityType } from '../types/contentBlocks';

export type { PageEntityType } from '../types/contentBlocks';

export interface PublicationBlock {
  id: string;
  entity_type: PageEntityType;
  entity_id: number;
  block_type: BlockType;
  sort_order: number;
  content: Record<string, string>;
}

interface PublicationRow {
  status: 'draft' | 'published';
  published_blocks: unknown;
  published_at: string | null;
}

const isBlockType = (value: string): value is BlockType => {
  return (BLOCK_TYPES as string[]).includes(value);
};

const normalizeBlocks = (rows: unknown[] | null | undefined): PublicationBlock[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map((row, index) => {
      const rawType = String(row.block_type ?? 'paragraph');
      const blockType: BlockType = isBlockType(rawType) ? rawType : 'paragraph';
      const entityType = String(row.entity_type ?? 'home_page') as PageEntityType;
      const entityId = Number(row.entity_id ?? 0);
      return {
        id: String(row.id ?? crypto.randomUUID()),
        entity_type: entityType,
        entity_id: entityId,
        block_type: blockType,
        sort_order: Number(row.sort_order ?? index),
        content: normalizeBlockContent(blockType, row.content),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};

const renderableBlocksCache = new Map<string, { timestamp: number; blocks: PublicationBlock[] }>();
const CACHE_TTL_MS = 60_000;

export const clearRenderableBlocksCache = (entityType?: PageEntityType, entityId?: number) => {
  if (entityType !== undefined && entityId !== undefined) {
    renderableBlocksCache.delete(`${entityType}:${entityId}`);
  } else {
    renderableBlocksCache.clear();
  }
};

export const getPublicationInfo = async (entityType: PageEntityType, entityId: number) => {
  const { data, error } = await supabase
    .from('content_page_publications')
    .select('status, published_blocks, published_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (error) {
    if ((error.message || '').toLowerCase().includes('does not exist')) return null;
    throw error;
  }

  return (data as PublicationRow | null) ?? null;
};

export const getRenderableBlocks = async (entityType: PageEntityType, entityId: number): Promise<PublicationBlock[]> => {
  const cacheKey = `${entityType}:${entityId}`;
  const cached = renderableBlocksCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.blocks;
  }

  try {
    const publication = await getPublicationInfo(entityType, entityId);
    // El estado draft significa que existe una edicion en curso. La web publica
    // debe seguir mostrando el ultimo snapshot publicado hasta la proxima publicacion.
    if (publication) {
      const normalized = normalizeBlocks(publication.published_blocks as unknown[]);
      renderableBlocksCache.set(cacheKey, { timestamp: now, blocks: normalized });
      return normalized;
    }
  } catch (error) {
    console.warn('No se pudo consultar publicacion. Se usara draft en vivo.', error);
  }

  const { data, error } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  const result = normalizeBlocks((data as unknown[]) ?? []);
  renderableBlocksCache.set(cacheKey, { timestamp: now, blocks: result });
  return result;
};

export const publishBlocksSnapshot = async (
  entityType: PageEntityType,
  entityId: number,
  blocks: PublicationBlock[]
) => {
  const payload = blocks
    .map((block, idx) => ({
      ...block,
      entity_type: entityType,
      entity_id: entityId,
      sort_order: idx,
      content: normalizeBlockContent(block.block_type, block.content),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('content_page_publications')
    .upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        status: 'published',
        published_blocks: payload,
        published_at: now,
      },
      { onConflict: 'entity_type,entity_id' }
    );

  if (error) throw error;
  clearRenderableBlocksCache(entityType, entityId);
  return now;
};

export const setPublicationDraft = async (entityType: PageEntityType, entityId: number) => {
  const { error } = await supabase
    .from('content_page_publications')
    .upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        status: 'draft',
      },
      { onConflict: 'entity_type,entity_id' }
    );

  if (error) throw error;
  clearRenderableBlocksCache(entityType, entityId);
};
