import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { getDailyCodes, authorizeDeferredCode, disableCodeAuthorization } from '../services/codes.service';
import { Key, Search, CheckCircle, XCircle, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InAppAlert, InAppToast } from '../components/ui/InAppDialogs';
import { Pagination } from '../components/ui/Pagination';
import type { DailyCode } from '../types';

type FilterUsed = 'Todos' | 'Usados' | 'No Usados';

export default function DailyCodes() {
  const [searchParams] = useSearchParams();
  const [codes, setCodes] = useState<DailyCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterUsed, setFilterUsed] = useState<FilterUsed>('Todos');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // In-page feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title?: string; message: string } | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type?: 'warning' | 'error' | 'info' } | null>(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    type: 'authorize' | 'disable';
    code: DailyCode;
  } | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyCodes();
      setCodes(data);
    } catch (err) {
      setError('No se pudo cargar la lista de códigos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleAuthorize = async (code: DailyCode) => {
    if (code.is_used) {
      setAlertInfo({
        type: 'warning',
        title: 'Código utilizado',
        message: 'Este código ya fue utilizado, por lo que no requiere autorización diferida.',
      });
      return;
    }
    if (code.is_authorized) {
      setAlertInfo({
        type: 'info',
        title: 'Ya autorizado',
        message: 'Este código ya ha sido autorizado previamente.',
      });
      return;
    }
    setConfirmModal({ type: 'authorize', code });
  };

  const handleDisable = async (code: DailyCode) => {
    if (!code.is_authorized) {
      setAlertInfo({
        type: 'warning',
        title: 'Código no autorizado',
        message: 'Este código no cuenta con autorización activa para deshabilitar.',
      });
      return;
    }
    setConfirmModal({ type: 'disable', code });
  };

  const executeAction = async () => {
    if (!confirmModal) return;
    const { type, code } = confirmModal;
    setActionLoading(code.codigo_diario);
    setConfirmModal(null);
    try {
      if (type === 'authorize') {
        await authorizeDeferredCode(code.codigo_diario);
        setToast({
          type: 'success',
          title: 'Código autorizado',
          message: `El código diferido ${code.codigo_diario} fue autorizado exitosamente.`,
        });
      } else {
        await disableCodeAuthorization(code.codigo_diario);
        setToast({
          type: 'info',
          title: 'Autorización deshabilitada',
          message: `Se deshabilitó la autorización del código ${code.codigo_diario}.`,
        });
      }
      await fetchCodes();
    } catch (err: any) {
      console.error(err);
      setAlertInfo({
        type: 'error',
        title: 'Error de operación',
        message: `No se pudo ${type === 'authorize' ? 'autorizar' : 'deshabilitar'} el código: ${err?.message || 'Error desconocido'}.`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const normalizeText = (text?: string | null): string =>
    String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const filteredCodes = useMemo(() => {
    const rawSearch = searchTerm.trim().toLowerCase();
    const normSearch = normalizeText(searchTerm);
    const normTokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
    const rawTokens = rawSearch ? rawSearch.split(/\s+/).filter(Boolean) : [];

    return codes.filter((c) => {
      const emailNorm = normalizeText(c.user_email);
      const emailRaw = String(c.user_email ?? '').toLowerCase();
      const codigoNorm = normalizeText(c.codigo_diario);
      const codigoRaw = String(c.codigo_diario ?? '').toLowerCase();

      const matchesSearch =
        normTokens.length === 0 ||
        normTokens.every((t, i) => {
          const rawT = rawTokens[i] || t;
          return (
            emailNorm.includes(t) ||
            emailRaw.includes(rawT) ||
            codigoNorm.includes(t) ||
            codigoRaw.includes(rawT)
          );
        });

      const matchesUsed =
        filterUsed === 'Todos' ||
        (filterUsed === 'Usados' && c.is_used) ||
        (filterUsed === 'No Usados' && !c.is_used);

      return matchesSearch && matchesUsed;
    });
  }, [codes, searchTerm, filterUsed]);

  const paginatedCodes = useMemo(() => {
    if (pageSize === -1) return filteredCodes;
    const start = (currentPage - 1) * pageSize;
    return filteredCodes.slice(start, start + pageSize);
  }, [filteredCodes, currentPage, pageSize]);

  // Piezas reutilizadas por la tabla (escritorio/tablet) y por las tarjetas (celular)
  const renderUsoBadge = (code: DailyCode) =>
    code.is_used ? (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green border border-brand-green/20">
        Usado
      </span>
    ) : (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
        No Usado
      </span>
    );

  const renderAutorizacion = (code: DailyCode) =>
    code.is_authorized ? (
      <span className="inline-flex items-center gap-1.5 text-brand-blue font-semibold text-xs">
        <CheckCircle className="w-4 h-4" /> Autorizado
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-slate-400 font-semibold text-xs">
        <XCircle className="w-4 h-4" /> Normal
      </span>
    );

  const renderFecha = (code: DailyCode) => {
    const dateObj = new Date(code.created_at);
    return (
      <>
        {dateObj.toLocaleDateString('es-CL')}{' '}
        <span className="text-slate-400">
          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </>
    );
  };

  const renderAcciones = (code: DailyCode) => {
    const isProcessing = actionLoading === code.codigo_diario;
    return (
      <>
        {!code.is_authorized && !code.is_used && (
          <button
            onClick={() => handleAuthorize(code)}
            disabled={isProcessing}
            className="px-2 py-1 text-xs font-bold bg-brand-blue/10 text-brand-blue rounded-lg hover:bg-brand-blue/20 transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Autorizar código diferido"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Autorizar
          </button>
        )}
        {code.is_authorized && (
          <button
            onClick={() => handleDisable(code)}
            disabled={isProcessing}
            className="px-2 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Deshabilitar autorización"
          >
            <ShieldOff className="w-3.5 h-3.5" /> Deshabilitar
          </button>
        )}
        {isProcessing && (
          <span className="text-xs text-slate-400 animate-pulse">Procesando...</span>
        )}
      </>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto"
    >
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 flex items-center gap-2.5 sm:gap-3 tracking-tight border-l-4 border-brand-orange pl-3 sm:pl-4">
          <div className="p-1.5 sm:p-2 bg-brand-blue/10 text-brand-blue rounded-xl">
            <Key className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          Gestión de Códigos Diarios
        </h1>
        <p className="text-slate-500 mt-1.5 sm:mt-2 text-sm sm:text-lg ml-4 sm:ml-5">
          Revisa el historial de códigos generados por los usuarios.
        </p>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Filters */}
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-semibold text-slate-500">Estado:</label>
              <select
                value={filterUsed}
                onChange={(e) => {
                  setFilterUsed(e.target.value as FilterUsed);
                  setCurrentPage(1);
                }}
                className="p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="Todos">Todos</option>
                <option value="Usados">Usados</option>
                <option value="No Usados">No Usados</option>
              </select>
            </div>

            <div className="flex-1 w-full sm:max-w-md relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm font-medium placeholder-slate-400"
                placeholder="Buscar por email o código..."
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
          </div>

          {searchTerm.trim() && (
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <span>Resultados:</span>
              <span className="px-2.5 py-0.5 bg-brand-blue/10 text-brand-blue rounded-full font-bold">
                {filteredCodes.length} {filteredCodes.length === 1 ? 'código' : 'códigos'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="p-4 text-center text-red-600 font-medium">{error}</p>
        )}

        {/* Vista en tarjetas (celular) */}
        <div className="md:hidden p-2 space-y-2">
          {loading ? (
            <p className="p-10 text-center text-sm text-slate-400">Cargando códigos...</p>
          ) : filteredCodes.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">No se encontraron códigos.</p>
          ) : (
            paginatedCodes.map((code, idx) => {
              const isGuest = code.codigo_diario.toUpperCase().startsWith('GUEST');
              return (
                <div
                  key={`card_${code.codigo_diario}_${code.created_at}_${idx}`}
                  className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-800 text-sm break-all">
                        {code.codigo_diario}
                        {isGuest && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-sans font-bold">
                            GUEST
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 font-medium break-all mt-0.5">{code.user_email}</p>
                    </div>
                    <div className="shrink-0">{renderUsoBadge(code)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                    <span>{renderFecha(code)}</span>
                    {renderAutorizacion(code)}
                  </div>
                  {(code.is_authorized || !code.is_used) && (
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100">
                      {renderAcciones(code)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Vista en tabla (tablet y escritorio) */}
        <div className="hidden md:block overflow-x-auto p-1 sm:p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="p-4 font-semibold">Código Diario</th>
                <th className="p-4 font-semibold">Email Usuario</th>
                <th className="p-4 font-semibold text-center">Uso de Vale</th>
                <th className="p-4 font-semibold text-center">Autorización Extra</th>
                <th className="p-4 font-semibold">Fecha Generación</th>
                <th className="p-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">Cargando códigos...</td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">No se encontraron códigos.</td>
                </tr>
              ) : (
                paginatedCodes.map((code, idx) => {
                  const isGuest = code.codigo_diario.toUpperCase().startsWith('GUEST');
                  return (
                    <tr
                      key={`${code.codigo_diario}_${code.created_at}_${idx}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 font-mono font-semibold text-slate-800">
                        {code.codigo_diario}
                        {isGuest && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-sans font-bold">
                            GUEST
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{code.user_email}</td>
                      <td className="p-4 text-center">{renderUsoBadge(code)}</td>
                      <td className="p-4 text-center">{renderAutorizacion(code)}</td>
                      <td className="p-4 text-xs text-slate-500">{renderFecha(code)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">{renderAcciones(code)}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredCodes.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="códigos"
        />
      </div>

      {/* Confirmation Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {confirmModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3">
                  {confirmModal.type === 'authorize' ? '✅ Confirmar Autorización' : '🚫 Confirmar Deshabilitación'}
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm space-y-1">
                  <p><span className="font-semibold text-slate-600">Email:</span> {confirmModal.code.user_email}</p>
                  <p><span className="font-semibold text-slate-600">Código:</span> <span className="font-mono">{confirmModal.code.codigo_diario}</span></p>
                </div>
                <p className="text-sm text-slate-500 mb-6">
                  {confirmModal.type === 'authorize'
                    ? 'Esto permitirá que el código de un día anterior pueda ser utilizado.'
                    : 'Esto eliminará la autorización del código.'}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executeAction}
                    className={`px-4 py-2 rounded-xl text-white font-bold transition-colors shadow-md ${
                      confirmModal.type === 'authorize'
                        ? 'bg-brand-blue hover:bg-brand-blue/90'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {confirmModal.type === 'authorize' ? 'Autorizar' : 'Deshabilitar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* In-page Toast & Alert */}
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
    </motion.div>
  );
}
