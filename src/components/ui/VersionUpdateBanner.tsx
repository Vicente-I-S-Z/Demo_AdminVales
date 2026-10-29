import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const VersionUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      // Usar cache: 'no-store' para que nunca responda con caché
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const serverBuildTime = Number(data.buildTime);

      // Si existe __APP_BUILD_TIME__ y el build del servidor es más reciente
      if (
        typeof __APP_BUILD_TIME__ === 'number' &&
        __APP_BUILD_TIME__ > 0 &&
        serverBuildTime > 0 &&
        serverBuildTime > __APP_BUILD_TIME__
      ) {
        setHasUpdate(true);
      }
    } catch (err) {
      // Falla silenciosa de red para no molestar al usuario
      console.debug('Error comprobando versión de la aplicación:', err);
    }
  }, []);

  useEffect(() => {
    // 1. Comprobación inicial tras montar con breve espera para priorizar la carga de la vista
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 1500);

    // 2. Comprobar periódicamente cada 60 segundos
    const interval = setInterval(checkForUpdate, 60 * 1000);

    // 3. Comprobar cuando el administrador vuelve a enfocar la pestaña del navegador
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkForUpdate);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, [checkForUpdate]);

  const handleUpdate = () => {
    setIsReloading(true);
    // Recarga limpia: Preserva la sesión de Supabase almacenada en localStorage
    window.location.reload();
  };

  if (!hasUpdate || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Notificación de actualización del sistema"
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-2xl"
      >
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-blue text-white p-3.5 md:p-4 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center text-brand-orange shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-bold text-white truncate flex items-center gap-1.5">
                <span>Nueva actualización disponible</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green text-white font-black uppercase tracking-wider">
                  Producción
                </span>
              </p>
              <p className="text-[11px] md:text-xs text-slate-300 truncate">
                Se han desplegado mejoras y correcciones. Tu sesión se mantendrá iniciada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUpdate}
              disabled={isReloading}
              className="px-3.5 py-1.5 bg-brand-orange hover:bg-brand-orange/90 text-slate-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'Actualizando...' : 'Actualizar ahora'}</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar aviso temporalmente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default VersionUpdateBanner;
