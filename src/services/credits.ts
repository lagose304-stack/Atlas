import { supabase } from './supabase';

export type CreditProfileKey = 'developer' | 'microscopy_coordinator';

export interface CreditProfile {
  profile_key: CreditProfileKey;
  photo_url: string | null;
  updated_at?: string;
}

export interface CreditContributor {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  contribution: string | null;
  photo_url: string | null;
  sort_order: number;
}

export const loadCredits = async () => {
  const profilesResult = await supabase.from('credit_profiles').select('profile_key, photo_url, updated_at');
  let contributorsResult = await supabase.from('credit_contributors').select('id, name, start_year, end_year, is_current, contribution, photo_url, sort_order')
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  let supportsContributorPhotos = true;
  if (contributorsResult.error && /photo_url|column/i.test(String(contributorsResult.error.message ?? ''))) {
    supportsContributorPhotos = false;
    const fallbackResult = await supabase.from('credit_contributors').select('id, name, start_year, end_year, is_current, contribution, sort_order')
      .order('sort_order', { ascending: true }).order('name', { ascending: true });
    contributorsResult = {
      ...fallbackResult,
      data: (fallbackResult.data ?? []).map(item => ({ ...item, photo_url: null })),
    } as typeof contributorsResult;
  }
  if (profilesResult.error) throw profilesResult.error;
  if (contributorsResult.error) throw contributorsResult.error;
  return {
    profiles: (profilesResult.data ?? []) as CreditProfile[],
    contributors: (contributorsResult.data ?? []) as CreditContributor[],
    supportsContributorPhotos,
  };
};
