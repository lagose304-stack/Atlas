import { supabase } from './supabase';

export type AuditEntityType =
  | 'placa'
  | 'prueba'
  | 'pagina'
  | 'tema'
  | 'subtema'
  | 'mapa'
  | 'usuario'
  | 'sesion'
  | 'sistema';

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'classify'
  | 'publish'
  | 'unpublish'
  | 'restore'
  | 'reorder'
  | 'login'
  | 'logout'
  | 'role_change'
  | 'maintenance_toggle';

export interface AuditActor {
  id?: number | null;
  username?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface AuditEventPayload {
  entityType: AuditEntityType;
  actionType: AuditActionType;
  entityId?: string | number | null;
  entityName: string;
  actor?: AuditActor | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface AuditLogEntry {
  id: number;
  created_at: string;
  entity_type: AuditEntityType;
  action_type: AuditActionType;
  entity_id: string | null;
  entity_name: string;
  actor_user_id: number | null;
  actor_username: string | null;
  actor_name: string;
  actor_role: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
}

export interface AuditFilters {
  entityType?: AuditEntityType | 'all';
  actionType?: AuditActionType | 'all';
  actorUserId?: number | 'all';
  entityId?: string | number | 'all';
  subtemaId?: number | 'all';
  temaId?: number | 'all';
  subtemaNombre?: string;
  scope?: 'tema' | 'subtema' | 'placa' | 'prueba' | 'all';
  includeEntities?: AuditEntityType[];
  excludeEntities?: AuditEntityType[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface PurgeAuditLogsParams {
  dateFrom?: string; // Formato YYYY-MM-DD
  dateTo?: string;   // Formato YYYY-MM-DD
  entityType?: AuditEntityType | 'all';
  actionType?: AuditActionType | 'all';
}

export interface AuditMetrics {
  totalCount: number;
  todayCount: number;
  activeEditorsCount: number;
  criticalCount: number;
  byEntity: Record<AuditEntityType, number>;
  byAction: Record<AuditActionType, number>;
  topEditors: Array<{ name: string; username: string; count: number }>;
}

const FALLBACK_STORAGE_KEY = 'atlas_unified_audit_logs_fallback';
const USER_KEY = 'atlas_user';
let supportsUnifiedTable: boolean | null = null;

const getCurrentCachedActor = (): AuditActor => {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return { id: null, username: 'anonimo', name: 'Usuario del sistema', role: null };
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return { id: null, username: 'anonimo', name: 'Usuario del sistema', role: null };
    const parsed = JSON.parse(raw) as { id?: number; username?: string; nombre?: string; rol?: string };
    return {
      id: parsed.id ?? null,
      username: parsed.username ?? null,
      name: parsed.nombre || parsed.username || 'Usuario del sistema',
      role: parsed.rol ?? null,
    };
  } catch {
    return { id: null, username: 'anonimo', name: 'Usuario del sistema', role: null };
  }
};

const writeFallbackLog = (payload: AuditEventPayload, actor: AuditActor) => {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return;
    }
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    const existing: AuditLogEntry[] = raw ? JSON.parse(raw) : [];

    const newEntry: AuditLogEntry = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      entity_type: payload.entityType,
      action_type: payload.actionType,
      entity_id: payload.entityId != null ? String(payload.entityId) : null,
      entity_name: payload.entityName,
      actor_user_id: actor.id ?? null,
      actor_username: actor.username ?? null,
      actor_name: actor.name || actor.username || 'Usuario del sistema',
      actor_role: actor.role ?? null,
      details: payload.details ?? {},
      ip_address: payload.ipAddress ?? null,
    };

    const next = [newEntry, ...existing].slice(0, 1000);
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('No se pudo escribir en el fallback de auditoría local:', err);
  }
};

/**
 * Registra un evento de auditoría en la tabla unified_audit_logs.
 * Si la tabla aún no existe o falla la red, guarda en fallback local automáticamente.
 */
