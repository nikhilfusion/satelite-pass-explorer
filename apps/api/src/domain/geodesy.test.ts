import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_KM, haversineM, interpolateVertex, lookAngles, wrapLon } from './geodesy';

describe('haversineM', () => {
  it('measures one degree of equator as ~111.2 km', () => {
    expect(haversineM(0, 0, 1, 0) / 1000).toBeCloseTo(111.195, 2);
  });

  it('is symmetric and zero for identical points', () => {
    expect(haversineM(10, 20, 10, 20)).toBe(0);
    expect(haversineM(10, 20, 30, 40)).toBeCloseTo(haversineM(30, 40, 10, 20), 6);
  });

  it('goes the short way across the antimeridian', () => {
    expect(haversineM(179.5, 0, -179.5, 0) / 1000).toBeCloseTo(111.195, 2);
  });
});

describe('lookAngles', () => {
  it('is 90° elevation with slant range = altitude when directly overhead', () => {
    const { elevationDeg, slantRangeKm } = lookAngles(0, 500);
    expect(elevationDeg).toBeCloseTo(90, 6);
    expect(slantRangeKm).toBeCloseTo(500, 6);
  });

  it('is 0° elevation at the geometric horizon', () => {
    const alt = 500;
    const horizonGround = EARTH_RADIUS_KM * Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + alt));
    expect(lookAngles(horizonGround, alt).elevationDeg).toBeCloseTo(0, 6);
  });

  it('decreases monotonically with ground distance', () => {
    const e = [0, 200, 600, 1500].map((d) => lookAngles(d, 500).elevationDeg);
    expect([...e].sort((a, b) => b - a)).toEqual(e);
  });
});

describe('wrapLon / interpolateVertex', () => {
  it('wraps into [-180, 180)', () => {
    expect(wrapLon(190)).toBeCloseTo(-170);
    expect(wrapLon(-190)).toBeCloseTo(170);
    expect(wrapLon(180)).toBeCloseTo(-180);
    expect(wrapLon(45)).toBeCloseTo(45);
  });

  it('interpolates across the antimeridian the short way', () => {
    const [lon, lat, alt] = interpolateVertex([179, 0, 500], [-179, 2, 510], 0.5);
    expect(Math.abs(lon)).toBeCloseTo(180);
    expect(lat).toBeCloseTo(1);
    expect(alt).toBeCloseTo(505);
  });
});
