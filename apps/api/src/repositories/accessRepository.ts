import type { CandidateEdge } from '../domain/accesses';
import { EARTH_RADIUS_M } from '../domain/geodesy';
import type { Database } from '../infra/database';
import { num } from '../infra/database';

export interface AccessSearch {
  lat: number;
  lon: number;
  radiusKm: number;
  /** Epoch seconds. */
  from: number;
  to: number;
  satIds: readonly number[];
}

/**
 * Exact "which parts of which tracks come within R km of a point, between t_from and t_to".
 *
 * Why not just test the sampled vertices? Vertices are ~75 km apart (10 s of orbital motion),
 * so a pass that goes straight over a 20 km target would be missed, and every pass would
 * be mis-timed by up to ±5 s. Instead each *edge* (vertex pair) is treated as a straight line
 * in an azimuthal-equidistant projection centred on the target, where
 *   - distance from the centre = true great-circle distance (exact),
 *   - a ≤ 75 km edge is, to <1 m, the same as the great-circle arc.
 * The edge ∩ disc interval and the closest approach are then closed-form (a quadratic), and are
 * evaluated for all ~600 k edges inside DuckDB's vectorised engine. sin/cos of Δλ make the
 * maths antimeridian- and pole-safe without special cases.
 *
 * A cheap latitude-band + time predicate runs first so DuckDB's zone maps prune most row
 * groups before any trigonometry is evaluated.
 */
const ACCESS_SQL = `
WITH q AS (
  -- Explicit casts: DuckDB binds whole-number JS values as INT32, which would overflow in r * r.
  SELECT CAST($lat AS DOUBLE) AS lat0, radians(CAST($lat AS DOUBLE)) AS p0,
         radians(CAST($lon AS DOUBLE)) AS l0,
         CAST($radius AS DOUBLE) AS r, CAST($R AS DOUBLE) AS rad,
         CAST($from AS DOUBLE) AS tf, CAST($to AS DOUBLE) AS tt,
         degrees(CAST($radius AS DOUBLE) / CAST($R AS DOUBLE)) + 0.05 AS dlat
),
cand AS (
  SELECT e.* FROM edges e, q
  WHERE e.tb >= q.tf AND e.ta <= q.tt
    AND {{SATS}}
    AND greatest(e.lat1, e.lat2) >= q.lat0 - q.dlat
    AND least(e.lat1, e.lat2)    <= q.lat0 + q.dlat
),
vec AS (
  SELECT c.*, q.r, q.rad, q.tf, q.tt,
    cos(radians(c.lat1)) * sin(radians(c.lon1) - q.l0) AS ax1,
    cos(q.p0) * sin(radians(c.lat1)) - sin(q.p0) * cos(radians(c.lat1)) * cos(radians(c.lon1) - q.l0) AS ay1,
    sin(q.p0) * sin(radians(c.lat1)) + cos(q.p0) * cos(radians(c.lat1)) * cos(radians(c.lon1) - q.l0) AS az1,
    cos(radians(c.lat2)) * sin(radians(c.lon2) - q.l0) AS ax2,
    cos(q.p0) * sin(radians(c.lat2)) - sin(q.p0) * cos(radians(c.lat2)) * cos(radians(c.lon2) - q.l0) AS ay2,
    sin(q.p0) * sin(radians(c.lat2)) + cos(q.p0) * cos(radians(c.lat2)) * cos(radians(c.lon2) - q.l0) AS az2
  FROM cand c, q
),
plane AS (
  -- azimuthal equidistant: scale by c / sin(c) (limit 1 at the centre)
  SELECT *,
    sqrt(ax1 * ax1 + ay1 * ay1) AS s1, sqrt(ax2 * ax2 + ay2 * ay2) AS s2
  FROM vec
),
xy AS (
  SELECT *,
    CASE WHEN s1 < 1e-12 THEN rad ELSE rad * atan2(s1, az1) / s1 END * ax1 AS x1,
    CASE WHEN s1 < 1e-12 THEN rad ELSE rad * atan2(s1, az1) / s1 END * ay1 AS y1,
    CASE WHEN s2 < 1e-12 THEN rad ELSE rad * atan2(s2, az2) / s2 END * ax2 AS x2,
    CASE WHEN s2 < 1e-12 THEN rad ELSE rad * atan2(s2, az2) / s2 END * ay2 AS y2
  FROM plane
),
quad AS (
  SELECT *,
    x2 - x1 AS dx, y2 - y1 AS dy,
    (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) AS a,
    2 * (x1 * (x2 - x1) + y1 * (y2 - y1)) AS b,
    x1 * x1 + y1 * y1 - r * r AS c
  FROM xy
),
solved AS (
  SELECT *, b * b - 4 * a * c AS disc FROM quad WHERE a > 1e-6
),
clipped AS (
  SELECT *,
    greatest(0.0, (-b - sqrt(greatest(disc, 0))) / (2 * a), (tf - ta) / (tb - ta)) AS lo,
    least(1.0, (-b + sqrt(greatest(disc, 0))) / (2 * a), (tt - ta) / (tb - ta)) AS hi
  FROM solved WHERE disc >= 0
),
closest AS (
  SELECT *, least(greatest(-b / (2 * a), lo), hi) AS tm FROM clipped WHERE lo <= hi
)
SELECT sat_id, ta, tb, lon1, lat1, alt1, lon2, lat2, alt2, lo, hi, tm,
       sqrt((x1 + tm * dx) * (x1 + tm * dx) + (y1 + tm * dy) * (y1 + tm * dy)) AS dist
FROM closest
ORDER BY sat_id, ta
`;

export class AccessRepository {
  constructor(private readonly db: Database) {}

  async findEdgesWithinRadius(search: AccessSearch): Promise<CandidateEdge[]> {
    if (!search.satIds.every((id) => Number.isInteger(id))) {
      throw new TypeError('satellite ids must be integers');
    }
    if (search.satIds.length === 0) return [];

    const sql = ACCESS_SQL.replace('{{SATS}}', `e.sat_id IN (${search.satIds.join(',')})`);
    const rows = await this.db.all(sql, {
      lat: search.lat,
      lon: search.lon,
      radius: search.radiusKm * 1000,
      R: EARTH_RADIUS_M,
      from: search.from,
      to: search.to,
    });

    return rows.map((r) => ({
      satelliteId: num(r.sat_id),
      ta: num(r.ta),
      tb: num(r.tb),
      v1: [num(r.lon1), num(r.lat1), num(r.alt1)],
      v2: [num(r.lon2), num(r.lat2), num(r.alt2)],
      lo: num(r.lo),
      hi: num(r.hi),
      tca: num(r.tm),
      distM: num(r.dist),
    }));
  }
}
