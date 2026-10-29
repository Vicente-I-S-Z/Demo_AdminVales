import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Dock from '../ui/Dock';
import { Home, BarChart2, Users, Key, FileSpreadsheet, Unlock, LogOut } from 'lucide-react';
import SupportWidget from '../ui/SupportWidget';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { signOut, user, userProfile, userRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userName =
    userProfile?.nombre
      ? `${userProfile.nombre} ${userProfile.apellidos || ''}`.trim()
      : user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Administrador';

  const roleLabel = userRole === 'admin' ? 'Administrador' : '';

  const navItems = [
    { icon: <Home size={22} />, label: 'Inicio', onClick: () => navigate('/'), isActive: location.pathname === '/' },
    { icon: <BarChart2 size={22} />, label: 'Estadísticas', onClick: () => navigate('/estadisticas'), isActive: location.pathname === '/estadisticas' },
    { icon: <Users size={22} />, label: 'Usuarios', onClick: () => navigate('/users'), isActive: location.pathname === '/users' },
    { icon: <Key size={22} />, label: 'Códigos', onClick: () => navigate('/codigos'), isActive: location.pathname === '/codigos' },
    { icon: <FileSpreadsheet size={22} />, label: 'Cierre', onClick: () => navigate('/cierre'), isActive: location.pathname === '/cierre' },
    { icon: <Unlock size={22} />, label: 'Solicitudes', onClick: () => navigate('/solicitudes'), isActive: location.pathname === '/solicitudes' },
  ];


  return (
    <div className="min-h-screen bg-brand-bg relative overflow-x-hidden flex flex-col items-center">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-blue/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob" />
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-brand-orange/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000" />

      {/* Top Welcome Bar */}
      <header className="w-full max-w-7xl mt-2 sm:mt-6 px-2 sm:px-4 z-40">
        <div className="flex justify-between items-center bg-white/80 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            {/* Logos Corporativos */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <img
                src="/logos/empresa-alpha.svg"
                alt="Empresa Alpha - Servicios Industriales"
                className="h-7 sm:h-9 md:h-11 object-contain transition-transform hover:scale-105"
              />
              <div className="h-6 sm:h-8 w-px bg-slate-200" />
              <img
                src="/logos/empresa-beta.svg"
                alt="Empresa Beta - Tecnologías & Gestión"
                className="h-7 sm:h-9 md:h-11 object-contain transition-transform hover:scale-105"
              />
            </div>

            {/* Separador y Saludo (Desktop) */}
            <div className="hidden sm:flex flex-col border-l border-slate-200 pl-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Sistema de Administración
                </span>
                {roleLabel && (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      userRole === 'admin'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-[#FFA53C]/15 text-[#D97706] border-[#FFA53C]/30'
                    }`}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-600 truncate">
                ¡Bienvenido, <span className="font-bold text-slate-800">{userName}</span>!
              </p>
            </div>

            {/* Indicador de Usuario y Rol (Mobile) */}
            <div className="flex sm:hidden flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">
                {userName.split(' ')[0]}
              </span>
              {roleLabel && (
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-px rounded-full border self-start ${
                    userRole === 'admin'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-[#FFA53C]/15 text-[#D97706] border-[#FFA53C]/30'
                  }`}
                >
                  {roleLabel}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs sm:text-sm bg-red-50 text-red-600 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold hover:bg-red-100 transition-all cursor-pointer border border-red-100/50 shadow-sm shrink-0 ml-2"
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="w-full max-w-[1600px] p-2 sm:p-4 md:p-6 mt-1 sm:mt-2 z-10 flex-grow relative pb-36 sm:pb-48 lg:pb-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Dock Navigation */}
      <div className="dock-safe-area fixed bottom-0 left-0 w-full z-40 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-fit mx-auto">
          <Dock
            items={navItems}
            panelHeight={68}
            baseItemSize={50}
            magnification={70}
          />
        </div>
      </div>

      {/* Support Floating Widget */}
      <SupportWidget />
    </div>
  );
}


