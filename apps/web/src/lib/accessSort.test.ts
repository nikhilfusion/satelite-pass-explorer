import type { Access } from '@sat/contract';
import { describe, expect, it } from 'vitest';

import { groupAccesses } from './accessSort';

const mk = (id: string, start: string, over: Partial<Access> = {}): Access => ({
  id,
  satellite: id.split('-')[0] as string,
  start,
  end: start,
  durationSeconds: 100,
  tca: start,
  minDistanceKm: 100,
  maxElevationDeg: 50,
  slantRangeKm: 600,
  geometry: { type: 'LineString', coordinates: [] },
  ...over,
});

const data = [
  mk('B-1', '2027-03-02T01:00:00Z', {
    maxElevationDeg: 80,
    durationSeconds: 300,
    minDistanceKm: 20,
  }),
  mk('A-1', '2027-03-01T23:00:00Z', {
    maxElevationDeg: 30,
    durationSeconds: 100,
    minDistanceKm: 400,
  }),
  mk('A-2', '2027-03-01T05:00:00Z', {
    maxElevationDeg: 60,
    durationSeconds: 200,
    minDistanceKm: 90,
  }),
];

describe('groupAccesses', () => {
  it('groups chronologically by UTC day', () => {
    const groups = groupAccesses(data, 'time');
    expect(groups.map((g) => g.label)).toEqual(['2027-03-01', '2027-03-02']);
    expect(groups[0]!.items.map((a) => a.id)).toEqual(['A-2', 'A-1']);
  });

  it.each([
    ['elevation', ['B-1', 'A-2', 'A-1']],
    ['duration', ['B-1', 'A-2', 'A-1']],
    ['distance', ['B-1', 'A-2', 'A-1']],
  ] as const)('ranks by %s in a single group', (key, expected) => {
    const groups = groupAccesses(data, key);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((a) => a.id)).toEqual(expected);
  });

  it('does not mutate its input', () => {
    const copy = [...data];
    groupAccesses(data, 'elevation');
    expect(data).toEqual(copy);
  });
});
