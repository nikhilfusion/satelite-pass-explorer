import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from './config';
import { buildApp } from './http/app';
import { Database } from './infra/database';

/**
 * Smoke/regression tests against the real week-long dataset. They only run when the database has
 * been built (`npm run ingest`) — CI does that first — and are skipped on a fresh checkout.
 */
const { DB_PATH } = loadConfig({});

describe.skipIf(!existsSync(DB_PATH))('real dataset', () => {
  let db: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    db = await Database.open({ path: DB_PATH, readOnly: true });
    app = await buildApp({
      db,
      config: { LOG_LEVEL: 'silent', CORS_ORIGIN: '', WEB_DIST: undefined, NODE_ENV: 'test' },
    });
  });
  afterAll(async () => {
    await app.close();
    db.close();
  });

  it('contains 10 satellites × 10 081 one-minute segments over one week', async () => {
    const { dataset, satellites } = (await app.inject('/api/meta')).json();
    expect(satellites).toHaveLength(10);
    expect(satellites.every((s: { segmentCount: number }) => s.segmentCount === 10_081)).toBe(true);
    expect(dataset).toMatchObject({
      segmentCount: 100_810,
      start: '2027-03-01T00:00:00Z',
      end: '2027-03-08T00:01:00Z',
      sampleIntervalSeconds: 10,
    });
  });

  it('serves an antimeridian-safe overview (no polyline spans more than 180° of longitude)', async () => {
    const t = (await app.inject('/api/tracks')).json();
    expect(t.count).toBeGreaterThan(100_000);
    let widest = 0;
    for (let i = 0; i < t.count; i += 1) {
      for (let v = t.offsets[i] + 1; v < t.offsets[i + 1]; v += 1) {
        widest = Math.max(widest, Math.abs(t.coords[2 * v] - t.coords[2 * (v - 1)]));
      }
    }
    expect(widest).toBeLessThan(180);
  });

  it('finds the first-day passes over Dubai and answers quickly', async () => {
    const res = await app.inject(
      '/api/accesses?lat=25.2048&lon=55.2708&radiusKm=500&from=2027-03-01T00:00:00Z&to=2027-03-02T00:00:00Z',
    );
    const body = res.json();
    const sats = body.accesses.map(
      (a: { satellite: string; tca: string }) => `${a.satellite}@${a.tca.slice(11, 16)}`,
    );
    expect(sats).toEqual(expect.arrayContaining(['YAM20@06:58', 'YAM24@07:19', 'YAM25@10:07']));
    expect(body.summary.tookMs).toBeLessThan(1500);
  });
});
