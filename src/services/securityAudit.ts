import { supabase } from './supabase';

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'logout'
  | 'session_invalidated'
  | 'route_denied';

interface SecurityEventPayload {
  userId?: number | null;
  username?: string | null;
  details?: Record<string, unknown>;
}

const FALLBACK_STORAGE_KEY = 'atlas_security_events';
let supportsAuditTable: boolean | null = null;

const writeFallbackEvent = (eventType: SecurityEventType, payload: SecurityEventPayload) => {
  try {
    const existingRaw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) as Array<Record<string, unknown>> : [];

    const next = [
      ...existing,
      {
        event_type: eventType,
        user_id: payload.userId ?? null,
        username: payload.username ?? null,
        details: payload.details ?? {},
        created_at: new Date().toISOString(),
      },
    ].slice(-200);

    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('No fue posible guardar auditoria local:', error);
  }
};

export const logSecurityEvent = async (
  eventType: SecurityEventType,
  payload: SecurityEventPayload = {},
): Promise<void> => {
  if (supportsAuditTable === false) {
    writeFallbackEvent(eventType, payload);
    return;
  }

  const { error } = await supabase.from('security_audit_logs').insert({
    event_type: eventType,
    user_id: payload.userId ?? null,
    username: payload.username ?? null,
    details: payload.details ?? {},
  });

  if (error) {
    supportsAuditTable = false;
    writeFallbackEvent(eventType, payload);
    return;
  }

  supportsAuditTable = true;
};
