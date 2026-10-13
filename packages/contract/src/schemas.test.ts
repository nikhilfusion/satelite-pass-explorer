import { describe, expect, it } from 'vitest';

import { AccessesQuerySchema, TracksQuerySchema } from './schemas';
import { epochToIso, isoToEpoch } from './time';

describe('time helpers', () => {
  it('round-trips epoch seconds and ISO strings', () => {
    const iso = '2027-03-01T06:58:00Z';
    expect(epochToIso(isoToEpoch(iso))).toBe(iso);
  });

  it('rejects garbage', () => {
    expect(() => isoToEpoch('nope')).toThrow();
  });
});

describe('TracksQuerySchema', () => {
  it('applies defaults and parses csv satellites', () => {
    const q = TracksQuerySchema.parse({ satellites: 'YAM20, YAM21,' });
    expect(q.satellites).toEqual(['YAM20', 'YAM21']);
    expect(q.step).toBe(3);
  });

  it('rejects out-of-range step', () => {
    expect(TracksQuerySchema.safeParse({ step: '50' }).success).toBe(false);
  });
});

describe('AccessesQuerySchema', () => {
  const base = {
    lat: '25.2',
    lon: '55.3',
    radiusKm: '500',
    from: '2027-03-01T00:00:00Z',
    to: '2027-03-02T00:00:00Z',
  };

  it('coerces numeric strings', () => {
    const q = AccessesQuerySchema.parse(base);
    expect(q.lat).toBeCloseTo(25.2);
    expect(q.radiusKm).toBe(500);
  });

  it('rejects inverted time windows', () => {
    const r = AccessesQuerySchema.safeParse({ ...base, from: base.to, to: base.from });
    expect(r.success).toBe(false);
  });

  it('rejects invalid latitude and non-positive radius', () => {
    expect(AccessesQuerySchema.safeParse({ ...base, lat: '95' }).success).toBe(false);
    expect(AccessesQuerySchema.safeParse({ ...base, radiusKm: '0' }).success).toBe(false);
  });
});
