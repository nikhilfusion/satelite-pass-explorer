export type Vertex = [lon: number, lat: number, alt: number];

/**
 * Splits a polyline wherever two consecutive vertices jump across the antimeridian
 * (|Δlon| > 180°) by inserting an interpolated vertex on ±180° on both sides.
 * Each returned part has ≥ 2 vertices, so it is directly renderable.
 */
export function splitAtAntimeridian(vertices: readonly Vertex[]): Vertex[][] {
  const parts: Vertex[][] = [];
  let current: Vertex[] = [];

  vertices.forEach((v, i) => {
    const prev = vertices[i - 1];
    if (prev && Math.abs(v[0] - prev[0]) > 180) {
      const boundary = prev[0] > 0 ? 180 : -180;
      const unwrappedLon = v[0] + (prev[0] > 0 ? 360 : -360);
      const f = (boundary - prev[0]) / (unwrappedLon - prev[0]);
      const lat = prev[1] + f * (v[1] - prev[1]);
      const alt = prev[2] + f * (v[2] - prev[2]);
      current.push([boundary, lat, alt]);
      parts.push(current);
      current = [[-boundary, lat, alt]];
    }
    current.push(v);
  });
  parts.push(current);

  return parts.filter((p) => p.length >= 2);
}
