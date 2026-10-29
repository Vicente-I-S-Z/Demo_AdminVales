import { supabase } from './supabase';
import type { AppUser } from '../types';
import { syncExpiredCalendarBlocks, getLocalDateString } from './calendar.service';

// ─── Fetch all users (authorized_emails + user_profiles) ─────
export async function getUsers(): Promise<AppUser[]> {
  // Sincronizar automáticamente bloqueos expirados en segundo plano
  await syncExpiredCalendarBlocks();

  const todayStr = getLocalDateString();

  const [profilesRes, authRes, activeBlocksRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('authorized_emails')
      .select('id, email, empresa, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('calendar_blocks')
      .select('user_email, fecha_inicio, fecha_termino, descripcion')
      .lte('fecha_inicio', todayStr)
      .gte('fecha_termino', todayStr)
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (authRes.error) {
    console.warn('Advertencia al consultar authorized_emails:', authRes.error);
  }

  // Mapa de bloqueos activos por email
  const activeBlocksByEmail = new Map<string, { fecha_inicio: string; fecha_termino: string; descripcion?: string | null }>();
  if (activeBlocksRes.data) {
    for (const b of activeBlocksRes.data) {
      if (b.user_email) {
        activeBlocksByEmail.set(b.user_email.trim().toLowerCase(), {
          fecha_inicio: b.fecha_inicio,
          fecha_termino: b.fecha_termino,
          descripcion: b.descripcion,
        });
      }
    }
  }

  const users: AppUser[] = [];
  const processedEmails = new Set<string>();

  // 1. Usuarios activos en authorized_emails (quienes tienen permiso de acceso)
  if (authRes.data) {
    for (const authItem of authRes.data) {
      const emailNorm = (authItem.email || '').trim().toLowerCase();
      if (!emailNorm || processedEmails.has(emailNorm)) continue;
      processedEmails.add(emailNorm);

      // Buscar si ya tiene perfil registrado en user_profiles
      const matchedProfile = (profilesRes.data ?? []).find(
        (p: any) => (p.email || '').trim().toLowerCase() === emailNorm
      );

      const activeBlock = activeBlocksByEmail.get(emailNorm) || null;

      if (matchedProfile) {
        users.push({
          ...matchedProfile,
          id: String(matchedProfile.id),
          empresa: authItem.empresa || matchedProfile.empresa || '-',
          is_authorized: true,
          authorized_email_id: authItem.id,
          active_calendar_block: activeBlock,
          habilitado: activeBlock ? false : matchedProfile.habilitado,
        });
      } else {
        // En authorized_emails pero aún no ha iniciado sesión por primera vez
        users.push({
          id: `auth_${authItem.id}`,
          email: authItem.email,
          empresa: authItem.empresa || '-',
          nombre: authItem.email.split('@')[0],
          apellidos: '(Pendiente primer ingreso)',
          rol: 'usuario',
          habilitado: activeBlock ? false : true,
          vales_disabled_from: null,
          vales_disabled_to: null,
          created_at: authItem.created_at || new Date().toISOString(),
          is_authorized: true,
          authorized_email_id: authItem.id,
          active_calendar_block: activeBlock,
        });
      }
    }
  }

  // 2. Usuarios históricos en user_profiles pero dados de baja en authorized_emails
  //    (se preservan para GDH y reportes de cierres de mes)
  for (const profile of profilesRes.data ?? []) {
    const emailNorm = (profile.email || '').trim().toLowerCase();
    if (!emailNorm || processedEmails.has(emailNorm)) continue;
    processedEmails.add(emailNorm);

    users.push({
      ...profile,
      id: String(profile.id),
      empresa: profile.empresa || '-',
      habilitado: false, // Sin acceso a vales
      is_authorized: false, // Baja / Acceso revocado en authorized_emails
      active_calendar_block: activeBlocksByEmail.get(emailNorm) || null,
    });
  }

  return users;
}

// ─── Normalizar rol para cumplir con el check constraint valid_rol ('usuario', 'admin', 'lider') ──
export function normalizeRole(role?: string | null): 'usuario' | 'admin' | 'lider' {
  const r = (role || '').trim().toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('lid') || r.includes('líder')) return 'lider';
  return 'usuario';
}

// ─── Update a user's role ────────────────────────────────────
export async function updateUserRole(userId: string, newRole: string, email?: string): Promise<void> {
  const roleToSave = normalizeRole(newRole);
  const cleanEmail = email?.trim().toLowerCase();

  let query = supabase.from('user_profiles').update({ rol: roleToSave });
  if (userId && !userId.startsWith('auth_') && !isNaN(Number(userId))) {
    query = query.or(`id.eq.${Number(userId)}${cleanEmail ? `,email.ilike.${cleanEmail}` : ''}`);
  } else if (cleanEmail) {
    query = query.ilike('email', cleanEmail);
  } else {
    query = query.eq('id', userId);
  }

  const { error } = await query;
  if (error) throw error;
}

// ─── Update a user's role and optionally their empresa ─────────
export async function updateUserRoleAndEmpresa(
  userId: string,
  email: string,
  newRole: string,
  newEmpresa?: string
): Promise<void> {
  const roleToSave = normalizeRole(newRole);
  const cleanEmail = email.trim().toLowerCase();
  const trimmedEmpresa = newEmpresa?.trim();

  const profilePayload: Record<string, any> = { rol: roleToSave };
  if (trimmedEmpresa) {
    profilePayload.empresa = trimmedEmpresa;
  }

  // 1. Actualizar en user_profiles buscando por id numérico o por email
  let res;
  if (userId && !userId.startsWith('auth_') && !isNaN(Number(userId))) {
    res = await supabase
      .from('user_profiles')
      .update(profilePayload)
      .or(`id.eq.${Number(userId)},email.ilike.${cleanEmail}`)
      .select('id, email, rol, empresa');
  } else {
    res = await supabase
      .from('user_profiles')
      .update(profilePayload)
      .ilike('email', cleanEmail)
      .select('id, email, rol, empresa');
  }

  if (res.error) throw res.error;

  // Si aún no existía en user_profiles (usuario solo registrado en authorized_emails)
  if (!res.data || res.data.length === 0) {
    const { error: insertErr } = await supabase
      .from('user_profiles')
      .insert({
        email: cleanEmail,
        nombre: cleanEmail.split('@')[0],
        apellidos: '(Pendiente)',
        rol: roleToSave,
        empresa: trimmedEmpresa || null,
        habilitado: true,
      });

    if (insertErr) {
      console.warn('Aviso insertando perfil nuevo al modificar rol:', insertErr);
    }
  }

  // 2. Si se ingresó empresa, actualizar también en authorized_emails
  if (trimmedEmpresa) {
    const { error: authErr } = await supabase
      .from('authorized_emails')
      .update({ empresa: trimmedEmpresa })
      .ilike('email', cleanEmail);

    if (authErr) {
      console.warn('Aviso al actualizar empresa en authorized_emails:', authErr);
    }
  }
}

// ─── Toggle user enabled status ──────────────────────────────
export async function setUserEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ habilitado: enabled })
    .eq('id', userId);

  if (error) throw error;
}

