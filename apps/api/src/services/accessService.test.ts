import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { haversineM } from '../domain/geodesy';
import type { Database } from '../infra/database';
import type { NormalizedSegment } from '../infra/ingest/normalize';
import { AccessRepository } from '../repositories/accessRepository';
import { TrackRepository } from '../repositories/trackRepository';
import { circularOrbit, equatorTrack, iso, memoryDb, segmentsFrom, T0 } from '../test/fixtures';
import { AccessService } from './accessService';
import { SatelliteCatalog } from './satelliteCatalog';

const KM_PER_DEG = 111.195;

async function serviceFor(segments: NormalizedSegment[]) {
  const db = await memoryDb(segments);
  const catalog = new SatelliteCatalog(await new TrackRepository(db).listSatellites());
  return { db, service: new AccessService(new AccessRepository(db), catalog) };
}

const query = (over: Record<string, unknown> = {}) => ({
  lat: 0,
  lon: 0,
  radiusKm: 100,
  from: iso(T0),
  to: iso(T0 + 3600),
  ...over,
});

describe('AccessService — analytic equator scenarios', () => {
  // 1°/min eastbound along the equator, starting at -5° → reaches lon 0 at T0 + 300 s.
  let db: Database;
  let service: AccessService;

  beforeAll(async () => {
    ({ db, service } = await serviceFor(segmentsFrom('EQ', equatorTrack(-5, 1), 10)));
  });
  afterAll(() => db.close());

  it('finds the pass and clips it exactly at the radius', async () => {
    const { accesses, summary } = await service.findAccesses(query({ radiusKm: KM_PER_DEG }));
    expect(summary.count).toBe(1);
    const [a] = accesses;
    // radius = 1° => inside for lon ∈ [-1, 1] => 120 s centred on T0 + 300
    expect(Date.parse(a!.start) / 1000).toBeCloseTo(T0 + 240, 0);
    expect(Date.parse(a!.end) / 1000).toBeCloseTo(T0 + 360, 0);
    expect(a!.durationSeconds).toBe(120);
    expect(Date.parse(a!.tca) / 1000).toBeCloseTo(T0 + 300, 0);
    expect(a!.minDistanceKm).toBeLessThan(0.5);
    expect(a!.maxElevationDeg).toBeGreaterThan(89);
    expect(a!.geometry.type).toBe('LineString');
  });

  it('detects passes that fall between two vertices (no vertex within the radius)', async () => {
    // Vertices are 10 s ≈ 18.5 km apart here; 2 km radius is far smaller than the spacing.
    const { summary, accesses } = await service.findAccesses(
      query({ lat: 0.0, lon: 0.05, radiusKm: 2 }),
    );
    expect(summary.count).toBe(1);
    expect(accesses[0]!.minDistanceKm).toBeLessThan(0.1);
  });

  it('reports the cross-track distance for an offset target', async () => {
    const { accesses } = await service.findAccesses(query({ lat: 1, lon: 0, radiusKm: 300 }));
    expect(accesses[0]!.minDistanceKm).toBeCloseTo(KM_PER_DEG, 0);
  });

  it('returns nothing when the target is out of range or the window misses the pass', async () => {
    expect((await service.findAccesses(query({ lat: 40 }))).summary.count).toBe(0);
    expect(
      (await service.findAccesses(query({ from: iso(T0 + 400), to: iso(T0 + 500) }))).summary.count,
    ).toBe(0);
  });

  it('clips passes at the requested time window', async () => {
    const { accesses } = await service.findAccesses(
      query({ radiusKm: KM_PER_DEG, from: iso(T0 + 300), to: iso(T0 + 900) }),
    );
    expect(accesses).toHaveLength(1);
    expect(accesses[0]!.start).toBe(iso(T0 + 300));
    expect(accesses[0]!.end).toBe(iso(T0 + 360));
  });

  it('rejects unknown satellites with a client error', async () => {
    await expect(service.findAccesses(query({ satellites: ['NOPE'] }))).rejects.toMatchObject({
      statusCode: 400,
      code: 'UNKNOWN_SATELLITE',
    });
  });
});

describe('AccessService — antimeridian', () => {
  let db: Database;
  let service: AccessService;

  beforeAll(async () => {
    // crosses 180° after 5 minutes
    ({ db, service } = await serviceFor(segmentsFrom('AM', equatorTrack(175, 1), 10)));
  });
  afterAll(() => db.close());

  it.each([
    ['east side of the line', 179.5],
    ['west side of the line', -179.5],
    ['exactly on the line', 180],
  ])('finds a single pass for a target %s and splits its geometry', async (_n, lon) => {
    const { accesses } = await service.findAccesses(query({ lon, radiusKm: 200 }));
    expect(accesses).toHaveLength(1);
    expect(accesses[0]!.geometry.type).toBe('MultiLineString');
  });
});

