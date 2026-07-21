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
