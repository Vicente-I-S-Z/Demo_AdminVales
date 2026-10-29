import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Loader2,
  Search,
  Clock,
  RefreshCw,
  FileQuestion,
  Wrench,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { createSupportTicket, lookupTickets } from '../../services/support.service';
import type { TicketCategoria, TicketPrioridad, SupportTicket } from '../../types';

export default function SupportWidget() {
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'lookup'>('create');
  const [loading, setLoading] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [categoria, setCategoria] = useState<TicketCategoria>('vales_bloqueos');
  const [prioridad, setPrioridad] = useState<TicketPrioridad>('media');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<{ base64: string; mime: string; nombre: string; size: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setArchivo(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('El archivo seleccionado supera el límite de 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [header, base64] = dataUrl.split(',') || [];
      const mime = header?.match(/:(.*?);/)?.[1] || file.type || 'application/octet-stream';
      setArchivo({ base64, mime, nombre: file.name, size: file.size });
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Lookup State
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SupportTicket[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const userName = userProfile?.nombre 
    ? `${userProfile.nombre} ${userProfile.apellidos || ''}`.trim()
    : user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Usuario';
  const userEmail = userProfile?.email || user?.email || '';

  useEffect(() => {
    if (userEmail && !searchTerm) {
      setSearchTerm(userEmail);
    }
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { ticket } = await createSupportTicket({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
        prioridad,
        reportado_por: userEmail,
        reportado_por_nombre: userName,
        sistema_origen: 'vales_admin',
        contexto_operativo: archivo ? {
          tiene_adjunto: true,
          adjunto_nombre: archivo.nombre,
          adjunto_mime: archivo.mime,
          adjunto_size: archivo.size,
          adjunto_data: archivo.base64,
        } : null
      });

      setSuccessCode(ticket.ticket_code);
      setTitulo('');
      setDescripcion('');
      setArchivo(null);
    } catch (err: any) {
      console.error('Error creando ticket desde widget:', err);
      setErrorMsg(err?.message || 'No se pudo enviar el ticket. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setErrorMsg(null);

    try {
      const results = await lookupTickets(searchTerm);
      setSearchResults(results);
      setHasSearched(true);
    } catch (err: any) {
      console.error('Error buscando tickets:', err);
      setErrorMsg('No se pudo consultar el estado. Revisa tu conexión.');
    } finally {
      setSearching(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSuccessCode(null);
    setErrorMsg(null);
  };

  return (
    <>
      {/* Floating Trigger Button (estilo corporativo) */}
      {/* En celular y tablet el botón se ubica sobre el menú inferior y solo muestra el ícono,
          para no tapar los íconos del Dock (ver .support-fab en index.css). */}
      <div className="support-fab fixed right-3 sm:right-5 lg:right-6 z-[9999] pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Soporte TI"
          className="flex items-center justify-center gap-2.5 w-12 h-12 lg:w-auto lg:h-auto p-0 lg:px-4 lg:py-2.5 rounded-full bg-[#0033ab] hover:bg-[#002685] text-white shadow-lg shadow-blue-900/25 border border-blue-600/40 group transition-all cursor-pointer hover:scale-105 active:scale-95 select-none"
          title="¿Necesitas soporte técnico o consultar un ticket?"
        >
          <div className="w-7 h-7 lg:w-6 lg:h-6 rounded-full bg-white/15 text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-300">
            <LifeBuoy className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-white" />
          </div>
          <span className="hidden lg:inline text-xs font-bold tracking-wide pr-0.5">Soporte TI</span>
        </button>
      </div>

      {/* Support Modal (tema claro corporativo) */}
      <AnimatePresence>
        {isOpen && (
          <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs pointer-events-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-[#0033ab] flex items-center justify-center font-bold">
                      <LifeBuoy className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                        Mesa de Ayuda TI
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Portal Admin Vales &bull; Empresa Alpha & Empresa Beta
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Segmented Control Tabs */}
                <div className="flex bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('create'); setSuccessCode(null); }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'create'
                        ? 'bg-white text-[#0033ab] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Nuevo Reporte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setActiveTab('lookup'); 
                      setSuccessCode(null);
                      if (searchTerm && !hasSearched) handleLookup();
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'lookup'
                        ? 'bg-white text-[#0033ab] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Consultar Estado</span>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs text-slate-800">
                {activeTab === 'create' ? (
                  successCode ? (
                    <div className="py-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">¡Incidencia Registrada!</h3>
                      <p className="text-slate-600 text-xs max-w-sm mx-auto">
                        Tu requerimiento fue recibido por el equipo técnico de TI.
                      </p>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-w-xs mx-auto space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Código de Seguimiento:</span>
                        <div className="font-mono text-[#0033ab] font-extrabold text-base">
                          {successCode}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Modo demo: el ticket quedó registrado, pero no se envían correos de confirmación.
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSearchTerm(successCode);
                            setActiveTab('lookup');
                            setSuccessCode(null);
                            lookupTickets(successCode).then(res => {
                              setSearchResults(res);
                              setHasSearched(true);
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#0033ab] hover:bg-[#002685] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Ver Estado del Ticket
                        </button>
                        <button
                          onClick={handleClose}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      {/* Área / Categoría */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Área del Problema:
                        </label>
                        <select
                          value={categoria}
                          onChange={(e) => setCategoria(e.target.value as TicketCategoria)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-[#0033ab] focus:ring-2 focus:ring-[#0033ab]/10"
                        >
                          <option value="vales_bloqueos">Vales y Bloqueos de Calendario</option>
                          <option value="codigos_qr">Códigos Diarios y Códigos QR</option>
                          <option value="cierre_mensual">Cierre Mensual y GDH</option>
                          <option value="autenticacion">Acceso / Clave / Usuarios</option>
                          <option value="interfaz_usuario">Lentitud / Error Visual</option>
                          <option value="otro">Otro inconveniente</option>
                        </select>
                      </div>

                      {/* Urgencia / Prioridad */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nivel de Urgencia / Prioridad:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrioridad('baja')}
                            className={`py-1.5 px-2 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                              prioridad === 'baja'
                                ? 'bg-slate-200 border-slate-400 text-slate-800'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            ⚪ Baja
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrioridad('media')}
                            className={`py-1.5 px-2 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                              prioridad === 'media'
                                ? 'bg-blue-100 border-blue-400 text-blue-900 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            🔵 Media
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrioridad('alta')}
                            className={`py-1.5 px-2 rounded-xl border text-center text-xs font-semibold transition cursor-pointer ${
                              prioridad === 'alta'
                                ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            🟠 Alta
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrioridad('critica')}
                            className={`py-1.5 px-2 rounded-xl border text-center text-xs font-bold transition cursor-pointer ${
                              prioridad === 'critica'
                                ? 'bg-rose-100 border-rose-400 text-rose-900 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            🔴 Crítica
                          </button>
                        </div>
                      </div>

                      {/* Título */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Título Breve:
                        </label>
                        <input
                          type="text"
                          required
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                          placeholder="Ej: Bloqueo de calendario no aplica para el casino turno noche"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0033ab] focus:ring-2 focus:ring-[#0033ab]/10"
                        />
                      </div>

                      {/* Descripción */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Descripción de lo Ocurrido:
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={descripcion}
                          onChange={(e) => setDescripcion(e.target.value)}
                          placeholder="Explica qué acción estabas realizando, qué mensaje apareció..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0033ab] focus:ring-2 focus:ring-[#0033ab]/10"
                        />
                      </div>

                      {/* Adjuntar Archivo / Evidencia */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Evidencia o Archivo Adjunto (captura, Excel, etc.):
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition">
                            <Paperclip className="w-3.5 h-3.5 text-[#0033ab]" />
                            <span>Elegir archivo</span>
                            <input
                              type="file"
                              accept="image/*,.xlsx,.xls,.csv,.pdf,.docx,.doc,.txt"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </label>
                          <span className="text-[11px] text-slate-500 truncate max-w-xs">
                            {archivo ? `📎 ${archivo.nombre}` : 'Sin archivo adjunto (máx 10MB)'}
                          </span>
                        </div>
                      </div>

                      {/* Metadatos de Usuario */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Reportando como: <strong className="text-slate-800">{userName}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono break-all">{userEmail}</span>
                      </div>

                      {/* Submit */}
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-1.5 rounded-xl bg-[#0033ab] hover:bg-[#002685] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Enviar Ticket</span>
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  /* ─── PESTAÑA: CONSULTAR ESTADO ─── */
                  <div className="space-y-4">
                    <form onSubmit={handleLookup} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Ingresa código (TK-2026-...) o tu correo..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0033ab] focus:ring-2 focus:ring-[#0033ab]/10"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                      <button
                        type="submit"
                        disabled={searching || !searchTerm.trim()}
                        className="px-3.5 py-2 rounded-xl bg-[#0033ab] hover:bg-[#002685] text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Consultar</span>
                      </button>
                    </form>

                    {searching && (
                      <div className="py-8 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0033ab]" />
                        <p className="text-xs">Buscando incidencias registradas...</p>
                      </div>
                    )}

                    {!searching && hasSearched && searchResults.length === 0 && (
                      <div className="py-8 text-center text-slate-500 space-y-1.5">
                        <FileQuestion className="w-8 h-8 mx-auto text-slate-400" />
                        <p className="text-xs font-bold text-slate-700">No se encontraron tickets</p>
                        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                          Verifica que el código (ej: <strong>TK-2026-XXXX</strong>) o tu correo estén bien escritos.
                        </p>
                      </div>
                    )}

                    {!searching && searchResults.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Resultados encontrados: <strong className="text-slate-800">{searchResults.length}</strong></span>
                        </div>

                        <div className="space-y-2.5 max-h-[55dvh] overflow-y-auto pr-1">
                          {searchResults.map((t) => {
                            const isResolved = t.estado === 'resuelto';
                            const isReviewing = t.estado === 'en_revision';

                            return (
                              <div 
                                key={t.ticket_code}
                                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-bold text-[#0033ab] text-xs">
                                    {t.ticket_code}
                                  </span>
                                  
                                  {/* Badge de Estado */}
                                  {isResolved ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Resuelto
                                    </span>
                                  ) : isReviewing ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> En Revisión TI
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Abierto
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="font-bold text-slate-900 text-xs">{t.titulo}</h4>
                                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{t.descripcion}</p>
                                </div>

                                {Boolean(t.contexto_operativo?.tiene_adjunto && (t.contexto_operativo?.adjunto_data || t.contexto_operativo?.adjunto_nombre)) && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-[#0033ab] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">
                                    <span>📎 Archivo adjunto:</span>
                                    <strong className="truncate max-w-[200px]">{t.contexto_operativo?.adjunto_nombre || 'Adjunto'}</strong>
                                  </div>
                                )}

                                {/* Solución y Diagnóstico de TI */}
                                {t.solucion ? (
                                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                                      <Wrench className="w-3.5 h-3.5" />
                                      <span>Diagnóstico y Solución TI:</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-800/90 whitespace-pre-wrap leading-relaxed">
                                      {t.solucion}
                                    </div>
                                    <div className="text-[10px] text-emerald-700 pt-1 border-t border-emerald-200 flex items-center justify-between">
                                      <span>Atendido por: <strong>{t.resuelto_por || 'Soporte TI'}</strong></span>
                                      {t.fecha_resolucion && (
                                        <span>{new Date(t.fecha_resolucion).toLocaleDateString('es-CL')}</span>
                                      )}
                                    </div>
                                  </div>
                                ) : isReviewing ? (
                                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px]">
                                    👨‍💻 Un especialista de TI está trabajando en este ticket.
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px]">
                                    ⏳ Tu ticket está en cola para ser atendido por TI.
                                  </div>
                                )}

                                <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                                  <span>Fecha: {new Date(t.created_at).toLocaleString('es-CL')}</span>
                                  <span className="capitalize">Prioridad: <strong>{t.prioridad}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
