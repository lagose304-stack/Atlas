import { supabase } from './supabase';

export type DiagnosticItem = { name: string; ok: boolean; detail: string; durationMs: number };
export type AdminSession = { id: string; username: string; created_at: string; last_seen_at: string; expires_at: string; current: boolean };
export type AuditEntry = { id: number; event_type: string; username: string | null; details: Record<string, unknown>; created_at: string };

export interface SiteControls {
  bannerEnabled: boolean;
  bannerMessage: string;
  disabledFeatures: string[];
  maintenanceStartsAt: string;
  maintenanceEndsAt: string;
}

export const DEFAULT_CONTROLS: SiteControls = {
  bannerEnabled: false,
  bannerMessage: '',
  disabledFeatures: [],
  maintenanceStartsAt: '',
  maintenanceEndsAt: '',
};

export const fetchSiteControls = async (): Promise<SiteControls> => {
  const { data } = await supabase.from('site_runtime_settings')
    .select('banner_enabled, banner_message, disabled_features, maintenance_starts_at, maintenance_ends_at')
    .eq('id', 1).maybeSingle();
  if (!data) return DEFAULT_CONTROLS;
  return {
    bannerEnabled: data.banner_enabled === true,
    bannerMessage: data.banner_message ?? '',
    disabledFeatures: Array.isArray(data.disabled_features) ? data.disabled_features : [],
    maintenanceStartsAt: data.maintenance_starts_at ? String(data.maintenance_starts_at).slice(0, 16) : '',
    maintenanceEndsAt: data.maintenance_ends_at ? String(data.maintenance_ends_at).slice(0, 16) : '',
  };
};

export const saveSiteControls = async (controls: SiteControls) => {
  const { error } = await supabase.rpc('atlas_update_site_controls', {
    p_controls: {
      banner_enabled: controls.bannerEnabled,
      banner_message: controls.bannerMessage,
      disabled_features: controls.disabledFeatures,
      maintenance_starts_at: controls.maintenanceStartsAt || null,
      maintenance_ends_at: controls.maintenanceEndsAt || null,
    },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
};

export const runSiteDiagnostics = async (): Promise<DiagnosticItem[]> => {
  const probes = [
    ['Base de datos', () => supabase.from('temas').select('id', { count: 'exact', head: true })],
    ['Placas', () => supabase.from('placas').select('id', { count: 'exact', head: true })],
    ['Evaluaciones', () => supabase.from('pruebas').select('id', { count: 'exact', head: true })],
    ['Analítica', () => supabase.from('site_analytics_events').select('id', { count: 'exact', head: true })],
    ['Presencia', () => supabase.from('site_online_presence').select('visitor_id', { count: 'exact', head: true })],
  ] as const;
  return Promise.all(probes.map(async ([name, probe]) => {
    const start = performance.now();
    const result = await probe();
    return { name, ok: !result.error, detail: result.error?.message ?? `${result.count ?? 0} registros`, durationMs: Math.round(performance.now() - start) };
  }));
};

export const cleanStalePresence = async () => {
  const { data, error } = await supabase.rpc('atlas_clean_stale_presence');
  return error ? { ok: false, error: error.message, removed: 0 } : { ok: true, removed: Number(data ?? 0) };
};

export const fetchAdminSessions = async (): Promise<AdminSession[]> => {
  const { data, error } = await supabase.rpc('atlas_list_active_sessions');
  return error || !Array.isArray(data) ? [] : data as AdminSession[];
};

export const revokeAdminSession = async (sessionId: string) => {
  const { error } = await supabase.rpc('atlas_revoke_session', { p_session_id: sessionId });
  return error ? { ok: false, error: error.message } : { ok: true };
};

export const fetchControlAudit = async (): Promise<AuditEntry[]> => {
  const { data } = await supabase.from('site_control_audit_logs')
    .select('id, event_type, username, details, created_at').order('created_at', { ascending: false }).limit(80);
  return (data ?? []) as AuditEntry[];
};

export const fetchRecentClientErrors = async (): Promise<AuditEntry[]> => {
  const { data } = await supabase.from('site_client_errors')
    .select('id, event_type, username, details, created_at').order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as AuditEntry[];
};

export const getStorageInventory = async () => {
  const [plates, waiting, tests, maps] = await Promise.all([
    supabase.from('placas').select('id, photo_url'),
    supabase.from('placas_sin_clasificar').select('id, photo_url'),
    supabase.from('pruebas').select('id, image_url'),
    supabase.from('interactive_maps').select('id, image_url'),
  ]);
  const urls = [
    ...(plates.data ?? []).map((row) => row.photo_url),
    ...(waiting.data ?? []).map((row) => row.photo_url),
    ...(tests.data ?? []).map((row) => row.image_url),
    ...(maps.data ?? []).map((row) => row.image_url),
  ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  return {
    referencedImages: urls.length,
    uniqueImages: new Set(urls).size,
    duplicateReferences: urls.length - new Set(urls).size,
    missingPlateUrls: (plates.data ?? []).filter((row) => !row.photo_url).length,
    queryErrors: [plates.error, waiting.error, tests.error, maps.error].filter(Boolean).length,
  };
};

export const downloadSiteBackup = async () => {
  const tables = ['temas', 'subtemas', 'placas', 'placas_sin_clasificar', 'tinciones', 'content_blocks', 'content_page_publications', 'interactive_maps', 'pruebas', 'prueba_preguntas', 'prueba_pregunta_opciones', 'site_runtime_settings'];
  const results = await Promise.all(tables.map(async (table) => {
    const { data, error } = await supabase.from(table).select('*');
    return [table, { data: data ?? [], error: error?.message ?? null }] as const;
  }));
  const backup = { format: 'atlas-backup-v1', created_at: new Date().toISOString(), tables: Object.fromEntries(results) };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `atlas_respaldo_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const logClientError = async (eventType: string, details: Record<string, unknown>) => {
  try {
    await supabase.from('site_client_errors').insert({ event_type: eventType, details });
  } catch {
    // El reporte nunca debe provocar otro error visible ni un ciclo de eventos.
  }
};
