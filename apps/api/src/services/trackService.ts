import { DEFAULT_TRACK_STEP, type TracksQuery, type TracksResponse } from '@sat/contract';
import { isoToEpoch } from '@sat/contract';

import { splitAtAntimeridian, type Vertex } from '../domain/antimeridian';
import type { SegmentRow, TrackRepository } from '../repositories/trackRepository';
import type { SatelliteCatalog } from './satelliteCatalog';

const COORD_DECIMALS = 3; // ≈ 110 m — far below one pixel at any useful zoom
const CACHE_SIZE = 32;

const round = (v: number) => Math.round(v * 10 ** COORD_DECIMALS) / 10 ** COORD_DECIMALS;

/** Keeps every `step`-th vertex plus the last one (so polylines still meet end-to-end). */
export function decimate<T>(items: readonly T[], step: number): T[] {
  if (step <= 1 || items.length <= 2) return [...items];
  return items.filter((_, i) => i % step === 0 || i === items.length - 1);
}

/** Pure encoder: DB rows -> columnar payload. Exported for unit tests. */
export function encodeTracks(
  rows: readonly SegmentRow[],
  satelliteNames: readonly string[],
  step: number,
): TracksResponse {
  const out: TracksResponse = {
    satellites: [...satelliteNames],
    step,
    count: 0,
    sat: [],
    t0: [],
    t1: [],
    offsets: [0],
    coords: [],
  };

  for (const row of rows) {
    const vertices: Vertex[] = decimate(
      row.lons.map((lon, i): Vertex => [lon, row.lats[i]!, 0]),
      step,
    );
    for (const part of splitAtAntimeridian(vertices)) {
      out.sat.push(row.satId);
      out.t0.push(row.t0);
      out.t1.push(row.t1);
      for (const [lon, lat] of part) out.coords.push(round(lon), round(lat));
      out.offsets.push(out.coords.length / 2);
      out.count += 1;
    }
  }
  return out;
}

/**
 * Serves track polylines for the map. The dataset is immutable for the lifetime of a DB file,
 * so encoded responses are memoised (small LRU keyed by the canonical query).
 */
export class TrackService {
  private readonly cache = new Map<string, Promise<TracksResponse>>();

  constructor(
    private readonly repo: TrackRepository,
    private readonly catalog: SatelliteCatalog,
  ) {}

  async getTracks(query: TracksQuery): Promise<TracksResponse> {
    const satIds = query.satellites ? this.catalog.idsFor(query.satellites) : undefined;
    const from = query.from ? isoToEpoch(query.from) : undefined;
    const to = query.to ? isoToEpoch(query.to) : undefined;
    const step = query.step ?? DEFAULT_TRACK_STEP;

    const key = JSON.stringify([satIds?.slice().sort((a, b) => a - b), from, to, step]);
    const hit = this.cache.get(key);
    if (hit) {
      // refresh recency
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }

    const pending = this.repo
      .findSegments({ satIds, from, to })
      .then((rows) => encodeTracks(rows, this.catalog.names(), step));
    this.cache.set(key, pending);
    pending.catch(() => this.cache.delete(key)); // never cache failures

    if (this.cache.size > CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return pending;
  }
}
