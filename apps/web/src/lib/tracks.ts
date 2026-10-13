import type { TracksResponse } from '@sat/contract';

/** Cheap structural guard — validating 700 k numbers with zod would cost more than rendering them. */
export function isTracksResponse(x: unknown): x is TracksResponse {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Partial<TracksResponse>;
  return (
    Array.isArray(r.satellites) &&
    Array.isArray(r.sat) &&
    Array.isArray(r.t0) &&
    Array.isArray(r.t1) &&
    Array.isArray(r.offsets) &&
    Array.isArray(r.coords) &&
    typeof r.count === 'number' &&
    r.sat.length === r.count &&
    r.offsets.length === r.count + 1 &&
    r.coords.length === 2 * ((r.offsets[r.count] as number) ?? 0)
  );
}
