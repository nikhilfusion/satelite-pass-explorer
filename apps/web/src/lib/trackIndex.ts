import { INSTANCE_STRIDE, type TrackBuffers } from './trackBuffers';

export interface NearestEdge {
  edge: number;
  satellite: string;
  /** Epoch seconds at the start of the edge. */
  time: number;
  distanceDeg: number;
}

export interface EdgeFilter {
  /** Bit mask of visible satellites. */
  mask: number;
  /** Relative seconds (since buffers.epoch0), inclusive. */
  from: number;
  to: number;
}

const CELL = 2; // degrees

/**
 * Uniform-grid spatial index over track edges, used for hover tooltips (the GPU layer cannot be
 * picked with `queryRenderedFeatures`). Each edge is registered in every cell its bbox touches.
 * Stored in CSR form (two typed arrays) so a 200 k-edge index builds in a few ms and stays small.
 */
export class TrackIndex {
  private readonly cols = Math.ceil(360 / CELL) + 1;
  private readonly rows = Math.ceil(180 / CELL) + 1;
  private readonly start: Uint32Array;
  private readonly items: Uint32Array;

  constructor(private readonly buffers: TrackBuffers) {
    const { lonlat, count } = buffers;
    const cells = this.cols * this.rows;
    const counts = new Uint32Array(cells + 1);

    const forEachCell = (e: number, fn: (cell: number) => void) => {
      const lo = Math.min(lonlat[4 * e] as number, lonlat[4 * e + 2] as number);
      const hi = Math.max(lonlat[4 * e] as number, lonlat[4 * e + 2] as number);
      const la = Math.min(lonlat[4 * e + 1] as number, lonlat[4 * e + 3] as number);
      const lb = Math.max(lonlat[4 * e + 1] as number, lonlat[4 * e + 3] as number);
      for (let y = Math.floor((la + 90) / CELL); y <= Math.floor((lb + 90) / CELL); y += 1) {
        for (let x = Math.floor((lo + 180) / CELL); x <= Math.floor((hi + 180) / CELL); x += 1) {
          fn(y * this.cols + x);
        }
      }
    };

    for (let e = 0; e < count; e += 1)
      forEachCell(e, (c) => (counts[c + 1] = (counts[c + 1] as number) + 1));
    for (let c = 0; c < cells; c += 1)
      counts[c + 1] = (counts[c + 1] as number) + (counts[c] as number);

    this.start = counts;
    this.items = new Uint32Array(counts[cells] as number);
    const cursor = counts.slice(0, cells);
    for (let e = 0; e < count; e += 1) {
      forEachCell(e, (c) => {
        this.items[cursor[c] as number] = e;
        cursor[c] = (cursor[c] as number) + 1;
      });
    }
  }

  /** Nearest visible edge within `toleranceDeg` of (lon, lat), or null. */
  nearest(lon: number, lat: number, toleranceDeg: number, filter: EdgeFilter): NearestEdge | null {
    const { lonlat, instances, satellites, epoch0 } = this.buffers;
    const reach = Math.max(1, Math.ceil(toleranceDeg / CELL));
    const cx = Math.floor((lon + 180) / CELL);
    const cy = Math.floor((lat + 90) / CELL);
    const kx = Math.cos((lat * Math.PI) / 180) || 1e-6;

    let best: NearestEdge | null = null;
    const seen = new Set<number>();

    for (let y = Math.max(0, cy - reach); y <= Math.min(this.rows - 1, cy + reach); y += 1) {
      for (let x = Math.max(0, cx - reach); x <= Math.min(this.cols - 1, cx + reach); x += 1) {
        const c = y * this.cols + x;
        for (let i = this.start[c] as number; i < (this.start[c + 1] as number); i += 1) {
          const e = this.items[i] as number;
          if (seen.has(e)) continue;
          seen.add(e);

          const sat = instances[e * INSTANCE_STRIDE + 5] as number;
          const t = instances[e * INSTANCE_STRIDE + 4] as number;
          if (((filter.mask >> sat) & 1) === 0 || t < filter.from || t > filter.to) continue;

          const d = distanceToEdgeDeg(lon, lat, kx, lonlat, e);
          if (d <= toleranceDeg && (!best || d < best.distanceDeg)) {
            best = {
              edge: e,
              satellite: satellites[sat] as string,
              time: t + epoch0,
              distanceDeg: d,
            };
          }
        }
      }
    }
    return best;
  }
}

/** Planar point–segment distance in degrees with longitude scaled by cos(lat). */
function distanceToEdgeDeg(
  lon: number,
  lat: number,
  kx: number,
  ll: Float32Array,
  e: number,
): number {
  const ax = ((ll[4 * e] as number) - lon) * kx;
  const ay = (ll[4 * e + 1] as number) - lat;
  const bx = ((ll[4 * e + 2] as number) - lon) * kx;
  const by = (ll[4 * e + 3] as number) - lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
