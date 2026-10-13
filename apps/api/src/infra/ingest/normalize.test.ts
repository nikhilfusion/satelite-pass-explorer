import { describe, expect, it } from 'vitest';

import { InvalidFeatureError, normalizeFeature } from './normalize';

const props = {
  satellite: 'YAM20',
  ts_start: '2027-03-01T00:00:00Z',
  ts_end: '2027-03-01T00:01:00Z',
};
const pts = [
  [10, 1, 500],
  [11, 2, 501],
  [12, 3, 502],
];

describe('normalizeFeature', () => {
  it('reads a LineString', () => {
    const seg = normalizeFeature({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: pts },
      properties: props,
    });
    expect(seg.satellite).toBe('YAM20');
    expect(seg.t1 - seg.t0).toBe(60);
    expect(seg.vertices).toHaveLength(3);
    expect(seg.vertices[1]).toEqual([11, 2, 501]);
  });

  it('accepts the source quirk: MultiLineString type with LineString-shaped coordinates', () => {
    const seg = normalizeFeature({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: pts },
      properties: props,
    });
    expect(seg.vertices).toHaveLength(3);
  });

  it('flattens a genuine MultiLineString', () => {
    const seg = normalizeFeature({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: [pts.slice(0, 2), pts.slice(2)] },
      properties: props,
    });
    expect(seg.vertices.map((v) => v[0])).toEqual([10, 11, 12]);
  });

  it('defaults a missing altitude to 0', () => {
    const seg = normalizeFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      },
      properties: props,
    });
    expect(seg.vertices[0]![2]).toBe(0);
  });

  it.each([
    ['unsupported geometry', { type: 'Point', coordinates: [1, 2] }],
    ['single vertex', { type: 'LineString', coordinates: [[1, 2, 3]] }],
  ])('rejects %s', (_name, geometry) => {
    expect(() => normalizeFeature({ type: 'Feature', geometry, properties: props })).toThrow(
      InvalidFeatureError,
    );
  });

  it('rejects inverted or unparsable time ranges', () => {
    const geometry = { type: 'LineString', coordinates: pts };
    expect(() =>
      normalizeFeature({
        type: 'Feature',
        geometry,
        properties: { ...props, ts_end: props.ts_start },
      }),
    ).toThrow(InvalidFeatureError);
    expect(() =>
      normalizeFeature({
        type: 'Feature',
        geometry,
        properties: { ...props, ts_start: 'garbage' },
      }),
    ).toThrow();
  });
});
