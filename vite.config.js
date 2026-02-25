import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      // Capacitor plugins that are only available at runtime on native builds
      // must be externalised so Vite doesn't try to bundle them for the web.
      external: ['@capacitor/local-notifications'],
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Required for Capacitor apps
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
});
// cache bust
