import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Use default minifier (esbuild) which is faster and doesn't require extra deps
    sourcemap: false,
    // Prevent code splitting issues in Capacitor
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // This is critical for Capacitor apps
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
});