import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const currentBuildTime = Date.now();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-version-file',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(
            {
              buildTime: currentBuildTime,
              buildDate: new Date(currentBuildTime).toISOString(),
            },
            null,
            2
          ),
        });
      },
    },
  ],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(currentBuildTime),
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/exceljs')) return 'vendor-excel';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})
