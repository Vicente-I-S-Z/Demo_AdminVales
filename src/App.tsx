import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import VersionUpdateBanner from './components/ui/VersionUpdateBanner';

// Reintento y recarga inteligente en caso de error de importación dinámica (nueva versión en producción)
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn('Error cargando módulo tras posible nuevo despliegue. Recargando automáticamente...', error);
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
      throw error;
    }
  });
}

// Lazy-loaded pages with automatic retry on new deployment
const Login = lazyWithRetry(() => import('./pages/Login'));
const Home = lazyWithRetry(() => import('./pages/Home'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const UserManagement = lazyWithRetry(() => import('./pages/UserManagement'));
const MonthlyClosing = lazyWithRetry(() => import('./pages/MonthlyClosing'));
const UnlockRequests = lazyWithRetry(() => import('./pages/UnlockRequests'));
const DailyCodes = lazyWithRetry(() => import('./pages/DailyCodes'));

function PageLoader() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium text-sm">Cargando módulo...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <VersionUpdateBanner />
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes — all share MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Home />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/estadisticas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UserManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/codigos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DailyCodes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cierre"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MonthlyClosing />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/solicitudes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UnlockRequests />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