export const logAuditEvent = async (payload: AuditEventPayload): Promise<void> => {
  const defaultActor = getCurrentCachedActor();
  const actor: AuditActor = {
    id: payload.actor?.id ?? defaultActor.id,
    username: payload.actor?.username ?? defaultActor.username,
    name: payload.actor?.name || defaultActor.name || payload.actor?.username || defaultActor.username || 'Usuario del sistema',
    role: payload.actor?.role ?? defaultActor.role,
  };

  const row = {
    entity_type: payload.entityType,
    action_type: payload.actionType,
    entity_id: payload.entityId != null ? String(payload.entityId) : null,
    entity_name: payload.entityName,
    actor_user_id: actor.id ?? null,
    actor_username: actor.username ?? null,
    actor_name: actor.name || actor.username || 'Usuario del sistema',
    actor_role: actor.role ?? null,
    details: payload.details ?? {},
    ip_address: payload.ipAddress ?? null,
  };

  if (supportsUnifiedTable === false) {
    writeFallbackLog(payload, actor);
    return;
  }

  try {
    const tableRef = supabase?.from?.('unified_audit_logs');
    if (!tableRef || typeof tableRef.insert !== 'function') {
      supportsUnifiedTable = false;
      writeFallbackLog(payload, actor);
      return;
    }

    const { error } = await tableRef.insert(row);
    if (error) {
      supportsUnifiedTable = false;
      writeFallbackLog(payload, actor);
      return;
    }
    supportsUnifiedTable = true;
  } catch {
    supportsUnifiedTable = false;
    writeFallbackLog(payload, actor);
  }
};

/**
 * Consulta registros de auditoría aplicando filtros de entidad, acción, usuario, fecha y búsqueda de texto.
 */
