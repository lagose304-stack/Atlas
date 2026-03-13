import { supabase } from './supabase';
import { getVisitorId } from './analytics';

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export const getActiveThresholdIso = (): string => {
  return new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
};

export const heartbeatPresence = async (): Promise<void> => {
  const visitorId = getVisitorId();
  const nowIso = new Date().toISOString();

  await supabase.from('site_online_presence').upsert(
    {
      visitor_id: visitorId,
      last_seen: nowIso,
    },
    {
      onConflict: 'visitor_id',
    },
  );
};

export const fetchActiveVisitorsCount = async (): Promise<number> => {
  const threshold = getActiveThresholdIso();

  const { count, error } = await supabase
    .from('site_online_presence')
    .select('visitor_id', { count: 'exact', head: true })
    .gte('last_seen', threshold);

  if (error) {
    return 0;
  }

  return count ?? 0;
};
