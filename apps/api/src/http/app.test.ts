import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Database } from '../infra/database';
import { circularOrbit, equatorTrack, iso, memoryDb, segmentsFrom, T0 } from '../test/fixtures';
import { buildApp } from './app';

let app: FastifyInstance;
let db: Database;

beforeAll(async () => {
  db = await memoryDb([
    ...segmentsFrom('SAT-A', equatorTrack(-5, 1), 12),
    ...segmentsFrom('SAT-B', circularOrbit(97, 10, 0), 12),
  ]);
  app = await buildApp({
    db,
    config: { LOG_LEVEL: 'silent', CORS_ORIGIN: '', WEB_DIST: undefined, NODE_ENV: 'test' },
  });
});

afterAll(async () => {
  await app.close();
  db.close();
});

const accessUrl = (extra = '') =>
  `/api/accesses?lat=0&lon=0&radiusKm=200&from=${iso(T0)}&to=${iso(T0 + 3600)}${extra}`;

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await app.inject('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});

describe('GET /api/meta', () => {
  it('describes the dataset and satellites, with cache headers', async () => {
    const res = await app.inject('/api/meta');
    const body = res.json();
    expect(body.satellites.map((s: { id: string }) => s.id)).toEqual(['SAT-A', 'SAT-B']);
    expect(body.dataset).toMatchObject({
      version: 'test-version',
      start: iso(T0),
      sampleIntervalSeconds: 10,
    });
    expect(res.headers.etag).toContain('test-version');
    expect(res.headers['cache-control']).toContain('max-age');
  });
});

describe('GET /api/tracks', () => {
  it('returns a self-consistent columnar payload', async () => {
    const body = (await app.inject('/api/tracks?step=1')).json();
    expect(body.satellites).toEqual(['SAT-A', 'SAT-B']);
    expect(body.offsets).toHaveLength(body.count + 1);
    expect(body.sat).toHaveLength(body.count);
    expect(body.coords).toHaveLength(body.offsets.at(-1) * 2);
    expect(body.count).toBeGreaterThanOrEqual(24);
  });

  it('filters by satellite and time range', async () => {
    const body = (
      await app.inject(`/api/tracks?satellites=SAT-A&from=${iso(T0)}&to=${iso(T0 + 119)}`)
    ).json();
    expect(new Set(body.sat)).toEqual(new Set([0]));
    expect(Math.max(...body.t0)).toBeLessThanOrEqual(T0 + 119);
  });

  it('supports conditional requests', async () => {
    const first = await app.inject('/api/tracks');
    const second = await app.inject({
      url: '/api/tracks',
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(second.statusCode).toBe(304);
  });

  it('validates input', async () => {
    const res = await app.inject('/api/tracks?step=99');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect((await app.inject('/api/tracks?satellites=NOPE')).json().error.code).toBe(
      'UNKNOWN_SATELLITE',
    );
  });
});

describe('GET /api/accesses', () => {
  it('finds accesses and summarises them', async () => {
    const body = (await app.inject(accessUrl())).json();
    expect(body.summary.count).toBeGreaterThanOrEqual(1);
    expect(body.summary.bySatellite['SAT-A']).toBe(1);
    expect(body.accesses[0]).toMatchObject({ satellite: 'SAT-A' });
    expect(body.query.satellites).toEqual(['SAT-A', 'SAT-B']);
  });

  it('accepts a satellite filter', async () => {
    const body = (await app.inject(accessUrl('&satellites=SAT-B'))).json();
    expect(body.accesses.every((a: { satellite: string }) => a.satellite === 'SAT-B')).toBe(true);
  });

  it.each([
    ['missing params', '/api/accesses'],
    ['bad latitude', accessUrl().replace('lat=0', 'lat=123')],
    ['inverted window', `/api/accesses?lat=0&lon=0&radiusKm=10&from=${iso(T0 + 10)}&to=${iso(T0)}`],
    ['radius too big', accessUrl().replace('radiusKm=200', 'radiusKm=99999')],
  ])('rejects %s with a 400 envelope', async (_n, url) => {
    const res = await app.inject(url);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
