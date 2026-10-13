import { defineConfig } from 'vitest/config';

// Root runner: executes every workspace's own vitest config (api = node, web = jsdom).
export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web', 'packages/contract'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'html'],
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/test-setup.ts',
        '**/*.d.ts',
        // Thin entrypoints / WebGL & MapLibre glue: covered by the Playwright e2e suite instead.
        'apps/api/src/main.ts',
        'apps/api/src/cli/**',
        'apps/web/src/main.tsx',
        'apps/web/src/map/**',
      ],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
    },
  },
});
