import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    open: true,
    proxy: {
      '/api': {
        target: 'https://backend-production-d3da.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
      '/reason': {
        target: 'https://rlm-engine-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
      '/intelligence': {
        target: 'https://rlm-engine-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
