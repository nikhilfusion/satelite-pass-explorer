import { Database } from '../infra/database';
import { loadSegments } from '../infra/ingest/ingest';
import type { NormalizedSegment } from '../infra/ingest/normalize';

export const T0 = Date.parse('2027-03-01T00:00:00Z') / 1000;
export const iso = (epoch: number) => new Date(epoch * 1000).toISOString().replace('.000Z', 'Z');

type Position = (tSeconds: number) => [lon: number, lat: number, alt: number];

/** Builds 1-minute, 7-vertex segments (like the real data set) from a continuous trajectory. */
export function segmentsFrom(
  satellite: string,
  position: Position,
  minutes: number,
  start = T0,
): NormalizedSegment[] {
  const out: NormalizedSegment[] = [];
  for (let m = 0; m < minutes; m += 1) {
    const t0 = start + m * 60;
    out.push({
      satellite,
      t0,
      t1: t0 + 60,
      vertices: Array.from({ length: 7 }, (_, k) => position(t0 + k * 10)),
    });
  }
  return out;
}

/** Eastbound ground track on the equator at `degPerMin`, starting at `lon0` at T0. */
export const equatorTrack =
  (lon0: number, degPerMin: number, alt = 500): Position =>
  (t) => {
    const lon = lon0 + ((t - T0) / 60) * degPerMin;
    return [((((lon + 180) % 360) + 360) % 360) - 180, 0, alt];
  };

/** Circular great-circle orbit (no Earth rotation) — enough to exercise arbitrary geometry. */
export function circularOrbit(
  inclinationDeg: number,
  raanDeg: number,
  phaseDeg: number,
  periodMin = 95,
): Position {
  const inc = (inclinationDeg * Math.PI) / 180;
  const raan = (raanDeg * Math.PI) / 180;
  return (t) => {
    const u = (phaseDeg * Math.PI) / 180 + (2 * Math.PI * (t - T0)) / (periodMin * 60);
    const x = Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(inc);
    const y = Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(inc);
    const z = Math.sin(u) * Math.sin(inc);
    return [(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(z) * 180) / Math.PI, 500];
  };
}

export async function memoryDb(segments: NormalizedSegment[]): Promise<Database> {
  const db = await Database.open({ path: ':memory:' });
  await loadSegments(db, segments, 'test-version');
  return db;
}
