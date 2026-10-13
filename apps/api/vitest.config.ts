import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@sat/contract': fileURLToPath(
        new URL('../../packages/contract/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
