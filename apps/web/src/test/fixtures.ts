import type { Access, AccessesResponse, MetaResponse, TracksResponse } from '@sat/contract';

export const T0 = Date.parse('2027-03-01T00:00:00Z') / 1000;
export const iso = (t: number) => new Date(t * 1000).toISOString().replace('.000Z', 'Z');

export const meta: MetaResponse = {
  dataset: {
    version: 'v1',
    start: iso(T0),
    end: iso(T0 + 3 * 86400),
    segmentCount: 100,
    sampleIntervalSeconds: 10,
  },
  satellites: ['SAT-A', 'SAT-B', 'SAT-C'].map((id, i) => ({
    id,
    segmentCount: 10,
    start: iso(T0),
    end: iso(T0 + 3 * 86400),
    minAltitudeKm: 500 + i,
    maxAltitudeKm: 510 + i,
  })),
};

export const tracks: TracksResponse = {
  satellites: ['SAT-A', 'SAT-B', 'SAT-C'],
  step: 3,
  count: 2,
  sat: [0, 1],
  t0: [T0, T0],
  t1: [T0 + 60, T0 + 60],
  offsets: [0, 2, 4],
  coords: [0, 0, 1, 1, 10, 10, 11, 11],
};

export const makeAccess = (over: Partial<Access> & { id: string }): Access => ({
  satellite: over.id.split('-').slice(0, 2).join('-'),
  start: iso(T0 + 3600),
  end: iso(T0 + 3720),
  durationSeconds: 120,
  tca: iso(T0 + 3660),
  minDistanceKm: 100,
  maxElevationDeg: 60,
  slantRangeKm: 600,
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0, 500],
      [1, 1, 500],
    ],
  },
  ...over,
});

export const accesses: Access[] = [
  makeAccess({ id: 'SAT-A-1', start: iso(T0 + 3600), end: iso(T0 + 3720), maxElevationDeg: 80 }),
  makeAccess({
    id: 'SAT-B-1',
    satellite: 'SAT-B',
    start: iso(T0 + 7200),
    end: iso(T0 + 7260),
    durationSeconds: 60,
    maxElevationDeg: 30,
    minDistanceKm: 400,
  }),
  makeAccess({
    id: 'SAT-A-2',
    start: iso(T0 + 86400 + 100),
    end: iso(T0 + 86400 + 200),
    durationSeconds: 100,
  }),
];

export const accessesResponse = (list: Access[] = accesses): AccessesResponse => ({
  query: {
    lat: 25,
    lon: 55,
    radiusKm: 500,
    from: iso(T0),
    to: iso(T0 + 3 * 86400),
    satellites: ['SAT-A', 'SAT-B', 'SAT-C'],
  },
  summary: {
    count: list.length,
    bySatellite: list.reduce<Record<string, number>>((m, a) => {
      m[a.satellite] = (m[a.satellite] ?? 0) + 1;
      return m;
    }, {}),
    totalDurationSeconds: list.reduce((s, a) => s + a.durationSeconds, 0),
    tookMs: 12,
  },
  accesses: list,
});

export const colors = { 'SAT-A': '#ff0000', 'SAT-B': '#00ff00', 'SAT-C': '#0000ff' };
