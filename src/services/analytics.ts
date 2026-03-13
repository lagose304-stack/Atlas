import { supabase } from './supabase';

export type AnalyticsEventType = 'site_visit' | 'tema_view' | 'subtema_view' | 'placa_view';
export type AnalyticsRangePreset = 'all' | 'year' | 'month' | 'week' | 'day';

interface AnalyticsEventInsert {
  event_type: AnalyticsEventType;
  visitor_id: string;
  tema_id?: number | null;
  subtema_id?: number | null;
  placa_id?: number | null;
}

export interface AnalyticsEvent {
  id: number;
  event_type: AnalyticsEventType;
  visitor_id: string;
  tema_id: number | null;
  subtema_id: number | null;
  placa_id: number | null;
  created_at: string;
}

export interface AnalyticsClearResult {
  ok: boolean;
  error?: string;
}

const VISITOR_ID_KEY = 'atlas_visitor_id';
const SESSION_VISIT_LOGGED_KEY = 'atlas_session_visit_logged';
const ANALYTICS_FALLBACK_KEY = 'atlas_analytics_events_fallback';
const SESSION_EVENT_TS_PREFIX = 'atlas_event_ts';
const SESSION_VISIT_LOCK_KEY = 'atlas_site_visit_inflight';
const EVENT_DEDUPE_WINDOW_MS = 2500;

const createVisitorId = (): string => {
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

export const getVisitorId = (): string => {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = createVisitorId();
  localStorage.setItem(VISITOR_ID_KEY, created);
  return created;
};

const fallbackStoreEvent = (event: AnalyticsEventInsert) => {
  try {
    const raw = localStorage.getItem(ANALYTICS_FALLBACK_KEY);
    const current = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const next = [
      ...current,
      {
        ...event,
        created_at: new Date().toISOString(),
      },
    ].slice(-1000);

    localStorage.setItem(ANALYTICS_FALLBACK_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('No fue posible guardar analitica local:', error);
  }
};

export const logAnalyticsEvent = async (event: AnalyticsEventInsert): Promise<void> => {
  const { error } = await supabase.from('site_analytics_events').insert(event);

  if (error) {
    fallbackStoreEvent(event);
  }
};

const shouldSkipRecentEvent = (eventKey: string): boolean => {
  const storageKey = `${SESSION_EVENT_TS_PREFIX}:${eventKey}`;
  const raw = sessionStorage.getItem(storageKey);
  const now = Date.now();

  if (raw) {
    const lastTs = Number(raw);
    if (!Number.isNaN(lastTs) && now - lastTs <= EVENT_DEDUPE_WINDOW_MS) {
      return true;
    }
  }

  sessionStorage.setItem(storageKey, String(now));
  return false;
};

export const logSiteVisitOncePerSession = async (): Promise<void> => {
  const alreadyLogged = sessionStorage.getItem(SESSION_VISIT_LOGGED_KEY) === 'true';
  const inflight = sessionStorage.getItem(SESSION_VISIT_LOCK_KEY) === 'true';
  if (alreadyLogged) {
    return;
  }

  if (inflight) {
    return;
  }

  sessionStorage.setItem(SESSION_VISIT_LOCK_KEY, 'true');
  sessionStorage.setItem(SESSION_VISIT_LOGGED_KEY, 'true');

  await logAnalyticsEvent({
    event_type: 'site_visit',
    visitor_id: getVisitorId(),
  });
  sessionStorage.removeItem(SESSION_VISIT_LOCK_KEY);
};

export const logTemaView = async (temaId: number): Promise<void> => {
  if (shouldSkipRecentEvent(`tema_view:${temaId}`)) {
    return;
  }

  await logAnalyticsEvent({
    event_type: 'tema_view',
    visitor_id: getVisitorId(),
    tema_id: temaId,
  });
};

export const logSubtemaView = async (subtemaId: number): Promise<void> => {
  if (shouldSkipRecentEvent(`subtema_view:${subtemaId}`)) {
    return;
  }

  await logAnalyticsEvent({
    event_type: 'subtema_view',
    visitor_id: getVisitorId(),
    subtema_id: subtemaId,
  });
};

export const logPlacaView = async (placaId: number, subtemaId?: number): Promise<void> => {
  if (shouldSkipRecentEvent(`placa_view:${placaId}`)) {
    return;
  }

  await logAnalyticsEvent({
    event_type: 'placa_view',
    visitor_id: getVisitorId(),
    placa_id: placaId,
    subtema_id: subtemaId ?? null,
  });
};

export const clearAllAnalyticsEvents = async (): Promise<AnalyticsClearResult> => {
  const rpcResult = await supabase.rpc('reset_site_analytics_events');

  if (!rpcResult.error) {
    localStorage.removeItem(ANALYTICS_FALLBACK_KEY);
    return { ok: true };
  }

  const fallbackResult = await supabase
    .from('site_analytics_events')
    .delete()
    .gte('id', 0);

  if (fallbackResult.error) {
    const message = fallbackResult.error.message || rpcResult.error.message || 'Error desconocido al borrar analitica.';
    console.error('No fue posible reiniciar analitica:', {
      rpcError: rpcResult.error,
      deleteError: fallbackResult.error,
    });
    return { ok: false, error: message };
  }

  localStorage.removeItem(ANALYTICS_FALLBACK_KEY);
  return { ok: true };
};

export const getRangeStartIso = (range: AnalyticsRangePreset): string | null => {
  if (range === 'all') {
    return null;
  }

  const now = new Date();

  if (range === 'year') {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }

  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  if (range === 'week') {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

export const fetchAnalyticsEvents = async (range: AnalyticsRangePreset): Promise<AnalyticsEvent[]> => {
  const startIso = getRangeStartIso(range);

  let query = supabase
    .from('site_analytics_events')
    .select('id, event_type, visitor_id, tema_id, subtema_id, placa_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);

  if (startIso) {
    query = query.gte('created_at', startIso);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as AnalyticsEvent[];
};
