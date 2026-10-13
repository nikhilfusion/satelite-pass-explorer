import { describe, expect, it } from 'vitest';

import { buildAccess, type CandidateEdge, groupContiguous } from './accesses';

const edge = (over: Partial<CandidateEdge> & { ta: number }): CandidateEdge => ({
  satelliteId: 0,
  tb: over.ta + 10,
  v1: [0, 0, 500],
  v2: [0.1, 0, 500],
  lo: 0,
  hi: 1,
  tca: 0.5,
  distM: 50_000,
  ...over,
});

describe('groupContiguous', () => {
  it('merges edges that share a vertex and are not clipped', () => {
    const groups = groupContiguous([edge({ ta: 0 }), edge({ ta: 10 }), edge({ ta: 20 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('splits on time gaps, other satellites and clipped joints', () => {
    const groups = groupContiguous([
      edge({ ta: 0 }),
      edge({ ta: 20 }), // gap
      edge({ ta: 30, satelliteId: 1 }), // other satellite
      edge({ ta: 40, satelliteId: 1, hi: 0.4 }), // clipped (exits disc) …
      edge({ ta: 50, satelliteId: 1 }), // … so the next edge starts a new pass
    ]);
    expect(groups.map((g) => g.length)).toEqual([1, 1, 2, 1]);
  });

  it('returns nothing for empty input', () => {
    expect(groupContiguous([])).toEqual([]);
  });
});

describe('buildAccess', () => {
  const T = Date.parse('2027-03-01T00:00:00Z') / 1000;

  it('computes interval, clipped geometry, TCA and look angles', () => {
    const run: CandidateEdge[] = [
      edge({
        ta: T,
        tb: T + 10,
        v1: [0, 0, 500],
        v2: [1, 0, 500],
        lo: 0.5,
        hi: 1,
        distM: 300_000,
        tca: 1,
      }),
      edge({
        ta: T + 10,
        tb: T + 20,
        v1: [1, 0, 500],
        v2: [2, 0, 500],
        lo: 0,
        hi: 0.5,
        distM: 20_000,
        tca: 0,
      }),
    ];
    const a = buildAccess(run, 'SAT-1');

    expect(a.id).toBe(`SAT-1-${T + 5}`);
    expect(a.start).toBe('2027-03-01T00:00:05Z');
    expect(a.end).toBe('2027-03-01T00:00:15Z');
    expect(a.durationSeconds).toBe(10);
    expect(a.tca).toBe('2027-03-01T00:00:10Z');
    expect(a.minDistanceKm).toBe(20);
    expect(a.maxElevationDeg).toBeGreaterThan(70);
    expect(a.geometry.type).toBe('LineString');
    expect(a.geometry.coordinates).toEqual([
      [0.5, 0, 500],
      [1, 0, 500],
      [1.5, 0, 500],
    ]);
  });

  it('emits a MultiLineString when the pass crosses the antimeridian', () => {
    const a = buildAccess([edge({ ta: T, v1: [179.9, 0, 500], v2: [-179.9, 0, 500] })], 'S');
    expect(a.geometry.type).toBe('MultiLineString');
  });
});
