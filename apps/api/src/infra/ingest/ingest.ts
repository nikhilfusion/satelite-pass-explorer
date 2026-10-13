import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';

import { Database } from '../database';
import { BUILD_MODEL, CREATE_STAGE } from '../schema';
import { InvalidFeatureError, type NormalizedSegment, normalizeFeature } from './normalize';

export interface IngestStats {
  features: number;
  skipped: number;
  vertices: number;
  satellites: number;
  version: string;
}

/**
 * Loads normalised segments into an (empty) database and derives the query model.
 * Kept free of file IO so tests can feed synthetic data into `:memory:`.
 */
export async function loadSegments(
  db: Database,
  segments: Iterable<NormalizedSegment>,
  sourceVersion: string,
): Promise<{ vertices: number; features: number }> {
  await db.exec(CREATE_STAGE);

  let vertices = 0;
  let features = 0;
  await db.withConnection(async (conn) => {
    const appender = await conn.createAppender('stage');
    for (const seg of segments) {
      features += 1;
      const n = seg.vertices.length;
      seg.vertices.forEach(([lon, lat, alt], i) => {
        appender.appendVarchar(seg.satellite);
        appender.appendDouble(seg.t0);
        appender.appendDouble(seg.t1);
        appender.appendInteger(i);
        appender.appendInteger(n);
        appender.appendDouble(lon);
        appender.appendDouble(lat);
        appender.appendDouble(alt);
        appender.endRow();
        vertices += 1;
      });
    }
    appender.flushSync();
    appender.closeSync();
  });

  await db.exec(BUILD_MODEL);
  await db.exec(`
    CREATE OR REPLACE TABLE meta AS
    SELECT 'version' AS key, '${sourceVersion.replace(/'/g, '')}' AS value
    UNION ALL SELECT 'start', CAST(min(t_start) AS VARCHAR) FROM satellites
    UNION ALL SELECT 'end', CAST(max(t_end) AS VARCHAR) FROM satellites
    UNION ALL SELECT 'segments', CAST(count(*) AS VARCHAR) FROM segments
    UNION ALL SELECT 'sample_interval', CAST(median(tb - ta) AS VARCHAR) FROM edges;
  `);
  return { vertices, features };
}

function* normalizeAll(
  features: unknown[],
  onSkip: (err: InvalidFeatureError, index: number) => void,
): Generator<NormalizedSegment> {
  for (const [index, raw] of features.entries()) {
    try {
      yield normalizeFeature(raw);
    } catch (err) {
      if (err instanceof InvalidFeatureError) onSkip(err, index);
      else throw err;
    }
  }
}

/**
 * File → DuckDB. Builds into `<db>.tmp` and renames atomically so a crash mid-ingest
 * can never leave a half-written database behind.
 */
export async function ingestGeoJsonFile(
  geojsonPath: string,
  dbPath: string,
  log: (msg: string) => void = () => undefined,
): Promise<IngestStats> {
  if (!existsSync(geojsonPath)) throw new Error(`GeoJSON source not found: ${geojsonPath}`);

  const started = Date.now();
  const buffer = readFileSync(geojsonPath);
  const version = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const collection = JSON.parse(buffer.toString('utf8')) as { features?: unknown[] };
  if (!Array.isArray(collection.features)) throw new Error('Not a GeoJSON FeatureCollection');
  log(`parsed ${collection.features.length} features in ${Date.now() - started} ms`);

  const tmpPath = `${dbPath}.tmp`;
  for (const p of [tmpPath, `${tmpPath}.wal`]) rmSync(p, { force: true });

  const db = await Database.open({ path: tmpPath });
  let skipped = 0;
  try {
    const { vertices, features } = await loadSegments(
      db,
      normalizeAll(collection.features, (err, index) => {
        skipped += 1;
        log(`skipped feature #${index}: ${err.message}`);
      }),
      version,
    );
    await db.exec('CHECKPOINT');
    const [row] = await db.all<{ n: bigint }>('SELECT count(*) AS n FROM satellites');
    db.close();

    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}.wal`, { force: true });
    renameSync(tmpPath, dbPath);
    log(`ingest finished in ${Date.now() - started} ms`);
    return { features, skipped, vertices, satellites: Number(row?.n ?? 0), version };
  } catch (err) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    rmSync(tmpPath, { force: true });
    throw err;
  }
}
