import { supabase } from './supabase';
import type { PageEntityType } from './contentPublication';

export interface ContentBlockVersionRow {
  id: number;
  entity_type: PageEntityType;
  entity_id: number;
  snapshot_name: string | null;
  reason: string | null;
  blocks_count: number;
  created_at: string;
}

export const listContentVersions = async (
  entityType: PageEntityType,
  entityId: number,
  limit = 30
): Promise<ContentBlockVersionRow[]> => {
  const { data, error } = await supabase
    .from('content_block_versions')
    .select('id, entity_type, entity_id, snapshot_name, reason, blocks_count, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as ContentBlockVersionRow[] | null) ?? [];
};

export const createContentVersion = async (
  entityType: PageEntityType,
  entityId: number,
  reason?: string,
  snapshotName?: string
): Promise<number> => {
  const { data, error } = await supabase.rpc('save_content_page_version', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_reason: reason ?? null,
    p_snapshot_name: snapshotName ?? null,
  });

  if (error) throw error;
  return Number(data);
};

export const restoreContentVersion = async (
  versionId: number,
  replace = true
): Promise<number> => {
  const { data, error } = await supabase.rpc('restore_content_page_version', {
    p_version_id: versionId,
    p_replace: replace,
  });

  if (error) throw error;
  return Number(data);
};