// ─── Set temporary vale block dates ──────────────────────────
export async function setValesBlock(
  userId: string,
  from: string | null,
  to: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ vales_disabled_from: from, vales_disabled_to: to })
    .eq('id', userId);

  if (error) throw error;
}

// ─── Invalidar códigos diarios no utilizados de hoy para un usuario ─────
export async function invalidateTodayUnusedCodes(userEmail: string): Promise<void> {
  try {
    const todayStr = getLocalDateString();
    await supabase
      .from('daily_user_codes')
      .delete()
      .ilike('user_email', userEmail.trim().toLowerCase())
      .eq('fecha_generacion', todayStr)
      .eq('is_used', false);
  } catch (err) {
    console.warn('Aviso al invalidar códigos de hoy para usuario deshabilitado:', err);
  }
}

// ─── Set temporary vale block synchronized with calendar_blocks ──
export async function setValesBlockWithCalendar(
  userId: string,
  userEmail: string,
  from: string | null,
  to: string | null,
  habilitado: boolean
): Promise<void> {
  const todayStr = getLocalDateString();
  const cleanEmail = userEmail.trim().toLowerCase();

  // Si se ingresaron fechas y hoy está dentro del rango, el usuario queda deshabilitado hoy
  const isBlockedToday = (Boolean(from) && Boolean(to) && from! <= todayStr && to! >= todayStr) || !habilitado;
  const finalHabilitado = isBlockedToday ? false : habilitado;

  // 1. Guardar en user_profiles
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .update({
      habilitado: finalHabilitado,
      vales_disabled_from: from,
      vales_disabled_to: to,
    })
    .eq('id', userId);

  if (profileErr) throw profileErr;

  // 2. Sincronizar con calendar_blocks
  if (from && to) {
    // Eliminar bloqueos previos de 'Bloqueo temporal de vales' para este usuario
    await supabase
      .from('calendar_blocks')
      .delete()
      .ilike('user_email', cleanEmail)
      .eq('descripcion', 'Bloqueo temporal de vales');

    // Insertar nuevo bloqueo en calendar_blocks para que el sistema de desbloqueo automático lo reconozca
    const { data: authData } = await supabase.auth.getUser();
    await supabase
      .from('calendar_blocks')
      .insert({
        user_email: cleanEmail,
        fecha_inicio: from,
        fecha_termino: to,
        descripcion: 'Bloqueo temporal de vales',
        created_by: authData?.user?.id || null,
      });
  } else {
    // Si se quitaron las fechas y el usuario se habilitó, limpiar cualquier bloqueo temporal
    if (habilitado) {
      await supabase
        .from('calendar_blocks')
        .delete()
        .ilike('user_email', cleanEmail)
        .eq('descripcion', 'Bloqueo temporal de vales');
    } else {
      // Si se deshabilitó manualmente sin fechas, limpiar bloqueos expirados para evitar que la RPC lo reactive
      await supabase
        .from('calendar_blocks')
        .delete()
        .ilike('user_email', cleanEmail)
        .lt('fecha_termino', todayStr);
    }
  }

  // 3. Si el usuario quedó deshabilitado o bloqueado para hoy, invalidar códigos no utilizados de hoy
  if (!finalHabilitado) {
    await invalidateTodayUnusedCodes(cleanEmail);
  }
}

