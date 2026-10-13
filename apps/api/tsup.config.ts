import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { main: 'src/main.ts', ingest: 'src/cli/ingest.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Inline the workspace contract; keep real npm deps external (native DuckDB bindings!).
  noExternal: ['@sat/contract'],
  tsconfig: 'tsconfig.json',
});
