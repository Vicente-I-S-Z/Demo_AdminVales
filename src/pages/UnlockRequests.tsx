import { useEffect, useState, useMemo, useCallback } from 'react';
import { getUnlockRequests, approveUnlockRequest, rejectUnlockRequest } from '../services/unlock.service';
import { Unlock, Search, CheckCircle, XCircle, FileSpreadsheet, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { InAppAlert, InAppConfirm, InAppToast } from '../components/ui/InAppDialogs';
import { Pagination } from '../components/ui/Pagination';
import type { UnlockRequest } from '../types';
import ExcelJS from 'exceljs';

export default function UnlockRequests() {
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // In-page feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string } | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type?: 'warning' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; isDanger?: boolean; onConfirm: () => void } | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUnlockRequests();
      setRequests(data);
    } catch (err) {
      setError('No se pudieron cargar las solicitudes.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async () => {
    if (!selectedId) {
      setToast({
        type: 'warning',
        title: 'Selección requerida',
        message: 'Por favor selecciona una solicitud de la lista para aprobar.',
      });
      return;
    }
    const req = requests.find((r) => r.id === selectedId);
    if (!req) return;

    setConfirmDialog({
      isOpen: true,
      title: '¿Aprobar solicitud de desbloqueo?',
      message: `¿Deseas autorizar el desbloqueo para ${req.user_email}?\nEsto volverá a habilitar sus vales en el sistema.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          await approveUnlockRequest(selectedId, req.user_email);
          setSelectedId(null);
          setToast({
            type: 'success',
            title: 'Desbloqueo aprobado',
            message: `Los vales de ${req.user_email} fueron habilitados con éxito.`,
          });
          await fetchRequests();
        } catch (err: any) {
          console.error(err);
          setAlertInfo({
            type: 'error',
            title: 'Error al aprobar',
            message: err?.message || 'No se pudo aprobar la solicitud.',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleReject = async () => {
    if (!selectedId) {
      setToast({
        type: 'warning',
        title: 'Selección requerida',
        message: 'Por favor selecciona una solicitud de la lista para rechazar.',
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: '¿Rechazar solicitud?',
      message: 'Esta solicitud será rechazada y eliminada permanentemente del sistema.',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          await rejectUnlockRequest(selectedId);
          setSelectedId(null);
          setToast({
            type: 'info',
            title: 'Solicitud rechazada',
            message: 'La solicitud fue rechazada y removida de la lista.',
          });
          await fetchRequests();
        } catch (err: any) {
          console.error(err);
          setAlertInfo({
            type: 'error',
            title: 'Error al rechazar',
            message: err?.message || 'No se pudo rechazar la solicitud.',
          });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const exportToExcel = async () => {
    if (filteredRequests.length === 0) {
      setToast({
        type: 'info',
        title: 'Sin datos',
        message: 'No hay solicitudes disponibles para exportar a Excel.',
      });
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Solicitudes');

    // Title row
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'SOLICITUDES DE DESBLOQUEO POR LÍDERES';
    titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B9' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 26;

    // Info row
    ws.mergeCells('A2:H2');
    const infoCell = ws.getCell('A2');
    const now = new Date();
    infoCell.value = `Generado: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  |  Total: ${filteredRequests.length} solicitud(es)`;
    infoCell.font = { name: 'Arial', size: 10 };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Empty row
    ws.getRow(3).height = 6;

    // Headers
    const headers = ['Fecha Solicitud', 'Email Usuario', 'Fecha Bloqueada', 'Justificación', 'Estado', 'N° Líder', 'Nombre Líder', 'Email Líder'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // Data rows
    filteredRequests.forEach((req) => {
      const dateObj = new Date(req.created_at);
      const row = ws.addRow([
        dateObj.toLocaleDateString('es-CL'),
        req.user_email,
        '-',
        req.justificacion,
        'Pendiente',
        String(req.numero_lider ?? ''),
        req.lider_name,
        req.lider_email,
      ]);
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    // Column widths
    ws.columns = [
      { width: 18 }, { width: 28 }, { width: 18 }, { width: 35 },
      { width: 14 }, { width: 14 }, { width: 25 }, { width: 28 },
    ];

    // AutoFilter
    ws.autoFilter = 'A4:H4';

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solicitudes_desbloqueo_${now.toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((r) => {
      const userEmail = String(r.user_email ?? '').toLowerCase();
      const liderName = String(r.lider_name ?? '').toLowerCase();
      const liderEmail = String(r.lider_email ?? '').toLowerCase();
      const numeroLider = String(r.numero_lider ?? '').toLowerCase();
      const justificacion = String(r.justificacion ?? '').toLowerCase();

      return (
        userEmail.includes(term) ||
        liderName.includes(term) ||
        liderEmail.includes(term) ||
        numeroLider.includes(term) ||
        justificacion.includes(term)
      );
    });
  }, [requests, searchTerm]);

  const paginatedRequests = useMemo(() => {
    if (pageSize === -1) return filteredRequests;
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto"
    >
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 flex items-center gap-2.5 sm:gap-3 tracking-tight border-l-4 border-brand-orange pl-3 sm:pl-4">
          <div className="p-1.5 sm:p-2 bg-brand-blue/10 text-brand-blue rounded-xl">
            <Unlock className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          Solicitudes de Desbloqueo
        </h1>
        <p className="text-slate-500 mt-1.5 sm:mt-2 text-sm sm:text-lg ml-4 sm:ml-5">
          Revisa y gestiona las peticiones enviadas por los líderes.
        </p>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Action Bar */}
        <div className="bg-slate-50/80 p-2.5 sm:p-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <span className="text-xs sm:text-sm font-semibold text-slate-500 mr-1 sm:mr-2">Acciones:</span>
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="px-2.5 sm:px-3 py-1.5 bg-brand-green text-white font-medium text-xs sm:text-[13px] rounded-xl sm:rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" /> Aprobar Desbloqueo
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="px-2.5 sm:px-3 py-1.5 bg-red-600 text-white font-medium text-xs sm:text-[13px] rounded-xl sm:rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="w-4 h-4" /> Rechazar Solicitud
          </button>
          <button
            onClick={exportToExcel}
            className="px-2.5 sm:px-3 py-1.5 bg-brand-blue text-white font-medium text-xs sm:text-[13px] rounded-xl sm:rounded shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 sm:ml-auto cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar a Excel
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue text-sm placeholder-slate-400"
              placeholder="Buscar por usuario, líder o teléfono..."
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
                {filteredRequests.length} {filteredRequests.length === 1 ? 'solicitud' : 'solicitudes'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="p-4 text-center text-red-600 font-medium">{error}</p>
        )}

        {/* Vista en tarjetas (celular y tablet) */}
        <div className="lg:hidden p-2 space-y-2" role="radiogroup" aria-label="Solicitudes de desbloqueo">
          {loading ? (
            <p className="p-10 text-center text-sm text-slate-400">Cargando solicitudes...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">No se encontraron solicitudes.</p>
          ) : (
            paginatedRequests.map((req) => {
              const isSelected = selectedId === req.id;
              const dateObj = new Date(req.created_at);
              return (
                <div
                  key={`card_${req.id}`}
                  onClick={() => setSelectedId(req.id)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'border-brand-blue bg-brand-blue/10 ring-2 ring-brand-blue/20'
                      : 'border-slate-200/80 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="reqSelectionCard"
                      checked={isSelected}
                      onChange={() => setSelectedId(req.id)}
                      className="mt-1 w-4 h-4 text-brand-blue focus:ring-brand-blue border-slate-300 cursor-pointer shrink-0"
                      aria-label={`Seleccionar solicitud de ${req.lider_name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Usuario a desbloquear</p>
                      <p className="font-semibold text-brand-blue text-sm break-all">{req.user_email}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 italic break-words">"{req.justificacion}"</p>
                  <div className="flex items-end justify-between gap-2 flex-wrap text-xs pt-1 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{req.lider_name}</p>
                      <p className="text-slate-400 break-all">{req.lider_email}</p>
                      <p className="text-slate-500 font-mono">N° líder: {req.numero_lider}</p>
                    </div>
                    <p className="text-slate-500 shrink-0">
                      {dateObj.toLocaleDateString('es-CL')}{' '}
                      <span className="text-slate-400">
                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Vista en tabla (escritorio) */}
        <div className="hidden lg:block overflow-x-auto p-1 sm:p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="p-4 font-semibold w-12 text-center">Sel</th>
                <th className="p-4 font-semibold">Líder Solicitante</th>
                <th className="p-4 font-semibold">N° Líder</th>
                <th className="p-4 font-semibold">Usuario a Desbloquear</th>
                <th className="p-4 font-semibold w-1/3">Motivo</th>
                <th className="p-4 font-semibold">Fecha Solicitud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">Cargando solicitudes...</td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">No se encontraron solicitudes.</td>
                </tr>
              ) : (
                paginatedRequests.map((req, idx) => {
                  const isSelected = selectedId === req.id;
                  const dateObj = new Date(req.created_at);
                  return (
                    <motion.tr
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-brand-blue/10' : ''}`}
                      onClick={() => setSelectedId(req.id)}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="radio"
                          name="reqSelection"
                          checked={isSelected}
                          onChange={() => setSelectedId(req.id)}
                          className="w-4 h-4 text-brand-blue focus:ring-brand-blue border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{req.lider_name}</div>
                        <div className="text-xs text-slate-400">{req.lider_email}</div>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{req.numero_lider}</td>
                      <td className="p-4 font-semibold text-brand-blue">{req.user_email}</td>
                      <td className="p-4 text-slate-600 italic">"{req.justificacion}"</td>
                      <td className="p-4 text-xs text-slate-500">
                        {dateObj.toLocaleDateString('es-CL')}{' '}
                        <span className="text-slate-400">
                          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredRequests.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="solicitudes"
        />
      </div>

      {/* In-page Dialogs */}
      {toast && (
        <InAppToast
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {alertInfo && (
        <InAppAlert
          isOpen={!!alertInfo}
          type={alertInfo.type || 'info'}
          title={alertInfo.title}
          message={alertInfo.message}
          onClose={() => setAlertInfo(null)}
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
