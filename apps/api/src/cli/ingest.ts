import { loadConfig } from '../config';
import { ingestGeoJsonFile } from '../infra/ingest/ingest';

const config = loadConfig();
const [geojson = config.GEOJSON_PATH, db = config.DB_PATH] = process.argv.slice(2);

console.log(`Ingesting ${geojson} -> ${db}`);
const stats = await ingestGeoJsonFile(geojson, db, (m) => console.log(`  ${m}`));
console.log(
  `Done: ${stats.features} features (${stats.skipped} skipped), ${stats.vertices} vertices, ` +
    `${stats.satellites} satellites, dataset version ${stats.version}`,
);
