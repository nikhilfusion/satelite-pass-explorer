/** Spherical-earth helpers. Mean radius is plenty for 1–3 000 km access radii (≤0.3 % error vs WGS84). */
export const EARTH_RADIUS_M = 6_371_008.8;
export const EARTH_RADIUS_KM = EARTH_RADIUS_M / 1000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Look angles of a satellite at altitude `altKm` whose sub-satellite point is `groundKm`
 * (great-circle) away from the observer. Spherical-earth geometry, no atmosphere.
 */
export function lookAngles(
  groundKm: number,
  altKm: number,
): { elevationDeg: number; slantRangeKm: number } {
  const R = EARTH_RADIUS_KM;
  const c = groundKm / R; // central angle
  const r = R + altKm;
  const slantRangeKm = Math.sqrt(R * R + r * r - 2 * R * r * Math.cos(c));
  // elevation = atan2(r cos c - R, r sin c)
  const elevationDeg = (Math.atan2(r * Math.cos(c) - R, r * Math.sin(c)) * 180) / Math.PI;
  return { elevationDeg, slantRangeKm };
}

/** Normalises a longitude to [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Linear interpolation between two lon/lat/alt vertices taking the short way around the
 * antimeridian. The result longitude is wrapped back into [-180, 180).
 */
export function interpolateVertex(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  f: number,
): [number, number, number] {
  let dLon = b[0] - a[0];
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  return [wrapLon(a[0] + dLon * f), a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
