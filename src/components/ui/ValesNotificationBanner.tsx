import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  X,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  getValesNotificationSummary, 
  type ValesNotificationSummary 
} from '../../services/notifications.service';
import { formatChileanDate } from '../../services/calendar.service';
import ShinyText from './ShinyText';

export const ValesNotificationBanner: React.FC = () => {
  const [summary, setSummary] = useState<ValesNotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getValesNotificationSummary();
        if (mounted) {
          setSummary(data);
        }
      } catch (err) {
        console.error('Error cargando banner de notificaciones:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (dismissed || loading || !summary) return null;

  const unlockedCount = summary.desbloqueados.length;
  const expiringCount = summary.porDesbloquear.length;
  const blockedCount = summary.siguenBloqueados.length;

  // Si no hay ningún dato de bloqueos ni desbloqueos, no mostramos el banner
  if (unlockedCount === 0 && expiringCount === 0 && blockedCount === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Fondo decorativo con gradiente animado */}
      <div className="absolute -left-20 -top-20 w-60 h-60 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Franja superior de acento */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-brand-blue to-amber-500" />

      <div className="p-4 sm:p-5 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Título y badge animado */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              {/* Badge pulsante tipo React Bits */}
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800">
                  <span className="text-emerald-700">Anuncio del Sistema:</span>{' '}
                  <ShinyText speed={4} className="text-slate-900">
                    Desbloqueo Automático de Vales
                  </ShinyText>
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  En Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor del calendario de restricciones de vales de colación corporativos.
              </p>
            </div>
          </div>

          {/* Resumen de Métricas (Chips interactivos) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chip Desbloqueados */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {unlockedCount} {unlockedCount === 1 ? 'desbloqueado' : 'desbloqueados'}
              </span>
            </div>

            {/* Chip Por Desbloquear */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold shadow-2xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {expiringCount} {expiringCount === 1 ? 'por desbloquear' : 'por desbloquear'}
              </span>
            </div>

            {/* Chip Siguen Bloqueados */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
              <Lock className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{blockedCount} bloqueados</span>
            </div>

            {/* Botón expandir/colapsar */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <span>{isExpanded ? 'Ocultar' : 'Ver resumen'}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Botón descartar anuncio */}
            <button
              onClick={() => setDismissed(true)}
              title="Ocultar anuncio temporalmente"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sección expandible con listado rápido */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mt-4 pt-4 border-t border-slate-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Columna 1: Desbloqueados recientemente */}
                <div className="bg-emerald-50/50 rounded-2xl p-3.5 border border-emerald-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Desbloqueados Recientes
                    </span>
                    <span className="text-[10px] bg-emerald-200/60 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-md">
                      {unlockedCount}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {unlockedCount === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-2">Sin registros recientes</p>
                    ) : (
                      summary.desbloqueados.map((item) => (
                        <div key={item.id} className="p-2 bg-white rounded-xl border border-emerald-100 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 truncate">{item.userName}</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Habilitado
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Bloqueo finalizó: {formatChileanDate(item.fechaTermino)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Columna 2: Por desbloquearse pronto */}
                <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Por Desbloquear (Próx. 72h)
                    </span>
                    <span className="text-[10px] bg-amber-200/60 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-md">
                      {expiringCount}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {expiringCount === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-2">Ninguno en las próximas 72h</p>
                    ) : (
                      summary.porDesbloquear.map((item) => (
                        <div key={item.id} className="p-2 bg-white rounded-xl border border-amber-100 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 truncate">{item.userName}</span>
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              {item.diasRestantes === 0 ? 'Vence HOY' : `En ${item.diasRestantes}d`}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Hasta: {formatChileanDate(item.fechaTermino)} {item.descripcion ? `• ${item.descripcion}` : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Columna 3: Siguen bloqueados */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-rose-500" />
                      Siguen Bloqueados
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-md">
                      {blockedCount}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {blockedCount === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-2">Ningún usuario bloqueado</p>
                    ) : (
                      summary.siguenBloqueados.slice(0, 5).map((item) => (
                        <div key={item.id} className="p-2 bg-white rounded-xl border border-slate-100 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 truncate">{item.userName}</span>
                            <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.empresa || 'General'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Hasta {formatChileanDate(item.fechaTermino)} {item.descripcion ? `• ${item.descripcion}` : ''}
                          </p>
                        </div>
                      ))
                    )}
                    {blockedCount > 5 && (
                      <p className="text-[10px] text-center text-slate-400 font-semibold pt-1">
                        +{blockedCount - 5} usuarios más en lista
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón de navegación hacia Usuarios */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => navigate('/users')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue hover:text-blue-800 transition-colors cursor-pointer"
                >
                  <span>Ir a Gestión de Usuarios y Bloqueos de Calendario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ValesNotificationBanner;
