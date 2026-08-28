import { supabase } from './supabase';

export interface SiteMaintenanceStatus {
  enabled: boolean;
  message: string;
  updatedAt: string | null;
  bannerEnabled: boolean;
  bannerMessage: string;
  disabledFeatures: string[];
}

const DEFAULT_STATUS: SiteMaintenanceStatus = {
  enabled: false,
  message: 'El sitio se encuentra temporalmente fuera de servicio por mantenimiento.',
  updatedAt: null,
  bannerEnabled: false,
  bannerMessage: '',
  disabledFeatures: [],
};

export const fetchSiteMaintenanceStatus = async (): Promise<SiteMaintenanceStatus> => {
  const { data, error } = await supabase
    .from('site_runtime_settings')
    .select('maintenance_enabled, maintenance_message, updated_at, banner_enabled, banner_message, disabled_features, maintenance_starts_at, maintenance_ends_at')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('No fue posible consultar el estado del sitio:', error);
    return DEFAULT_STATUS;
  }

  const now = Date.now();
  const scheduled = Boolean(data.maintenance_starts_at)
    && new Date(data.maintenance_starts_at).getTime() <= now
    && (!data.maintenance_ends_at || new Date(data.maintenance_ends_at).getTime() > now);
  return {
    enabled: data.maintenance_enabled === true || scheduled,
    message: data.maintenance_message?.trim() || DEFAULT_STATUS.message,
    updatedAt: data.updated_at ?? null,
    bannerEnabled: data.banner_enabled === true,
    bannerMessage: data.banner_message ?? '',
    disabledFeatures: Array.isArray(data.disabled_features) ? data.disabled_features : [],
  };
};

export const setSiteMaintenanceMode = async (
  enabled: boolean,
  message: string,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.rpc('atlas_set_site_maintenance', {
    p_enabled: enabled,
    p_message: message.trim() || DEFAULT_STATUS.message,
  });

  if (error) {
    console.error('No fue posible cambiar el estado del sitio:', error);
    return { ok: false, error: error.message || 'Error desconocido.' };
  }

  return { ok: true };
};

export const canBypassMaintenance = (
  user: { rol?: string; is_protected?: boolean } | null | undefined,
  isAuthenticated: boolean,
): boolean => {
  if (!isAuthenticated || !user) return false;
  return (
    user.rol === 'Administrador' ||
    user.rol === 'Microscopía' ||
    Boolean(user.is_protected)
  );
};

export const isFeatureDisabled = (
  featureKey: string,
  disabledFeatures: string[] = [],
): boolean => {
  if (!Array.isArray(disabledFeatures)) return false;
  return disabledFeatures.includes(featureKey);
};

export const isParcialDisabled = (parcialKey: string, disabledFeatures: string[] = []): boolean => {
  if (!parcialKey || !Array.isArray(disabledFeatures)) return false;
  const normalized = parcialKey.toLowerCase().trim();
  return (
    disabledFeatures.includes(`parcial_${normalized}`) ||
    disabledFeatures.includes(normalized)
  );
};

export const isTemaDisabled = (
  temaId: number | string | null | undefined,
  parcialKey?: string | null,
  disabledFeatures: string[] = [],
): boolean => {
  if (!Array.isArray(disabledFeatures)) return false;
  if (parcialKey && isParcialDisabled(parcialKey, disabledFeatures)) {
    return true;
  }
  if (temaId === null || temaId === undefined) return false;
  return disabledFeatures.includes(`tema_${temaId}`);
};

export const subscribeSiteMaintenanceStatus = (
  onStatusChange: (status: SiteMaintenanceStatus) => void,
): (() => void) => {
  let isSubscribed = true;

  const triggerUpdate = () => {
    if (!isSubscribed) return;
    void fetchSiteMaintenanceStatus().then((status) => {
      if (isSubscribed) onStatusChange(status);
    });
  };

  // Realtime subscription using Supabase channel
  const channel = supabase
    .channel('atlas_maintenance_realtime_channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'site_runtime_settings', filter: 'id=eq.1' },
      () => {
        triggerUpdate();
      },
    )
    .subscribe();

  // Background polling every 15 seconds to ensure fast sync even if realtime is delayed
  const pollInterval = window.setInterval(triggerUpdate, 15_000);

  // Sync on tab visibility change and window focus
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      triggerUpdate();
    }
  };

  window.addEventListener('focus', triggerUpdate);
  window.addEventListener('online', triggerUpdate);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    isSubscribed = false;
    window.clearInterval(pollInterval);
    window.removeEventListener('focus', triggerUpdate);
    window.removeEventListener('online', triggerUpdate);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void supabase.removeChannel(channel);
  };
};
