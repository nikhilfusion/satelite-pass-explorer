const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Geodesic circle (small circle on a sphere) as a closed GeoJSON ring; wraps longitudes into [-180, 180]. */
export function circleRing(
  lon: number,
  lat: number,
  radiusKm: number,
  steps = 96,
): [number, number][] {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat1 = rad(lat);
  const lon1 = rad(lon);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([((deg(lon2) + 540) % 360) - 180, deg(lat2)]);
  }
  ring[ring.length - 1] = ring[0] as [number, number];
  return ring;
}

type Pos = readonly number[];
export type Bounds = [west: number, south: number, east: number, north: number];

/** Bounding box of lines/points. Longitudes are unwrapped around the first point to survive the antimeridian. */
export function boundsOf(
  lines: readonly (readonly Pos[])[],
  extra: readonly Pos[] = [],
): Bounds | null {
  const all = [...lines.flat(), ...extra];
  const first = all[0];
  if (!first) return null;
  const ref = first[0] as number;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const p of all) {
    let lon = p[0] as number;
    while (lon - ref > 180) lon -= 360;
    while (lon - ref < -180) lon += 360;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, p[1] as number);
    north = Math.max(north, p[1] as number);
  }
  return [west, south, east, north];
}

export const formatLat = (lat: number) => `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
export const formatLon = (lon: number) => `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;

export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * Polygon(s) for a geodesic circle, safe across the antimeridian: the ring is unwrapped so it is
 * continuous, then duplicated one world to the side when it spills past ±180° so both halves render.
 * A circle that encloses a pole cannot be drawn as a simple polygon and returns [] (outline only).
 */
export function circlePolygons(lon: number, lat: number, radiusKm: number): [number, number][][][] {
  const ring = circleRing(lon, lat, radiusKm);
  const unwrapped: [number, number][] = [];
  let offset = 0;
  ring.forEach(([x, y], i) => {
    const prev = ring[i - 1];
    if (prev) {
      const jump = x - prev[0];
      if (jump > 180) offset -= 360;
      else if (jump < -180) offset += 360;
    }
    unwrapped.push([x + offset, y]);
  });

  const last = unwrapped[unwrapped.length - 1] as [number, number];
  const first = unwrapped[0] as [number, number];
  if (Math.abs(last[0] - first[0]) > 180) return []; // encloses a pole

  const xs = unwrapped.map((p) => p[0]);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const polygons: [number, number][][][] = [[unwrapped]];
  if (max > 180) polygons.push([unwrapped.map(([x, y]) => [x - 360, y] as [number, number])]);
  if (min < -180) polygons.push([unwrapped.map(([x, y]) => [x + 360, y] as [number, number])]);
  return polygons;
}
