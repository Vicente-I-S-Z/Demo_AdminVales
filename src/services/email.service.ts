import { supabase } from './supabase';
import type { SupportTicket } from '../types';
import { CATEGORIA_LABELS, PRIORIDAD_LABELS } from './support.service';

/**
 * MODO DEMO: notificaciones por correo desactivadas.
 * Los tickets se siguen guardando en Supabase con normalidad,
 * pero no se envía ningún correo (ni relay PHP, ni Edge Function, ni Resend).
 */
export const EMAIL_NOTIFICATIONS_ENABLED: boolean = false;

/**
 * Correos del equipo de administración técnica encargados de reparar incidencias.
 */
export const TECH_ADMIN_EMAILS = [
  'admin@demo.com',
  'soporte@demo.com',
];

export interface EmailNotificationResult {
  success: boolean;
  notifiedAdmins: boolean;
  notifiedUser: boolean;
  message?: string;
  error?: string;
}

/**
 * Genera el cuerpo en texto plano y HTML para la notificación al administrador.
 */
export function buildAdminEmailContent(ticket: SupportTicket) {
  const categoria = CATEGORIA_LABELS[ticket.categoria] || ticket.categoria;
  const prioridad = PRIORIDAD_LABELS[ticket.prioridad] || ticket.prioridad;
  const reportante = ticket.reportado_por_nombre
    ? `${ticket.reportado_por_nombre} (${ticket.reportado_por})`
    : ticket.reportado_por;
  const fecha = new Date(ticket.created_at).toLocaleString('es-CL');

  const subject = `🚨 [Soporte TI] Nueva Incidencia: [${ticket.ticket_code}] ${ticket.titulo}`;

  const text = `
SOPORTE TÉCNICO - NUEVA INCIDENCIA REPORTADA
============================================
Código de Ticket : ${ticket.ticket_code}
Fecha y Hora     : ${fecha}
Reportado Por    : ${reportante}
Categoría        : ${categoria}
Nivel Prioridad  : ${prioridad.toUpperCase()}
Estado Actual    : Abierto / Pendiente de Diagnóstico

TÍTULO:
${ticket.titulo}

DESCRIPCIÓN DEL PROBLEMA Y PASOS PARA REPRODUCIR:
-------------------------------------------------
${ticket.descripcion}

============================================
Para responder directamente al usuario, escribe a: ${ticket.reportado_por}
Sistema de Administración Web Demo
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0033ab; padding: 24px; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
    .badge-critica { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
    .badge-alta { background: #ffedd5; color: #c2410c; }
    .badge-media { background: #fef3c7; color: #92400e; }
    .badge-baja { background: #f1f5f9; color: #475569; }
    .content { padding: 24px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
    .meta-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .meta-label { color: #64748b; font-weight: 600; width: 140px; }
    .desc-box { background: #f8fafc; border-left: 4px solid #0033ab; padding: 16px; border-radius: 8px; margin-top: 16px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .footer { padding: 16px 24px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin: 0; font-size: 20px;">🚨 Nueva Incidencia Reportada</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Código: <strong>${ticket.ticket_code}</strong></p>
    </div>
    <div class="content">
      <table class="meta-table">
        <tr>
          <td class="meta-label">Asunto:</td>
          <td><strong>${ticket.titulo}</strong></td>
        </tr>
        <tr>
          <td class="meta-label">Reportado por:</td>
          <td>${reportante}</td>
        </tr>
        <tr>
          <td class="meta-label">Categoría:</td>
          <td>${categoria}</td>
        </tr>
        <tr>
          <td class="meta-label">Prioridad:</td>
          <td><span class="badge badge-${ticket.prioridad}">${prioridad}</span></td>
        </tr>
        <tr>
          <td class="meta-label">Fecha de Envío:</td>
          <td>${fecha}</td>
        </tr>
      </table>

      <h4 style="margin: 20px 0 8px 0; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Detalle del Error / Problema</h4>
      <div class="desc-box">${ticket.descripcion}</div>

      <div style="margin-top: 24px; text-align: center;">
        <a href="mailto:${ticket.reportado_por}?subject=Re: [${ticket.ticket_code}] ${encodeURIComponent(ticket.titulo)}" 
           style="background: #0033ab; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
          Responder a ${ticket.reportado_por_nombre || ticket.reportado_por}
        </a>
      </div>
    </div>
    <div class="footer">
      Sistema de Administración Web · Entorno Demo · Notificación Automática de Soporte TI
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Genera el cuerpo en texto plano y HTML para la confirmación al usuario.
 */
export function buildUserEmailContent(ticket: SupportTicket) {
  const categoria = CATEGORIA_LABELS[ticket.categoria] || ticket.categoria;
  const prioridad = PRIORIDAD_LABELS[ticket.prioridad] || ticket.prioridad;
  const nombre = ticket.reportado_por_nombre || 'Usuario';
  const fecha = new Date(ticket.created_at).toLocaleString('es-CL');

  const subject = `✅ [Soporte TI] Hemos recibido tu solicitud: [${ticket.ticket_code}] ${ticket.titulo}`;

  const text = `
Hola ${nombre},

Hemos recibido correctamente tu reporte de incidencia en el Sistema de Administración Web:

Código de Seguimiento : ${ticket.ticket_code}
Asunto                : ${ticket.titulo}
Categoría             : ${categoria}
Prioridad             : ${prioridad}
Fecha de Registro     : ${fecha}

DETALLE REGISTRADO:
${ticket.descripcion}

Los administradores de TI encargados ya han sido notificados con todos los antecedentes para su diagnóstico y resolución.

Tan pronto el problema sea revisado, nos contactaremos contigo por este medio.

Saludos cordiales,
Equipo de TI y Soporte Técnico
Sistema de Administración Demo
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #15803d; padding: 24px; color: #ffffff; }
    .content { padding: 24px; }
    .desc-box { background: #f8fafc; border-left: 4px solid #15803d; padding: 16px; border-radius: 8px; margin-top: 16px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; font-size: 13px; color: #166534; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin: 0; font-size: 20px;">✅ Solicitud de Soporte Recibida</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Código de Ticket: <strong>${ticket.ticket_code}</strong></p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hola <strong>${nombre}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.5;">
        Confirmamos que tu reporte ha sido ingresado exitosamente en nuestra plataforma de soporte técnico.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr><td style="padding: 6px 0; color: #64748b; width: 130px;">Código:</td><td><strong>${ticket.ticket_code}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Asunto:</td><td>${ticket.titulo}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Categoría:</td><td>${categoria}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Prioridad:</td><td>${prioridad}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Fecha:</td><td>${fecha}</td></tr>
      </table>

      <h4 style="margin: 16px 0 6px 0; font-size: 13px; color: #334155; text-transform: uppercase;">Detalle enviado:</h4>
      <div class="desc-box">${ticket.descripcion}</div>

      <div class="info-box">
        ℹ️ El equipo de administración técnica ha sido notificado para analizar el caso y aplicar las correcciones necesarias.
      </div>
    </div>
    <div class="footer">
      Sistema de Administración Web · Entorno Demo · Mesa de Ayuda
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Genera un enlace mailto pre-rellenado para abrir directamente en Outlook / cliente local.
 */
export function buildMailtoUrl(to: string[], subject: string, body: string): string {
  const recipients = to.join(',');
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Obtiene el enlace de correo para notificar al administrador desde el cliente.
 */
export function getAdminMailtoUrl(ticket: SupportTicket): string {
  const { subject, text } = buildAdminEmailContent(ticket);
  return buildMailtoUrl(TECH_ADMIN_EMAILS, subject, text);
}

/**
 * Obtiene el enlace de correo para notificar al usuario que su ticket ha sido resuelto.
 */
export function getUserResolutionMailtoUrl(ticket: SupportTicket, solucion?: string): string {
  const nombre = ticket.reportado_por_nombre || 'Usuario';
  const fecha = new Date().toLocaleString('es-CL');
  const subject = `✅ [Soporte TI] Incidencia Resuelta: [${ticket.ticket_code}] ${ticket.titulo}`;
  const text = `
Hola ${nombre},

Te informamos que tu reporte de incidencia en el Sistema de Administración Web ha sido marcado como RESUELTO por el equipo de TI.

DETALLES DEL TICKET:
====================
Código de Ticket : ${ticket.ticket_code}
Asunto           : ${ticket.titulo}
Fecha Resolución : ${fecha}

DIAGNÓSTICO Y SOLUCIÓN APLICADA:
---------------------------------
${solucion || ticket.solucion || 'El problema ha sido diagnosticado y corregido exitosamente en el sistema.'}

Si aún experimentas inconvenientes relacionados, por favor responde a este correo o ingresa a la plataforma.

Atentamente,
Equipo de TI y Soporte Técnico
Sistema de Administración Demo
`.trim();

  return buildMailtoUrl([ticket.reportado_por], subject, text);
}

/**
 * Disparador HTTP hacia el relay de correo SendGrid (send_support_email.php)
 */
async function dispatchEmailRelay(payload: any): Promise<{ success: boolean; data?: any }> {
  // Probar rutas relativas del relay según el despliegue
  const endpoints = [
    '/send_support_email.php',
    './send_support_email.php',
    `${window.location.origin}/send_support_email.php`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: data.success === true, data };
      }
    } catch {
      // Continuar con el siguiente endpoint candidato
    }
  }

  return { success: false };
}

