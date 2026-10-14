import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist', sourcemap: false },
  server: { port: 5173, proxy: { '/v1': 'http://localhost:8787' } },
  preview: { port: 4173, proxy: { '/v1': 'http://localhost:8787' } },
});
