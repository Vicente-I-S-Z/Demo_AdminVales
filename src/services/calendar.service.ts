import { supabase } from './supabase';
import type { CalendarBlock } from '../types';

// ─── Fetch all calendar blocks for a given user ──────────────
export async function getCalendarBlocks(userEmail: string): Promise<CalendarBlock[]> {
  const { data, error } = await supabase
    .from('calendar_blocks')
    .select('id, user_email, fecha_inicio, fecha_termino, descripcion, created_by, created_at')
    .eq('user_email', userEmail)
    .order('fecha_inicio', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Create a new calendar block ─────────────────────────────
// ─── Create a new calendar block ─────────────────────────────
export async function createCalendarBlock(
  userEmail: string,
  fechaInicio: string,
  fechaTermino: string,
  descripcion: string,
  tipoBloqueo: 'rango' | 'extremos' = 'rango'
): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;
  const cleanEmail = userEmail.trim().toLowerCase();
  const todayStr = getLocalDateString();
  let isTodayBlocked = false;

  if (tipoBloqueo === 'extremos' && fechaInicio !== fechaTermino) {
    const desc = descripcion?.trim();
    const descInicio = desc ? `${desc} (Inicio)` : 'Bloqueo día inicio';
    const descTermino = desc ? `${desc} (Fin)` : 'Bloqueo día fin';

    const { error } = await supabase
      .from('calendar_blocks')
      .insert([
        {
          user_email: cleanEmail,
          fecha_inicio: fechaInicio,
          fecha_termino: fechaInicio,
          descripcion: descInicio,
          created_by: userId,
        },
        {
          user_email: cleanEmail,
          fecha_inicio: fechaTermino,
          fecha_termino: fechaTermino,
          descripcion: descTermino,
          created_by: userId,
        },
      ]);

    if (error) throw error;
    isTodayBlocked = fechaInicio === todayStr || fechaTermino === todayStr;
  } else {
    const { error } = await supabase
      .from('calendar_blocks')
      .insert({
        user_email: cleanEmail,
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino,
        descripcion: descripcion?.trim() || null,
        created_by: userId,
      });

    if (error) throw error;
    isTodayBlocked = fechaInicio <= todayStr && fechaTermino >= todayStr;
  }

  // Si hoy cae dentro de un día bloqueado, actualizar inmediatamente el perfil
  if (isTodayBlocked) {
    try {
      await supabase
        .from('user_profiles')
        .update({ habilitado: false })
        .ilike('email', cleanEmail);

      await supabase
        .from('daily_user_codes')
        .delete()
        .ilike('user_email', cleanEmail)
        .eq('fecha_generacion', todayStr)
        .eq('is_used', false);
    } catch (err) {
      console.warn('Aviso al actualizar estado inmediato de usuario:', err);
    }
  }
}

// ─── Delete a calendar block ─────────────────────────────────
export async function deleteCalendarBlock(blockId: string, userEmail?: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('id', blockId);

  if (error) throw error;

  // Si se eliminó un bloqueo y se conoce el email, verificar si le quedan bloqueos activos hoy
  if (userEmail) {
    try {
      const todayStr = getLocalDateString();
      const { data: remainingBlocks } = await supabase
        .from('calendar_blocks')
        .select('id')
        .ilike('user_email', userEmail.trim())
        .lte('fecha_inicio', todayStr)
        .gte('fecha_termino', todayStr);

      if (!remainingBlocks || remainingBlocks.length === 0) {
        await supabase
          .from('user_profiles')
          .update({ habilitado: true })
          .ilike('email', userEmail.trim());
      }
    } catch (err) {
      console.warn('Aviso al sincronizar estado tras eliminar bloqueo:', err);
    }
  }
}

// ─── Bulk create calendar blocks ─────────────────────────────
export interface BulkBlockItem {
  userEmail: string;
  fechaInicio: string;
  fechaTermino: string;
  descripcion?: string;
  tipoBloqueo?: 'rango' | 'extremos';
}

export async function createBulkCalendarBlocks(blocks: BulkBlockItem[]): Promise<void> {
  if (!blocks || blocks.length === 0) return;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  const rowsToInsert: {
    user_email: string;
    fecha_inicio: string;
    fecha_termino: string;
    descripcion: string | null;
    created_by: string | null;
  }[] = [];

  for (const b of blocks) {
    const email = b.userEmail.trim().toLowerCase();
    const desc = b.descripcion?.trim() || null;

    if (b.tipoBloqueo === 'extremos' && b.fechaInicio !== b.fechaTermino) {
      const descInicio = desc ? `${desc} (Inicio)` : 'Bloqueo día inicio';
      const descTermino = desc ? `${desc} (Fin)` : 'Bloqueo día fin';
      rowsToInsert.push({
        user_email: email,
        fecha_inicio: b.fechaInicio,
        fecha_termino: b.fechaInicio,
        descripcion: descInicio,
        created_by: userId,
      });
      rowsToInsert.push({
        user_email: email,
        fecha_inicio: b.fechaTermino,
        fecha_termino: b.fechaTermino,
        descripcion: descTermino,
        created_by: userId,
      });
    } else {
      rowsToInsert.push({
        user_email: email,
        fecha_inicio: b.fechaInicio,
        fecha_termino: b.fechaTermino,
        descripcion: desc,
        created_by: userId,
      });
    }
  }

  const { error } = await supabase
    .from('calendar_blocks')
    .insert(rowsToInsert);

  if (error) throw error;

  // Actualizar inmediatamente habilitado = false para usuarios cuyo bloqueo inicia hoy o antes
  const todayStr = getLocalDateString();
  const emailsToDisable = Array.from(
    new Set(
      rowsToInsert
        .filter((r) => r.fecha_inicio <= todayStr && r.fecha_termino >= todayStr)
        .map((r) => r.user_email)
    )
  );

  if (emailsToDisable.length > 0) {
    try {
      await supabase
        .from('user_profiles')
        .update({ habilitado: false })
        .in('email', emailsToDisable);

      await supabase
        .from('daily_user_codes')
        .delete()
        .in('user_email', emailsToDisable)
        .eq('fecha_generacion', todayStr)
        .eq('is_used', false);
    } catch (err) {
      console.warn('Aviso al actualizar estado inmediato de usuarios:', err);
    }
  }
}

// ─── Helper: Obtener fecha local en formato YYYY-MM-DD ───────
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Helper: Formatear YYYY-MM-DD a DD-MM-YYYY sin desfase UTC ─
export function formatChileanDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  }
  return dateStr;
}