/**
 * Envía las notificaciones de correo para un ticket creado.
 * Realiza el envío tanto al administrador encargado como al usuario que reportó.
 */
export async function sendSupportTicketNotificationEmails(ticket: SupportTicket): Promise<EmailNotificationResult> {
  if (!EMAIL_NOTIFICATIONS_ENABLED) {
    return {
      success: true,
      notifiedAdmins: false,
      notifiedUser: false,
      message: 'Modo demo: notificaciones por correo desactivadas.',
    };
  }

  const adminContent = buildAdminEmailContent(ticket);
  const userContent = buildUserEmailContent(ticket);

  let notifiedAdmins = false;
  let notifiedUser = false;
  let errorMessage: string | undefined;

  // 1. Intentar enviar a través del Relay SendGrid nativo
  try {
    const relayResult = await dispatchEmailRelay({
      action: 'ticket_created',
      ticket,
    });

    if (relayResult.success) {
      return {
        success: true,
        notifiedAdmins: relayResult.data?.notifications?.admin ?? true,
        notifiedUser: relayResult.data?.notifications?.user ?? true,
        message: 'Correos despachados vía SendGrid exitosamente.',
      };
    }
  } catch (err: any) {
    console.info('Relay SendGrid local no disponible en dev, probando alternativas:', err?.message);
  }

  // 2. Intentar enviar mediante Supabase Edge Function si está desplegada
  try {
    const { error: fnError } = await supabase.functions.invoke('send-support-ticket-email', {
      body: {
        ticket,
        adminEmails: TECH_ADMIN_EMAILS,
        userEmail: ticket.reportado_por,
        adminContent,
        userContent,
      },
    });

    if (!fnError) {
      return {
        success: true,
        notifiedAdmins: true,
        notifiedUser: true,
        message: 'Correos enviados exitosamente mediante Edge Function de Supabase.',
      };
    }
  } catch (err: any) {
    console.info('Aviso al llamar Edge Function de Supabase:', err?.message || err);
  }

  // 3. Intentar servicio de envío configurado en variables de entorno (p.ej. Resend)
  const resendApiKey = (import.meta as any).env?.VITE_RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const adminRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Soporte TI <soporte@demo.com>',
          to: TECH_ADMIN_EMAILS,
          subject: adminContent.subject,
          html: adminContent.html,
          text: adminContent.text,
        }),
      });

      if (adminRes.ok) notifiedAdmins = true;

      if (ticket.reportado_por) {
        const userRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Soporte TI <soporte@demo.com>',
            to: [ticket.reportado_por],
            subject: userContent.subject,
            html: userContent.html,
            text: userContent.text,
          }),
        });

        if (userRes.ok) notifiedUser = true;
      }
    } catch (apiErr: any) {
      console.warn('Error al contactar Resend API:', apiErr);
      errorMessage = apiErr?.message;
    }
  }

  return {
    success: true,
    notifiedAdmins,
    notifiedUser,
    message: notifiedAdmins && notifiedUser
      ? 'Notificaciones de correo despachadas exitosamente.'
      : 'Ticket registrado y listo para notificación.',
    error: errorMessage,
  };
}

