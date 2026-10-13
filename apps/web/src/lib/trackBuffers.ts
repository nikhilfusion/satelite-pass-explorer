import type { TracksResponse } from '@sat/contract';

/** Floats per edge instance: start(x,y) end(x,y) mercator, then time + satellite index. */
export const INSTANCE_STRIDE = 6;

export interface TrackBuffers {
  satellites: string[];
  count: number;
  /** Interleaved GPU instance data (see INSTANCE_STRIDE). Times are seconds since `epoch0`. */
  instances: Float32Array;
  /** lon/lat of each edge (lon1, lat1, lon2, lat2), kept for CPU hit-testing. */
  lonlat: Float32Array;
  /** Epoch seconds that relative time 0 maps to (float32 cannot hold 1.8e9 with 1 s precision). */
  epoch0: number;
}

const MAX_MERCATOR_LAT = 85.0511287798;

/** lon/lat (deg) -> spherical web-mercator in [0, 1]² (y grows southwards, like MapLibre). */
export function toMercator(lon: number, lat: number): [number, number] {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const x = (lon + 180) / 360;
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / (2 * Math.PI);
  return [x, y];
}

/**
 * Columnar polylines -> one GPU instance per edge. Doing this once (typed arrays, no per-feature
 * objects) is what makes the 100 k-segment dataset cheap: ~20 ms to build, no worker re-tiling, and
 * time/satellite filters become shader uniforms.
 */
export function buildTrackBuffers(data: TracksResponse): TrackBuffers {
  let edges = 0;
  for (let i = 0; i < data.count; i += 1) {
    edges += Math.max(0, (data.offsets[i + 1] as number) - (data.offsets[i] as number) - 1);
  }

  const epoch0 = data.count ? Math.min(...chunkedMin(data.t0)) : 0;
  const instances = new Float32Array(edges * INSTANCE_STRIDE);
  const lonlat = new Float32Array(edges * 4);

  let e = 0;
  for (let i = 0; i < data.count; i += 1) {
    const from = data.offsets[i] as number;
    const to = data.offsets[i + 1] as number;
    const m = to - from;
    if (m < 2) continue;
    const t0 = data.t0[i] as number;
    const span = (data.t1[i] as number) - t0;
    const sat = data.sat[i] as number;

    for (let v = 0; v < m - 1; v += 1) {
      const lon1 = data.coords[2 * (from + v)] as number;
      const lat1 = data.coords[2 * (from + v) + 1] as number;
      const lon2 = data.coords[2 * (from + v + 1)] as number;
      const lat2 = data.coords[2 * (from + v + 1) + 1] as number;
      const [x1, y1] = toMercator(lon1, lat1);
      const [x2, y2] = toMercator(lon2, lat2);
      const o = e * INSTANCE_STRIDE;
      instances[o] = x1;
      instances[o + 1] = y1;
      instances[o + 2] = x2;
      instances[o + 3] = y2;
      instances[o + 4] = t0 + (span * v) / (m - 1) - epoch0;
      instances[o + 5] = sat;
      const l = e * 4;
      lonlat[l] = lon1;
      lonlat[l + 1] = lat1;
      lonlat[l + 2] = lon2;
      lonlat[l + 3] = lat2;
      e += 1;
    }
  }

  return { satellites: data.satellites, count: edges, instances, lonlat, epoch0 };
}

/** Math.min(...bigArray) overflows the call stack on ~100 k elements; reduce in chunks instead. */
function chunkedMin(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 8192) out.push(Math.min(...values.slice(i, i + 8192)));
  return out;
}

/** Bit i set => satellite i visible (≤ 31 satellites; the shader reads it as an int). */
export function visibilityMask(satellites: readonly string[], visible: readonly string[]): number {
  const on = new Set(visible);
  return satellites.reduce((mask, name, i) => (on.has(name) ? mask | (1 << i) : mask), 0);
}
