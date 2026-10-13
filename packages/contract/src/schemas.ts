import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export const MAX_RADIUS_KM = 3000;
export const DEFAULT_TRACK_STEP = 3;

/** ISO-8601 instant, e.g. 2027-03-01T00:00:00Z. */
export const IsoInstant = z.iso.datetime({ offset: true });

/** Query-string list: "A,B,C" -> ["A","B","C"]. Empty / missing -> undefined. */
const csvList = z
  .string()
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1).max(32)).max(100));

/* ------------------------------------------------------------------ */
/* GET /api/meta                                                       */
/* ------------------------------------------------------------------ */

export const SatelliteSchema = z.object({
  id: z.string(),
  segmentCount: z.number().int(),
  start: IsoInstant,
  end: IsoInstant,
  minAltitudeKm: z.number(),
  maxAltitudeKm: z.number(),
});
export type Satellite = z.infer<typeof SatelliteSchema>;

export const MetaResponseSchema = z.object({
  dataset: z.object({
    version: z.string().describe('Opaque dataset fingerprint, used for HTTP cache validation'),
    start: IsoInstant,
    end: IsoInstant,
    segmentCount: z.number().int(),
    sampleIntervalSeconds: z.number(),
  }),
  satellites: z.array(SatelliteSchema),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

/* ------------------------------------------------------------------ */
/* GET /api/tracks                                                     */
/* ------------------------------------------------------------------ */

export const TracksQuerySchema = z.object({
  satellites: csvList.optional(),
  from: IsoInstant.optional(),
  to: IsoInstant.optional(),
  step: z.coerce.number().int().min(1).max(6).default(DEFAULT_TRACK_STEP),
});
export type TracksQuery = z.infer<typeof TracksQuerySchema>;

/**
 * Columnar track payload (≈5x smaller than GeoJSON and much cheaper to parse).
 *
 * Record `i` is a polyline belonging to satellite `satellites[sat[i]]`, valid over
 * [t0[i], t1[i]] (epoch seconds, UTC), whose vertices are
 * `coords[offsets[i] .. offsets[i+1])` as a flat [lon, lat, lon, lat, ...] list.
 * Polylines never cross the antimeridian (they are split server side).
 */
export interface TracksResponse {
  satellites: string[];
  step: number;
  count: number;
  sat: number[];
  t0: number[];
  t1: number[];
  offsets: number[];
  coords: number[];
}

/* ------------------------------------------------------------------ */
/* GET /api/accesses                                                   */
/* ------------------------------------------------------------------ */

export const AccessesQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM),
    from: IsoInstant,
    to: IsoInstant,
    satellites: csvList.optional(),
  })
  .refine((q) => Date.parse(q.from) < Date.parse(q.to), {
    message: '`from` must be strictly before `to`',
    path: ['to'],
  });
export type AccessesQuery = z.infer<typeof AccessesQuerySchema>;

const Position = z.tuple([z.number(), z.number(), z.number()]);

export const AccessSchema = z.object({
  id: z.string(),
  satellite: z.string(),
  start: IsoInstant,
  end: IsoInstant,
  durationSeconds: z.number(),
  tca: IsoInstant.describe('Time of closest approach'),
  minDistanceKm: z.number().describe('Ground distance at closest approach'),
  maxElevationDeg: z.number().describe('Elevation of the satellite seen from the target at TCA'),
  slantRangeKm: z.number().describe('Line-of-sight distance at TCA'),
  /** MultiLineString only when the portion crosses the antimeridian (RFC 7946 §3.1.9). */
  geometry: z.discriminatedUnion('type', [
    z.object({ type: z.literal('LineString'), coordinates: z.array(Position) }),
    z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(Position)) }),
  ]),
});
export type Access = z.infer<typeof AccessSchema>;

export const AccessesResponseSchema = z.object({
  query: z.object({
    lat: z.number(),
    lon: z.number(),
    radiusKm: z.number(),
    from: IsoInstant,
    to: IsoInstant,
    satellites: z.array(z.string()),
  }),
  summary: z.object({
    count: z.number().int(),
    bySatellite: z.record(z.string(), z.number().int()),
    totalDurationSeconds: z.number(),
    tookMs: z.number(),
  }),
  accesses: z.array(AccessSchema),
});
export type AccessesResponse = z.infer<typeof AccessesResponseSchema>;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
