import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// lab.html is a dev-only model/material viewer used by tools/shot.mjs; it is
// served by `vite dev` but deliberately left out of the production build.
export default defineConfig({
  plugins: [react()],
  server: { port: 5183, strictPort: false, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});