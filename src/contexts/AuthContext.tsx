import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface UserProfileData {
  id: number | string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: 'admin' | 'lider' | 'usuario';
  empresa?: string;
  habilitado: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfileData | null;
  userRole: 'admin' | 'lider' | 'usuario' | null;
  isAdmin: boolean;
  isLider: boolean;
  isAuthorized: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userProfile: null,
  userRole: null,
  isAdmin: false,
  isLider: false,
  isAuthorized: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'lider' | 'usuario' | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userEmail: string): Promise<UserProfileData | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, nombre, apellidos, rol, empresa, habilitado')
        .ilike('email', userEmail.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) return null;

      const rawRole = (data.rol || 'usuario').toLowerCase();
      const cleanRole: 'admin' | 'lider' | 'usuario' =
        rawRole === 'admin' ? 'admin' : rawRole === 'lider' ? 'lider' : 'usuario';

      return {
        ...data,
        rol: cleanRole,
      };
    } catch (err) {
      console.error('Error al obtener perfil en AuthContext:', err);
      return null;
    }
  }, []);

  const handleSessionChange = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user?.email) {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    const email = currentSession.user.email;
    const profile = await fetchProfile(email);
    const role = profile?.rol || 'usuario';

    // REGLA CRÍTICA DE SEGURIDAD (SISTEMA GDH / ADMINISTRACIÓN):
    // ÚNICAMENTE los perfiles con rol 'admin' tienen permitido ingresar a este Sistema.
    // Ningún perfil con rol 'lider' ni 'usuario' puede acceder a esta plataforma.
    if (role !== 'admin') {
      console.warn(`Acceso restringido: ${email} tiene rol '${role}'. Solo administradores pueden ingresar al Sistema GDH.`);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserRole(role);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Usuario autorizado (exclusivamente administradores)
    setSession(currentSession);
    setUser(currentSession.user);
    setUserProfile(profile);
    setUserRole(role);
    setIsAuthorized(true);
    setLoading(false);
  }, [fetchProfile]);

  useEffect(() => {
    // Get active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });

    return () => subscription.unsubscribe();
  }, [handleSessionChange]);

  const signOut = async () => {
    setSession(null);
    setUser(null);
    setUserProfile(null);
    setUserRole(null);
    setIsAuthorized(false);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user?.email) {
      const p = await fetchProfile(user.email);
      if (p) {
        if (p.rol !== 'admin') {
          await signOut();
          return;
        }
        setUserProfile(p);
        setUserRole(p.rol);
        setIsAuthorized(true);
      }
    }
  };

  const isAdmin = userRole === 'admin';
  const isLider = userRole === 'lider';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        userRole,
        isAdmin,
        isLider,
        isAuthorized,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
