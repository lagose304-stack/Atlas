import { supabase } from './supabase';
import type { ContentBlock, PageEntityType } from '../types/contentBlocks';
import { normalizeBlockContent } from '../components/blocks/blockRegistry';

export interface PageVersionRow {
  id: number;
  entity_type: PageEntityType;
  entity_id: number;
  version_name: string;
  description: string | null;
  is_published: boolean;
  blocks: ContentBlock[];
  blocks_count: number;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserContextInfo {
  id?: string | number | null;
  nombre?: string | null;
  username?: string | null;
  email?: string | null;
}

const normalizeVersionBlocks = (rawBlocks: unknown): ContentBlock[] => {
  if (!Array.isArray(rawBlocks)) return [];
  return rawBlocks
    .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === 'object'))
    .map((b, idx) => {
      const blockType = String(b.block_type || 'paragraph') as ContentBlock['block_type'];
      return {
        id: String(b.id || crypto.randomUUID()),
        entity_type: (b.entity_type as PageEntityType) || 'home_page',
        entity_id: Number(b.entity_id || 0),
        block_type: blockType,
        sort_order: Number(b.sort_order ?? idx),
        content: normalizeBlockContent(blockType, b.content),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const listPageVersions = async (
  entityType: PageEntityType,
  entityId: number
): Promise<PageVersionRow[]> => {
  const { data, error } = await supabase
    .from('content_page_versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('is_published', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    // Si la tabla no existe o falla la consulta, retornamos array vacío
    console.warn('Error al consultar content_page_versions:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    entity_type: row.entity_type as PageEntityType,
    entity_id: Number(row.entity_id),
    version_name: String(row.version_name || 'Versión sin nombre'),
    description: row.description ? String(row.description) : null,
    is_published: Boolean(row.is_published),
    blocks: normalizeVersionBlocks(row.blocks),
    blocks_count: Number(row.blocks_count ?? (Array.isArray(row.blocks) ? row.blocks.length : 0)),
    created_by: row.created_by ? String(row.created_by) : null,
    created_by_name: row.created_by_name ? String(row.created_by_name) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_by_name: row.updated_by_name ? String(row.updated_by_name) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  }));
};

export const getPageVersionById = async (versionId: number): Promise<PageVersionRow | null> => {
  const { data, error } = await supabase
    .from('content_page_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: Number(data.id),
    entity_type: data.entity_type as PageEntityType,
    entity_id: Number(data.entity_id),
    version_name: String(data.version_name || 'Versión sin nombre'),
    description: data.description ? String(data.description) : null,
    is_published: Boolean(data.is_published),
    blocks: normalizeVersionBlocks(data.blocks),
    blocks_count: Number(data.blocks_count ?? (Array.isArray(data.blocks) ? data.blocks.length : 0)),
    created_by: data.created_by ? String(data.created_by) : null,
    created_by_name: data.created_by_name ? String(data.created_by_name) : null,
    updated_by: data.updated_by ? String(data.updated_by) : null,
    updated_by_name: data.updated_by_name ? String(data.updated_by_name) : null,
    published_at: data.published_at ? String(data.published_at) : null,
    created_at: String(data.created_at || new Date().toISOString()),
    updated_at: String(data.updated_at || new Date().toISOString()),
  };
};

export interface CreateVersionParams {
  entityType: PageEntityType;
  entityId: number;
  versionName: string;
  description?: string;
  sourceBlocks?: ContentBlock[];
  user?: UserContextInfo;
}

export const createPageVersion = async (
  params: CreateVersionParams
): Promise<PageVersionRow> => {
  const userName = params.user?.nombre || params.user?.username || params.user?.email || 'Docente / Admin';
  const userId = params.user?.id ? String(params.user.id) : null;

  const blocksToStore = (params.sourceBlocks ?? []).map((b, i) => ({
    id: b.id || crypto.randomUUID(),
    entity_type: params.entityType,
    entity_id: params.entityId,
    block_type: b.block_type,
    sort_order: i,
    content: b.content,
  }));

  const payload: Record<string, unknown> = {
    entity_type: params.entityType,
    entity_id: params.entityId,
    version_name: params.versionName.trim() || 'Nueva Versión',
    description: params.description?.trim() || null,
    is_published: false,
    blocks: blocksToStore,
    created_by: userId,
    created_by_name: userName,
    updated_by: userId,
    updated_by_name: userName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let result = await supabase
    .from('content_page_versions')
    .insert(payload)
    .select()
    .single();

  // Si la columna en la base de datos era UUID antes de la migración, reintentamos omitiendo los IDs numéricos
  if (result.error && (result.error.message?.includes('uuid') || result.error.code === '22P02')) {
    const fallbackPayload = {
      ...payload,
      created_by: null,
      updated_by: null,
    };
    result = await supabase
      .from('content_page_versions')
      .insert(fallbackPayload)
      .select()
      .single();
  }

  if (result.error) {
    console.error('Error supabase al crear versión:', result.error);
    if (result.error.code === '23505' || result.error.message?.includes('duplicate key') || result.error.message?.includes('unique')) {
      throw new Error(`Ya existe una versión con el nombre "${params.versionName}".`);
    }
    throw new Error(result.error.message || 'Error al crear la versión.');
  }

  const data = result.data;

  return {
    id: Number(data.id),
    entity_type: data.entity_type as PageEntityType,
    entity_id: Number(data.entity_id),
    version_name: String(data.version_name),
    description: data.description ? String(data.description) : null,
    is_published: Boolean(data.is_published),
    blocks: normalizeVersionBlocks(data.blocks),
    blocks_count: Number(data.blocks_count ?? blocksToStore.length),
    created_by: data.created_by ? String(data.created_by) : null,
    created_by_name: data.created_by_name ? String(data.created_by_name) : null,
    updated_by: data.updated_by ? String(data.updated_by) : null,
    updated_by_name: data.updated_by_name ? String(data.updated_by_name) : null,
    published_at: null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
};

export const savePageVersionBlocks = async (
  versionId: number,
  blocks: ContentBlock[],
  user?: UserContextInfo
): Promise<void> => {
  const userName = user?.nombre || user?.username || user?.email || 'Docente / Admin';
  const userId = user?.id ? String(user.id) : null;

  const currentVersion = await getPageVersionById(versionId);
  if (!currentVersion) throw new Error('La versión no existe.');

  const blocksToStore = blocks.map((b, i) => ({
    id: b.id || crypto.randomUUID(),
    entity_type: currentVersion.entity_type,
    entity_id: currentVersion.entity_id,
    block_type: b.block_type,
    sort_order: i,
    content: b.content,
  }));

  const updatePayload: Record<string, unknown> = {
    blocks: blocksToStore,
    updated_by: userId,
    updated_by_name: userName,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from('content_page_versions')
    .update(updatePayload)
    .eq('id', versionId);

  if (error && (error.message?.includes('uuid') || error.code === '22P02')) {
    delete updatePayload.updated_by;
    const retry = await supabase
      .from('content_page_versions')
      .update(updatePayload)
      .eq('id', versionId);
    error = retry.error;
  }

  if (error) {
    console.error('Error al actualizar versión:', error);
    throw error;
  }

  // Si la versión está actualmente publicada, sincronizamos inmediatamente con content_page_publications
  if (currentVersion.is_published) {
    await supabase.from('content_page_publications').upsert({
      entity_type: currentVersion.entity_type,
      entity_id: currentVersion.entity_id,
      status: 'published',
      published_blocks: blocksToStore,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'entity_type,entity_id',
    });
  }
};

export const publishPageVersion = async (
  versionId: number,
  user?: UserContextInfo
): Promise<void> => {
  const userName = user?.nombre || user?.username || user?.email || 'Docente / Admin';
  const userId = user?.id ? String(user.id) : null;

  // Intentamos primero la función RPC atómica
  const { error: rpcError } = await supabase.rpc('publish_page_version', {
    p_version_id: versionId,
    p_user_id: userId,
    p_user_name: userName,
  });

  if (!rpcError) return;

  // Fallback si la función RPC aún no fue ejecutada en Supabase
  console.warn('RPC publish_page_version no disponible, ejecutando fallback cliente:', rpcError);
  const version = await getPageVersionById(versionId);
  if (!version) throw new Error('Versión no encontrada.');

  // 1. Despublicar todas las de la misma entidad
  await supabase
    .from('content_page_versions')
    .update({ is_published: false })
    .eq('entity_type', version.entity_type)
    .eq('entity_id', version.entity_id);

  // 2. Marcar como publicada esta versión
  await supabase
    .from('content_page_versions')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      updated_by: userId,
      updated_by_name: userName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  // 3. Sincronizar content_page_publications
  await supabase.from('content_page_publications').upsert({
    entity_type: version.entity_type,
    entity_id: version.entity_id,
    status: 'published',
    published_blocks: version.blocks,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'entity_type,entity_id',
  });
};

export const deletePageVersion = async (versionId: number): Promise<void> => {
  const { error } = await supabase
    .from('content_page_versions')
    .delete()
    .eq('id', versionId);

  if (error) throw error;
};

export const ensurePageHasInitialVersion = async (
  entityType: PageEntityType,
  entityId: number,
  user?: UserContextInfo
): Promise<PageVersionRow[]> => {
  const existing = await listPageVersions(entityType, entityId);
  if (existing.length > 0) return existing;

  // Si no hay versiones pero hay bloques en content_blocks o content_page_publications,
  // los migramos a una versión oficial inicial
  const [{ data: blocksData }, { data: pubData }] = await Promise.all([
    supabase
      .from('content_blocks')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('content_page_publications')
      .select('published_blocks')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle(),
  ]);

  const rawBlocks = (pubData?.published_blocks as unknown[]) ?? blocksData ?? [];
  const normalized = normalizeVersionBlocks(rawBlocks);

  const userName = user?.nombre || user?.username || user?.email || 'Sistema';
  const userId = user?.id ? String(user.id) : null;

  try {
    const payload: Record<string, unknown> = {
      entity_type: entityType,
      entity_id: entityId,
      version_name: 'Versión Oficial (Inicial)',
      description: 'Versión inicial importada automáticamente.',
      is_published: true,
      blocks: normalized,
      created_by: userId,
      created_by_name: userName,
      updated_by: userId,
      updated_by_name: userName,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let result = await supabase
      .from('content_page_versions')
      .insert(payload)
      .select()
      .single();

    if (result.error && (result.error.message?.includes('uuid') || result.error.code === '22P02')) {
      delete payload.created_by;
      delete payload.updated_by;
      result = await supabase
        .from('content_page_versions')
        .insert(payload)
        .select()
        .single();
    }

    const newRow = result.data;

    if (!result.error && newRow) {
      return [{
        id: Number(newRow.id),
        entity_type: newRow.entity_type as PageEntityType,
        entity_id: Number(newRow.entity_id),
        version_name: String(newRow.version_name),
        description: newRow.description ? String(newRow.description) : null,
        is_published: true,
        blocks: normalized,
        blocks_count: normalized.length,
        created_by: newRow.created_by ? String(newRow.created_by) : null,
        created_by_name: newRow.created_by_name ? String(newRow.created_by_name) : null,
        updated_by: newRow.updated_by ? String(newRow.updated_by) : null,
        updated_by_name: newRow.updated_by_name ? String(newRow.updated_by_name) : null,
        published_at: newRow.published_at ? String(newRow.published_at) : null,
        created_at: String(newRow.created_at),
        updated_at: String(newRow.updated_at),
      }];
    }
  } catch (err) {
    console.warn('No se pudo auto-inicializar versión de página:', err);
  }

  return [];
};

