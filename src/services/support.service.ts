import { supabase } from './supabase';
import ExcelJS from 'exceljs';
import type { SupportTicket, TicketCategoria, TicketPrioridad, TicketEstado } from '../types';
import { sendSupportTicketNotificationEmails, sendSupportTicketResolutionEmail, type EmailNotificationResult } from './email.service';

export const CATEGORIA_LABELS: Record<TicketCategoria, string> = {
  autenticacion: 'Autenticación y Sesiones',
  vales_bloqueos: 'Vales y Bloqueos de Calendario',
  codigos_qr: 'Códigos Diarios y Códigos QR',
  base_de_datos: 'Base de Datos y Supabase',
  interfaz_usuario: 'Interfaz de Usuario y Rendimiento',
  cierre_mensual: 'Cierre Mensual y GDH',
  otro: 'Otro / Consulta General',
};

export const PRIORIDAD_LABELS: Record<TicketPrioridad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const ESTADO_LABELS: Record<TicketEstado, string> = {
  abierto: 'Abierto / Pendiente',
  en_revision: 'En Revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado / Descartado',
};

// ─── Generador de Código de Ticket ───────────────────────────
function generateTicketCode(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TK-${year}-${randomSuffix}`;
}

// ─── Obtener todos los tickets de soporte ─────────────────────
export async function getSupportTickets(filterEmail?: string, sistemaOrigen: string = 'vales_admin'): Promise<SupportTicket[]> {
  let query = supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (sistemaOrigen) {
    query = query.eq('sistema_origen', sistemaOrigen);
  }

  if (filterEmail) {
    query = query.ilike('reportado_por', filterEmail.trim().toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    // Si la tabla aún no existe en Supabase, arrojar un error explicativo
    if (error.code === '42P01') {
      console.warn('La tabla support_tickets no existe aún en la base de datos de Supabase.');
      return [];
    }
    throw error;
  }

  return (data || []) as SupportTicket[];
}

// ─── Consultar tickets por código (TK-...) o por correo ───────
export async function lookupTickets(searchTerm: string, sistemaOrigen: string = 'vales_admin'): Promise<SupportTicket[]> {
  const term = searchTerm.trim();
  if (!term) return [];

  try {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .or(`ticket_code.ilike.%${term}%,reportado_por.ilike.%${term}%`);

    if (sistemaOrigen) {
      query = query.eq('sistema_origen', sistemaOrigen);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as SupportTicket[];
    }
  } catch (err) {
    console.warn('Error al buscar tickets en Supabase:', err);
  }

  // Fallback a localStorage si la red falla o está en modo offline
  try {
    const raw = localStorage.getItem('demo_support_offline_tickets') || localStorage.getItem('demo_dashboard_ti_tickets_v1');
    if (raw) {
      const tickets: SupportTicket[] = JSON.parse(raw);
      const lower = term.toLowerCase();
      return tickets.filter(t => 
        (!sistemaOrigen || (t as any).sistema_origen === sistemaOrigen) &&
        ((t.ticket_code && t.ticket_code.toLowerCase().includes(lower)) ||
        (t.reportado_por && t.reportado_por.toLowerCase().includes(lower)))
      );
    }
  } catch {}

  return [];
}

// ─── Crear un nuevo ticket de soporte ─────────────────────────
export interface CreateTicketDTO {
  titulo: string;
  descripcion: string;
  categoria: TicketCategoria;
  prioridad: TicketPrioridad;
  reportado_por: string;
  reportado_por_nombre?: string;
  sistema_origen?: string;
  contexto_operativo?: any;
}

export async function createSupportTicket(dto: CreateTicketDTO): Promise<{ ticket: SupportTicket; emailResult: EmailNotificationResult }> {
  const ticket_code = generateTicketCode();

  const newTicket: any = {
    ticket_code,
    titulo: dto.titulo.trim(),
    descripcion: dto.descripcion.trim(),
    categoria: dto.categoria,
    prioridad: dto.prioridad,
    estado: 'abierto' as TicketEstado,
    reportado_por: dto.reportado_por.trim().toLowerCase(),
    reportado_por_nombre: dto.reportado_por_nombre?.trim() || null,
    sistema_origen: dto.sistema_origen || 'vales_admin',
    contexto_operativo: dto.contexto_operativo || null,
    solucion: null,
    resuelto_por: null,
    fecha_resolucion: null,
  };


  const { data, error } = await supabase
    .from('support_tickets')
    .insert([newTicket])
    .select()
    .single();

  if (error) throw error;
  const createdTicket = data as SupportTicket;

  let emailResult: EmailNotificationResult = {
    success: true,
    notifiedAdmins: false,
    notifiedUser: false,
  };

  // Notificar por correo tanto a los administradores como al usuario
  try {
    emailResult = await sendSupportTicketNotificationEmails(createdTicket);
  } catch (emailErr: any) {
    console.warn('Aviso enviando notificaciones por correo:', emailErr);
    emailResult.error = emailErr?.message;
  }

  return { ticket: createdTicket, emailResult };
}

// ─── Actualizar estado o solución de un ticket ───────────────
export interface UpdateTicketDTO {
  titulo?: string;
  descripcion?: string;
  categoria?: TicketCategoria;
  prioridad?: TicketPrioridad;
  estado?: TicketEstado;
  solucion?: string | null;
  resuelto_por?: string | null;
}

export async function updateSupportTicket(
  ticketId: number,
  dto: UpdateTicketDTO
): Promise<SupportTicket> {
  const updatePayload: Record<string, any> = { ...dto };

  // Si el estado pasa a ser resuelto, registrar automáticamente la fecha de resolución
  if (dto.estado === 'resuelto') {
    updatePayload.fecha_resolucion = new Date().toISOString();
  } else if (dto.estado === 'abierto' || dto.estado === 'en_revision') {
    // Si se reabre, limpiar la fecha de resolución
    updatePayload.fecha_resolucion = null;
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update(updatePayload)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw error;
  const updatedTicket = data as SupportTicket;

  // Disparar correo de resolución al usuario si el ticket quedó marcado como resuelto
  if (dto.estado === 'resuelto') {
    sendSupportTicketResolutionEmail(
      updatedTicket, 
      dto.solucion || undefined, 
      dto.resuelto_por || undefined
    ).catch(err => {
      console.warn('Aviso enviando correo de resolución:', err);
    });
  }

  return updatedTicket;
}

// ─── Eliminar un ticket de soporte ───────────────────────────
export async function deleteSupportTicket(ticketId: number): Promise<void> {
  const { error } = await supabase
    .from('support_tickets')
    .delete()
    .eq('id', ticketId);

  if (error) throw error;
}

// ─── Exportar reporte completo a Microsoft Excel (.xlsx) ─────
export async function exportSupportTicketsExcel(tickets: SupportTicket[]): Promise<void> {
  if (!tickets || tickets.length === 0) {
    throw new Error('No hay tickets de soporte disponibles para exportar.');
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Reporte de Incidencias');

  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-CL');
  const horaStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Título Corporativo
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'REPORTE Y CONTROL DE INCIDENCIAS TÉCNICAS — SISTEMA DE ADMINISTRACIÓN';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0033AB' } }; // Azul institucional Demo
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // 2. Fila de Metadatos
  ws.mergeCells('A2:J2');
  const infoCell = ws.getCell('A2');
  const resueltosCount = tickets.filter((t) => t.estado === 'resuelto').length;
  const abiertosCount = tickets.filter((t) => t.estado === 'abierto').length;
  const enRevisionCount = tickets.filter((t) => t.estado === 'en_revision').length;

  infoCell.value = `Generado el ${fechaStr} a las ${horaStr}  |  Total de Tickets: ${tickets.length}  |  Resueltos: ${resueltosCount}  |  Abiertos: ${abiertosCount}  |  En Revisión: ${enRevisionCount}`;
  infoCell.font = { name: 'Arial', size: 9.5, italic: true };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Fila vacía separadora
  ws.getRow(3).height = 8;

  // 3. Encabezados de Columnas
  const headers = [
    'Código Ticket',
    'Fecha Reporte',
    'Categoría',
    'Prioridad',
    'Estado',
    'Título de la Incidencia',
    'Descripción del Error',
    'Reportado Por',
    'Solución y Respuesta Técnica',
    'Resuelto Por / Fecha Resolución',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // 4. Filas de Datos
  tickets.forEach((t) => {
    const createdDate = new Date(t.created_at);
    const dateFormatted = `${createdDate.toLocaleDateString('es-CL')} ${createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let resolucionInfo = '-';
    if (t.fecha_resolucion) {
      const resDate = new Date(t.fecha_resolucion);
      resolucionInfo = `${t.resuelto_por || 'Administrador'} (${resDate.toLocaleDateString('es-CL')})`;
    } else if (t.resuelto_por) {
      resolucionInfo = t.resuelto_por;
    }

    const row = ws.addRow([
      t.ticket_code,
      dateFormatted,
      CATEGORIA_LABELS[t.categoria] || t.categoria,
      PRIORIDAD_LABELS[t.prioridad] || t.prioridad,
      ESTADO_LABELS[t.estado] || t.estado,
      t.titulo,
      t.descripcion,
      t.reportado_por_nombre ? `${t.reportado_por_nombre} (${t.reportado_por})` : t.reportado_por,
      t.solucion || 'Pendiente de solución técnica.',
      resolucionInfo,
    ]);

    row.height = 28;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alineación centrada para códigos, fechas, categorías y estados
      if ([1, 2, 3, 4, 5, 10].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }

      // Color condicional sutil por estado
      if (colNumber === 5) {
        if (t.estado === 'resuelto') {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } }; // Verde
        } else if (t.estado === 'abierto') {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFDC2626' } }; // Rojo
        } else if (t.estado === 'en_revision') {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFD97706' } }; // Ámbar
        }
      }
    });
  });

  // 5. Configurar Anchos de Columnas
  ws.columns = [
    { width: 16 }, // Código
    { width: 18 }, // Fecha Reporte
    { width: 26 }, // Categoría
    { width: 14 }, // Prioridad
    { width: 18 }, // Estado
    { width: 32 }, // Título
    { width: 45 }, // Descripción
    { width: 28 }, // Reportado Por
    { width: 45 }, // Solución
    { width: 28 }, // Resuelto Por
  ];

  // 6. Activar Autofilter
  ws.autoFilter = 'A4:J4';

  // 7. Descargar archivo
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_soporte_incidencias_${now.toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