// ─── Helper: Convertir YYYY-MM-DD a Date local seguro (00:00:00)
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('T')[0].split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// ─── Helper: Calcular días inclusivos entre dos fechas YYYY-MM-DD
export function calculateInclusiveDays(fechaInicio: string, fechaTermino: string): number {
  if (!fechaInicio || !fechaTermino) return 0;
  const start = parseLocalDate(fechaInicio);
  const end = parseLocalDate(fechaTermino);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

// ─── Helper: Información de días extremos y días intermedios ──
export interface ExtremeDatesInfo {
  totalRangeDays: number;
  blockedDaysCount: number;
  intermediateDaysCount: number;
  intermediateStartStr: string | null;
  intermediateEndStr: string | null;
  intermediateStartFormatted: string | null;
  intermediateEndFormatted: string | null;
}

export function getExtremeDatesInfo(fechaInicio: string, fechaTermino: string): ExtremeDatesInfo {
  if (!fechaInicio || !fechaTermino) {
    return {
      totalRangeDays: 0,
      blockedDaysCount: 0,
      intermediateDaysCount: 0,
      intermediateStartStr: null,
      intermediateEndStr: null,
      intermediateStartFormatted: null,
      intermediateEndFormatted: null,
    };
  }

  const totalRangeDays = calculateInclusiveDays(fechaInicio, fechaTermino);

  if (fechaInicio === fechaTermino) {
    return {
      totalRangeDays: 1,
      blockedDaysCount: 1,
      intermediateDaysCount: 0,
      intermediateStartStr: null,
      intermediateEndStr: null,
      intermediateStartFormatted: null,
      intermediateEndFormatted: null,
    };
  }

  const blockedDaysCount = 2;
  const intermediateDaysCount = Math.max(0, totalRangeDays - 2);

  let intermediateStartStr: string | null = null;
  let intermediateEndStr: string | null = null;

  if (intermediateDaysCount > 0) {
    const startD = parseLocalDate(fechaInicio);
    startD.setDate(startD.getDate() + 1);
    intermediateStartStr = getLocalDateString(startD);

    const endD = parseLocalDate(fechaTermino);
    endD.setDate(endD.getDate() - 1);
    intermediateEndStr = getLocalDateString(endD);
  }

  return {
    totalRangeDays,
    blockedDaysCount,
    intermediateDaysCount,
    intermediateStartStr,
    intermediateEndStr,
    intermediateStartFormatted: intermediateStartStr ? formatChileanDate(intermediateStartStr) : null,
    intermediateEndFormatted: intermediateEndStr ? formatChileanDate(intermediateEndStr) : null,
  };
}

// ─── Sincronización automática de bloqueos expirados ─────────
// Regla: si un bloqueo terminó el 12 de septiembre, el 13 de septiembre
// el usuario debe quedar automáticamente habilitado para pedir vales.
export async function syncExpiredCalendarBlocks(): Promise<void> {
  try {
    // 1. Intentar llamar a la función RPC de Supabase si existe
    const { error: rpcError } = await supabase.rpc('update_user_status_by_calendar_blocks');
    if (!rpcError) return;
  } catch {
    // Si la RPC no existe aún en la base de datos, ejecutar la lógica en cliente
  }

  try {
    const todayStr = getLocalDateString();

    // Consultar todos los bloqueos registrados
    const { data: allBlocks } = await supabase
      .from('calendar_blocks')
      .select('user_email, fecha_inicio, fecha_termino');

    if (!allBlocks) return;

    // Clasificar emails que tienen un bloqueo activo HOY
    const activeBlockedEmails = new Set<string>();
    const expiredBlockEmails = new Set<string>();

    for (const b of allBlocks) {
      if (!b.user_email) continue;
      const email = b.user_email.trim().toLowerCase();
      if (b.fecha_inicio <= todayStr && b.fecha_termino >= todayStr) {
        activeBlockedEmails.add(email);
      } else if (b.fecha_termino < todayStr) {
        expiredBlockEmails.add(email);
      }
    }

    // Consultar perfiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, habilitado, vales_disabled_from, vales_disabled_to');

    if (!profiles) return;

    const toEnable: string[] = [];
    const toDisable: string[] = [];
    const datesToClear: string[] = [];

    for (const p of profiles) {
      const email = (p.email || '').trim().toLowerCase();
      if (!email) continue;

      const hasActiveCalendarBlock = activeBlockedEmails.has(email);
      const hasActiveDateRange =
        p.vales_disabled_from &&
        p.vales_disabled_from <= todayStr &&
        (!p.vales_disabled_to || p.vales_disabled_to >= todayStr);

      const isCurrentlyBlocked = hasActiveCalendarBlock || hasActiveDateRange;

      if (isCurrentlyBlocked && p.habilitado !== false) {
        toDisable.push(p.id);
      } else if (!isCurrentlyBlocked && p.habilitado === false) {
        // Estaba deshabilitado pero ya no tiene bloqueos activos hoy
        // Verificar si tenía bloqueo expirado (en calendar_blocks o vales_disabled_to)
        const hadExpiredCalendar = expiredBlockEmails.has(email);
        const hadExpiredDateRange = p.vales_disabled_to && p.vales_disabled_to < todayStr;
        if (hadExpiredCalendar || hadExpiredDateRange) {
          toEnable.push(p.id);
        }
      }

      // Limpiar vales_disabled_to si ya expiró
      if (p.vales_disabled_to && p.vales_disabled_to < todayStr && !hasActiveCalendarBlock) {
        datesToClear.push(p.id);
      }
    }

    // Aplicar actualizaciones en lote
    if (toDisable.length > 0) {
      await supabase
        .from('user_profiles')
        .update({ habilitado: false })
        .in('id', toDisable);
    }

    if (toEnable.length > 0) {
      await supabase
        .from('user_profiles')
        .update({ habilitado: true })
        .in('id', toEnable);
    }

    if (datesToClear.length > 0) {
      await supabase
        .from('user_profiles')
        .update({ vales_disabled_from: null, vales_disabled_to: null, habilitado: true })
        .in('id', datesToClear);
    }
  } catch (err) {
    console.warn('Aviso en sincronización automática de bloqueos:', err);
  }
}
