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
  sort_order: number;
}

export const loadCredits = async () => {
  const [profilesResult, contributorsResult] = await Promise.all([
    supabase.from('credit_profiles').select('profile_key, photo_url, updated_at'),
    supabase.from('credit_contributors').select('id, name, start_year, end_year, is_current, contribution, sort_order')
      .order('sort_order', { ascending: true }).order('name', { ascending: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (contributorsResult.error) throw contributorsResult.error;
  return {
    profiles: (profilesResult.data ?? []) as CreditProfile[],
    contributors: (contributorsResult.data ?? []) as CreditContributor[],
  };
};
