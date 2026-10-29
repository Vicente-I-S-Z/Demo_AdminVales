import { supabase } from './supabase';
import type { DashboardStats, RolStat, RestaurantStat } from '../types';

async function fetchAll<T = any>(table: string, columns: string, dateCol?: string, start?: string, end?: string): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase.from(table).select(columns);
    if (dateCol && start && end) {
      query = query.gte(dateCol, start).lte(dateCol, end);
    }
    const { data, error } = await query.range(from, from + step - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...(data as unknown as T[]));
    if (data.length < step) break;
    from += step;
  }
  return allData;
}

export interface DateFilter {
  day: number | null;
  month: number | null;
  year: number | null;
}

export async function getAvailableYears(): Promise<string[]> {
  const currentYear = new Date().getFullYear();
  let oldestYear = currentYear;

  try {
    const { data: qrData } = await supabase
      .from('qr_registrations')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);
    
    const { data: codesData } = await supabase
      .from('daily_user_codes')
      .select('fecha_generacion')
      .order('fecha_generacion', { ascending: true })
      .limit(1);

    const d1 = qrData?.[0]?.date ? new Date(qrData[0].date).getFullYear() : currentYear;
    const d2 = codesData?.[0]?.fecha_generacion ? new Date(codesData[0].fecha_generacion).getFullYear() : currentYear;
    
    oldestYear = Math.min(d1, d2, currentYear);
  } catch (error) {
    console.error('Error fetching available years:', error);
  }

  const years = ['Todos'];
  for (let y = oldestYear; y <= currentYear; y++) {
    years.push(String(y));
  }
  return years;
}

// ─── Aggregate all dashboard statistics in one call ──────────
export async function getDashboardStats(filter?: DateFilter): Promise<DashboardStats> {
  let startStr, endStr;
  
  if (filter?.year) {
    const y = filter.year;
    const m = filter.month;
    const d = filter.day;
    
    if (d && m) {
      // Specific day
      startStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`;
      endStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59`;
    } else if (m) {
      // Entire month
      const lastDay = new Date(y, m, 0).getDate();
      startStr = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`;
      endStr = `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59`;
    } else {
      // Entire year
      startStr = `${y}-01-01T00:00:00`;
      endStr = `${y}-12-31T23:59:59`;
    }
  }

  // Fetch in parallel for performance using our pagination helper
  const [usersData, qrData, codesData, contData] = await Promise.all([
    fetchAll<{ rol: string }>('user_profiles', 'rol'), // Users are not date filtered
    fetchAll<{ restaurante: string }>('qr_registrations', 'restaurante', 'date', startStr?.split('T')[0], endStr?.split('T')[0]),
    fetchAll<{ codigo_diario: string; is_used: boolean }>('daily_user_codes', 'codigo_diario, is_used', 'fecha_generacion', startStr, endStr),
    fetchAll<{ restaurante: string }>('vales_contingencia_manual', 'restaurante', 'fecha_consumo', startStr?.split('T')[0], endStr?.split('T')[0]).catch(() => []),
  ]);

  // ── Users / Roles ──────────────────────────────────────────
  const totalUsers = usersData.length;

  const rolesCount: Record<string, number> = {};
  usersData.forEach((u) => {
    const raw = String(u.rol || 'usuario').toLowerCase();
    const rolName = raw === 'admin' ? 'Admin' : raw === 'lider' ? 'Líder' : 'Usuario';
    rolesCount[rolName] = (rolesCount[rolName] || 0) + 1;
  });

  const rolesData: RolStat[] = Object.keys(rolesCount)
    .map((name) => ({
      name,
      value: rolesCount[name],
      percent: totalUsers > 0 ? (rolesCount[name] / totalUsers) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // ── Restaurants ────────────────────────────────────────────
  const contingenciaList = contData || [];
  const totalQr = qrData.length + contingenciaList.length;

  const restaurantsCount: Record<string, number> = {};
  qrData.forEach((qr) => {
    const rest = qr.restaurante || 'Desconocido';
    restaurantsCount[rest] = (restaurantsCount[rest] || 0) + 1;
  });
  contingenciaList.forEach((c) => {
    const rest = c.restaurante || 'Casino Central';
    restaurantsCount[rest] = (restaurantsCount[rest] || 0) + 1;
  });

  const totalRestaurantes = Object.keys(restaurantsCount).length;

  const topRestaurants: RestaurantStat[] = Object.keys(restaurantsCount)
    .map((rest) => ({ name: rest, value: restaurantsCount[rest] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ── Daily Codes ────────────────────────────────────────────
  const totalCodesGenerated = codesData.length;
  const totalCodesUsed = codesData.filter((c) => c.is_used).length;

  // Guest codes: rows where codigo_diario starts with 'GUEST'
  const guestCodes = codesData.filter((c) =>
    c.codigo_diario?.toUpperCase().startsWith('GUEST')
  );
  const totalGuestCodes = guestCodes.length;
  const guestCodesUsed = guestCodes.filter((c) => c.is_used).length;
  const guestCodesUnused = totalGuestCodes - guestCodesUsed;

  return {
    totalUsers,
    totalQr,
    totalRestaurantes,
    totalGuestCodes,
    guestCodesUsed,
    guestCodesUnused,
    totalCodesGenerated,
    totalCodesUsed,
    rolesData,
    topRestaurants,
  };
}
