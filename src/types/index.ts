// ============================================================
// Shared TypeScript interfaces for the entire application
// ============================================================

// ─── Auth ────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  empresa: string;
  rol: string;
  habilitado: boolean;
  vales_disabled_from: string | null;
  vales_disabled_to: string | null;
  created_at: string;
  is_authorized?: boolean;
  authorized_email_id?: number;
  active_calendar_block?: {
    fecha_inicio: string;
    fecha_termino: string;
    descripcion?: string | null;
  } | null;
}

// ─── Dashboard ───────────────────────────────────────────────
export interface RolStat {
  name: string;
  value: number;
  percent: number;
}

export interface RestaurantStat {
  name: string;
  value: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalQr: number;
  totalRestaurantes: number;
  totalGuestCodes: number;
  guestCodesUsed: number;
  guestCodesUnused: number;
  totalCodesGenerated: number;
  totalCodesUsed: number;
  rolesData: RolStat[];
  topRestaurants: RestaurantStat[];
}

// ─── Daily Codes ─────────────────────────────────────────────
export interface DailyCode {
  codigo_diario: string;
  user_email: string;
  is_used: boolean;
  created_at: string;
  is_authorized: boolean;
}

// ─── Unlock Requests ─────────────────────────────────────────
export interface UnlockRequest {
  id: number;
  numero_lider: string | number;
  user_email: string;
  justificacion: string;
  created_at: string;
  lider_name: string;
  lider_email: string;
}

// ─── Closing ─────────────────────────────────────────────────
export interface ClosingFilters {
  month: number;
  year: number;
  restaurant: string;
}

// ─── Calendar Blocks ─────────────────────────────────────────
export interface CalendarBlock {
  id: string;
  user_email: string;
  fecha_inicio: string;
  fecha_termino: string;
  descripcion: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Technical Support & Tickets ─────────────────────────────
export type TicketCategoria =
  | 'autenticacion'
  | 'vales_bloqueos'
  | 'codigos_qr'
  | 'base_de_datos'
  | 'interfaz_usuario'
  | 'cierre_mensual'
  | 'otro';

export type TicketPrioridad = 'baja' | 'media' | 'alta' | 'critica';

export type TicketEstado = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';

export interface SupportTicket {
  id: number;
  ticket_code: string;
  titulo: string;
  descripcion: string;
  categoria: TicketCategoria;
  prioridad: TicketPrioridad;
  estado: TicketEstado;
  reportado_por: string;
  reportado_por_nombre?: string | null;
  solucion?: string | null;
  resuelto_por?: string | null;
  fecha_resolucion?: string | null;
  contexto_operativo?: {
    tiene_adjunto?: boolean;
    adjunto_nombre?: string | null;
    adjunto_mime?: string | null;
    adjunto_size?: number | null;
    adjunto_data?: string | null;
    adjunto_base64?: string | null;
    adjunto_url?: string | null;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketFilters {
  searchTerm?: string;
  categoria?: string;
  prioridad?: string;
  estado?: string;
}

// ─── Build Global Constants ──────────────────────────────────
declare global {
  const __APP_BUILD_TIME__: number;
}
