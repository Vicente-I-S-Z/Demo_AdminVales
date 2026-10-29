import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  getUsers,
  updateUserRoleAndEmpresa,
  setValesBlockWithCalendar,
  deleteAuthorizedEmail,
  createAuthorizedUser
} from '../services/users.service';
import {
  getCalendarBlocks,
  createCalendarBlock,
  deleteCalendarBlock,
  createBulkCalendarBlocks,
  getLocalDateString,
  formatChileanDate,
  calculateInclusiveDays,
  getExtremeDatesInfo
} from '../services/calendar.service';
import {
  Users, Search, Ban, CheckCircle, Lock, X, Calendar, Trash2,
  FileSpreadsheet, Coins, UserPlus, Key, Edit3, User,
  CalendarRange, Clock, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InAppAlert, InAppConfirm, InAppToast } from '../components/ui/InAppDialogs';
import { Pagination } from '../components/ui/Pagination';
import type { AppUser, CalendarBlock } from '../types';
import ExcelJS from 'exceljs';

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [savingAction, setSavingAction] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal de Bloqueo Masivo de Vales
  interface BulkUserItem {
    user: AppUser;
    fechaInicio: string;
    fechaTermino: string;
    descripcion: string;
    tipoBloqueo: 'rango' | 'extremos';
  }

  const [bulkBlockModal, setBulkBlockModal] = useState<{
    isOpen: boolean;
    sameDurationForAll: boolean;
    globalInicio: string;
    globalTermino: string;
    globalDescripcion: string;
    globalTipoBloqueo: 'rango' | 'extremos';
    users: BulkUserItem[];
  }>({
    isOpen: false,
    sameDurationForAll: true,
    globalInicio: '',
    globalTermino: '',
    globalDescripcion: '',
    globalTipoBloqueo: 'rango',
    users: [],
  });

  // Helpers de cálculo de fechas y desbloqueo automático
  const addDaysToDate = (baseDateStr: string, days: number): string => {
    if (!baseDateStr) return '';
    const parts = baseDateStr.split('-').map(Number);
    if (parts.length !== 3) return '';
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
  };

  const getAutoUnblockDateInfo = (fechaInicio: string, fechaTermino: string) => {
    if (!fechaTermino) return { unblockDateStr: '-', unblockFormatted: '-', totalDays: 0 };
    const parts = fechaTermino.split('-').map(Number);
    if (parts.length !== 3) return { unblockDateStr: '-', unblockFormatted: '-', totalDays: 0 };

    // Si termina el 12, se desbloquea el 13
    const unblockDate = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const unblockDateStr = getLocalDateString(unblockDate);
    const unblockFormatted = unblockDate.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const totalDays = calculateInclusiveDays(fechaInicio, fechaTermino);

    return { unblockDateStr, unblockFormatted, totalDays };
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSelectedUser = (): AppUser | null => {
    if (selectedUserIds.size === 1) {
      const firstId = Array.from(selectedUserIds)[0];
      return users.find((u) => u.id === firstId) || null;
    }
    return null;
  };

  const openBulkBlockModal = () => {
    const selectedList = users.filter((u) => selectedUserIds.has(u.id));
    if (selectedList.length < 2) {
      setToast({
        type: 'warning',
        title: 'Selección requerida',
        message: 'Por favor selecciona al menos 2 usuarios con los checkboxes para realizar un bloqueo en conjunto.',
      });
      return;
    }

    const todayStr = getLocalDateString();
    const endStr = addDaysToDate(todayStr, 2); // Default 3 días inclusivos (hoy + 2)

    setBulkBlockModal({
      isOpen: true,
      sameDurationForAll: true,
      globalInicio: todayStr,
      globalTermino: endStr,
      globalDescripcion: '',
      globalTipoBloqueo: 'rango',
      users: selectedList.map((u) => ({
        user: u,
        fechaInicio: todayStr,
        fechaTermino: endStr,
        descripcion: '',
        tipoBloqueo: 'rango',
      })),
    });
  };

  // In-page feedback & dialogs (NO native alert or confirm)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; isDanger?: boolean; onConfirm: () => void } | null>(null);

  // Modals state
  const [roleModal, setRoleModal] = useState<{ isOpen: boolean; user: AppUser | null; selectedRole: string; selectedEmpresa: string }>({
    isOpen: false,
    user: null,
    selectedRole: 'usuario',
    selectedEmpresa: '',
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: AppUser | null }>({ isOpen: false, user: null });
  const [valesModal, setValesModal] = useState<{ isOpen: boolean; user: AppUser | null; habilitado: boolean }>({ isOpen: false, user: null, habilitado: true });
  const [newUserModal, setNewUserModal] = useState<{ isOpen: boolean; email: string; empresa: string }>({
    isOpen: false, email: '', empresa: ''
  });

  // Calendar Block Modal
  const [calendarModal, setCalendarModal] = useState<AppUser | null>(null);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockForm, setBlockForm] = useState<{
    fechaInicio: string;
    fechaTermino: string;
    descripcion: string;
    tipoBloqueo: 'rango' | 'extremos';
  }>({
    fechaInicio: '',
    fechaTermino: '',
    descripcion: '',
    tipoBloqueo: 'rango',
  });
  const [blockSaving, setBlockSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError('No se pudo cargar la lista de usuarios.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Dispatcher for Action Bar Buttons ───────────────────────
  const handleActionClick = (action: string) => {
    if (action === 'nuevo') {
      setNewUserModal({ isOpen: true, email: '', empresa: '' });
      return;
    }

    if (action === 'bloqueo_masivo') {
      openBulkBlockModal();
      return;
    }

    if (selectedUserIds.size > 1 && (action === 'calendario' || action === 'habilitar')) {
      openBulkBlockModal();
      return;
    }

    if (selectedUserIds.size > 1) {
      setToast({
        type: 'info',
        title: 'Acción individual',
        message: 'Para modificar rol, eliminar o ver códigos selecciona un solo usuario, o utiliza "Bloqueo en Conjunto" para los usuarios seleccionados.',
      });
      return;
    }

    const selectedUser = getSelectedUser();
    if (!selectedUser) {
      setToast({
        type: 'warning',
        title: 'Selección requerida',
        message: 'Por favor, haz clic sobre un usuario en la tabla para seleccionarlo.',
      });
      return;
    }

    switch (action) {
      case 'modificar':
        setRoleModal({
          isOpen: true,
          user: selectedUser,
          selectedRole: (selectedUser.rol || 'usuario').toLowerCase(),
          selectedEmpresa: selectedUser.empresa && selectedUser.empresa !== '-' ? selectedUser.empresa : '',
        });
        break;

      case 'eliminar':
        setDeleteModal({
          isOpen: true,
          user: selectedUser,
        });
        break;

      case 'codigos':
        navigate(`/codigos?search=${encodeURIComponent(selectedUser.email)}`);
        break;

      case 'habilitar': {
        const isBlocked = isValesBlocked(selectedUser);
        setValesModal({
          isOpen: true,
          user: selectedUser,
          habilitado: isBlocked ? false : (selectedUser.habilitado ?? true),
        });
        break;
      }

      case 'calendario':
        openCalendarModal(selectedUser);
        break;

      default:
        break;
    }
  };

  // ─── GUARDAR BLOQUEO EN CONJUNTO (MASIVO) ────────────────────
  const handleSaveBulkBlock = async () => {
    if (bulkBlockModal.users.length === 0) return;

    if (bulkBlockModal.sameDurationForAll) {
      if (!bulkBlockModal.globalInicio || !bulkBlockModal.globalTermino) {
        setAlertDialog({
          isOpen: true,
          type: 'warning',
          title: 'Fechas requeridas',
          message: 'Por favor ingresa la fecha de inicio y de término para el bloqueo en conjunto.',
        });
        return;
      }
      if (bulkBlockModal.globalTermino < bulkBlockModal.globalInicio) {
        setAlertDialog({
          isOpen: true,
          type: 'warning',
          title: 'Rango de fechas inválido',
          message: 'La fecha de término debe ser igual o posterior a la fecha de inicio.',
        });
        return;
      }
    } else {
      for (const item of bulkBlockModal.users) {
        if (!item.fechaInicio || !item.fechaTermino) {
          setAlertDialog({
            isOpen: true,
            type: 'warning',
            title: 'Fechas requeridas',
            message: `Por favor completa las fechas de inicio y término para ${item.user.nombre} (${item.user.email}).`,
          });
          return;
        }
        if (item.fechaTermino < item.fechaInicio) {
          setAlertDialog({
            isOpen: true,
            type: 'warning',
            title: 'Rango de fechas inválido',
            message: `Para ${item.user.nombre}, la fecha de término no puede ser anterior a la de inicio.`,
          });
          return;
        }
      }
    }

    setSavingAction(true);
    try {
      const itemsToBlock = bulkBlockModal.sameDurationForAll
        ? bulkBlockModal.users.map((item) => ({
          userEmail: item.user.email,
          fechaInicio: bulkBlockModal.globalInicio,
          fechaTermino: bulkBlockModal.globalTermino,
          descripcion: bulkBlockModal.globalDescripcion || (
            bulkBlockModal.globalTipoBloqueo === 'extremos'
              ? 'Bloqueo en conjunto (días extremos)'
              : 'Bloqueo en conjunto (misma cantidad de días)'
          ),
          tipoBloqueo: bulkBlockModal.globalTipoBloqueo,
        }))
        : bulkBlockModal.users.map((item) => ({
          userEmail: item.user.email,
          fechaInicio: item.fechaInicio,
          fechaTermino: item.fechaTermino,
          descripcion: item.descripcion || (
            item.tipoBloqueo === 'extremos'
              ? 'Bloqueo días extremos independiente'
              : 'Bloqueo independiente por trabajador'
          ),
          tipoBloqueo: item.tipoBloqueo,
        }));

      await createBulkCalendarBlocks(itemsToBlock);

      setBulkBlockModal((prev) => ({ ...prev, isOpen: false }));
      setSelectedUserIds(new Set());
      setToast({
        type: 'success',
        title: 'Bloqueo en conjunto aplicado',
        message: `Se configuró el bloqueo para ${itemsToBlock.length} trabajadores exitosamente.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'Error al aplicar bloqueo en conjunto',
        message: err?.message || 'No se pudieron registrar los bloqueos en calendar_blocks.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  // ─── 1. MODIFICAR ROL Y EMPRESA ─────────────────────────────
  const handleSaveRole = async () => {
    if (!roleModal.user) return;
    const targetUserId = roleModal.user.id;
    const targetEmail = roleModal.user.email;
    const targetRole = roleModal.selectedRole.toLowerCase().trim();
    const targetEmpresa = roleModal.selectedEmpresa.trim();

    setSavingAction(true);
    try {
      await updateUserRoleAndEmpresa(
        targetUserId,
        targetEmail,
        targetRole,
        targetEmpresa
      );

      // Actualización inmediata en memoria de la lista de usuarios
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === targetUserId || u.email.toLowerCase() === targetEmail.toLowerCase()) {
            return {
              ...u,
              rol: targetRole,
              empresa: targetEmpresa || u.empresa,
            };
          }
          return u;
        })
      );

      setRoleModal({ isOpen: false, user: null, selectedRole: 'usuario', selectedEmpresa: '' });
      setToast({
        type: 'success',
        title: 'Usuario actualizado',
        message: `Se actualizaron los datos de ${targetEmail} con éxito.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'Error al actualizar',
        message: err?.message || 'No se pudo guardar la información en la base de datos. Verifica los permisos RLS en Supabase.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  // ─── 2. ELIMINAR USUARIO ────────────────────────────────────
  const handleExecuteDelete = async () => {
    if (!deleteModal.user) return;
    setSavingAction(true);
    const targetUser = deleteModal.user;

    try {
      await deleteAuthorizedEmail(targetUser.email);

      setDeleteModal({ isOpen: false, user: null });
      setSelectedUserIds(new Set());
      setToast({
        type: 'success',
        title: 'Acceso revocado exitosamente',
        message: `El correo ${targetUser.email} fue eliminado de authorized_emails. El usuario ya no podrá iniciar sesión ni solicitar vales.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'Error al revocar acceso',
        message: err?.message || 'Ocurrió un error al intentar revocar el acceso del usuario.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  // ─── 3. GESTIONAR ACCESO A VALES ────────────────────────────
  const handleSaveVales = async () => {
    if (!valesModal.user) return;
    setSavingAction(true);
    try {
      await setValesBlockWithCalendar(
        valesModal.user.id,
        valesModal.user.email,
        null,
        null,
        valesModal.habilitado
      );

      const userEmail = valesModal.user.email;
      setValesModal({ isOpen: false, user: null, habilitado: true });
      setToast({
        type: 'success',
        title: 'Vales actualizados',
        message: `Se actualizaron los permisos de vales para ${userEmail}.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'Error al actualizar vales',
        message: err?.message || 'No se pudieron actualizar los permisos de vales.',
      });
    } finally {
      setSavingAction(false);
    }
  };

  // ─── 4. NUEVO USUARIO AUTORIZADO ────────────────────────────
  const handleCreateUser = async () => {
    const email = newUserModal.email.trim();
    const empresa = newUserModal.empresa.trim();

    if (!email || !empresa) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'Campos requeridos',
        message: 'Por favor ingresa tanto el correo electrónico como el nombre de la empresa.',
      });
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'Correo inválido',
        message: 'Por favor ingresa un correo electrónico válido (ejemplo: usuario@empresa.cl).',
      });
      return;
    }

    setSavingAction(true);
    try {
      await createAuthorizedUser(email, empresa);

      setNewUserModal({ isOpen: false, email: '', empresa: '' });
      setToast({
        type: 'success',
        title: 'Usuario autorizado registrado',
        message: `El correo ${email} (${empresa}) fue agregado exitosamente a authorized_emails.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      const isRls = err?.message?.includes('row-level security') || err?.code === '42501';
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: isRls ? 'Permisos de Supabase (RLS)' : 'Error al crear usuario',
        message: isRls
          ? 'Supabase bloqueó la operación porque falta habilitar los permisos RLS para administradores.\n\nEjecuta el script SQL "fix_all_admin_rls.sql" en tu panel de Supabase para activar los permisos.'
          : (err?.message?.includes('duplicate') || err?.message?.includes('unique')
            ? `El correo "${email}" ya se encuentra registrado en el sistema.`
            : `No se pudo crear el usuario: ${err?.message || 'Error desconocido'}.`),
      });
    } finally {
      setSavingAction(false);
    }
  };

  // ─── 5. CALENDARIO DE BLOQUEOS ──────────────────────────────
  const openCalendarModal = async (user: AppUser) => {
    setCalendarModal(user);
    const todayStr = getLocalDateString();
    setBlockForm({
      fechaInicio: todayStr,
      fechaTermino: addDaysToDate(todayStr, 2),
      descripcion: '',
      tipoBloqueo: 'rango',
    }); // 3 días inclusivos
    setBlocksLoading(true);
    try {
      const data = await getCalendarBlocks(user.email);
      setBlocks(data);
    } catch (err) {
      console.error(err);
      setBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  };

  const handleCreateBlock = async () => {
    if (!calendarModal) return;
    if (!blockForm.fechaInicio || !blockForm.fechaTermino) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'Fechas requeridas',
        message: 'Por favor selecciona las fechas de inicio y término del bloqueo.',
      });
      return;
    }
    if (blockForm.fechaTermino < blockForm.fechaInicio) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'Rango de fechas inválido',
        message: 'La fecha de término debe ser igual o posterior a la fecha de inicio.',
      });
      return;
    }
    setBlockSaving(true);
    try {
      await createCalendarBlock(
        calendarModal.email,
        blockForm.fechaInicio,
        blockForm.fechaTermino,
        blockForm.descripcion,
        blockForm.tipoBloqueo
      );
      const isExtremos = blockForm.tipoBloqueo === 'extremos' && blockForm.fechaInicio !== blockForm.fechaTermino;
      setBlockForm({
        fechaInicio: '',
        fechaTermino: '',
        descripcion: '',
        tipoBloqueo: 'rango',
      });
      const data = await getCalendarBlocks(calendarModal.email);
      setBlocks(data);
      setToast({
        type: 'success',
        title: isExtremos ? 'Bloqueo de días extremos registrado' : 'Bloqueo registrado',
        message: isExtremos
          ? `Se registraron los bloqueos puntuales para ${calendarModal.email}. Los días intermedios tendrán vales disponibles.`
          : `Bloqueo programado para ${calendarModal.email}.`,
      });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'Error al crear bloqueo',
        message: err?.message || 'No se pudo registrar el bloqueo. Verifica las políticas RLS en la tabla calendar_blocks.',
      });
    } finally {
      setBlockSaving(false);
    }
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!calendarModal) return;
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar bloqueo?',
      message: 'Esta acción cancelará el bloqueo programado para este usuario.',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteCalendarBlock(blockId, calendarModal.email);
          const data = await getCalendarBlocks(calendarModal.email);
          setBlocks(data);
          setToast({
            type: 'success',
            title: 'Bloqueo eliminado',
            message: 'El bloqueo fue eliminado exitosamente.',
          });
          await fetchUsers();
        } catch (err: any) {
          console.error(err);
          setAlertDialog({
            isOpen: true,
            type: 'error',
            title: 'Error al eliminar',
            message: err?.message || 'No se pudo eliminar el bloqueo seleccionado.',
          });
        }
      },
    });
  };

  const exportBlocksToExcel = async () => {
    if (blocks.length === 0) {
      setToast({
        type: 'info',
        title: 'Sin datos',
        message: 'No hay bloqueos registrados para exportar.',
      });
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historial Bloqueos');

    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `HISTORIAL DE BLOQUEOS — ${calendarModal?.email}`;
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0033AB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:F2');
    const infoCell = ws.getCell('A2');
    const now = new Date();
    infoCell.value = `Generado: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  |  Total: ${blocks.length} bloqueo(s)`;
    infoCell.font = { name: 'Arial', size: 10 };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(3).height = 6;

    const headers = ['Email Usuario', 'Fecha Inicio', 'Fecha Término', 'Descripción', 'Días Bloqueado', 'Fecha Registro'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    blocks.forEach((b) => {
      const inicioFormatted = formatChileanDate(b.fecha_inicio);
      const terminoFormatted = formatChileanDate(b.fecha_termino);
      const dias = calculateInclusiveDays(b.fecha_inicio, b.fecha_termino);
      const row = ws.addRow([
        b.user_email,
        inicioFormatted,
        terminoFormatted,
        b.descripcion || '-',
        dias,
        new Date(b.created_at).toLocaleDateString('es-CL'),
      ]);
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    ws.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 30 }, { width: 16 }, { width: 18 }];
    ws.autoFilter = 'A4:F4';

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_bloqueos_${calendarModal?.email?.split('@')[0]}_${now.toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Normalizador seguro para búsqueda insensible a mayúsculas, tildes, diacríticos y nulos
  const normalizeText = (text?: string | null): string =>
    String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const filteredUsers = useMemo(() => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) return users;

    const normSearch = normalizeText(searchTerm);
    const normTokens = normSearch.split(/\s+/).filter(Boolean);
    const rawTokens = rawSearch.split(/\s+/).filter(Boolean);

    if (normTokens.length === 0) return users;

    return users.filter((u) => {
      const emailNorm = normalizeText(u.email);
      const emailRaw = String(u.email ?? '').toLowerCase();

      const nombreNorm = normalizeText(u.nombre);
      const nombreRaw = String(u.nombre ?? '').toLowerCase();

      const apellidosNorm = normalizeText(u.apellidos);
      const apellidosRaw = String(u.apellidos ?? '').toLowerCase();

      const fullNorm = `${nombreNorm} ${apellidosNorm}`.trim();
      const fullRaw = `${nombreRaw} ${apellidosRaw}`.trim();

      const empresaNorm = normalizeText(u.empresa);
      const empresaRaw = String(u.empresa ?? '').toLowerCase();

      const rolNorm = normalizeText(u.rol);
      const rolRaw = String(u.rol ?? '').toLowerCase();

      return normTokens.every((token, idx) => {
        const rawToken = rawTokens[idx] || token;
        return (
          emailNorm.includes(token) ||
          emailRaw.includes(rawToken) ||
          fullNorm.includes(token) ||
          fullRaw.includes(rawToken) ||
          nombreNorm.includes(token) ||
          nombreRaw.includes(rawToken) ||
          apellidosNorm.includes(token) ||
          apellidosRaw.includes(rawToken) ||
          empresaNorm.includes(token) ||
          empresaRaw.includes(rawToken) ||
          rolNorm.includes(token) ||
          rolRaw.includes(rawToken)
        );
      });
    });
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    if (pageSize === -1) return filteredUsers;
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const isValesBlocked = (user: AppUser): boolean => {
    if (user.active_calendar_block) return true;
    if (!user.vales_disabled_from) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(user.vales_disabled_from);
    if (from > today) return false;
    if (!user.vales_disabled_to) return true;
    return new Date(user.vales_disabled_to) >= today;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto"
    >
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 flex items-center gap-2.5 sm:gap-3 tracking-tight border-l-4 border-brand-orange pl-3 sm:pl-4">
          <div className="p-1.5 sm:p-2 bg-brand-blue/10 text-brand-blue rounded-xl">
            <Users className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          Gestión de Usuarios
        </h1>
        <p className="text-slate-500 mt-1.5 sm:mt-2 text-sm sm:text-lg ml-4 sm:ml-5">
          Administra los accesos, roles y permisos de vales institucionales.
        </p>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Action Bar */}
        <div className="bg-slate-50/80 p-2.5 sm:p-3.5 border-b border-slate-100 flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="w-full sm:w-auto text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">Acciones:</span>

          <button
            onClick={() => handleActionClick('modificar')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-blue text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-brand-blue/90 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange" /> Modificar Rol
          </button>

          <button
            onClick={() => handleActionClick('eliminar')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-red-700 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Eliminar
          </button>

          <button
            onClick={() => handleActionClick('codigos')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-blue text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-brand-blue/90 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange" /> Códigos
          </button>

          <button
            onClick={() => handleActionClick('habilitar')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-blue text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-brand-blue/90 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange" /> Vales
          </button>

          <button
            onClick={() => handleActionClick('calendario')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-blue text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-brand-blue/90 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-orange" /> Calendario
          </button>

          <button
            onClick={() => handleActionClick('nuevo')}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-brand-green text-white font-bold text-xs rounded-xl shadow-xs hover:bg-brand-green/90 transition-all flex items-center gap-1.5 sm:ml-auto shrink-0 whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Nuevo Usuario
          </button>
        </div>

        {/* Search & View Mode Switcher */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative w-full sm:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-10 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue text-sm placeholder-slate-400 font-medium transition-all"
                placeholder="Buscar por nombre, apellido, email, empresa o rol..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchTerm.trim() && (
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span>Resultados:</span>
                <span className="px-2.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded-full font-bold">
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario coincidente' : 'usuarios coincidentes'}
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Content Views */}
        {error && (
          <p className="p-4 text-center text-red-600 font-medium">{error}</p>
        )}

        {/* Lista estática de usuarios paginada (sin animaciones dinámicas ni botones secundarios) */}
        <div className="p-2 sm:p-3 md:p-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              Cargando usuarios...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No se encontraron usuarios coincidentes.
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              {paginatedUsers.map((user) => {
                const isSelected = selectedUserIds.has(user.id);
                const blocked = isValesBlocked(user);
                return (
                  <div
                    key={user.id}
                    className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-2xl border transition-colors cursor-pointer select-none gap-3 sm:gap-3.5 ${isSelected
                        ? 'border-brand-blue bg-blue-50/60 shadow-sm ring-2 ring-brand-blue/30'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    onClick={() => toggleSelectUser(user.id)}
                  >
                    {/* Left: Checkbox + Avatar + Info */}
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 w-full sm:w-auto">
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(user.id)}
                          className="w-4 h-4 text-brand-blue rounded focus:ring-brand-blue border-slate-300 cursor-pointer"
                        />
                      </div>
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-blue/10 to-brand-blue/20 text-brand-blue flex items-center justify-center font-extrabold text-sm shrink-0 border border-brand-blue/10 shadow-2xs">
                        {user.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm truncate">
                            {user.nombre} {user.apellidos}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${user.rol?.toLowerCase() === 'admin'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : user.rol?.toLowerCase() === 'lider'
                                  ? 'bg-[#FFA53C]/15 text-[#D97706] border-[#FFA53C]/30'
                                  : 'bg-[#0033AB]/10 text-[#0033AB] border-[#0033AB]/20'
                              }`}
                          >
                            {user.rol?.toLowerCase() === 'admin' ? 'Admin' : user.rol?.toLowerCase() === 'lider' ? 'Líder' : 'Usuario'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono truncate mt-0.5">
                          {user.email}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>🏢 {user.empresa || 'Sin empresa'}</span>
                          <span>•</span>
                          <span>Reg: {new Date(user.created_at).toLocaleDateString('es-CL')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Badge ONLY (Botones secundarios eliminados) */}
                    <div className="shrink-0 flex items-center self-end sm:self-center">
                      {user.is_authorized === false ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Ban className="w-3 h-3" /> GDH / Baja
                        </span>
                      ) : user.active_calendar_block ? (
                        <span
                          className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs"
                          title={`Bloqueado por calendario hasta ${formatChileanDate(user.active_calendar_block.fecha_termino)}. Desbloqueo automático al día siguiente.`}
                        >
                          <Lock className="w-3 h-3 text-amber-700" /> Bloqueado ({formatChileanDate(user.active_calendar_block.fecha_termino)})
                        </span>
                      ) : blocked ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Lock className="w-3 h-3" /> Bloqueado
                        </span>
                      ) : user.habilitado ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Habilitado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Ban className="w-3 h-3" /> Inhabilitado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reusable Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="usuarios"
        />
      </div>

      {/* ─── MODAL 1: MODIFICAR ROL ───────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {roleModal.isOpen && roleModal.user && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-4 sm:p-6 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-brand-blue" /> Modificar Rol y Empresa
                  </h3>
                  <button onClick={() => setRoleModal({ isOpen: false, user: null, selectedRole: 'usuario', selectedEmpresa: '' })} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl mb-4 text-xs text-slate-600 border border-slate-100">
                  <p><strong className="text-slate-800">Usuario:</strong> {roleModal.user.nombre} {roleModal.user.apellidos}</p>
                  <p className="mt-0.5"><strong className="text-slate-800">Email:</strong> {roleModal.user.email}</p>
                </div>

                {/* Empresa */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    🏢 Empresa Asignada
                  </label>
                  <input
                    type="text"
                    value={roleModal.selectedEmpresa}
                    onChange={(e) => setRoleModal((prev) => ({ ...prev, selectedEmpresa: e.target.value }))}
                    placeholder="Ej. Empresa Alpha, Empresa Beta..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-blue focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Actualiza la empresa vinculada en correos autorizados y perfil.
                  </p>
                </div>

                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  🔑 Rol del Sistema
                </label>
                <div className="space-y-2.5 mb-6">
                  {[
                    { val: 'usuario', label: '👤 Usuario Estándar', desc: 'Genera y usa vales/QR de almuerzo (sin acceso a esta plataforma GDH).' },
                    { val: 'lider', label: '⭐ Líder de Equipo', desc: 'Líder en terreno y vales (sin acceso a esta plataforma GDH).' },
                    { val: 'admin', label: '👑 Administrador', desc: 'Acceso exclusivo al Sistema de GDH, gestión de usuarios, cierres y reportes.' },
                  ].map(({ val, label, desc }) => (
                    <label
                      key={val}
                      onClick={() => setRoleModal((prev) => ({ ...prev, selectedRole: val }))}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${roleModal.selectedRole.toLowerCase() === val
                        ? 'border-brand-blue bg-brand-blue/5 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="userRoleChoice"
                        checked={roleModal.selectedRole.toLowerCase() === val}
                        onChange={() => setRoleModal((prev) => ({ ...prev, selectedRole: val }))}
                        className="mt-1 w-4 h-4 text-brand-blue focus:ring-brand-blue"
                      />
                      <div>
                        <div className="font-bold text-sm text-slate-800">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setRoleModal({ isOpen: false, user: null, selectedRole: 'usuario', selectedEmpresa: '' })}
                    className="px-4 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveRole}
                    disabled={savingAction}
                    className="px-6 py-2.5 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-blue/90 text-sm shadow-md disabled:opacity-50"
                  >
                    {savingAction ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── MODAL 2: ELIMINAR USUARIO ────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {deleteModal.isOpen && deleteModal.user && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-4 sm:p-6 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-red-600 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" /> Revocar Acceso / Dar de Baja
                  </h3>
                  <button onClick={() => setDeleteModal({ isOpen: false, user: null })} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl mb-4 text-xs text-slate-700 border border-slate-100">
                  <p><strong className="text-slate-900">Usuario:</strong> {deleteModal.user.nombre} {deleteModal.user.apellidos}</p>
                  <p className="mt-0.5"><strong className="text-slate-900">Correo:</strong> {deleteModal.user.email}</p>
                  <p className="mt-0.5"><strong className="text-slate-900">Empresa:</strong> {deleteModal.user.empresa || '-'}</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-xs text-red-800 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-red-900 text-sm">
                    ⚠️ ¿Confirmas revocar el acceso a este usuario?
                  </p>
                  <p>
                    • Se eliminará únicamente de <strong>emails autorizados</strong>: el trabajador <strong>no podrá volver a iniciar sesión ni generar vales</strong>.
                  </p>
                  <p>
                    • Su historial y perfil se <strong>conservarán intactos en perfil de usuarios</strong> para que siga apareciendo en los reportes y Excel de cierre de mes de GDH.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteModal({ isOpen: false, user: null })}
                    className="px-4 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExecuteDelete}
                    disabled={savingAction}
                    className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {savingAction ? 'Revocando...' : 'Confirmar y Revocar Acceso'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── MODAL 3: GESTIONAR VALES ─────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {valesModal.isOpen && valesModal.user && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-4 sm:p-6 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-brand-orange" /> Gestión de Vales y Códigos
                  </h3>
                  <button onClick={() => setValesModal({ isOpen: false, user: null, habilitado: true })} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl mb-5 text-xs text-slate-700 border border-slate-100">
                  <p><strong className="text-slate-900">Usuario:</strong> {valesModal.user.nombre} {valesModal.user.apellidos}</p>
                  <p className="mt-0.5"><strong className="text-slate-900">Correo:</strong> {valesModal.user.email}</p>
                </div>

                {/* Switch de Habilitación general */}
                <div className="mb-5 p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">Estado de Vales</div>
                    <div className="text-xs text-slate-500">
                      {valesModal.habilitado ? 'Habilitado para generar códigos' : 'Deshabilitado temporalmente'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValesModal((prev) => ({ ...prev, habilitado: !prev.habilitado }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${valesModal.habilitado
                      ? 'bg-brand-green text-white hover:bg-brand-green/90'
                      : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                  >
                    {valesModal.habilitado ? '✅ Habilitado' : '🚫 Deshabilitado'}
                  </button>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setValesModal({ isOpen: false, user: null, habilitado: true })}
                    className="px-4 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveVales}
                    disabled={savingAction}
                    className="px-6 py-2.5 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-blue/90 text-sm shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {savingAction ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── MODAL 4: NUEVO USUARIO AUTORIZADO ─────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {newUserModal.isOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-4 sm:p-6 max-h-[90dvh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-brand-green" /> Nuevo Usuario Autorizado
                  </h3>
                  <button onClick={() => setNewUserModal((p) => ({ ...p, isOpen: false }))} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  Autoriza un nuevo correo institucional y asigna su empresa en <code>authorized_emails</code>. El ID del usuario se asignará de forma automática por la base de datos.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Correo Electrónico *</label>
                    <input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={newUserModal.email}
                      onChange={(e) => setNewUserModal((p) => ({ ...p, email: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-blue outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Empresa *</label>
                    <input
                      type="text"
                      placeholder="Empresa Alpha, Empresa Beta, etc."
                      value={newUserModal.empresa}
                      onChange={(e) => setNewUserModal((p) => ({ ...p, empresa: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-blue outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setNewUserModal((p) => ({ ...p, isOpen: false }))}
                    className="px-4 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={savingAction}
                    className="px-6 py-2.5 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green/90 text-sm shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingAction ? 'Registrando...' : '➕ Registrar Usuario'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── MODAL 5: BLOQUEO POR CALENDARIO ──────────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {calendarModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 w-full max-w-2xl max-h-[90dvh] overflow-y-auto flex flex-col"
              >
                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl sm:rounded-t-3xl">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-brand-blue" /> Bloqueo por Calendario
                    </h3>
                    <p className="text-sm text-slate-500">{calendarModal.nombre} {calendarModal.apellidos} — {calendarModal.email}</p>
                  </div>
                  <button onClick={() => setCalendarModal(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* New Block Form */}
                <div className="p-6 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Nuevo Bloqueo</h4>

                  {/* Selector de Modalidad de Bloqueo */}
                  <div className="mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      Modalidad de Bloqueo:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setBlockForm((f) => ({ ...f, tipoBloqueo: 'rango' }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${blockForm.tipoBloqueo === 'rango'
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${blockForm.tipoBloqueo === 'rango' ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'
                            }`}
                        >
                          {blockForm.tipoBloqueo === 'rango' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <span className="text-xs block text-slate-800 font-bold">Rango Continuo</span>
                          <span className="text-[10px] text-slate-500 font-normal block">Bloquea todos los días del período</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBlockForm((f) => ({ ...f, tipoBloqueo: 'extremos' }))}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${blockForm.tipoBloqueo === 'extremos'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-900 font-bold shadow-xs ring-1 ring-amber-500/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${blockForm.tipoBloqueo === 'extremos' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                            }`}
                        >
                          {blockForm.tipoBloqueo === 'extremos' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <span className="text-xs block text-slate-800 font-bold">Solo Días Extremos</span>
                          <span className="text-[10px] text-slate-500 font-normal block">Bloquea inicio y fin (intermedios libres)</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        {blockForm.tipoBloqueo === 'extremos' ? '📅 Primer Día Bloqueado (Inicio)' : 'Fecha Inicio'}
                      </label>
                      <input
                        type="date"
                        value={blockForm.fechaInicio}
                        onChange={(e) => setBlockForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                        {blockForm.tipoBloqueo === 'extremos' ? '📅 Segundo Día Bloqueado (Fin)' : 'Fecha Término'}
                      </label>
                      <input
                        type="date"
                        value={blockForm.fechaTermino}
                        onChange={(e) => setBlockForm((f) => ({ ...f, fechaTermino: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                      />
                    </div>
                  </div>
                  {/* Atajos de duración */}
                  <div className="mb-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Atajos rápidos de duración:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: '1 día', days: 1 },
                        { label: '3 días', days: 3 },
                        { label: '7 días (1 sem)', days: 7 },
                        { label: '15 días (quincena)', days: 15 },
                        { label: '30 días (1 mes)', days: 30 },
                      ].map((shortcut) => (
                        <button
                          key={shortcut.days}
                          type="button"
                          onClick={() => {
                            const base = blockForm.fechaInicio || getLocalDateString();
                            const calculatedEnd = addDaysToDate(base, shortcut.days - 1);
                            setBlockForm((prev) => ({
                              ...prev,
                              fechaInicio: base,
                              fechaTermino: calculatedEnd,
                            }));
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          +{shortcut.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {blockForm.fechaTermino && (
                    blockForm.tipoBloqueo === 'extremos' ? (
                      <div className="mb-4 bg-amber-50/90 border border-amber-200 rounded-2xl p-4 text-xs space-y-2.5">
                        {(() => {
                          const extInfo = getExtremeDatesInfo(blockForm.fechaInicio, blockForm.fechaTermino);
                          const isSameDay = blockForm.fechaInicio === blockForm.fechaTermino;
                          return (
                            <>
                              <div className="flex items-center gap-2 font-bold text-amber-900">
                                <CalendarRange className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Configuración: Solo Días Extremos (Inicio y Fin)</span>
                              </div>

                              <div className="space-y-1.5 pl-1">
                                <div className="flex items-center gap-2 text-slate-800">
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                  <span>
                                    <strong>Día Inicio bloqueado:</strong> {formatChileanDate(blockForm.fechaInicio)}
                                  </span>
                                </div>

                                {!isSameDay && (
                                  <>
                                    <div className="flex items-center gap-2 text-slate-800">
                                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                      <span>
                                        <strong>Día Fin bloqueado:</strong> {formatChileanDate(blockForm.fechaTermino)}
                                      </span>
                                    </div>

                                    {extInfo.intermediateDaysCount > 0 ? (
                                      <div className="bg-emerald-100/90 border border-emerald-300 rounded-xl p-3 flex items-start gap-2.5 text-emerald-950 mt-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-bold block">
                                            Días intermedios con VALES HABILITADOS ({extInfo.intermediateDaysCount} {extInfo.intermediateDaysCount === 1 ? 'día' : 'días'}):
                                          </span>
                                          <span className="text-[11px] text-emerald-900">
                                            {extInfo.intermediateDaysCount === 1
                                              ? `El día ${extInfo.intermediateStartFormatted} el trabajador PODRÁ generar vales con total normalidad.`
                                              : `Desde el ${extInfo.intermediateStartFormatted} hasta el ${extInfo.intermediateEndFormatted}, el trabajador PODRÁ generar vales con total normalidad.`
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="bg-slate-100 rounded-xl p-2.5 text-slate-600 text-[11px]">
                                        Las fechas son consecutivas; ambos días consecutivos quedarán bloqueados (2 días).
                                      </div>
                                    )}
                                  </>
                                )}

                                {isSameDay && (
                                  <p className="text-slate-600 text-[11px] italic">
                                    Al coincidir la fecha de inicio y fin, se bloqueará únicamente este día puntual (1 día).
                                  </p>
                                )}
                              </div>

                              <div className="text-[11px] text-amber-800 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
                                ℹ️ Se {isSameDay ? 'registrará 1 bloqueo puntual' : 'registrarán 2 bloqueos puntuales de 1 día cada uno'}. Los días intermedios se mantendrán libres.
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="mb-4 bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs space-y-2">
                        {(() => {
                          const info = getAutoUnblockDateInfo(blockForm.fechaInicio, blockForm.fechaTermino);
                          return (
                            <>
                              <p className="text-slate-700">
                                Duración: <strong>{info.totalDays} {info.totalDays === 1 ? 'día' : 'días'}</strong> (desde el{' '}
                                <span className="font-semibold text-slate-900">{formatChileanDate(blockForm.fechaInicio)}</span> hasta el{' '}
                                <span className="font-semibold text-slate-900">{formatChileanDate(blockForm.fechaTermino)}</span>).
                              </p>
                              <div className="bg-emerald-100/80 border border-emerald-300/80 rounded-xl p-2.5 flex items-start gap-2 text-emerald-900">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">
                                    Desbloqueo automático el día: {info.unblockFormatted}
                                  </span>
                                  <span className="text-[11px] text-emerald-800">
                                    El día posterior a la fecha de término, los vales quedarán automáticamente disponibles.
                                  </span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  )}

                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción / Motivo</label>
                    <input
                      type="text"
                      placeholder="Ej: Vacaciones programadas"
                      value={blockForm.descripcion}
                      onChange={(e) => setBlockForm((f) => ({ ...f, descripcion: e.target.value }))}
                      maxLength={200}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                    />
                  </div>
                  <button
                    onClick={handleCreateBlock}
                    disabled={blockSaving}
                    className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-brand-blue/90 transition-colors shadow-md disabled:opacity-50"
                  >
                    {blockSaving ? 'Guardando...' : '📅 Crear Bloqueo'}
                  </button>
                </div>

                {/* Block History */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Historial de Bloqueos</h4>
                    <button
                      onClick={exportBlocksToExcel}
                      className="px-3 py-1.5 bg-brand-green text-white font-medium text-xs rounded-lg shadow-sm hover:bg-brand-green/90 transition-colors flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                    </button>
                  </div>

                  {blocksLoading ? (
                    <p className="text-center text-slate-400 py-8">Cargando historial...</p>
                  ) : blocks.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No hay bloqueos registrados.</p>
                  ) : (
                    <div className="space-y-3">
                      {blocks.map((b) => {
                        const todayStr = getLocalDateString();
                        const isActive = b.fecha_inicio <= todayStr && b.fecha_termino >= todayStr;
                        const isPast = b.fecha_termino < todayStr;
                        const dias = calculateInclusiveDays(b.fecha_inicio, b.fecha_termino);
                        const inicioFormatted = formatChileanDate(b.fecha_inicio);
                        const terminoFormatted = formatChileanDate(b.fecha_termino);

                        return (
                          <div
                            key={b.id}
                            className={`p-4 rounded-xl border flex justify-between items-center ${isActive
                              ? 'bg-red-50 border-red-200'
                              : isPast
                                ? 'bg-slate-50 border-slate-200 opacity-60'
                                : 'bg-amber-50 border-amber-200'
                              }`}
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isActive ? 'bg-red-200 text-red-700' : isPast ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-700'
                                  }`}>
                                  {isActive ? '🔴 ACTIVO' : isPast ? '⚪ FINALIZADO' : '🟡 PROGRAMADO'}
                                </span>
                                <span className="text-xs text-slate-500">{dias} {dias === 1 ? 'día' : 'días'}</span>
                              </div>
                              <p className="text-sm font-semibold text-slate-700">
                                {inicioFormatted} → {terminoFormatted}
                              </p>
                              {b.descripcion && <p className="text-xs text-slate-500 italic">"{b.descripcion}"</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteBlock(b.id)}
                              className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                              title="Eliminar bloqueo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ─── MODAL 6: BLOQUEO MASIVO / EN CONJUNTO ─────────────── */}
          {bulkBlockModal.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full p-4 sm:p-6 my-4 sm:my-8 max-h-[92dvh] flex flex-col ${bulkBlockModal.sameDurationForAll ? 'max-w-2xl' : 'max-w-5xl'
                  }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2 sm:gap-2.5">
                      <div className="p-1.5 sm:p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                        <CalendarRange className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      Bloqueo Masivo de Vales
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      Configuración para <strong className="text-slate-800">{bulkBlockModal.users.length} trabajadores</strong> seleccionados.
                    </p>
                  </div>
                  <button
                    onClick={() => setBulkBlockModal((prev) => ({ ...prev, isOpen: false }))}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="overflow-y-auto py-5 space-y-6 flex-1 pr-1">
                  {/* PREGUNTA PRINCIPAL */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-brand-orange" />
                      ¿Los usuarios seleccionados serán bloqueados por la misma cantidad de días?
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBulkBlockModal((prev) => ({ ...prev, sameDurationForAll: true }))}
                        className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${bulkBlockModal.sameDurationForAll
                            ? 'bg-amber-50/80 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                          }`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${bulkBlockModal.sameDurationForAll ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                            }`}
                        >
                          {bulkBlockModal.sameDurationForAll && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block text-slate-800">
                            Sí, misma cantidad de días
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                            Aplica el mismo período de bloqueo y motivo a todos los trabajadores seleccionados.
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBulkBlockModal((prev) => ({ ...prev, sameDurationForAll: false }))}
                        className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${!bulkBlockModal.sameDurationForAll
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue ring-2 ring-brand-blue/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                          }`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!bulkBlockModal.sameDurationForAll ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'
                            }`}
                        >
                          {!bulkBlockModal.sameDurationForAll && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block text-slate-800">
                            No, tiempo independiente
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                            Asigna fechas y motivos personalizados de forma individual para cada trabajador.
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* CASO 1: MISMA CANTIDAD DE DÍAS */}
                  {bulkBlockModal.sameDurationForAll ? (
                    <div className="space-y-4">
                      {/* Selector de Modalidad Global */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 block mb-2">
                          Modalidad de Bloqueo para el grupo:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setBulkBlockModal((prev) => ({ ...prev, globalTipoBloqueo: 'rango' }))}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${bulkBlockModal.globalTipoBloqueo === 'rango'
                                ? 'bg-brand-blue/10 border-brand-blue text-brand-blue font-bold shadow-xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${bulkBlockModal.globalTipoBloqueo === 'rango' ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'
                                }`}
                            >
                              {bulkBlockModal.globalTipoBloqueo === 'rango' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <div>
                              <span className="text-xs block text-slate-800 font-bold">Rango Continuo</span>
                              <span className="text-[10px] text-slate-500 font-normal block">Bloquea todos los días del período</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBulkBlockModal((prev) => ({ ...prev, globalTipoBloqueo: 'extremos' }))}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${bulkBlockModal.globalTipoBloqueo === 'extremos'
                                ? 'bg-amber-500/15 border-amber-500 text-amber-900 font-bold shadow-xs ring-1 ring-amber-500/30'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${bulkBlockModal.globalTipoBloqueo === 'extremos' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                                }`}
                            >
                              {bulkBlockModal.globalTipoBloqueo === 'extremos' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <div>
                              <span className="text-xs block text-slate-800 font-bold">Solo Días Extremos</span>
                              <span className="text-[10px] text-slate-500 font-normal block">Bloquea inicio y fin (intermedios libres)</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Fechas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            {bulkBlockModal.globalTipoBloqueo === 'extremos'
                              ? '📅 Primer Día Bloqueado (Inicio)'
                              : '📅 Fecha de Inicio del Bloqueo'}
                          </label>
                          <input
                            type="date"
                            value={bulkBlockModal.globalInicio}
                            onChange={(e) => {
                              const newIni = e.target.value;
                              setBulkBlockModal((prev) => ({
                                ...prev,
                                globalInicio: newIni,
                                globalTermino: prev.globalTermino && prev.globalTermino < newIni ? newIni : prev.globalTermino,
                              }));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            {bulkBlockModal.globalTipoBloqueo === 'extremos'
                              ? '📅 Segundo Día Bloqueado (Fin)'
                              : '📅 Fecha de Término del Bloqueo'}
                          </label>
                          <input
                            type="date"
                            min={bulkBlockModal.globalInicio}
                            value={bulkBlockModal.globalTermino}
                            onChange={(e) =>
                              setBulkBlockModal((prev) => ({ ...prev, globalTermino: e.target.value }))
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue outline-none"
                          />
                        </div>
                      </div>

                      {/* Atajos de días */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Atajos rápidos de duración:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '1 día', days: 1 },
                            { label: '3 días', days: 3 },
                            { label: '7 días (1 sem)', days: 7 },
                            { label: '15 días (quincena)', days: 15 },
                            { label: '30 días (1 mes)', days: 30 },
                          ].map((shortcut) => (
                            <button
                              key={shortcut.days}
                              type="button"
                              onClick={() => {
                                const base = bulkBlockModal.globalInicio || getLocalDateString();
                                const calculatedEnd = addDaysToDate(base, shortcut.days - 1);
                                setBulkBlockModal((prev) => ({
                                  ...prev,
                                  globalInicio: base,
                                  globalTermino: calculatedEnd,
                                }));
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              +{shortcut.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Motivo global */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          📝 Motivo o Descripción (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder={bulkBlockModal.globalTipoBloqueo === 'extremos'
                            ? 'Ej: Bloqueo inicio y retorno de faena...'
                            : 'Ej: Suspensión por cierre de faena, vacaciones colectivas...'}
                          value={bulkBlockModal.globalDescripcion}
                          onChange={(e) =>
                            setBulkBlockModal((prev) => ({ ...prev, globalDescripcion: e.target.value }))
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue outline-none"
                        />
                      </div>

                      {/* Tarjeta dinámica de cálculo */}
                      {bulkBlockModal.globalTermino && (
                        bulkBlockModal.globalTipoBloqueo === 'extremos' ? (
                          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 text-xs space-y-2.5">
                            {(() => {
                              const extInfo = getExtremeDatesInfo(
                                bulkBlockModal.globalInicio,
                                bulkBlockModal.globalTermino
                              );
                              const isSameDay = bulkBlockModal.globalInicio === bulkBlockModal.globalTermino;
                              const totalBlocksCreated = bulkBlockModal.users.length * (isSameDay ? 1 : 2);
                              return (
                                <>
                                  <div className="flex items-center gap-2 font-bold text-amber-900">
                                    <CalendarRange className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>Resumen: Bloqueo de Días Extremos ({bulkBlockModal.users.length} trabajadores)</span>
                                  </div>

                                  <div className="space-y-1.5 pl-1">
                                    <div className="flex items-center gap-2 text-slate-800">
                                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                      <span>
                                        <strong>Día Inicio bloqueado:</strong> {formatChileanDate(bulkBlockModal.globalInicio)}
                                      </span>
                                    </div>

                                    {!isSameDay && (
                                      <>
                                        <div className="flex items-center gap-2 text-slate-800">
                                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                          <span>
                                            <strong>Día Fin bloqueado:</strong> {formatChileanDate(bulkBlockModal.globalTermino)}
                                          </span>
                                        </div>

                                        {extInfo.intermediateDaysCount > 0 ? (
                                          <div className="bg-emerald-100/90 border border-emerald-300 rounded-xl p-3 flex items-start gap-2.5 text-emerald-950 mt-2">
                                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                              <span className="font-bold block">
                                                Días intermedios con VALES HABILITADOS ({extInfo.intermediateDaysCount} {extInfo.intermediateDaysCount === 1 ? 'día' : 'días'}):
                                              </span>
                                              <span className="text-[11px] text-emerald-900">
                                                {extInfo.intermediateDaysCount === 1
                                                  ? `El día ${extInfo.intermediateStartFormatted}, los ${bulkBlockModal.users.length} trabajadores PODRÁN pedir vales con normalidad.`
                                                  : `Desde el ${extInfo.intermediateStartFormatted} hasta el ${extInfo.intermediateEndFormatted}, los ${bulkBlockModal.users.length} trabajadores PODRÁN pedir vales con normalidad.`
                                                }
                                              </span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="bg-slate-100 rounded-xl p-2.5 text-slate-600 text-[11px]">
                                            Fechas consecutivas; ambos días quedarán bloqueados para todos los trabajadores seleccionados.
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-amber-800 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
                                    ℹ️ Se registrarán un total de <strong>{totalBlocksCreated} bloqueos puntuales</strong> en el sistema ({isSameDay ? '1 por persona' : '2 por persona: día inicio y día fin'}).
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs space-y-2.5">
                            <div className="flex items-center gap-2 font-bold text-amber-900">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>Resumen del bloqueo en conjunto:</span>
                            </div>
                            {(() => {
                              const info = getAutoUnblockDateInfo(
                                bulkBlockModal.globalInicio,
                                bulkBlockModal.globalTermino
                              );
                              return (
                                <>
                                  <p className="text-slate-700">
                                    Se aplicará a <strong>{bulkBlockModal.users.length} trabajadores</strong> durante{' '}
                                    <strong>{info.totalDays} {info.totalDays === 1 ? 'día' : 'días'}</strong> (desde el{' '}
                                    <span className="font-semibold text-slate-900">{formatChileanDate(bulkBlockModal.globalInicio)}</span>{' '}
                                    hasta el{' '}
                                    <span className="font-semibold text-slate-900">{formatChileanDate(bulkBlockModal.globalTermino)}</span>).
                                  </p>
                                  <div className="bg-emerald-100/80 border border-emerald-300/80 rounded-xl p-3 flex items-start gap-2.5 text-emerald-900">
                                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold block">
                                        Desbloqueo automático el día: {info.unblockFormatted}
                                      </span>
                                      <span className="text-[11px] text-emerald-800">
                                        El día posterior a la fecha de término, los vales quedarán automáticamente habilitados para los trabajadores.
                                      </span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )
                      )}

                      {/* Lista de usuarios afectados */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Trabajadores incluidos ({bulkBlockModal.users.length}):
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                          {bulkBlockModal.users.map((item) => (
                            <span
                              key={item.user.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                            >
                              <User className="w-3 h-3 text-slate-400" />
                              {item.user.nombre} {item.user.apellidos}
                              <span className="text-[10px] text-slate-400">({item.user.empresa || '-'})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* CASO 2: TIEMPO INDEPENDIENTE POR TRABAJADOR */
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-600 font-medium">
                          Configura las fechas, modalidad y motivo de forma independiente para cada uno de los{' '}
                          <strong>{bulkBlockModal.users.length} trabajadores</strong>:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (bulkBlockModal.users.length === 0) return;
                            const first = bulkBlockModal.users[0];
                            setBulkBlockModal((prev) => ({
                              ...prev,
                              users: prev.users.map((u) => ({
                                ...u,
                                fechaInicio: first.fechaInicio,
                                fechaTermino: first.fechaTermino,
                                tipoBloqueo: first.tipoBloqueo,
                                descripcion: first.descripcion || u.descripcion,
                              })),
                            }));
                            setToast({
                              type: 'info',
                              title: 'Configuración replicada',
                              message: 'Se replicaron las fechas, modalidad y motivo del primer trabajador a todos los demás.',
                            });
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 text-brand-blue" /> Replicar del primero a todos
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto max-h-[380px]">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="p-3">👤 Trabajador</th>
                                <th className="p-3 w-36">⚙️ Modalidad</th>
                                <th className="p-3 w-40">📅 Fecha Inicio</th>
                                <th className="p-3 w-40">📅 Fecha Término</th>
                                <th className="p-3 w-48">⏰ Estado / Desbloqueo</th>
                                <th className="p-3 min-w-44">📝 Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {bulkBlockModal.users.map((item, idx) => {
                                const info = getAutoUnblockDateInfo(item.fechaInicio, item.fechaTermino);
                                const isExtremos = item.tipoBloqueo === 'extremos';
                                const extInfo = isExtremos ? getExtremeDatesInfo(item.fechaInicio, item.fechaTermino) : null;

                                return (
                                  <tr key={item.user.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3">
                                      <p className="font-bold text-slate-800">
                                        {item.user.nombre} {item.user.apellidos}
                                      </p>
                                      <p className="text-[11px] text-slate-400 font-mono">{item.user.email}</p>
                                      <p className="text-[10px] text-slate-500 font-medium">{item.user.empresa || '-'}</p>
                                    </td>
                                    <td className="p-3">
                                      <select
                                        value={item.tipoBloqueo}
                                        onChange={(e) => {
                                          const val = e.target.value as 'rango' | 'extremos';
                                          setBulkBlockModal((prev) => ({
                                            ...prev,
                                            users: prev.users.map((u, i) => (i === idx ? { ...u, tipoBloqueo: val } : u)),
                                          }));
                                        }}
                                        className={`w-full border rounded-lg px-2 py-1.5 text-xs font-semibold outline-none focus:ring-2 cursor-pointer ${item.tipoBloqueo === 'extremos'
                                            ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-amber-500'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-brand-blue'
                                          }`}
                                      >
                                        <option value="rango">🔵 Rango Continuo</option>
                                        <option value="extremos">🟠 Solo Extremos</option>
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="date"
                                        value={item.fechaInicio}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setBulkBlockModal((prev) => ({
                                            ...prev,
                                            users: prev.users.map((u, i) =>
                                              i === idx
                                                ? {
                                                  ...u,
                                                  fechaInicio: val,
                                                  fechaTermino: u.fechaTermino && u.fechaTermino < val ? val : u.fechaTermino,
                                                }
                                                : u
                                            ),
                                          }));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="date"
                                        min={item.fechaInicio}
                                        value={item.fechaTermino}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setBulkBlockModal((prev) => ({
                                            ...prev,
                                            users: prev.users.map((u, i) => (i === idx ? { ...u, fechaTermino: val } : u)),
                                          }));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                                      />
                                      {/* Mini atajos */}
                                      <div className="flex gap-1 mt-1">
                                        {[
                                          { l: '+1d', d: 1 },
                                          { l: '+3d', d: 3 },
                                          { l: '+7d', d: 7 },
                                          { l: '+15d', d: 15 },
                                        ].map((sc) => (
                                          <button
                                            key={sc.d}
                                            type="button"
                                            onClick={() => {
                                              const base = item.fechaInicio || getLocalDateString();
                                              const calcEnd = addDaysToDate(base, sc.d - 1);
                                              setBulkBlockModal((prev) => ({
                                                ...prev,
                                                users: prev.users.map((u, i) =>
                                                  i === idx ? { ...u, fechaInicio: base, fechaTermino: calcEnd } : u
                                                ),
                                              }));
                                            }}
                                            className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 rounded cursor-pointer"
                                          >
                                            {sc.l}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      {item.fechaTermino ? (
                                        isExtremos ? (
                                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-[11px] text-amber-900 space-y-0.5">
                                            <span className="font-bold block">
                                              {item.fechaInicio === item.fechaTermino ? '1 día puntual' : '2 días extremos'}
                                            </span>
                                            {extInfo && extInfo.intermediateDaysCount > 0 ? (
                                              <span className="text-[10px] text-emerald-700 font-bold block">
                                                🟢 {extInfo.intermediateDaysCount} {extInfo.intermediateDaysCount === 1 ? 'día libre' : 'días libres'}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-slate-500 block">Días seguidos</span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-[11px] text-emerald-800">
                                            <span className="font-bold block">
                                              {info.totalDays} {info.totalDays === 1 ? 'día' : 'días'}
                                            </span>
                                            <span className="text-[10px] text-emerald-700">
                                              Desbloqueo: {formatChileanDate(info.unblockDateStr)}
                                            </span>
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-slate-400 italic text-[11px]">Define fecha término</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        placeholder="Ej: Vacaciones..."
                                        value={item.descripcion}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setBulkBlockModal((prev) => ({
                                            ...prev,
                                            users: prev.users.map((u, i) => (i === idx ? { ...u, descripcion: val } : u)),
                                          }));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-brand-blue"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0 mt-2">
                  <button
                    type="button"
                    onClick={() => setBulkBlockModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBulkBlock}
                    disabled={savingAction}
                    className="px-5 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <CalendarRange className="w-4 h-4" />
                    {savingAction
                      ? 'Aplicando Bloqueo...'
                      : `Confirmar Bloqueo (${bulkBlockModal.users.length} trabajadores)`}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── BARRA FLOTANTE DE SELECCIÓN MÚLTIPLE (PORTAL AL BODY CON Z-INDEX ELEVADO) ─── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedUserIds.size >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className="fixed bottom-[calc(136px+env(safe-area-inset-bottom))] sm:bottom-[calc(172px+env(safe-area-inset-bottom))] lg:bottom-28 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-1.5rem)] sm:w-auto max-w-xl bg-slate-900/95 backdrop-blur-xl text-white px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xl flex items-center justify-between sm:justify-start gap-2 sm:gap-3 border border-slate-700/80 ring-1 ring-white/10 pointer-events-auto select-none"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-xs font-black text-slate-950 shadow-xs">
                  {selectedUserIds.size}
                </span>
                <span className="text-xs md:text-sm font-semibold truncate">
                  <span className="hidden sm:inline">usuarios </span>seleccionados
                </span>
              </div>

              <div className="hidden sm:block h-4 w-px bg-slate-700" />
              <button
                type="button"
                onClick={openBulkBlockModal}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <CalendarRange className="w-4 h-4" />
                <span className="sm:hidden">Bloquear</span>
                <span className="hidden sm:inline">Bloquear en Conjunto</span>
              </button>

              <div className="hidden sm:block h-4 w-px bg-slate-700" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedUserIds(new Set());
                }}
                className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600/70 rounded-xl px-2.5 py-1.5 transition-all cursor-pointer flex items-center gap-1.5 font-bold shadow-xs active:scale-95"
                title="Deseleccionar todos los usuarios"
                aria-label="Limpiar selección"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpiar selección</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ─── IN-PAGE ALERTS, CONFIRMS & TOASTS ─────────────────── */}
      {toast && (
        <InAppToast
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {alertDialog && (
        <InAppAlert
          isOpen={alertDialog.isOpen}
          type={alertDialog.type}
          title={alertDialog.title}
          message={alertDialog.message}
          onClose={() => setAlertDialog(null)}
        />
      )}

      {confirmDialog && (
        <InAppConfirm
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.isDanger ? 'danger' : 'warning'}
          confirmText="Confirmar"
          cancelText="Cancelar"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </motion.div>
  );
}