export const fetchAuditLogs = async (filters: AuditFilters = {}): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);

  try {
    let query = supabase
      .from('unified_audit_logs')
      .select('*', { count: 'exact' });

    if (filters.entityId && filters.entityId !== 'all') {
      query = query.eq('entity_id', String(filters.entityId));
    }
    if (filters.includeEntities && filters.includeEntities.length > 0) {
      query = query.in('entity_type', filters.includeEntities);
    }
    if (filters.excludeEntities && filters.excludeEntities.length > 0) {
      filters.excludeEntities.forEach((exc) => {
        query = query.neq('entity_type', exc);
      });
    }
    if (filters.entityType && filters.entityType !== 'all') {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters.actionType && filters.actionType !== 'all') {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters.actorUserId && filters.actorUserId !== 'all') {
      query = query.eq('actor_user_id', filters.actorUserId);
    }
    if (filters.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
    }
    if (filters.subtemaId && filters.subtemaId !== 'all') {
      query = query.filter('details->>subtema_id', 'eq', String(filters.subtemaId));
    }
    if (filters.temaId && filters.temaId !== 'all') {
      query = query.filter('details->>tema_id', 'eq', String(filters.temaId));
    }
    if (filters.subtemaNombre && filters.subtemaNombre.trim()) {
      query = query.ilike('details->>subtema_nombre', `%${filters.subtemaNombre.trim()}%`);
    }
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const sanitized = filters.searchQuery.trim().replace(/[%,]/g, '');
      query = query.or(
        `entity_name.ilike.%${sanitized}%,actor_name.ilike.%${sanitized}%,actor_username.ilike.%${sanitized}%,entity_id.ilike.%${sanitized}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const logs = (data ?? []) as AuditLogEntry[];

    // Enriquecer registros de placas que carezcan de photo_url
    const plateLogsWithoutPhoto = logs.filter(
      (l) => l.entity_type === 'placa' && !l.details?.photo_url && !l.details?.image_url && l.entity_id
    );
    if (plateLogsWithoutPhoto.length > 0) {
      const numericIds = plateLogsWithoutPhoto
        .map((l) => Number(l.entity_id))
        .filter((id) => !isNaN(id) && id > 0);
      if (numericIds.length > 0) {
        try {
          const { data: platesData } = await supabase
            .from('placas')
            .select('id, photo_url, subtema_id, tema_id, aumento, tincion')
            .in('id', numericIds);
          if (platesData && platesData.length > 0) {
            const plateMap = new Map(platesData.map((p) => [String(p.id), p]));
            logs.forEach((log) => {
              if (log.entity_type === 'placa' && log.entity_id && plateMap.has(String(log.entity_id))) {
                const p = plateMap.get(String(log.entity_id))!;
                if (!log.details) log.details = {};
                if (!log.details.photo_url && p.photo_url) {
                  log.details.photo_url = p.photo_url;
                }
                if (!log.details.aumento && p.aumento) {
                  log.details.aumento = p.aumento;
                }
                if (!log.details.tincion && p.tincion) {
                  log.details.tincion = p.tincion;
                }
                if (!log.details.subtema_id && p.subtema_id) {
                  log.details.subtema_id = p.subtema_id;
                }
              }
            });
          }
        } catch {
          // Silencioso
        }
      }
    }

    return { logs, total: count ?? logs.length };
  } catch (err) {
    console.warn('No se pudo consultar unified_audit_logs, leyendo del fallback local:', err);

    // Fallback a localStorage
    const raw = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
      ? localStorage.getItem(FALLBACK_STORAGE_KEY)
      : null;
    let localLogs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];

    if (filters.entityId && filters.entityId !== 'all') {
      localLogs = localLogs.filter((l) => String(l.entity_id) === String(filters.entityId));
    }
    if (filters.includeEntities && filters.includeEntities.length > 0) {
      localLogs = localLogs.filter((l) => filters.includeEntities!.includes(l.entity_type));
    }
    if (filters.excludeEntities && filters.excludeEntities.length > 0) {
      localLogs = localLogs.filter((l) => !filters.excludeEntities!.includes(l.entity_type));
    }
    if (filters.entityType && filters.entityType !== 'all') {
      localLogs = localLogs.filter((l) => l.entity_type === filters.entityType);
    }
    if (filters.actionType && filters.actionType !== 'all') {
      localLogs = localLogs.filter((l) => l.action_type === filters.actionType);
    }
    if (filters.actorUserId && filters.actorUserId !== 'all') {
      localLogs = localLogs.filter((l) => l.actor_user_id === filters.actorUserId);
    }
    if (filters.subtemaId && filters.subtemaId !== 'all') {
      localLogs = localLogs.filter((l) => String(l.details?.subtema_id) === String(filters.subtemaId));
    }
    if (filters.temaId && filters.temaId !== 'all') {
      localLogs = localLogs.filter((l) => String(l.details?.tema_id) === String(filters.temaId));
    }
    if (filters.subtemaNombre && filters.subtemaNombre.trim()) {
      const st = filters.subtemaNombre.toLowerCase().trim();
      localLogs = localLogs.filter((l) => String(l.details?.subtema_nombre || '').toLowerCase().includes(st));
    }
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase();
      localLogs = localLogs.filter((l) => {
        const d = l.details || {};
        return (
          l.entity_name.toLowerCase().includes(q) ||
          (l.entity_id && l.entity_id.toLowerCase().includes(q)) ||
          l.actor_name.toLowerCase().includes(q) ||
          (l.actor_username && l.actor_username.toLowerCase().includes(q)) ||
          String(d.subtema_nombre || '').toLowerCase().includes(q) ||
          String(d.tema_nombre || '').toLowerCase().includes(q) ||
          String(d.nombre_placa || '').toLowerCase().includes(q) ||
          String(d.tincion || '').toLowerCase().includes(q) ||
          String(d.aumento || '').toLowerCase().includes(q) ||
          String(d.comentario || '').toLowerCase().includes(q)
        );
      });
    }

    const total = localLogs.length;
    const paginated = localLogs.slice(offset, offset + limit);
    return { logs: paginated, total };
  }
};

/**
 * Calcula métricas acumuladas de auditoría para el panel de control.
 */
export const calculateAuditMetrics = (logs: AuditLogEntry[]): AuditMetrics => {
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const byEntity: Record<AuditEntityType, number> = {
    placa: 0,
    prueba: 0,
    pagina: 0,
    tema: 0,
    subtema: 0,
    mapa: 0,
    usuario: 0,
    sesion: 0,
    sistema: 0,
  };
  const byAction: Record<AuditActionType, number> = {
    create: 0,
    update: 0,
    delete: 0,
    classify: 0,
    publish: 0,
    unpublish: 0,
    restore: 0,
    reorder: 0,
    login: 0,
    logout: 0,
    role_change: 0,
    maintenance_toggle: 0,
  };

  const editorsMap = new Map<string, { name: string; username: string; count: number }>();
  let todayCount = 0;
  let criticalCount = 0;

  logs.forEach((log) => {
    if (byEntity[log.entity_type] !== undefined) byEntity[log.entity_type]++;
    if (byAction[log.action_type] !== undefined) byAction[log.action_type]++;

    if (log.created_at.startsWith(todayDateStr)) {
      todayCount++;
    }

    if (log.action_type === 'delete' || log.action_type === 'unpublish' || log.action_type === 'role_change') {
      criticalCount++;
    }

    const actorKey = log.actor_name || log.actor_username || 'Desconocido';
    const existing = editorsMap.get(actorKey) ?? {
      name: log.actor_name || log.actor_username || 'Desconocido',
      username: log.actor_username || '',
      count: 0,
    };
    existing.count++;
    editorsMap.set(actorKey, existing);
  });

  const topEditors = Array.from(editorsMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalCount: logs.length,
    todayCount,
    activeEditorsCount: editorsMap.size,
    criticalCount,
    byEntity,
    byAction,
    topEditors,
  };
};

/**
 * Exporta un conjunto de registros de auditoría a formato CSV seguro.
 */
export const exportAuditLogsToCsv = (logs: AuditLogEntry[]): string => {
  const headers = ['ID', 'Fecha y Hora', 'Categoría', 'Acción', 'Nombre del Recurso', 'ID Recurso', 'Nombre del Autor', 'Usuario', 'Rol', 'Detalles'];
  const escapeCsv = (val: unknown): string => {
    if (val == null) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = logs.map((log) => [
    log.id,
    new Date(log.created_at).toLocaleString('es-CO'),
    log.entity_type,
    log.action_type,
    log.entity_name,
    log.entity_id ?? '',
    log.actor_name,
    log.actor_username ?? '',
    log.actor_role ?? '',
    escapeCsv(log.details),
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
};

/**
 * Exporta un conjunto de registros de auditoría a formato JSON formateado.
 */
export const exportAuditLogsToJson = (logs: AuditLogEntry[]): string => {
  return JSON.stringify(logs, null, 2);
};

/**
 * Cuenta la cantidad de registros que coinciden con los criterios de purga antes de eliminarlos.
 */
export const countAuditLogsForPurge = async (params: PurgeAuditLogsParams): Promise<number> => {
  try {
    let query = supabase.from('unified_audit_logs').select('*', { count: 'exact', head: true });

    if (params.dateFrom) {
      query = query.gte('created_at', `${params.dateFrom}T00:00:00.000Z`);
    }
    if (params.dateTo) {
      query = query.lte('created_at', `${params.dateTo}T23:59:59.999Z`);
    }
    if (params.entityType && params.entityType !== 'all') {
      query = query.eq('entity_type', params.entityType);
    }
    if (params.actionType && params.actionType !== 'all') {
      query = query.eq('action_type', params.actionType);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch {
    // Fallback a localStorage
    const raw = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
      ? localStorage.getItem(FALLBACK_STORAGE_KEY)
      : null;
    let localLogs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];

    if (params.dateFrom) {
      const from = `${params.dateFrom}T00:00:00.000Z`;
      localLogs = localLogs.filter((l) => l.created_at >= from);
    }
    if (params.dateTo) {
      const to = `${params.dateTo}T23:59:59.999Z`;
      localLogs = localLogs.filter((l) => l.created_at <= to);
    }
    if (params.entityType && params.entityType !== 'all') {
      localLogs = localLogs.filter((l) => l.entity_type === params.entityType);
    }
    if (params.actionType && params.actionType !== 'all') {
      localLogs = localLogs.filter((l) => l.action_type === params.actionType);
    }

    return localLogs.length;
  }
};

/**
 * Elimina registros de auditoría por fecha específica, rango de fechas y categorías opcionales.
 */
export const purgeAuditLogs = async (params: PurgeAuditLogsParams): Promise<{ count: number }> => {
  let deletedCount = 0;

  // 1. Limpieza en Supabase
  try {
    let query = supabase.from('unified_audit_logs').delete({ count: 'exact' });

    let hasFilter = false;
    if (params.dateFrom) {
      query = query.gte('created_at', `${params.dateFrom}T00:00:00.000Z`);
      hasFilter = true;
    }
    if (params.dateTo) {
      query = query.lte('created_at', `${params.dateTo}T23:59:59.999Z`);
      hasFilter = true;
    }
    if (params.entityType && params.entityType !== 'all') {
      query = query.eq('entity_type', params.entityType);
      hasFilter = true;
    }
    if (params.actionType && params.actionType !== 'all') {
      query = query.eq('action_type', params.actionType);
      hasFilter = true;
    }

    if (!hasFilter) {
      // Si no se pasaron filtros pero se llamó a purge, limpiar todo
      query = query.neq('id', -1);
    }

    const { count, error } = await query;
    if (error) {
      // Intentar RPC si existe
      const { data: rpcCount, error: rpcError } = await supabase.rpc('purge_unified_audit_logs', {
        p_date_from: params.dateFrom ? `${params.dateFrom}T00:00:00.000Z` : null,
        p_date_to: params.dateTo ? `${params.dateTo}T23:59:59.999Z` : null,
        p_entity_type: params.entityType ?? null,
        p_action_type: params.actionType ?? null,
      });

      if (rpcError) throw error;
      deletedCount = Number(rpcCount ?? 0);
    } else {
      deletedCount = count ?? 0;
    }
  } catch (err) {
    console.warn('No se pudo purgar en Supabase unified_audit_logs, procediendo con fallback local:', err);
  }

  // 2. Limpieza en Fallback LocalStorage
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (raw) {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        const beforeCount = localLogs.length;

        const filtered = localLogs.filter((l) => {
          if (params.dateFrom && l.created_at < `${params.dateFrom}T00:00:00.000Z`) {
            return true; // Conservar
          }
          if (params.dateTo && l.created_at > `${params.dateTo}T23:59:59.999Z`) {
            return true; // Conservar
          }
          if (params.entityType && params.entityType !== 'all' && l.entity_type !== params.entityType) {
            return true; // Conservar
          }
          if (params.actionType && params.actionType !== 'all' && l.action_type !== params.actionType) {
            return true; // Conservar
          }
          // Si cumple todas las condiciones de borrado, se descarta (elimina)
          return false;
        });

        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(filtered));
        const localDeleted = beforeCount - filtered.length;
        if (deletedCount === 0) {
          deletedCount = localDeleted;
        }
      }
    }
  } catch (err) {
    console.warn('Error al limpiar localStorage de auditoría:', err);
  }

  return { count: deletedCount };
};

/**
 * Elimina registros individuales seleccionados por ID.
 */
export const deleteAuditLogsByIds = async (ids: number[]): Promise<{ count: number }> => {
  if (ids.length === 0) return { count: 0 };

  let count = 0;
  try {
    const { count: deletedCount, error } = await supabase
      .from('unified_audit_logs')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (!error && deletedCount != null) {
      count = deletedCount;
    }
  } catch (err) {
    console.warn('Error al eliminar logs en Supabase:', err);
  }

  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (raw) {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        const filtered = localLogs.filter((l) => !ids.includes(l.id));
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(filtered));
        if (count === 0) count = localLogs.length - filtered.length;
      }
    }
  } catch {
    // Silencioso
  }

  return { count };
};

/**
 * Consulta específica para el historial de cambios en el contenido de la página y configuración de un TEMA.
 * Excluye las placas y combina unified_audit_logs con content_page_versions.
 */
export const fetchTemaAuditLogs = async (
  temaId?: number,
  temaNombre?: string
): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  const mergedLogs: AuditLogEntry[] = [];
  const seenKeys = new Set<string>();

  // 1. Consultar unified_audit_logs para tema y página
  try {
    let query = supabase
      .from('unified_audit_logs')
      .select('*')
      .in('entity_type', ['tema', 'pagina'])
      .order('created_at', { ascending: false });

    if (temaId) {
      query = query.eq('entity_id', String(temaId));
    }

    const { data } = await query;
    if (data) {
      data.forEach((row: any) => {
        const key = `unified-${row.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push(row as AuditLogEntry);
        }
      });
    }
  } catch (err) {
    console.warn('Error al consultar auditoria de tema:', err);
  }

  // 2. Consultar versiones de contenido de la página del tema (subtemas_page)
  if (temaId) {
    try {
      const { data: pageVersions } = await supabase
        .from('content_page_versions')
        .select('*')
        .eq('entity_type', 'subtemas_page')
        .eq('entity_id', temaId)
        .order('updated_at', { ascending: false });

      if (pageVersions && pageVersions.length > 0) {
        pageVersions.forEach((v: any) => {
          const key = `page_version-${v.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedLogs.push({
              id: Number(v.id) + 100000,
              created_at: v.updated_at || v.created_at || new Date().toISOString(),
              entity_type: 'pagina',
              action_type: v.is_published ? 'publish' : 'update',
              entity_id: String(v.entity_id),
              entity_name: `Contenido de página: ${v.version_name || (temaNombre ? `Tema ${temaNombre}` : `Tema #${v.entity_id}`)}`,
              actor_user_id: null,
              actor_username: v.updated_by || v.created_by || 'editor',
              actor_name: v.updated_by_name || v.created_by_name || v.updated_by || v.created_by || 'Editor de Contenido',
              actor_role: 'Editor',
              details: {
                version_id: v.id,
                version_name: v.version_name,
                blocks_count: Array.isArray(v.blocks) ? v.blocks.length : (v.blocks_count || 0),
                is_published: v.is_published,
                published_at: v.published_at,
                tema_id: v.entity_id,
                tema_nombre: temaNombre || `Tema #${v.entity_id}`,
                descripcion: v.description,
                tipo_pagina: 'Página de Subtemas (Tema)',
              },
              ip_address: null,
            });
          }
        });
      }
    } catch (err) {
      console.warn('Error al consultar versiones de página del tema:', err);
    }
  }

  // 3. Fallback de localStorage
  if (mergedLogs.length === 0) {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null;
    if (raw) {
      try {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        localLogs
          .filter((l) => (l.entity_type === 'tema' || l.entity_type === 'pagina') && (!temaId || String(l.entity_id) === String(temaId)))
          .forEach((l) => mergedLogs.push(l));
      } catch {}
    }
  }

  mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { logs: mergedLogs, total: mergedLogs.length };
};

