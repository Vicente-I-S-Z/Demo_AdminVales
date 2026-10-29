import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';

type AuthMode = 'login' | 'forgot' | 'reset';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Detectar si el usuario llegó con enlace de recuperación de contraseña de Supabase
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
      setMode('reset');
    }

    // Detectar si el usuario llegó con parámetro de acceso denegado por rol no-admin
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unauthorized') {
      setError('Acceso denegado: Este sistema de GDH y Administración está reservado exclusivamente para perfiles de Administrador. Los líderes y usuarios pueden seguir operando en la generación de QR para almorzar, pero no en este sistema.');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;

      // ─── VALIDAR PERMISOS ADMINISTRATIVOS POR ROL ─────────────
      // Exclusivo para usuarios con rol de Administrador ('admin')
      // Los líderes y usuarios estándar operan únicamente en la app móvil.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email, rol, habilitado')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const userRole = (profile?.rol || 'usuario').toLowerCase();

      if (userRole !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('ACCESO_DENEGADO_ROL_NO_ADMIN');
      }

      navigate('/');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg === 'ACCESO_DENEGADO_ROL_NO_ADMIN' || msg === 'ACCESO_DENEGADO_ROL_USUARIO') {
        setError(
          'Acceso denegado: Este sistema de GDH y Administración está reservado exclusivamente para perfiles de Administrador. Los líderes de equipo y usuarios normales pueden seguir operando con normalidad en la generación de códigos QR para almorzar, pero no tienen acceso a esta plataforma.'
        );
      } else if (msg.includes('Invalid login credentials')) {
        setError('Correo electrónico o contraseña incorrectos. Por favor verifica tus datos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Tu correo no ha sido confirmado aún. Por favor revisa tu bandeja de entrada o spam para confirmar tu cuenta.');
      } else if (msg.includes('Too many requests') || msg.includes('rate limit')) {
        setError('Demasiados intentos fallidos. Por seguridad, espera unos momentos antes de volver a intentar.');
      } else {
        setError(msg || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // MODO DEMO: la recuperación de contraseña por correo está desactivada.
    setMessage(
      'Modo demo: la recuperación de contraseña por correo está desactivada. Ingresa con las credenciales de prueba entregadas.'
    );
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage('¡Tu contraseña se ha actualizado exitosamente! Entrando al sistema...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-5 sm:p-8">
        
        {/* Header Icon */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center shadow-md">
            {mode === 'login' && <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
            {mode === 'forgot' && <Mail className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
            {mode === 'reset' && <KeyRound className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
          </div>
        </div>

        {/* Titles */}
        {mode === 'login' && (
          <>
            <h1 className="text-xl sm:text-2xl font-bold text-primary text-center mb-1.5 sm:mb-2">Sistema de Administración</h1>
            <p className="text-gray-500 text-center mb-6 sm:mb-8 text-xs sm:text-sm">Inicia sesión en tu cuenta</p>
          </>
        )}
        {mode === 'forgot' && (
          <>
            <h1 className="text-xl sm:text-2xl font-bold text-primary text-center mb-1.5 sm:mb-2">Recuperar Contraseña</h1>
            <p className="text-gray-500 text-center mb-6 sm:mb-8 text-xs sm:text-sm">
              Ingresa tu correo para recibir las instrucciones de restablecimiento
            </p>
          </>
        )}
        {mode === 'reset' && (
          <>
            <h1 className="text-2xl font-bold text-primary text-center mb-2">Nueva Contraseña</h1>
            <p className="text-gray-500 text-center mb-8 text-sm">Crea una nueva contraseña para tu cuenta</p>
          </>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-danger p-4 rounded-md mb-6 flex items-start gap-2 text-sm border border-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {message && (
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-md mb-6 flex items-start gap-2 text-sm border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            <p>{message}</p>
          </div>
        )}

        {/* ─── FORM: INICIAR SESIÓN ─── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-text">Contraseña</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
                  className="text-xs text-secondary hover:underline font-semibold cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-white font-bold py-2.5 px-4 rounded-md hover:bg-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-sm cursor-pointer"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {/* ─── FORM: RECUPERAR CONTRASEÑA ─── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Correo Electrónico Registrado</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-white font-bold py-2.5 px-4 rounded-md hover:bg-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-sm cursor-pointer"
            >
              {loading ? 'Enviando enlace...' : 'Enviar Enlace de Recuperación'}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                className="text-sm text-gray-600 hover:text-primary font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Volver a Iniciar Sesión
              </button>
            </div>
          </form>
        )}

        {/* ─── FORM: NUEVA CONTRASEÑA (RESET TRAS ENLACE) ─── */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Nueva Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-1">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-white font-bold py-2.5 px-4 rounded-md hover:bg-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-sm cursor-pointer"
            >
              {loading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
            </button>
          </form>
        )}

        {/* Footer Note */}
        {mode === 'login' && (
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Acceso exclusivo para personal autorizado por GDH.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
