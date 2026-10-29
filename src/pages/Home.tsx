import { useEffect, useState, useCallback } from 'react';
import { getDashboardStats } from '../services/dashboard.service';
import { Users, QrCode, Store, Ticket, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { DashboardStats } from '../types';
import ValesNotificationBanner from '../components/ui/ValesNotificationBanner';

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError('Error cargando resumen.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Corporate palette (Modern Enterprise Theme)
  // Blue (#0033AB), Green (#207B47), Orange (#FFA53C / #D97706), Ochre (#BC7314)
  const kpis = [
    { 
      key: 'totalUsers', 
      label: 'Usuarios Activos', 
      icon: Users, 
      color: 'text-[#0033AB]', 
      bg: 'bg-[#0033AB]/10', 
      border: 'border-[#0033AB]/20',
      glow: 'bg-[#0033AB]/20'
    },
    { 
      key: 'totalQr', 
      label: 'Registros QR', 
      icon: QrCode, 
      color: 'text-[#207B47]', 
      bg: 'bg-[#207B47]/10', 
      border: 'border-[#207B47]/20',
      glow: 'bg-[#207B47]/20'
    },
    { 
      key: 'totalRestaurantes', 
      label: 'Restaurantes', 
      icon: Store, 
      color: 'text-[#D97706]', 
      bg: 'bg-[#FFA53C]/15', 
      border: 'border-[#FFA53C]/30',
      glow: 'bg-[#FFA53C]/20'
    },
    { 
      key: 'totalGuestCodes', 
      label: 'Códigos Invitado', 
      icon: Ticket, 
      color: 'text-[#BC7314]', 
      bg: 'bg-[#BC7314]/10', 
      border: 'border-[#BC7314]/20',
      glow: 'bg-[#BC7314]/20'
    },
  ] as const;

  const COLORS = ['#0033AB', '#207B47', '#FFA53C', '#BC7314', '#7F4C12', '#442A12'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1400px] mx-auto w-full flex flex-col gap-6"
    >
      {/* Brand Header */}
      <div className="mb-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight border-l-4 border-brand-orange pl-4">
          Resumen <span className="text-brand-blue">General</span>
        </h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base ml-5">
          Métricas clave y estado operativo de la plataforma.
        </p>
      </div>

      {/* Anuncio del Sistema y Notificaciones de Vales */}
      <ValesNotificationBanner />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* KPIs Grid - 1 col on mobile, 2 on tablet, 4 on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {kpis.map(({ key, label, icon: Icon, color, bg, border, glow }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * idx }}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-6 flex items-center gap-4 md:gap-5 transition-all hover:-translate-y-1 hover:shadow-md relative overflow-hidden"
          >
            <div className={`absolute -right-6 -top-6 w-24 h-24 ${glow} rounded-full opacity-50 blur-2xl`}></div>
            <div className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-2xl ${bg} ${border} border flex items-center justify-center shadow-xs`}>
              <Icon className={`w-6 h-6 md:w-7 md:h-7 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] md:text-[11px] mb-0.5 md:mb-1 truncate">
                {label}
              </p>
              <div className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight truncate">
                {loading ? '—' : stats?.[key] ?? 0}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid - 1 col on mobile/tablet, 3 cols on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Bar Chart (Takes 2 columns on lg) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6 flex flex-col min-h-[380px] md:min-h-[420px]"
        >
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h3 className="text-sm md:text-base font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-brand-blue" />
              Flujo por Restaurante
            </h3>
            <span className="text-[10px] md:text-xs font-semibold text-brand-blue bg-brand-blue/10 px-2 md:px-3 py-1 rounded-full">Top 5</span>
          </div>
          
          <div className="flex-grow w-full h-[300px] md:h-auto">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">
                Cargando datos...
              </div>
            ) : (stats?.topRestaurants?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats!.topRestaurants} margin={{ top: 10, right: 10, left: -20, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    dy={15} 
                    angle={-35}
                    textAnchor="end"
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="value" fill="#0033AB" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {stats!.topRestaurants.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">
                Sin datos para mostrar
              </div>
            )}
          </div>
        </motion.div>

        {/* Donut Chart (Takes 1 column on lg) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6 flex flex-col min-h-[300px] md:min-h-[360px]"
        >
          <div className="mb-2">
            <h3 className="text-sm md:text-base font-bold text-slate-700 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-green" />
              Roles
            </h3>
          </div>
          
          <div className="flex-grow w-full relative min-h-[200px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">
                Cargando...
              </div>
            ) : (stats?.rolesData?.length ?? 0) > 0 ? (
              <>
                <div className="absolute inset-0 pb-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats!.rolesData}
                        cx="50%"
                        cy="50%"
                        innerRadius="60%"
                        outerRadius="80%"
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats!.rolesData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend custom */}
                <div className="absolute bottom-0 w-full flex flex-col gap-1.5 md:gap-2">
                  {stats!.rolesData.slice(0, 3).map((rol, idx) => (
                    <div key={rol.name} className="flex items-center justify-between text-xs md:text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }}></div>
                        <span className="text-slate-600 font-medium truncate">{rol.name}</span>
                      </div>
                      <span className="font-bold text-slate-800 ml-2">{rol.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs md:text-sm">
                Sin roles
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
