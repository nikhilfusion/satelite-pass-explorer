import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Persisted DuckDB file produced by `npm run ingest`. */
  DB_PATH: z.string().default(`${repoRoot}data/db/tracks.duckdb`),
  /** Source GeoJSON; only needed when the DB file does not exist yet. */
  GEOJSON_PATH: z.string().default(`${repoRoot}data/Altair-2P5S-tracks-1w.json`),
  /** Built frontend to serve (production single-container mode). Optional. */
  WEB_DIST: z.string().optional(),
  /** Comma separated list of allowed CORS origins; empty = CORS disabled. */
  CORS_ORIGIN: z.string().default(''),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
