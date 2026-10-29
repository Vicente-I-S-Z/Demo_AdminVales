import { supabase } from './supabase';
import type { DailyCode } from '../types';

// ─── Fetch all daily codes with authorization status ─────────
export async function getDailyCodes(): Promise<DailyCode[]> {
  const [codesRes, authRes] = await Promise.all([
    supabase
      .from('daily_user_codes')
      .select('codigo_diario, user_email, is_used, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('code_authorizations')
      .select('codigo_diario, is_authorized'),
  ]);

  if (codesRes.error) throw codesRes.error;

  const authMap = new Map<string, boolean>();
  (authRes.data ?? []).forEach((a) => authMap.set(a.codigo_diario, a.is_authorized));

  return (codesRes.data ?? []).map((c) => ({
    ...c,
    is_authorized: authMap.get(c.codigo_diario) ?? false,
  }));
}

// ─── Authorize a deferred code ───────────────────────────────
export async function authorizeDeferredCode(codigoDiario: string): Promise<void> {
  // Check if authorization already exists
  const { data: existing } = await supabase
    .from('code_authorizations')
    .select('codigo_diario, is_authorized')
    .eq('codigo_diario', codigoDiario);

  if (existing && existing.length > 0) {
    // Update existing
    const { error } = await supabase
      .from('code_authorizations')
      .update({ is_authorized: true })
      .eq('codigo_diario', codigoDiario);
    if (error) throw error;
  } else {
    // Insert new
    const { error } = await supabase
      .from('code_authorizations')
      .insert({ codigo_diario: codigoDiario, is_authorized: true });
    if (error) throw error;
  }
}

// ─── Remove authorization from a code ────────────────────────
export async function disableCodeAuthorization(codigoDiario: string): Promise<void> {
  const { error } = await supabase
    .from('code_authorizations')
    .delete()
    .eq('codigo_diario', codigoDiario);

  if (error) throw error;
}
