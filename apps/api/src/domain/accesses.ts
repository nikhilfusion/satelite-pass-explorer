import type { Access } from '@sat/contract';
import { epochToIso } from '@sat/contract';

import { splitAtAntimeridian, type Vertex } from './antimeridian';
import { interpolateVertex, lookAngles } from './geodesy';

/**
 * One track edge (two consecutive vertices) that intersects the access disc, as produced by
 * the SQL stage. `lo`/`hi` are the clipped sub-interval of the edge in [0, 1] (disc ∩ time
 * window); `tca` is the closest-approach parameter inside [lo, hi] and `distM` the ground
 * distance (metres) there.
 */
export interface CandidateEdge {
  satelliteId: number;
  ta: number;
  tb: number;
  v1: Vertex;
  v2: Vertex;
  lo: number;
  hi: number;
  tca: number;
  distM: number;
}

const EPS = 1e-9;

/** True when `next` continues `prev` without a gap: same satellite, shared vertex, no clipping in between. */
function continues(prev: CandidateEdge, next: CandidateEdge): boolean {
  return (
    prev.satelliteId === next.satelliteId &&
    next.ta === prev.tb &&
    prev.hi >= 1 - EPS &&
    next.lo <= EPS
  );
}

/** Groups clipped edges into contiguous runs ("passes"). Input must be sorted by (satellite, ta). */
export function groupContiguous(edges: readonly CandidateEdge[]): CandidateEdge[][] {
  const groups: CandidateEdge[][] = [];
  let current: CandidateEdge[] = [];
  for (const edge of edges) {
    const last = current[current.length - 1];
    if (last && !continues(last, edge)) {
      groups.push(current);
      current = [];
    }
    current.push(edge);
  }
  if (current.length) groups.push(current);
  return groups;
}

const at = (e: CandidateEdge, f: number) => e.ta + (e.tb - e.ta) * f;
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Turns one contiguous run of edges into an API `Access` (geometry, TCA, look angles…). */
export function buildAccess(run: readonly CandidateEdge[], satelliteName: string): Access {
  const first = run[0]!;
  const last = run[run.length - 1]!;

  const start = at(first, first.lo);
  const end = at(last, last.hi);

  const vertices: Vertex[] = [interpolateVertex(first.v1, first.v2, first.lo)];
  for (const edge of run) vertices.push(interpolateVertex(edge.v1, edge.v2, edge.hi));

  const closest = run.reduce((best, e) => (e.distM < best.distM ? e : best));
  const tca = at(closest, closest.tca);
  const altAtTca = closest.v1[2] + (closest.v2[2] - closest.v1[2]) * closest.tca;
  const minDistanceKm = closest.distM / 1000;
  const { elevationDeg, slantRangeKm } = lookAngles(minDistanceKm, altAtTca);

  const parts = splitAtAntimeridian(
    vertices.map((v) => [round(v[0], 4), round(v[1], 4), round(v[2], 1)]),
  );
  const geometry: Access['geometry'] =
    parts.length === 1
      ? { type: 'LineString', coordinates: parts[0]! }
      : { type: 'MultiLineString', coordinates: parts };

  return {
    id: `${satelliteName}-${Math.round(start)}`,
    satellite: satelliteName,
    start: epochToIso(Math.round(start)),
    end: epochToIso(Math.round(end)),
    durationSeconds: Math.round(end - start),
    tca: epochToIso(Math.round(tca)),
    minDistanceKm: round(minDistanceKm, 1),
    maxElevationDeg: round(elevationDeg, 1),
    slantRangeKm: round(slantRangeKm, 1),
    geometry,
  };
}
