/**
 * Physical model.
 *
 *  stage      transient, one row per GeoJSON vertex (bulk-loaded with the Appender API)
 *  satellites one row per spacecraft + denormalised stats (served by /api/meta)
 *  segments   one row per source feature (1-minute polyline) — drives the map overview
 *  edges      one row per consecutive vertex pair — drives the exact geographic access query
 *  meta       key/value dataset facts (version fingerprint, counts…)
 *
 * All instants are stored as DOUBLE epoch seconds (UTC): vertex timestamps fall on
 * sub-minute boundaries, and plain numbers keep the SQL arithmetic trivial and fast.
 */
export const CREATE_STAGE = `
  CREATE OR REPLACE TABLE stage (
    sat VARCHAR, t0 DOUBLE, t1 DOUBLE, i INTEGER, n INTEGER,
    lon DOUBLE, lat DOUBLE, alt DOUBLE
  )`;

export const BUILD_MODEL = `
  CREATE OR REPLACE TABLE satellites AS
  SELECT CAST(row_number() OVER (ORDER BY sat) - 1 AS INTEGER) AS id,
         sat AS name,
         CAST(count(DISTINCT t0) AS INTEGER) AS segment_count,
         min(t0) AS t_start,
         max(t1) AS t_end,
         min(alt) AS alt_min,
         max(alt) AS alt_max
  FROM stage
  GROUP BY sat;

  CREATE OR REPLACE TABLE segments AS
  SELECT s.id AS sat_id,
         p.t0, p.t1,
         list(p.lon ORDER BY p.i) AS lons,
         list(p.lat ORDER BY p.i) AS lats,
         list(p.alt ORDER BY p.i) AS alts
  FROM stage p JOIN satellites s ON s.name = p.sat
  GROUP BY s.id, p.t0, p.t1
  ORDER BY p.t0, s.id;

  -- Vertex k of a segment is sampled at t0 + k * (t1 - t0) / (n - 1).
  CREATE OR REPLACE TABLE edges AS
  SELECT sat_id,
         t0 + (k - 1) * (t1 - t0) / (len(lons) - 1) AS ta,
         t0 + k * (t1 - t0) / (len(lons) - 1)       AS tb,
         lons[k] AS lon1, lats[k] AS lat1, alts[k] AS alt1,
         lons[k + 1] AS lon2, lats[k + 1] AS lat2, alts[k + 1] AS alt2
  FROM (
    SELECT *, unnest(range(1, len(lons))) AS k FROM segments
  )
  ORDER BY ta, sat_id;

  DROP TABLE stage;
`;
