import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, userRole, loading, isAuthorized } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-600">Verificando credenciales y permisos...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // REGLA ESTRICTA: Solo perfiles con rol 'admin' pueden ingresar a las vistas protegidas del Sistema GDH.
  // Cualquier usuario o líder es redirigido a login con aviso de denegación.
  if (!isAuthorized || userRole !== 'admin') {
    return <Navigate to="/login?error=unauthorized" replace />;
  }

  return <>{children}</>;
}
