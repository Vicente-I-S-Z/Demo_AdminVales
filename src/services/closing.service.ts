import { supabase } from './supabase';
import ExcelJS from 'exceljs';
import type { ClosingFilters } from '../types';
import { GUEST_CODES_FALLBACK } from './guestCodesFallback';

export interface ClosingReportResult {
  total: number;
  qrCount: number;
  contingenciaCount: number;
  filename: string;
}

const MONTH_LABELS = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getCalendarParts(str?: string | null) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  }
  return null;
}

interface UnifiedClosingRecord {
  tipo: 'qr' | 'contingencia';
  sortDate: string;
  codTxt: string;
  codNum: string;
  fechaVale: string;
  nombre: string;
  empresa: string;
  fechaValFormat: string;
  hora: string;
  restaurante: string;
  periodo: string;
  desviacion: number;
  observacion?: string;
}

// ─── Generate and download an Excel report for a given month ─
export async function generateMonthlyReport(filters: ClosingFilters): Promise<ClosingReportResult> {
  const { month, year, restaurant } = filters;

  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const monthNamesShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const yy = String(year).slice(-2);
  const periodoStr = `${monthNamesShort[month - 1]}-${yy}`;

  // 1. Fetch QR Registrations
  let query = supabase
    .from('qr_registrations')
    .select('qr_code, date, time, restaurante')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (restaurant !== 'Todos') {
    query = query.eq('restaurante', restaurant);
  }

  const { data: validations, error: valError } = await query;
  if (valError) throw valError;
  const qrList = validations || [];

  // 1.1 Fetch Vales de Contingencia Manual (ej. Cafe Vincent por fallo o robo de equipo)
  let contQuery = supabase
    .from('vales_contingencia_manual')
    .select('id, nombre_trabajador, empresa, restaurante, fecha_consumo, notas, created_at')
    .gte('fecha_consumo', startDate)
    .lte('fecha_consumo', endDate)
    .order('fecha_consumo', { ascending: true });

  if (restaurant !== 'Todos') {
    const restKeyword = restaurant.replace(/cafe/i, '').trim() || restaurant;
    contQuery = contQuery.ilike('restaurante', `%${restKeyword}%`);
  }

  let contingenciaData: any[] = [];
  try {
    const { data: contRows, error: contError } = await contQuery;
    if (contError) {
      console.warn('Advertencia al consultar vales_contingencia_manual:', contError);
    } else if (contRows) {
      contingenciaData = contRows;
    }
  } catch (err) {
    console.warn('Error consultando vales_contingencia_manual:', err);
  }

  const totalRecords = qrList.length + contingenciaData.length;
  if (totalRecords === 0) {
    throw new Error('No se encontraron registros para los filtros seleccionados.');
  }

  // 2. Extract unique QR codes to fetch their generation details without hitting 1000-row limits
  const qrCodesToFetch = [...new Set(qrList.map(v => v.qr_code).filter(Boolean))];

  const codesData: any[] = [];
  // Use small chunks (50) to prevent '414 URI Too Long' HTTP errors in Supabase GET requests
  for (let i = 0; i < qrCodesToFetch.length; i += 50) {
    const chunk = qrCodesToFetch.slice(i, i + 50);
    const { data, error } = await supabase
      .from('daily_user_codes')
      .select('codigo_diario, user_email, fecha_generacion, created_at, empresa, nombre_invitado, apellido_invitado, user_name, qr_data')
      .in('codigo_diario', chunk);
      
    if (error) console.error('Error fetching codes chunk:', error);
    if (data) codesData.push(...data);
  }

  // Recolectar todos los correos relevantes (tanto de usuarios directos como de creadores de vales GUEST)
  const emailsToFetch = [...new Set(
    codesData.flatMap((c) => {
      const list: string[] = [];
      if (c.user_email) list.push(String(c.user_email).toLowerCase().trim());
      if (c.qr_data) {
        try {
          const parsed = typeof c.qr_data === 'string' ? JSON.parse(c.qr_data) : c.qr_data;
          if (parsed?.generatedBy) list.push(String(parsed.generatedBy).toLowerCase().trim());
          if (parsed?.createdBy) list.push(String(parsed.createdBy).toLowerCase().trim());
          if (parsed?.email) list.push(String(parsed.email).toLowerCase().trim());
        } catch {
          // ignore
        }
      }
      return list;
    }).filter(Boolean)
  )];

  const usersData: any[] = [];
  const authData: any[] = [];
  
  if (emailsToFetch.length > 0) {
    for (let i = 0; i < emailsToFetch.length; i += 50) {
      const chunk = emailsToFetch.slice(i, i + 50);
      
      const [uRes, aRes] = await Promise.all([
        supabase.from('user_profiles').select('email, nombre, apellidos, empresa').in('email', chunk),
        supabase.from('authorized_emails').select('email, empresa').in('email', chunk)
      ]);
      
      if (uRes.error) console.error('Error fetching users chunk:', uRes.error);
      if (uRes.data) usersData.push(...uRes.data);
      
      if (aRes.error) console.error('Error fetching auth chunk:', aRes.error);
      if (aRes.data) authData.push(...aRes.data);
    }
  }

  const codesMap = new Map();
  codesData.forEach(c => codesMap.set(c.codigo_diario, c));

  const usersMap = new Map();
  const userEmpresaMap = new Map();
  usersData.forEach(u => {
    const emailKey = (u.email || '').toLowerCase().trim();
    if (emailKey) {
      usersMap.set(emailKey, `${u.nombre || ''} ${u.apellidos || ''}`.trim());
      if (u.empresa) userEmpresaMap.set(emailKey, u.empresa);
    }
  });

  const authMap = new Map();
  authData.forEach(a => {
    const emailKey = (a.email || '').toLowerCase().trim();
    if (emailKey && a.empresa) authMap.set(emailKey, a.empresa);
  });

  // 3. Transformar registros QR en estructura unificada
  const qrRecords: UnifiedClosingRecord[] = qrList.map((item) => {
    const qrCode = item.qr_code || '';
    let codTxt = qrCode;
    let codNum = '';

    if (qrCode.includes('-')) {
      const parts = qrCode.split('-');
      codTxt = parts[0];
      codNum = parts.slice(1).join('-');
    }

    const codeInfo = codesMap.get(qrCode) || {};
    let nombre = '';
    let empresa = '';
    const fechaValeRaw = codeInfo.fecha_generacion || codeInfo.created_at || ''; 

    if (qrCode.startsWith('GUEST')) {
      // ─── RESOLUCIÓN DE CÓDIGOS DE INVITADO (GUEST-*) ─────────
      // 1. Extraer el nombre de la persona asignada con el vale
      let guestNom = '';
      if (codeInfo.nombre_invitado || codeInfo.apellido_invitado) {
        guestNom = `${codeInfo.nombre_invitado || ''} ${codeInfo.apellido_invitado || ''}`.replace(/\s+/g, ' ').trim();
      }

      if (!guestNom && codeInfo.qr_data) {
        try {
          const parsed = typeof codeInfo.qr_data === 'string' ? JSON.parse(codeInfo.qr_data) : codeInfo.qr_data;
          const nom = (parsed?.nombre || parsed?.name || parsed?.guest_name || '').trim();
          const ape = (parsed?.apellido || parsed?.lastName || '').trim();
          guestNom = `${nom} ${ape}`.replace(/\s+/g, ' ').trim();
        } catch {
          // ignore
        }
      }

      if (!guestNom && codeInfo.user_name) {
        guestNom = String(codeInfo.user_name).replace(/\s+/g, ' ').trim();
      }

      // Respaldo de seguridad histórico si no vino en Supabase
      if (!guestNom || guestNom.toLowerCase() === 'invitado') {
        const fallback = GUEST_CODES_FALLBACK[qrCode];
        if (fallback?.nombre) {
          guestNom = fallback.nombre;
        }
      }

      const cleanGuestNom = guestNom && guestNom.toLowerCase() !== 'invitado' ? guestNom : '';
      nombre = cleanGuestNom ? `${cleanGuestNom} (Invitado)` : 'Invitado';

      // 2. Extraer empresa de la persona que generó/entregó el vale
      let issuerEmail = (codeInfo.user_email || '').toLowerCase().trim();
      if (!issuerEmail && codeInfo.qr_data) {
        try {
          const parsed = typeof codeInfo.qr_data === 'string' ? JSON.parse(codeInfo.qr_data) : codeInfo.qr_data;
          issuerEmail = (parsed?.generatedBy || parsed?.createdBy || parsed?.email || '').toLowerCase().trim();
        } catch {
          // ignore
        }
      }
      if (!issuerEmail) {
        const fallback = GUEST_CODES_FALLBACK[qrCode];
        if (fallback?.issuer) issuerEmail = fallback.issuer.toLowerCase().trim();
      }

      // Buscar empresa del emisor en los mapeos
      let issuerEmpresa = authMap.get(issuerEmail) || userEmpresaMap.get(issuerEmail) || '';

      // Si no se encontró por mapeo, verificar campo empresa del registro si no es 'Invitado'
      if (!issuerEmpresa && codeInfo.empresa && codeInfo.empresa.trim().toLowerCase() !== 'invitado') {
        issuerEmpresa = codeInfo.empresa.trim();
      }

      // Heurística de dominio de correo
      if (!issuerEmpresa || issuerEmpresa === 'Sin información') {
        if (issuerEmail.includes('beta')) {
          issuerEmpresa = 'Empresa Beta';
        } else if (issuerEmail.includes('gamma')) {
          issuerEmpresa = 'Empresa Gamma';
        } else {
          issuerEmpresa = 'Empresa Alpha';
        }
      }

      // Respaldo de seguridad si aún no tiene empresa
      if (!issuerEmpresa || issuerEmpresa === 'Sin información') {
        const fallback = GUEST_CODES_FALLBACK[qrCode];
        if (fallback?.empresa) issuerEmpresa = fallback.empresa;
      }

      // Normalizar nombre de empresa
      const empLower = (issuerEmpresa || '').toLowerCase().trim();
      if (empLower === 'empresa beta') empresa = 'Empresa Beta';
      else if (empLower === 'empresa gamma') empresa = 'Empresa Gamma';
      else empresa = 'Empresa Alpha';

    } else {
      // ─── RESOLUCIÓN DE CÓDIGOS DE TRABAJADOR REGULAR ──────────
      const email = (codeInfo.user_email || '').toLowerCase().trim();
      nombre = usersMap.get(email);
      
      if (!nombre) {
        if (codeInfo.user_name) nombre = String(codeInfo.user_name).replace(/\s+/g, ' ').trim();
        else nombre = 'Usuario Registrado';
      }
      
      empresa = authMap.get(email) || userEmpresaMap.get(email) || codeInfo.empresa || '';

      if (!empresa || empresa === 'Sin información') {
        if (email.includes('beta')) {
          empresa = 'Empresa Beta';
        } else if (email.includes('gamma')) {
          empresa = 'Empresa Gamma';
        } else {
          empresa = 'Empresa Alpha';
        }
      }
    }

    let fechaVale = '-';
    let fechaValFormat = '-';
    let desviacion = 0;

    let valeParts = getCalendarParts(fechaValeRaw);
    if (!valeParts && qrCode) {
      const qrMatch = qrCode.match(/-(\d{2})(\d{2})(\d{4})$/);
      if (qrMatch) {
        valeParts = {
          day: parseInt(qrMatch[1], 10),
          month: parseInt(qrMatch[2], 10),
          year: parseInt(qrMatch[3], 10),
        };
      }
    }

    if (valeParts) {
      fechaVale = `${String(valeParts.day).padStart(2, '0')}-${String(valeParts.month).padStart(2, '0')}-${valeParts.year}`;
    }

    const valParts = getCalendarParts(item.date);
    if (valParts) {
      fechaValFormat = `${String(valParts.day).padStart(2, '0')}-${String(valParts.month).padStart(2, '0')}-${valParts.year}`;
    } else if (item.date) {
      fechaValFormat = item.date;
    }

    // Calculate Deviation in calendar days
    if (valeParts && valParts) {
      const utcVale = Date.UTC(valeParts.year, valeParts.month - 1, valeParts.day);
      const utcVal = Date.UTC(valParts.year, valParts.month - 1, valParts.day);
      desviacion = Math.round(Math.abs(utcVal - utcVale) / (1000 * 60 * 60 * 24));
    }

    const isGuest = qrCode.toUpperCase().startsWith('GUEST');
    const observacion = isGuest ? 'Invitado' : 'Validación Normal (Código QR)';

    return {
      tipo: 'qr',
      sortDate: item.date || '',
      codTxt,
      codNum,
      fechaVale,
      nombre,
      empresa,
      fechaValFormat,
      hora: item.time || '',
      restaurante: item.restaurante || '',
      periodo: periodoStr,
      desviacion,
      observacion,
    };
  });

  // 4. Transformar registros de Contingencia Manual en estructura unificada
  const contRecords: UnifiedClosingRecord[] = contingenciaData.map((c) => {
    const valParts = getCalendarParts(c.fecha_consumo);
    const fechaFmt = valParts
      ? `${String(valParts.day).padStart(2, '0')}-${String(valParts.month).padStart(2, '0')}-${valParts.year}`
      : c.fecha_consumo || '-';

    let emp = (c.empresa || '').trim();
    const empLower = emp.toLowerCase();
    if (empLower === 'empresa alpha') emp = 'Empresa Alpha';
    else if (empLower === 'empresa beta') emp = 'Empresa Beta';
    else if (empLower === 'empresa gamma') emp = 'Empresa Gamma';
    else if (!emp) emp = 'Empresa Alpha';

    return {
      tipo: 'contingencia',
      sortDate: c.fecha_consumo || '',
      codTxt: 'CONTINGENCIA',
      codNum: 'MANUAL',
      fechaVale: fechaFmt,
      nombre: c.nombre_trabajador ? c.nombre_trabajador.trim() : 'Sin información',
      empresa: emp,
      fechaValFormat: fechaFmt,
      hora: 'Manual (Contingencia)',
      restaurante: c.restaurante ? c.restaurante.trim() : 'Casino Central',
      periodo: periodoStr,
      desviacion: 0,
      observacion: `Contingencia Manual - ${c.notas || 'Robo de equipo'}`,
    };
  });

  // 5. Consolidar y ordenar cronológicamente
  const allRecords: UnifiedClosingRecord[] = [...qrRecords, ...contRecords];
  allRecords.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  // Build Excel with ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SistemaAdmin';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Cierre Mensual');

  worksheet.columns = [
    { key: 'idx', width: 6 },
    { key: 'cod_txt', width: 16 },
    { key: 'cod_num', width: 18 },
    { key: 'fecha_vale', width: 14 },
    { key: 'nombre', width: 35 },
    { key: 'empresa', width: 20 },
    { key: 'fecha_val', width: 18 },
    { key: 'hora', width: 22 },
    { key: 'restaurante', width: 22 },
    { key: 'periodo', width: 12 },
    { key: 'desviacion', width: 14 },
    { key: 'observacion', width: 40 },
  ];

  // Fila 1: Banner de Título Principal (Estilo corporativo según diseño de referencia)
  const titleText = `REPORTE DE CIERRE MENSUAL - ${MONTH_LABELS[month].toUpperCase()} ${year}${restaurant !== 'Todos' ? ` - ${restaurant.toUpperCase()}` : ''}`;
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = titleText;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 26;

  // Fila 2: Subcabecera con información de generación y totales (indicando contingencia si aplica)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const contDetail = contingenciaData.length > 0 ? ` (incluye ${contingenciaData.length} vales manuales de contingencia)` : '';
  const subheaderText = `Generado: ${dateStr}  |  Total: ${allRecords.length} validación(es)${contDetail}${restaurant !== 'Todos' ? `  |  Restaurante: ${restaurant}` : ''}`;
  worksheet.mergeCells('A2:L2');
  const subheaderCell = worksheet.getCell('A2');
  subheaderCell.value = subheaderText;
  subheaderCell.font = { name: 'Arial', size: 10, color: { argb: 'FF333333' } };
  subheaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 18;

  // Fila 3: Espaciador
  worksheet.getRow(3).height = 10;

  // Fila 4: Cabeceras de las columnas
  const headerValues = [
    '#', 'CÓDIGO', 'CÓDIGO', 'FECHA VALE', 'NOMBRE', 'EMPRESA', 'FECHA VALIDACIÓN', 'HORA', 'RESTAURANTE', 'PERIODO', 'DESVIACIÓN', 'TIPO / OBSERVACIÓN'
  ];
  const headerRow = worksheet.getRow(4);
  headerValues.forEach((val, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = val;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE60000' } }; // Rojo corporativo
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    };
  });
  headerRow.height = 22;

  // Filtro automático en la fila 4
  worksheet.autoFilter = 'A4:L4';

  const statsByEmpresa = new Map<string, { qr: number; cont: number; total: number }>();

  allRecords.forEach((item, idx) => {
    // Acumular conteo para el resumen por empresa (los invitados se suman a su empresa emisora)
    let empKey = item.empresa || 'Sin información';
    if (empKey.toLowerCase() === 'invitado') {
      empKey = 'Empresa Alpha';
    }
    if (!statsByEmpresa.has(empKey)) {
      statsByEmpresa.set(empKey, { qr: 0, cont: 0, total: 0 });
    }
    const stat = statsByEmpresa.get(empKey)!;
    if (item.tipo === 'contingencia') stat.cont++;
    else stat.qr++;
    stat.total++;

    const row = worksheet.addRow({
      idx: idx + 1,
      cod_txt: item.codTxt,
      cod_num: item.codNum,
      fecha_vale: item.fechaVale,
      nombre: item.nombre,
      empresa: item.empresa,
      fecha_val: item.fechaValFormat,
      hora: item.hora,
      restaurante: item.restaurante,
      periodo: item.periodo,
      desviacion: item.desviacion,
      observacion: item.observacion,
    });
    
    row.height = 20;
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' }; // Nombre left aligned
    row.getCell(12).alignment = { horizontal: 'left', vertical: 'middle' }; // Observación left aligned

    const isContingencia = item.tipo === 'contingencia';
    const isEven = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (isContingencia) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }; // Suave dorado ámbar para contingencia
        if (colNumber === 2 || colNumber === 12) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF856404' } };
        }
      } else if (item.observacion === 'Invitado') {
        if (colNumber === 2 || colNumber === 12) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } }; // Azul destacado para Invitado
        }
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          };
        }
      } else if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' },
        };
      }
    });
  });

  // ─── PESTAÑA 2: RESUMEN POR EMPRESA ─────────────────────────
  const summarySheet = workbook.addWorksheet('Resumen por Empresa');

  summarySheet.columns = [
    { key: 'pad', width: 4 },
    { key: 'empresa', width: 25 },
    { key: 'qr', width: 16 },
    { key: 'cont', width: 20 },
    { key: 'total', width: 18 },
    { key: 'pct', width: 16 },
  ];

  // Fila 1: Banner de Título Principal (Azul corporativo)
  const sumTitleText = `RESUMEN POR EMPRESA - ${MONTH_LABELS[month].toUpperCase()} ${year}${restaurant !== 'Todos' ? ` - ${restaurant.toUpperCase()}` : ''}`;
  const bannerRow = summarySheet.addRow(['', sumTitleText, '', '', '', '']);
  bannerRow.height = 26;
  summarySheet.mergeCells(`B${bannerRow.number}:F${bannerRow.number}`);
  const bannerCell = bannerRow.getCell(2);
  bannerCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
  bannerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 2: Subcabecera con información de generación y total
  const sumSubheaderText = `Generado: ${dateStr}  |  Total: ${allRecords.length} validación(es)${contDetail}${restaurant !== 'Todos' ? `  |  Restaurante: ${restaurant}` : ''}`;
  const subRow = summarySheet.addRow(['', sumSubheaderText, '', '', '', '']);
  subRow.height = 18;
  summarySheet.mergeCells(`B${subRow.number}:F${subRow.number}`);
  const subCell = subRow.getCell(2);
  subCell.font = { name: 'Arial', size: 10, color: { argb: 'FF333333' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 3: Espaciador
  const spacerRow = summarySheet.addRow([]);
  spacerRow.height = 10;

  // Fila 4: Cabeceras de la tabla
  const headerTblRow = summarySheet.addRow(['', 'EMPRESA', 'VALES QR', 'CONTINGENCIA', 'TOTAL GENERAL', '% DEL TOTAL']);
  headerTblRow.height = 22;
  [2, 3, 4, 5, 6].forEach((colIdx) => {
    const cell = headerTblRow.getCell(colIdx);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF207B47' } }; // Verde Corporativo Demo
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F5132' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Filas por empresa
  let totQr = 0;
  let totCont = 0;
  let totGen = 0;

  Array.from(statsByEmpresa.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([emp, st], idx) => {
      totQr += st.qr;
      totCont += st.cont;
      totGen += st.total;
      const pct = allRecords.length > 0 ? ((st.total / allRecords.length) * 100).toFixed(1) + '%' : '0%';
      const dataRow = summarySheet.addRow(['', emp, st.qr, st.cont, st.total, pct]);
      dataRow.height = 22;
      const isEven = idx % 2 === 0;
      const fillBg = isEven ? 'FFF8F9FA' : 'FFFFFFFF';

      [2, 3, 4, 5, 6].forEach((cIdx) => {
        const cell = dataRow.getCell(cIdx);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillBg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        cell.alignment = { horizontal: cIdx === 2 ? 'left' : 'center', vertical: 'middle' };
      });

      dataRow.getCell(2).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      dataRow.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0033AB' } };
      if (st.cont > 0) {
        dataRow.getCell(4).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF856404' } };
      } else {
        dataRow.getCell(4).font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
      }
      dataRow.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      dataRow.getCell(6).font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
    });

  // Fila Total
  const totalRow = summarySheet.addRow(['', 'TOTAL GENERAL', totQr, totCont, totGen, '100.0%']);
  totalRow.height = 24;
  [2, 3, 4, 5, 6].forEach((colIdx) => {
    const cell = totalRow.getCell(colIdx);
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBC7314' } }; // Ocre Corporativo
    cell.alignment = { horizontal: colIdx === 2 ? 'left' : 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF7F4C12' } },
      bottom: { style: 'medium', color: { argb: 'FF7F4C12' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // ─── PESTAÑA 3: DETALLE CONTINGENCIA (Si existen vales de contingencia) ─
  if (contingenciaData.length > 0) {
    const contSheet = workbook.addWorksheet('Detalle Contingencia');
    contSheet.columns = [
      { key: 'idx', width: 6 },
      { key: 'fecha', width: 16 },
      { key: 'nombre', width: 35 },
      { key: 'empresa', width: 20 },
      { key: 'restaurante', width: 22 },
      { key: 'notas', width: 45 },
    ];

    contSheet.mergeCells('A1:F1');
    const cTitle = contSheet.getCell('A1');
    cTitle.value = `VALES REGISTRADOS POR CONTINGENCIA MANUAL - ${MONTH_LABELS[month].toUpperCase()} ${year}${restaurant !== 'Todos' ? ` - ${restaurant.toUpperCase()}` : ''}`;
    cTitle.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBC7314' } };
    cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    contSheet.getRow(1).height = 26;

    contSheet.mergeCells('A2:F2');
    const cSub = contSheet.getCell('A2');
    cSub.value = `Total de vales registrados por contingencia: ${contingenciaData.length}  |  Motivo: Inoperatividad temporal del sistema web en restaurante`;
    cSub.font = { name: 'Arial', size: 10, color: { argb: 'FF333333' } };
    cSub.alignment = { horizontal: 'center', vertical: 'middle' };
    contSheet.getRow(2).height = 18;

    contSheet.getRow(3).height = 10;

    const cHeaders = ['#', 'FECHA CONSUMO', 'NOMBRE TRABAJADOR', 'EMPRESA', 'RESTAURANTE', 'NOTAS / MOTIVO'];
    const cHeaderRow = contSheet.addRow(cHeaders);
    cHeaderRow.height = 22;
    [1, 2, 3, 4, 5, 6].forEach((i) => {
      const c = cHeaderRow.getCell(i);
      c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE60000' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      };
    });
    contSheet.autoFilter = 'A4:F4';

    contingenciaData.forEach((c, idx) => {
      const parts = getCalendarParts(c.fecha_consumo);
      const fechaFmt = parts ? `${String(parts.day).padStart(2, '0')}-${String(parts.month).padStart(2, '0')}-${parts.year}` : c.fecha_consumo;
      const r = contSheet.addRow({
        idx: idx + 1,
        fecha: fechaFmt,
        nombre: c.nombre_trabajador,
        empresa: c.empresa,
        restaurante: c.restaurante,
        notas: c.notas || 'Ingresado por contingencia de robo de equipo',
      });
      r.height = 20;
      r.alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };

      const isEven = idx % 2 === 1;
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' },
          };
        }
      });
    });
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const restSuffix = restaurant !== 'Todos' ? `_${restaurant.replace(/\s+/g, '_')}` : '';
  const downloadFilename = `Cierre_${MONTH_LABELS[month]}_${year}${restSuffix}.xlsx`;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    total: allRecords.length,
    qrCount: qrList.length,
    contingenciaCount: contingenciaData.length,
    filename: downloadFilename,
  };
}
