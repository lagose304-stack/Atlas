import { supabase } from './supabase';

export type PlateActivityActionType =
  | 'upload_classified'
  | 'upload_unclassified'
  | 'classify_waiting_plate'
  | 'edit_plate'
  | 'delete_classified'
  | 'delete_unclassified';

interface ActorInfo {
  id?: number | null;
  username?: string | null;
}

interface PlateActivityPayload {
  actionType: PlateActivityActionType;
  targetTable: 'placas' | 'placas_sin_clasificar';
  placaId?: number | null;
  waitingPlateId?: number | null;
  actor?: ActorInfo | null;
  details?: Record<string, unknown>;
}

const FALLBACK_STORAGE_KEY = 'atlas_plate_activity_logs_fallback';
let supportsAuditTable: boolean | null = null;

const writeFallback = (payload: PlateActivityPayload) => {
  try {
    const existingRaw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) as Array<Record<string, unknown>> : [];

    const next = [
      ...existing,
      {
        action_type: payload.actionType,
        target_table: payload.targetTable,
        placa_id: payload.placaId ?? null,
        waiting_plate_id: payload.waitingPlateId ?? null,
        actor_user_id: payload.actor?.id ?? null,
        actor_username: payload.actor?.username ?? null,
        details: payload.details ?? {},
        created_at: new Date().toISOString(),
      },
    ].slice(-1000);

    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('No fue posible guardar auditoria de placas local:', error);
  }
};

export const logPlateActivity = async (payload: PlateActivityPayload): Promise<void> => {
  if (supportsAuditTable === false) {
    writeFallback(payload);
    return;
  }

  const { error } = await supabase.from('placas_activity_logs').insert({
    action_type: payload.actionType,
    target_table: payload.targetTable,
    placa_id: payload.placaId ?? null,
    waiting_plate_id: payload.waitingPlateId ?? null,
    actor_user_id: payload.actor?.id ?? null,
    actor_username: payload.actor?.username ?? null,
    details: payload.details ?? {},
  });

  if (error) {
    supportsAuditTable = false;
    writeFallback(payload);
    return;
  }

  supportsAuditTable = true;
};
