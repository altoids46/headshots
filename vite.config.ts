import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4174
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});