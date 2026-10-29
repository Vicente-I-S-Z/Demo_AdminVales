import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Manejo automático de nuevas versiones: Si se despliega una versión y el navegador solicita un chunk reemplazado, recargar limpiamente
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Nueva versión de producción detectada. Recargando...', event);
  const lastReload = sessionStorage.getItem('last_preload_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
    sessionStorage.setItem('last_preload_reload', String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