/**
 * Consulta específica para el historial de cambios en el contenido de la página y configuración de un SUBTEMA.
 * Excluye las placas y combina unified_audit_logs con content_page_versions.
 */
export const fetchSubtemaAuditLogs = async (
  subtemaId?: number,
  subtemaNombre?: string
): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  const mergedLogs: AuditLogEntry[] = [];
  const seenKeys = new Set<string>();

  // 1. Consultar unified_audit_logs para subtema y página
  try {
    let query = supabase
      .from('unified_audit_logs')
      .select('*')
      .in('entity_type', ['subtema', 'pagina'])
      .order('created_at', { ascending: false });

    if (subtemaId) {
      query = query.eq('entity_id', String(subtemaId));
    }

    const { data } = await query;
    if (data) {
      data.forEach((row: any) => {
        const key = `unified-${row.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push(row as AuditLogEntry);
        }
      });
    }
  } catch (err) {
    console.warn('Error al consultar auditoria de subtema:', err);
  }

  // 2. Consultar versiones de contenido de la página del subtema (placas_page)
  if (subtemaId) {
    try {
      const { data: pageVersions } = await supabase
        .from('content_page_versions')
        .select('*')
        .eq('entity_type', 'placas_page')
        .eq('entity_id', subtemaId)
        .order('updated_at', { ascending: false });

      if (pageVersions && pageVersions.length > 0) {
        pageVersions.forEach((v: any) => {
          const key = `page_version-${v.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedLogs.push({
              id: Number(v.id) + 100000,
              created_at: v.updated_at || v.created_at || new Date().toISOString(),
              entity_type: 'pagina',
              action_type: v.is_published ? 'publish' : 'update',
              entity_id: String(v.entity_id),
              entity_name: `Contenido de página: ${v.version_name || (subtemaNombre ? `Subtema ${subtemaNombre}` : `Subtema #${v.entity_id}`)}`,
              actor_user_id: null,
              actor_username: v.updated_by || v.created_by || 'editor',
              actor_name: v.updated_by_name || v.created_by_name || v.updated_by || v.created_by || 'Editor de Contenido',
              actor_role: 'Editor',
              details: {
                version_id: v.id,
                version_name: v.version_name,
                blocks_count: Array.isArray(v.blocks) ? v.blocks.length : (v.blocks_count || 0),
                is_published: v.is_published,
                published_at: v.published_at,
                subtema_id: v.entity_id,
                subtema_nombre: subtemaNombre || `Subtema #${v.entity_id}`,
                descripcion: v.description,
                tipo_pagina: 'Página de Placas (Subtema)',
              },
              ip_address: null,
            });
          }
        });
      }
    } catch (err) {
      console.warn('Error al consultar versiones de página del subtema:', err);
    }
  }

  // 3. Fallback de localStorage
  if (mergedLogs.length === 0) {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null;
    if (raw) {
      try {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        localLogs
          .filter((l) => (l.entity_type === 'subtema' || l.entity_type === 'pagina') && (!subtemaId || String(l.entity_id) === String(subtemaId)))
          .forEach((l) => mergedLogs.push(l));
      } catch {}
    }
  }

  mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { logs: mergedLogs, total: mergedLogs.length };
};

