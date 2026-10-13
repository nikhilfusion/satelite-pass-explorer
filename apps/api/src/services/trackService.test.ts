import { describe, expect, it } from 'vitest';

import { decimate, encodeTracks } from './trackService';

describe('decimate', () => {
  it('keeps every n-th vertex and always the last one', () => {
    expect(decimate([0, 1, 2, 3, 4, 5, 6], 3)).toEqual([0, 3, 6]);
    expect(decimate([0, 1, 2, 3, 4], 3)).toEqual([0, 3, 4]);
  });

  it('is the identity for step 1 and tiny inputs', () => {
    expect(decimate([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(decimate([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('encodeTracks', () => {
  it('produces a consistent columnar payload and splits at the antimeridian', () => {
    const out = encodeTracks(
      [
        { satId: 0, t0: 0, t1: 60, lons: [10, 11, 12], lats: [0, 1, 2] },
        { satId: 1, t0: 0, t1: 60, lons: [179, -179], lats: [0, 0] },
      ],
      ['A', 'B'],
      1,
    );
    expect(out.satellites).toEqual(['A', 'B']);
    expect(out.count).toBe(3); // 1 + 2 parts
    expect(out.sat).toEqual([0, 1, 1]);
    expect(out.offsets).toEqual([0, 3, 5, 7]);
    expect(out.coords).toHaveLength(14);
    expect(out.coords.slice(0, 6)).toEqual([10, 0, 11, 1, 12, 2]);
  });

  it('rounds coordinates to 3 decimals', () => {
    const out = encodeTracks(
      [{ satId: 0, t0: 0, t1: 1, lons: [1.123456, 2], lats: [3.987654, 4] }],
      ['A'],
      1,
    );
    expect(out.coords.slice(0, 2)).toEqual([1.123, 3.988]);
  });
});
