import { supabase } from './supabase';
import { getLocalDateString, syncExpiredCalendarBlocks } from './calendar.service';

export interface ValesNotificationItem {
  id: string;
  userEmail: string;
  userName: string;
  empresa?: string;
  fechaInicio: string;
  fechaTermino: string;
  descripcion?: string;
  diasRestantes?: number;
  tipo: 'desbloqueado' | 'por_desbloquear' | 'bloqueado';
  fechaDesbloqueoStr?: string;
}

export interface ValesNotificationSummary {
  desbloqueados: ValesNotificationItem[];
  porDesbloquear: ValesNotificationItem[];
  siguenBloqueados: ValesNotificationItem[];
  totalNotificaciones: number;
  lastUpdated: string;
}

/**
 * Calcula días de diferencia entre hoy (YYYY-MM-DD) y una fecha objetivo
 */
function diffDaysFromToday(targetDateStr: string, todayStr: string): number {
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const target = new Date(y, m - 1, d);
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Obtiene el resumen clasificado de notificaciones de vales
 */
export async function getValesNotificationSummary(): Promise<ValesNotificationSummary> {
  // 1. Ejecutar sincronización previa para asegurar datos actualizados
  try {
    await syncExpiredCalendarBlocks();
  } catch (syncErr) {
    console.warn('Aviso sincronizando antes de notificaciones:', syncErr);
  }

  const todayStr = getLocalDateString();

  // Calcular fecha de hace 14 días para mostrar desbloqueos recientes
  const [y, m, d] = todayStr.split('-').map(Number);
  const pastDate = new Date(y, m - 1, d - 14);
  const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;

  // Consultar bloqueos de calendario y perfiles en paralelo
  const [blocksRes, profilesRes] = await Promise.all([
    supabase
      .from('calendar_blocks')
      .select('id, user_email, fecha_inicio, fecha_termino, descripcion, created_at')
      .order('fecha_termino', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('id, email, nombre, apellidos, empresa, habilitado, vales_disabled_from, vales_disabled_to')
  ]);

  const blocks = blocksRes.data || [];
  const profiles = profilesRes.data || [];

  // Mapear perfiles por email en minúsculas
  const profileMap = new Map<string, {
    nombre: string;
    empresa?: string;
    habilitado: boolean;
  }>();

  profiles.forEach(p => {
    if (p.email) {
      const cleanEmail = p.email.trim().toLowerCase();
      const fullName = [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() || cleanEmail;
      profileMap.set(cleanEmail, {
        nombre: fullName,
        empresa: p.empresa || undefined,
        habilitado: p.habilitado !== false
      });
    }
  });

  const desbloqueados: ValesNotificationItem[] = [];
  const porDesbloquear: ValesNotificationItem[] = [];
  const siguenBloqueados: ValesNotificationItem[] = [];

  // Conjuntos para evitar duplicados si un usuario tiene varios registros
  const seenUnlockedEmails = new Set<string>();
  const seenExpiringEmails = new Set<string>();
  const seenBlockedEmails = new Set<string>();

  for (const b of blocks) {
    const email = (b.user_email || '').trim().toLowerCase();
    if (!email) continue;

    const profile = profileMap.get(email);
    const userName = profile?.nombre || email;
    const empresa = profile?.empresa;
    const isUserEnabled = profile ? profile.habilitado : true;

    // 1. Desbloqueados automáticamente:
    // Fecha de término ya expiró (< todayStr) dentro de los últimos 14 días y el usuario está habilitado
    if (b.fecha_termino < todayStr && b.fecha_termino >= pastDateStr) {
      if (isUserEnabled && !seenUnlockedEmails.has(email)) {
        seenUnlockedEmails.add(email);
        desbloqueados.push({
          id: b.id,
          userEmail: email,
          userName,
          empresa,
          fechaInicio: b.fecha_inicio,
          fechaTermino: b.fecha_termino,
          descripcion: b.descripcion,
          tipo: 'desbloqueado',
          fechaDesbloqueoStr: b.fecha_termino
        });
      }
    }

    // 2. Bloqueos vigentes hoy (fecha_inicio <= todayStr <= fecha_termino)
    if (b.fecha_inicio <= todayStr && b.fecha_termino >= todayStr) {
      const diasRestantes = diffDaysFromToday(b.fecha_termino, todayStr);

      // Si vence hoy o en los próximos 3 días (diasRestantes <= 3) -> Por desbloquear
      if (diasRestantes <= 3 && !seenExpiringEmails.has(email)) {
        seenExpiringEmails.add(email);
        porDesbloquear.push({
          id: b.id,
          userEmail: email,
          userName,
          empresa,
          fechaInicio: b.fecha_inicio,
          fechaTermino: b.fecha_termino,
          descripcion: b.descripcion,
          diasRestantes,
          tipo: 'por_desbloquear'
        });
      }

      // Todos los que están actualmente bloqueados
      if (!seenBlockedEmails.has(email)) {
        seenBlockedEmails.add(email);
        siguenBloqueados.push({
          id: b.id,
          userEmail: email,
          userName,
          empresa,
          fechaInicio: b.fecha_inicio,
          fechaTermino: b.fecha_termino,
          descripcion: b.descripcion,
          diasRestantes,
          tipo: 'bloqueado'
        });
      }
    }
  }

  // Ordenar desbloqueados por fecha más reciente
  desbloqueados.sort((a, b) => b.fechaTermino.localeCompare(a.fechaTermino));

  // Ordenar próximos a desbloquear por los días más cercanos
  porDesbloquear.sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));

  // Ordenar bloqueados por fecha término ascendente
  siguenBloqueados.sort((a, b) => a.fechaTermino.localeCompare(b.fechaTermino));

  return {
    desbloqueados,
    porDesbloquear,
    siguenBloqueados,
    totalNotificaciones: desbloqueados.length + porDesbloquear.length,
    lastUpdated: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  };
}
