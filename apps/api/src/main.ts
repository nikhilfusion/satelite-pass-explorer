import { existsSync } from 'node:fs';

import { loadConfig } from './config';
import { buildApp } from './http/app';
import { Database } from './infra/database';
import { ingestGeoJsonFile } from './infra/ingest/ingest';

const config = loadConfig();

// First boot convenience (Docker): build the database from the GeoJSON if it is missing.
if (!existsSync(config.DB_PATH)) {
  console.log(`No database at ${config.DB_PATH}; ingesting ${config.GEOJSON_PATH} …`);
  await ingestGeoJsonFile(config.GEOJSON_PATH, config.DB_PATH, (m) => console.log(`  ${m}`));
}

const db = await Database.open({ path: config.DB_PATH, readOnly: true });
const app = await buildApp({ db, config });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
