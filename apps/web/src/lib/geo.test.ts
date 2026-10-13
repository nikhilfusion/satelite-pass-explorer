import { describe, expect, it } from 'vitest';

import { boundsOf, circlePolygons, circleRing, formatLat, formatLon, wrapLon } from './geo';

const haversineKm = (a: readonly number[], b: readonly number[]) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r((b[1] as number) - (a[1] as number)) / 2) ** 2 +
    Math.cos(r(a[1] as number)) *
      Math.cos(r(b[1] as number)) *
      Math.sin(r((b[0] as number) - (a[0] as number)) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
};

describe('circleRing', () => {
  it('is closed and every vertex lies at the requested radius', () => {
    const ring = circleRing(55.3, 25.2, 500);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const p of ring) expect(haversineKm(p, [55.3, 25.2])).toBeCloseTo(500, 0);
  });
});

describe('circlePolygons', () => {
  it('returns a single polygon away from the antimeridian', () => {
    expect(circlePolygons(10, 10, 300)).toHaveLength(1);
  });

  it('duplicates the polygon across the antimeridian so both halves render', () => {
    const polys = circlePolygons(179.5, 0, 400);
    expect(polys).toHaveLength(2);
    const xs = polys.map((p) => p[0]!.map((c) => c[0]));
    expect(Math.max(...xs[0]!)).toBeGreaterThan(180);
    expect(Math.min(...xs[1]!)).toBeLessThan(0);
    expect(Math.max(...xs[1]!)).toBeLessThanOrEqual(180);
  });

  it('skips polygons that enclose a pole', () => {
    expect(circlePolygons(0, 89, 500)).toEqual([]);
  });
});

describe('boundsOf', () => {
  it('computes a bbox including extra points', () => {
    expect(
      boundsOf(
        [
          [
            [10, 5],
            [20, 15],
          ],
        ],
        [[0, 30]],
      ),
    ).toEqual([0, 5, 20, 30]);
  });

  it('keeps antimeridian-crossing geometry compact', () => {
    const b = boundsOf([
      [
        [170, 0],
        [-170, 10],
      ],
    ]);
    expect(b).toEqual([170, 0, 190, 10]);
  });

  it('returns null when empty', () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe('formatting', () => {
  it('formats hemispheres', () => {
    expect(formatLat(-33.8688)).toBe('33.869°S');
    expect(formatLon(151.2093)).toBe('151.209°E');
    expect(formatLon(-0.1)).toBe('0.100°W');
  });
  it('wraps longitudes', () => {
    expect(wrapLon(540)).toBeCloseTo(-180);
    expect(wrapLon(-190)).toBeCloseTo(170);
  });
});
