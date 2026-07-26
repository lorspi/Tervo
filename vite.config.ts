import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const APP_VERSION = readFileSync('public/version.txt', 'utf-8').trim();

export default defineConfig(() => ({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('zustand')) return 'vendor-zustand';
          }
        },
      },
    },
  },
  server: {
    host: '::',
    port: 8080,
    allowedHosts: ["test.lorspi.com"],
  },
}));
