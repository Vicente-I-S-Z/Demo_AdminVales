import { useState } from 'react';
import { generateMonthlyReport } from '../services/closing.service';
import { FileSpreadsheet, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const MONTHS = [
  { value: 1,  label: 'Enero' },
  { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },
  { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },
  { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },
  { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export default function MonthlyClosing() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [restaurant, setRestaurant] = useState('Todos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Años disponibles: desde el año actual hacia atrás hasta 2024
  const availableYears = Array.from({ length: Math.max(currentYear - 2024 + 1, 3) }, (_, i) => currentYear - i);

  // Si es el año actual, solo mostrar meses hasta el mes en curso. Si es un año anterior, mostrar todos los meses.
  const availableMonths = year === currentYear
    ? MONTHS.filter((m) => m.value <= currentMonth)
    : MONTHS;

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setError(null);
    if (newYear === currentYear && month > currentMonth) {
      setMonth(currentMonth);
    }
  };

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    setError(null);
  };

  const handleRestaurantChange = (newRest: string) => {
    setRestaurant(newRest);
    setError(null);
  };

  const currentMonthLabel = MONTHS.find((m) => m.value === month)?.label ?? '';

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      await generateMonthlyReport({ month, year, restaurant });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el reporte.');
    } finally {
      setLoading(false);
    }
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
            <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          Cierre Mensual de Vales
        </h1>
        <p className="text-slate-500 mt-1.5 sm:mt-2 text-sm sm:text-lg ml-4 sm:ml-5">
          Genera y descarga el reporte Excel para el cobro a los restaurantes.
        </p>
      </div>

      <div className="bg-brand-cream/30 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-6 md:p-8">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-brand-orange inline-block" />
          Generador de Reporte Consolidado
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-600 mb-1.5 sm:mb-2">Mes</label>
            <select
              value={month}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white text-slate-700 font-medium cursor-pointer text-sm"
            >
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-600 mb-1.5 sm:mb-2">Año</label>
            <select
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white text-slate-700 font-medium cursor-pointer text-sm"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <label className="block text-xs sm:text-sm font-semibold text-slate-600 mb-1.5 sm:mb-2">Restaurante</label>
          <select
            value={restaurant}
            onChange={(e) => handleRestaurantChange(e.target.value)}
            className="w-full p-2.5 sm:p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white text-slate-700 font-medium cursor-pointer text-sm"
          >
            <option value="Todos">Todos los restaurantes</option>
            <option value="Casino Central">Casino Central</option>
            <option value="Cafetería Gourmet">Cafetería Gourmet</option>
            <option value="Bistró Express">Bistró Express</option>
            <option value="Restaurante Don Pedro">Restaurante Don Pedro</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all text-xs sm:text-sm md:text-base ${
            loading
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-brand-blue hover:bg-brand-blue/90 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
          }`}
        >
          {loading ? (
            'Procesando datos y generando Excel...'
          ) : (
            <>
              <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Descargar Reporte ({currentMonthLabel} {year}{restaurant !== 'Todos' ? ` - ${restaurant}` : ''})</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