/**
 * Consulta específica para el historial de cambios exclusivo de una PLACA.
 */
export const fetchPlacaAuditLogs = async (
  placaId: number | string
): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  const mergedLogs: AuditLogEntry[] = [];
  const seenKeys = new Set<string>();
  const idStr = String(placaId);

  // 1. Consultar unified_audit_logs para esta placa
  try {
    const { data } = await supabase
      .from('unified_audit_logs')
      .select('*')
      .eq('entity_type', 'placa')
      .eq('entity_id', idStr)
      .order('created_at', { ascending: false });

    if (data) {
      data.forEach((row: any) => {
        const key = `unified-${row.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push(row as AuditLogEntry);
        }
      });
    }
  } catch (err) {
    console.warn('Error al consultar auditoria unificada de placa:', err);
  }

  // 2. Consultar placas_activity_logs como fuente complementaria
  try {
    const numericId = Number(placaId);
    if (!isNaN(numericId)) {
      const { data: palData } = await supabase
        .from('placas_activity_logs')
        .select('*')
        .or(`placa_id.eq.${numericId},waiting_plate_id.eq.${numericId}`)
        .order('created_at', { ascending: false });

      if (palData && palData.length > 0) {
        palData.forEach((row: any) => {
          const key = `pal-${row.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedLogs.push({
              id: Number(row.id) + 500000,
              created_at: row.created_at,
              entity_type: 'placa',
              action_type: row.action_type === 'upload_classified' ? 'create' : (row.action_type === 'classify_waiting_plate' ? 'classify' : (row.action_type === 'edit_plate' ? 'update' : (row.action_type === 'delete_classified' ? 'delete' : 'update'))),
              entity_id: idStr,
              entity_name: row.details?.nombre_placa || `Placa #${idStr}`,
              actor_user_id: row.actor_user_id,
              actor_username: row.actor_username,
              actor_name: row.actor_username || 'Usuario',
              actor_role: null,
              details: row.details || {},
              ip_address: null,
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('Error al consultar placas_activity_logs:', err);
  }

  // 3. Fallback de localStorage
  if (mergedLogs.length === 0) {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null;
    if (raw) {
      try {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        localLogs
          .filter((l) => l.entity_type === 'placa' && String(l.entity_id) === idStr)
          .forEach((l) => mergedLogs.push(l));
      } catch {}
    }
  }

  // Enriquecer con foto si falta
  const withoutPhoto = mergedLogs.filter((l) => !l.details?.photo_url && !l.details?.image_url);
  if (withoutPhoto.length > 0 && !isNaN(Number(placaId))) {
    try {
      const { data: plateData } = await supabase
        .from('placas')
        .select('id, photo_url, aumento, tincion, subtema_id, tema_id')
        .eq('id', Number(placaId))
        .single();
      if (plateData) {
        mergedLogs.forEach((log) => {
          if (!log.details) log.details = {};
          if (!log.details.photo_url) log.details.photo_url = plateData.photo_url;
          if (!log.details.aumento) log.details.aumento = plateData.aumento;
          if (!log.details.tincion) log.details.tincion = plateData.tincion;
        });
      }
    } catch {}
  }

  mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { logs: mergedLogs, total: mergedLogs.length };
};

/**
 * Consulta específica para el historial de cambios exclusivo de una PRUEBA / EVALUACIÓN.
 */
export const fetchPruebaAuditLogs = async (
  pruebaId: number | string,
  pruebaNombre?: string
): Promise<{ logs: AuditLogEntry[]; total: number }> => {
  const mergedLogs: AuditLogEntry[] = [];
  const seenKeys = new Set<string>();
  const idStr = String(pruebaId);

  // 1. Consultar unified_audit_logs para esta prueba
  try {
    let query = supabase
      .from('unified_audit_logs')
      .select('*')
      .eq('entity_type', 'prueba');

    if (idStr && idStr !== 'undefined' && idStr !== 'null') {
      query = query.eq('entity_id', idStr);
    } else if (pruebaNombre) {
      query = query.ilike('entity_name', `%${pruebaNombre}%`);
    }

    query = query.order('created_at', { ascending: false });
    const { data } = await query;

    if (data) {
      data.forEach((row: any) => {
        const key = `unified-${row.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedLogs.push(row as AuditLogEntry);
        }
      });
    }
  } catch (err) {
    console.warn('Error al consultar auditoria unificada de prueba:', err);
  }

  // 2. Fallback de localStorage
  if (mergedLogs.length === 0) {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null;
    if (raw) {
      try {
        const localLogs: AuditLogEntry[] = JSON.parse(raw);
        localLogs
          .filter((l) => l.entity_type === 'prueba' && String(l.entity_id) === idStr)
          .forEach((l) => mergedLogs.push(l));
      } catch {}
    }
  }

  mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return { logs: mergedLogs, total: mergedLogs.length };
};

