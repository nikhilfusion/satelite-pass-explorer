import { describe, expect, it } from 'vitest';

import { decodeState, encodeState, type SharedState } from './urlState';

const base: SharedState = {
  hidden: [],
  range: null,
  target: null,
  radiusKm: 500,
  customWindow: null,
  selectedId: null,
  projection: 'globe',
};

describe('URL state codec', () => {
  it('omits defaults', () => {
    expect(encodeState(base)).toBe('');
  });

  it('round-trips a full state', () => {
    const state: SharedState = {
      hidden: ['YAM22', 'YAM21'],
      range: [1_803_000_000, 1_803_086_400],
      target: { lat: 25.2048, lon: 55.2708 },
      radiusKm: 750,
      customWindow: [1_803_010_000, 1_803_020_000],
      selectedId: 'YAM20-1803000123',
      projection: 'mercator',
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual({ ...state, hidden: ['YAM21', 'YAM22'] }); // sorted for stable links
  });

  it('ignores garbage instead of throwing', () => {
    expect(decodeState('lat=abc&lon=1&r=-4&from=nope&to=nope&proj=cube')).toEqual({});
  });

  it('clamps out-of-range coordinates and radius', () => {
    const d = decodeState('lat=123&lon=-400&r=99999');
    expect(d.target).toEqual({ lat: 90, lon: -180 });
    expect(d.radiusKm).toBe(3000);
  });

  it('rejects inverted ranges', () => {
    expect(decodeState('from=2027-03-02T00:00:00Z&to=2027-03-01T00:00:00Z').range).toBeUndefined();
  });
});
