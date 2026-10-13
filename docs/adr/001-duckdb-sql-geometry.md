# ADR-001: Exact geometry in plain DuckDB SQL (no spatial extension)

- Status: accepted

## Context

Accesses = portions of each satellite track inside a disc of radius R around a clicked point, within [from, to].
The brief suggests DuckDB's `spatial` extension. Two problems:

1. `INSTALL spatial` needs a network download at build/run time. It is blocked in our sandbox and would make
   the Docker image and offline CI non-hermetic.
2. `ST_*` functions are planar. Tracks cross the antimeridian and polar regions, and a "radius in km" is a
   geodesic notion. Planar buffers are wrong there (wrap-around, distorted at high latitude).

## Decision

Ingest to a persisted DuckDB file (`segments`, `edges`). Run the intersection in SQL with an
azimuthal-equidistant projection centred on the target (sin/cos of the longitude delta, so no wrap issues),
solve the edge/disc quadratic, clip against the time window, and compute the closest approach.
Contiguous edges are grouped into passes in TypeScript. Elevation / slant range use a spherical earth.

## Consequences

- Zero extension downloads; reproducible image; correct at the antimeridian and poles.
- Verified by a brute-force differential oracle test and against the reference screenshot.

* Spherical (not WGS84 ellipsoid) distances: error well below 0.5 %, documented.
* More SQL to maintain than `ST_Intersection`. Mitigated by tests and the single `ACCESS_SQL` constant.
* If the extension becomes available, an R-tree prefilter could be added behind the repository interface.
