import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getDashboardStats, getAvailableYears } from '../services/dashboard.service';
import type { DateFilter } from '../services/dashboard.service';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, QrCode, Store, Ticket, RefreshCw, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DashboardStats } from '../types';

const ROLE_COLORS = ['#0033AB', '#207B47', '#FFA53C', '#BC7314'];
const PIE_COLORS = ['#0033AB', '#207B47'];

const KPI_CONFIG = [
  { key: 'totalUsers',        label: 'Total Usuarios',       icon: Users,  color: 'text-[#0033AB]', bg: 'bg-[#0033AB]/10' },
  { key: 'totalQr',           label: 'Registros QR',         icon: QrCode, color: 'text-[#207B47]', bg: 'bg-[#207B47]/10' },
  { key: 'totalRestaurantes', label: 'Restaurantes',         icon: Store,  color: 'text-[#D97706]', bg: 'bg-[#FFA53C]/15' },
  { key: 'totalGuestCodes',   label: 'Códigos de Invitado', icon: Ticket, color: 'text-[#BC7314]', bg: 'bg-[#BC7314]/10' },
] as const;

const monthsOptions = ['Todos', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filter, setFilter] = useState<DateFilter>({ day: null, month: null, year: null });
  const [tempFilter, setTempFilter] = useState<DateFilter>({ day: null, month: null, year: null });
  const [dynamicYears, setDynamicYears] = useState<string[]>(['Todos', String(new Date().getFullYear())]);

  const fetchStats = useCallback(async (currentFilter = filter) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardStats(currentFilter);
      setStats(data);
    } catch (err) {
      setError('No se pudieron cargar las estadísticas.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchStats(filter);
  }, [fetchStats, filter]);

  useEffect(() => {
    getAvailableYears().then(setDynamicYears);
  }, []);

  const applyFilter = () => {
    setFilter(tempFilter);
    setIsFilterOpen(false);
  };

  const getLabel = () => {
    if (!filter.year) return 'Histórico Total';
    let label = `${filter.year}`;
    if (filter.month) label = `${monthsOptions[filter.month]} ${label}`;
    if (filter.day && filter.month) label = `${String(filter.day).padStart(2, '0')} ${label}`;
    return label;
  };

  const tooltipStyle = {
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontWeight: 'bold',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-4 sm:gap-6"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight border-l-4 border-brand-orange pl-3">
            PANEL <span className="text-brand-blue">OPERATIVO</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium ml-4 mt-0.5 sm:mt-1">{getLabel()}</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <Filter className="w-4 h-4" />
            Filtro
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-100">
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-400 ${loading ? 'animate-spin text-brand-blue' : ''}`} />
            <button
              onClick={() => fetchStats(filter)}
              disabled={loading}
              className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 disabled:opacity-50 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90dvh]"
              >
                <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Filtrar por Fecha</h3>
                  <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-4 sm:p-8 bg-white flex flex-col md:flex-row gap-4 sm:gap-6 overflow-y-auto">
                  
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Día</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                      value={tempFilter.day ?? ''}
                      onChange={(e) => setTempFilter(p => ({ ...p, day: e.target.value ? parseInt(e.target.value) : null }))}
                    >
                      <option value="">Todos</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                      value={tempFilter.month ?? ''}
                      onChange={(e) => setTempFilter(p => ({ ...p, month: e.target.value ? parseInt(e.target.value) : null }))}
                    >
                      <option value="">Todos</option>
                      {monthsOptions.slice(1).map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Año</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none"
                      value={tempFilter.year ?? ''}
                      onChange={(e) => setTempFilter(p => ({ ...p, year: e.target.value ? parseInt(e.target.value) : null }))}
                    >
                      <option value="">Todos</option>
                      {dynamicYears.slice(1).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                </div>
                
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
                  <button 
                    onClick={() => { setTempFilter({ day: null, month: null, year: null }); setFilter({ day: null, month: null, year: null }); setIsFilterOpen(false); }}
                    className="px-5 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                  >
                    Restablecer
                  </button>
                  <button 
                    onClick={applyFilter}
                    className="px-5 py-2 rounded-xl bg-brand-blue text-white font-bold hover:bg-brand-blue/90 transition-colors shadow-md"
                  >
                    Aplicar Filtro
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {KPI_CONFIG.map(({ key, label, icon: Icon, color, bg }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-50 ${bg} blur-3xl`} />
            <div className={`flex items-center justify-center gap-1.5 sm:gap-2 max-w-full text-slate-500 font-bold mb-1.5 sm:mb-3 uppercase tracking-wide sm:tracking-wider text-[10px] min-[400px]:text-[11px] sm:text-sm leading-tight relative z-10`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${color}`} />
              <span className="min-w-0 break-words">{label}</span>
            </div>
            <div className={`text-2xl sm:text-5xl font-black ${color} relative z-10 tracking-tight`}>
              {loading ? '—' : stats?.[key] ?? 0}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Roles Pie Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xs sm:text-sm font-bold text-slate-700 flex justify-center items-center gap-2 mb-4 uppercase tracking-widest">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-brand-blue" /> Distribución de Roles
          </h2>
          <div className="h-64 sm:h-72 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Cargando...</div>
            ) : (stats?.rolesData?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats!.rolesData}
                    cx="50%" cy="50%"
                    outerRadius={80} innerRadius={50}
                    dataKey="value"
                    paddingAngle={5}
                    label={({ name, payload }) => `${name} ${payload.percent.toFixed(0)}%`}
                    labelLine={false}
                    stroke="none"
                  >
                    {stats!.rolesData.map((_, index) => (
                      <Cell key={index} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Sin datos</div>
            )}
          </div>
        </div>

        {/* Top Restaurants Bar Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xs sm:text-sm font-bold text-slate-700 flex justify-center items-center gap-2 mb-4 uppercase tracking-widest">
            <Store className="w-4 h-4 sm:w-5 sm:h-5 text-brand-green" /> Top Restaurantes
          </h2>
          <div className="h-64 sm:h-72 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Cargando...</div>
            ) : (stats?.topRestaurants?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats!.topRestaurants} layout="vertical" margin={{ left: 10, right: 15, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="#64748b" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#207B47" radius={[0, 4, 4, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Sin datos</div>
            )}
          </div>
        </div>
      </div>


      {/* Codes Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <h2 className="text-sm font-bold text-slate-700 flex justify-center items-center gap-2 p-4 border-b border-slate-100 uppercase tracking-widest bg-slate-50">
            <Ticket className="w-5 h-5 text-brand-orange" /> Trazabilidad de Códigos
          </h2>
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="px-4 py-4 font-bold">Tipo</th>
                <th className="px-4 py-4 font-bold text-center">Emitidos</th>
                <th className="px-4 py-4 font-bold text-center">Usados</th>
                <th className="px-4 py-4 font-bold text-center">Pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {[
                {
                  label: 'GUEST (Invitados)',
                  icon: <Ticket className="w-4 h-4 text-brand-orange" />,
                  total: stats?.totalGuestCodes ?? 0,
                  used: stats?.guestCodesUsed ?? 0,
                  pending: stats?.guestCodesUnused ?? 0,
                  totalColor: 'text-[#BC7314] bg-[#BC7314]/10',
                  pendingColor: 'text-slate-600 bg-slate-100',
                },
                {
                  label: 'Global (Todos)',
                  icon: <QrCode className="w-4 h-4 text-brand-blue" />,
                  total: stats?.totalCodesGenerated ?? 0,
                  used: stats?.totalCodesUsed ?? 0,
                  pending: (stats?.totalCodesGenerated ?? 0) - (stats?.totalCodesUsed ?? 0),
                  totalColor: 'text-brand-blue bg-brand-blue/10',
                  pendingColor: 'text-slate-600 bg-slate-100',
                },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-5 font-bold text-slate-700 flex items-center gap-2">
                    {row.icon} {row.label}
                  </td>
                  <td className={`px-4 py-5 text-center font-mono font-bold ${row.totalColor}`}>{loading ? '—' : row.total}</td>
                  <td className="px-4 py-5 text-center text-brand-green font-mono font-bold">{loading ? '—' : row.used}</td>
                  <td className={`px-4 py-5 text-center font-mono font-bold ${row.pendingColor}`}>{loading ? '—' : row.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Guest Codes Pie */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 flex justify-center items-center gap-2 mb-4 uppercase tracking-widest bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Ticket className="w-5 h-5 text-brand-orange" /> Ratio de Uso (Invitados)
          </h2>
          <div className="h-64 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Cargando...</div>
            ) : (stats?.totalGuestCodes ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Redimidos', value: stats!.guestCodesUsed },
                      { name: 'Pendientes', value: stats!.guestCodesUnused },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={90}
                    dataKey="value"
                    paddingAngle={5}
                    label={({ percent }) => percent && percent > 0 ? `${(percent * 100).toFixed(1)}%` : ''}
                    labelLine={false}
                    stroke="none"
                  >
                    {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Sin datos</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