// ─── Revocar acceso a un usuario (Eliminar SOLAMENTE de authorized_emails) ───
// Preserva el perfil y la empresa en user_profiles y vales para los reportes y cierres de mes de GDH
export async function deleteAuthorizedEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Obtener la empresa antes de eliminar para conservarla permanentemente
  try {
    const { data: authRow } = await supabase
      .from('authorized_emails')
      .select('empresa')
      .ilike('email', cleanEmail)
      .maybeSingle();

    const empresaToPreserve = authRow?.empresa;

    if (empresaToPreserve) {
      // Persistir empresa en user_profiles
      await supabase
        .from('user_profiles')
        .update({ empresa: empresaToPreserve })
        .ilike('email', cleanEmail);

      // Persistir empresa en los vales de daily_user_codes
      await supabase
        .from('daily_user_codes')
        .update({ empresa: empresaToPreserve })
        .ilike('user_email', cleanEmail);
    }
  } catch (err) {
    console.warn('Aviso al respaldar empresa antes de eliminar:', err);
  }

  // 2. Eliminar el registro únicamente de authorized_emails
  const { error } = await supabase
    .from('authorized_emails')
    .delete()
    .ilike('email', cleanEmail);

  if (error) throw error;
}

// Alias para compatibilidad
export const deleteUser = (userId: string, email?: string) => deleteAuthorizedEmail(email || userId);
export const deleteUserCompletely = (_userId: string, email: string) => deleteAuthorizedEmail(email);

// ─── Crear nuevo usuario autorizado (SOLAMENTE en authorized_emails) ────────
// Solo se requiere correo y empresa. El ID es asignado automáticamente por Supabase.
export async function createAuthorizedUser(
  email: string,
  empresa: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanEmpresa = empresa.trim();

  // 1. Insertar ÚNICAMENTE en authorized_emails
  const { error } = await supabase
    .from('authorized_emails')
    .insert({ email: cleanEmail, empresa: cleanEmpresa });

  if (error) {
    throw error;
  }

  // 2. Si ya existe un perfil en user_profiles, sincronizar la empresa
  try {
    await supabase
      .from('user_profiles')
      .update({ empresa: cleanEmpresa })
      .ilike('email', cleanEmail);
  } catch (err) {
    console.warn('Aviso al sincronizar empresa en user_profiles:', err);
  }
}

// ─── Habilitar o deshabilitar usuarios en lote ───────────────
export async function setBulkUsersEnabled(userIds: string[], enabled: boolean): Promise<void> {
  if (!userIds || userIds.length === 0) return;
  const { error } = await supabase
    .from('user_profiles')
    .update({ habilitado: enabled })
    .in('id', userIds);

  if (error) throw error;
}

