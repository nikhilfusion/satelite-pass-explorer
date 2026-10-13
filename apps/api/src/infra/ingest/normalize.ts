/**
 * GeoJSON → normalised segments.
 *
 * Source quirks handled here (found by profiling the provided file):
 *  1. 1 134 features are typed `MultiLineString` but carry *LineString-shaped* coordinates
 *     (a flat list of [lon, lat, alt] positions). We detect geometry by coordinate depth,
 *     not by the declared type, and also support genuine MultiLineStrings (parts concatenated).
 *  2. Those same features straddle the antimeridian without being split — consecutive
 *     vertices jump from ≈ -180 to ≈ +180. Raw longitudes are preserved in storage; splitting
 *     happens at presentation time (see domain/antimeridian.ts) so exact math stays honest.
 *  3. Altitudes are in km (≈ 490–545), vertex timestamps are implicit: vertices are evenly
 *     distributed over [ts_start, ts_end].
 */
import { isoToEpoch } from '@sat/contract';
import { z } from 'zod';

export interface NormalizedSegment {
  satellite: string;
  t0: number;
  t1: number;
  /** [lon, lat, alt][] in time order, ≥ 2 vertices. */
  vertices: [number, number, number][];
}

const Position = z.array(z.number()).min(2);

const FeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.enum(['LineString', 'MultiLineString']),
    coordinates: z.array(z.unknown()),
  }),
  properties: z.object({
    satellite: z.string().min(1),
    ts_start: z.string(),
    ts_end: z.string(),
  }),
});

export class InvalidFeatureError extends Error {}

function flattenPositions(coordinates: unknown[]): number[][] {
  const first = coordinates[0];
  if (Array.isArray(first) && typeof first[0] === 'number') {
    return z.array(Position).parse(coordinates);
  }
  // genuine MultiLineString: array of arrays of positions
  return coordinates.flatMap((part) => z.array(Position).parse(part));
}

export function normalizeFeature(raw: unknown): NormalizedSegment {
  const parsed = FeatureSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidFeatureError(z.prettifyError(parsed.error));
  const { geometry, properties } = parsed.data;

  const positions = flattenPositions(geometry.coordinates);
  if (positions.length < 2) throw new InvalidFeatureError('Feature has fewer than 2 vertices');

  const t0 = isoToEpoch(properties.ts_start);
  const t1 = isoToEpoch(properties.ts_end);
  if (!(t1 > t0)) throw new InvalidFeatureError(`ts_end must be after ts_start (${t0} >= ${t1})`);

  return {
    satellite: properties.satellite,
    t0,
    t1,
    vertices: positions.map(([lon, lat, alt]) => [lon as number, lat as number, alt ?? 0]),
  };
}
