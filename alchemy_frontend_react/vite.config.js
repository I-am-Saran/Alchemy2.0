import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ✅ Vite + React Router config (for local development)
export default defineConfig({
  plugins: [react()],
  base: '/', // 👈 This is crucial for correct routing in production
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward API calls to FastAPI backend during development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [], // keep empty
    }, // Build output directory
  },
  optimizeDeps: {
    include: ['react-data-table-component', 'file-saver', 'exceljs'],
  },
});