describe('AccessService — merges multiple satellites, honours the satellite filter', () => {
  let db: Database;
  let service: AccessService;

  beforeAll(async () => {
    ({ db, service } = await serviceFor([
      ...segmentsFrom('A', equatorTrack(-5, 1), 10),
      ...segmentsFrom('B', equatorTrack(-10, 2), 10),
    ]));
  });
  afterAll(() => db.close());

  it('returns both, sorted chronologically', async () => {
    const r = await service.findAccesses(query({ radiusKm: 150 }));
    // Both reach lon 0 at T0+300 s, but the slower sat A enters the 150 km disc earlier (219 s vs 260 s).
    expect(r.accesses.map((a) => a.satellite)).toEqual(['A', 'B']);
    expect(r.summary.bySatellite).toEqual({ A: 1, B: 1 });
  });

  it('filters by satellite', async () => {
    const r = await service.findAccesses(query({ radiusKm: 150, satellites: ['A'] }));
    expect(r.accesses.map((a) => a.satellite)).toEqual(['A']);
    expect(r.query.satellites).toEqual(['A']);
  });
});

/**
 * Differential test: the SQL (closed-form edge ∩ disc) must agree with a brute-force
 * dense-sampling oracle on randomised orbits and ground targets, including high latitudes.
 */
describe('AccessService — agrees with a brute-force oracle', () => {
  const orbits = [
    { name: 'O1', inc: 97.4, raan: 20, phase: 0 },
    { name: 'O2', inc: 53, raan: 140, phase: 120 },
    { name: 'O3', inc: 85, raan: 260, phase: 240 },
  ];
  const minutes = 6 * 60;
  let db: Database;
  let service: AccessService;
  const trajectories = new Map<string, NormalizedSegment[]>();

  beforeAll(async () => {
    const all: NormalizedSegment[] = [];
    for (const o of orbits) {
      const segs = segmentsFrom(o.name, circularOrbit(o.inc, o.raan, o.phase), minutes);
      trajectories.set(o.name, segs);
      all.push(...segs);
    }
    ({ db, service } = await serviceFor(all));
  });
  afterAll(() => db.close());

  function oracle(sat: string, lat: number, lon: number, radiusKm: number) {
    let inside = 0;
    let passes = 0;
    let prevInside = false;
    const dt = 0.05; // s
    for (const seg of trajectories.get(sat)!) {
      const n = seg.vertices.length - 1;
      for (let e = 0; e < n; e += 1) {
        const a = seg.vertices[e]!;
        const b = seg.vertices[e + 1]!;
        const steps = Math.round(10 / dt);
        for (let s = 0; s < steps; s += 1) {
          const f = s / steps;
          let dLon = b[0] - a[0];
          if (dLon > 180) dLon -= 360;
          if (dLon < -180) dLon += 360;
          const d = haversineM(a[0] + dLon * f, a[1] + (b[1] - a[1]) * f, lon, lat) / 1000;
          const isIn = d <= radiusKm;
          if (isIn) inside += dt;
          if (isIn && !prevInside) passes += 1;
          prevInside = isIn;
        }
      }
    }
    return { inside, passes };
  }

  const targets = [
    { lat: 25.2, lon: 55.3, radiusKm: 1500 },
    { lat: 78, lon: 15, radiusKm: 900 },
    { lat: -33.9, lon: 151.2, radiusKm: 2000 },
    { lat: 0, lon: 179.7, radiusKm: 1200 },
    { lat: -88, lon: 0, radiusKm: 700 },
  ];

  it.each(targets)('matches for target %o', async ({ lat, lon, radiusKm }) => {
    const res = await service.findAccesses(
      query({ lat, lon, radiusKm, to: iso(T0 + minutes * 60) }),
    );
    for (const o of orbits) {
      const expected = oracle(o.name, lat, lon, radiusKm);
      const mine = res.accesses.filter((a) => a.satellite === o.name);
      const sqlInside = mine.reduce(
        (s, a) => s + (Date.parse(a.end) - Date.parse(a.start)) / 1000,
        0,
      );
      // ±1 s per boundary (ISO rounding) and ±0.05 s oracle sampling
      expect(mine.length, `${o.name} pass count`).toBe(expected.passes);
      expect(Math.abs(sqlInside - expected.inside), `${o.name} seconds inside`).toBeLessThanOrEqual(
        2 * mine.length + 1,
      );
    }
  });
});