/**
 * Envía el correo de notificación de ticket resuelto al usuario que lo reportó.
 */
export async function sendSupportTicketResolutionEmail(
  ticket: SupportTicket,
  solucion?: string,
  resuelto_por?: string
): Promise<{ success: boolean; message?: string }> {
  if (!EMAIL_NOTIFICATIONS_ENABLED) {
    return { success: true, message: 'Modo demo: notificaciones por correo desactivadas.' };
  }

  const userEmail = (ticket.reportado_por || (ticket as any).email || (ticket as any).correo || '').trim();
  if (!userEmail) {
    console.warn('[sendSupportTicketResolutionEmail] El ticket no contiene correo en "reportado_por":', ticket);
    return { success: false, message: 'Ticket sin correo reportado_por.' };
  }

  try {
    const relayResult = await dispatchEmailRelay({
      action: 'ticket_resolved',
      ticket: {
        ...ticket,
        solucion: solucion || ticket.solucion,
        resuelto_por: resuelto_por || ticket.resuelto_por || 'Soporte TI',
      },
      solucion: solucion || ticket.solucion,
      resuelto_por: resuelto_por || ticket.resuelto_por || 'Soporte TI',
    });

    if (relayResult.success) {
      console.info(`[SistemaAdminWeb] ✅ Correo de resolución despachado a: ${userEmail}`);
      return { success: true, message: 'Correo de resolución enviado al usuario.' };
    }
  } catch (err: any) {
    console.warn('Aviso enviando correo de resolución:', err?.message);
  }

  return { success: false, message: 'No se pudo contactar el servicio de correo.' };
}
