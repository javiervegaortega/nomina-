import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['exceljs']
  },
  build: {
    // Vite 8 / Rolldown espera manualChunks como función
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx') || id.includes('exceljs')) {
            return 'vendor-export';
          }
          if (id.includes('@chakra-ui') || id.includes('@emotion') || id.includes('framer-motion')) {
            return 'vendor-chakra';
          }
          if (id.includes('react-router') || id.includes('/react/') || id.includes('\\react\\') || id.includes('react-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
