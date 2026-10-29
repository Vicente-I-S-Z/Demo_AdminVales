import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface AlertModalProps {
  isOpen: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  type?: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface ToastProps {
  id?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

// ─── Modal de Alerta en Página (Reemplazo de alert()) ────────
export function InAppAlert({ isOpen, type = 'info', title, message, onClose }: AlertModalProps) {
  if (typeof document === 'undefined') return null;

  const icons = {
    success: <CheckCircle2 className="w-8 h-8 text-[#207B47]" />,
    error: <AlertCircle className="w-8 h-8 text-red-600" />,
    warning: <AlertTriangle className="w-8 h-8 text-[#FFA53C]" />,
    info: <Info className="w-8 h-8 text-[#0033AB]" />,
  };

  const borderColors = {
    success: 'border-[#207B47]/30',
    error: 'border-red-200',
    warning: 'border-[#FFA53C]/30',
    info: 'border-[#0033AB]/30',
  };

  const buttonColors = {
    success: 'bg-[#207B47] hover:bg-[#207B47]/90 text-white',
    error: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-[#FFA53C] hover:bg-[#FFA53C]/90 text-slate-900',
    info: 'bg-[#0033AB] hover:bg-[#0033AB]/90 text-white',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl border ${borderColors[type]} w-full max-w-md p-4 sm:p-6 relative overflow-hidden`}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl shrink-0 border border-slate-100">
                {icons[type]}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">{title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 flex justify-end">
              <button
                onClick={onClose}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm ${buttonColors[type]}`}
              >
                Aceptar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Modal de Confirmación en Página (Reemplazo de confirm()) ─
export function InAppConfirm({
  isOpen,
  type = 'warning',
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  if (typeof document === 'undefined') return null;

  const isDanger = type === 'danger';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl border ${
              isDanger ? 'border-red-200' : 'border-slate-100'
            } w-full max-w-md p-4 sm:p-6 relative overflow-hidden`}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 border ${
                  isDanger ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}
              >
                {isDanger ? <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" /> : <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">{title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-all shadow-md text-white disabled:opacity-50 text-sm ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                    : 'bg-[#0033AB] hover:bg-[#0033AB]/90 shadow-blue-200'
                }`}
              >
                {loading ? 'Procesando...' : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Toast Flotante en Página ────────────────────────────────
export function InAppToast({ type = 'success', title, message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (typeof document === 'undefined') return null;

  const bgStyles = {
    success: 'bg-emerald-900/90 text-white border-emerald-700',
    error: 'bg-red-900/90 text-white border-red-700',
    warning: 'bg-amber-900/90 text-white border-amber-700',
    info: 'bg-slate-900/90 text-white border-slate-700',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`fixed top-4 sm:top-6 right-4 sm:right-6 left-4 sm:left-auto z-[999999] flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl shadow-xl border backdrop-blur-md max-w-md ${bgStyles[type]}`}
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        {title && <div className="font-bold text-sm leading-snug">{title}</div>}
        <div className="text-xs opacity-90 leading-snug mt-0.5">{message}</div>
      </div>
      <button onClick={onClose} className="p-1 hover:opacity-75 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </motion.div>,
    document.body
  );
}
