import type { TracksResponse } from '@sat/contract';
import { describe, expect, it } from 'vitest';

import { isTracksResponse } from './tracks';

const payload: TracksResponse = {
  satellites: ['A', 'B'],
  step: 3,
  count: 2,
  sat: [0, 1],
  t0: [0, 60],
  t1: [60, 120],
  offsets: [0, 2, 5],
  coords: [1, 2, 3, 4, 10, 20, 11, 21, 12, 22],
};

describe('isTracksResponse', () => {
  it('accepts consistent payloads and rejects truncated ones', () => {
    expect(isTracksResponse(payload)).toBe(true);
    expect(isTracksResponse({ ...payload, coords: [1, 2] })).toBe(false);
    expect(isTracksResponse({ ...payload, sat: [0] })).toBe(false);
    expect(isTracksResponse(null)).toBe(false);
    expect(isTracksResponse({})).toBe(false);
  });
});
