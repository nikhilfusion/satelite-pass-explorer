import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sat/contract': src('../../packages/contract/src/index.ts'),
      '@': src('./src'),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1200, // maplibre-gl alone is ~800 kB
    rollupOptions: {
      output: { manualChunks: { maplibre: ['maplibre-gl'], react: ['react', 'react-dom'] } },
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
