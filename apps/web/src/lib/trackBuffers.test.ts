import type { TracksResponse } from '@sat/contract';
import { describe, expect, it } from 'vitest';

import { buildTrackBuffers, INSTANCE_STRIDE, toMercator, visibilityMask } from './trackBuffers';
import { TrackIndex } from './trackIndex';

const payload: TracksResponse = {
  satellites: ['A', 'B'],
  step: 1,
  count: 2,
  sat: [0, 1],
  t0: [1000, 1060],
  t1: [1060, 1120],
  offsets: [0, 3, 5],
  // A: (0,0) (10,0) (20,0)   B: (0,10) (0,20)
  coords: [0, 0, 10, 0, 20, 0, 0, 10, 0, 20],
};

describe('toMercator', () => {
  it('maps the world corners and centre', () => {
    expect(toMercator(-180, 0)[0]).toBeCloseTo(0);
    expect(toMercator(180, 0)[0]).toBeCloseTo(1);
    expect(toMercator(0, 0)).toEqual([0.5, 0.5]);
    expect(toMercator(0, 85.0511)[1]).toBeCloseTo(0, 3);
  });

  it('clamps latitudes beyond the mercator limit instead of returning infinity', () => {
    expect(Number.isFinite(toMercator(0, 90)[1])).toBe(true);
  });
});

describe('buildTrackBuffers', () => {
  const b = buildTrackBuffers(payload);

  it('creates one instance per edge', () => {
    expect(b.count).toBe(3); // 2 edges + 1 edge
    expect(b.instances).toHaveLength(3 * INSTANCE_STRIDE);
    expect(b.lonlat).toHaveLength(12);
  });

  it('stores relative times (float32-safe) and satellite indices', () => {
    expect(b.epoch0).toBe(1000);
    const t = [0, 1, 2].map((e) => b.instances[e * INSTANCE_STRIDE + 4]);
    expect(t).toEqual([0, 30, 60]); // A: 0,30 over 60 s ; B starts at 60
    const sat = [0, 1, 2].map((e) => b.instances[e * INSTANCE_STRIDE + 5]);
    expect(sat).toEqual([0, 0, 1]);
  });

  it('survives very large inputs (no spread-argument stack overflow)', () => {
    const n = 150_000;
    const big: TracksResponse = {
      satellites: ['A'],
      step: 1,
      count: n,
      sat: new Array(n).fill(0),
      t0: Array.from({ length: n }, (_, i) => 1000 + i),
      t1: Array.from({ length: n }, (_, i) => 1060 + i),
      offsets: Array.from({ length: n + 1 }, (_, i) => i * 2),
      coords: new Array(n * 4).fill(1),
    };
    expect(buildTrackBuffers(big).count).toBe(n);
  });
});

describe('visibilityMask', () => {
  it('sets one bit per visible satellite', () => {
    expect(visibilityMask(['A', 'B', 'C'], ['A', 'C'])).toBe(0b101);
    expect(visibilityMask(['A', 'B'], [])).toBe(0);
  });
});

describe('TrackIndex.nearest', () => {
  const b = buildTrackBuffers(payload);
  const index = new TrackIndex(b);
  const all = { mask: 0b11, from: 0, to: 1e9 };

  it('finds the closest edge within tolerance', () => {
    const hit = index.nearest(5, 0.2, 1, all);
    expect(hit?.satellite).toBe('A');
    expect(hit?.time).toBe(1000);
  });

  it('returns null when nothing is close enough', () => {
    expect(index.nearest(-100, -50, 2, all)).toBeNull();
  });

  it('respects the satellite mask and the time range', () => {
    expect(index.nearest(5, 0.2, 1, { ...all, mask: 0b10 })).toBeNull();
    expect(index.nearest(5, 0.2, 1, { ...all, from: 100 })).toBeNull();
  });

  it('finds edges stored in neighbouring cells', () => {
    expect(index.nearest(0.1, 15, 1, all)?.satellite).toBe('B');
  });
});
