import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/frontend',
  build: { outDir: '../../dist/frontend', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
