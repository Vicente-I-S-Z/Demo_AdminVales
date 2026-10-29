import { supabase } from './supabase';
import type { UnlockRequest } from '../types';

// ─── Fetch all unlock requests merged with leader info ────────
export async function getUnlockRequests(): Promise<UnlockRequest[]> {
  const [reqRes, leaderRes] = await Promise.all([
    supabase
      .from('solicitudes_desbloqueo')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('lideres').select('numero_lider, nombre, email'),
  ]);

  if (reqRes.error) throw reqRes.error;

  const leaderMap = new Map<string, { nombre: string; email: string }>();
  (leaderRes.data ?? []).forEach((l) => {
    const key = String(l.numero_lider ?? '').trim();
    if (key) {
      leaderMap.set(key, { nombre: l.nombre, email: l.email });
    }
  });

  return (reqRes.data ?? []).map((r) => {
    const numLiderStr = String(r.numero_lider ?? '').trim();
    const leaderInfo = leaderMap.get(numLiderStr);
    return {
      ...r,
      numero_lider: numLiderStr,
      lider_name: leaderInfo?.nombre ?? 'Desconocido',
      lider_email: leaderInfo?.email ?? '-',
    };
  });
}

// ─── Approve an unlock request (re-enables the user's vales) ─
export async function approveUnlockRequest(
  requestId: number,
  userEmail: string
): Promise<void> {
  const { error: userError } = await supabase
    .from('user_profiles')
    .update({ vales_disabled_from: null, vales_disabled_to: null })
    .eq('email', userEmail);

  if (userError) throw userError;

  const { error: reqError } = await supabase
    .from('solicitudes_desbloqueo')
    .delete()
    .eq('id', requestId);

  if (reqError) throw reqError;
}

// ─── Reject an unlock request (just removes the request) ─────
export async function rejectUnlockRequest(requestId: number): Promise<void> {
  const { error } = await supabase
    .from('solicitudes_desbloqueo')
    .delete()
    .eq('id', requestId);

  if (error) throw error;
}
