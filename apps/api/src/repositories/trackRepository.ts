import type { Database } from '../infra/database';
import { num } from '../infra/database';

export interface SatelliteRow {
  id: number;
  name: string;
  segmentCount: number;
  start: number;
  end: number;
  altMin: number;
  altMax: number;
}

export interface DatasetRow {
  version: string;
  start: number;
  end: number;
  segmentCount: number;
  sampleIntervalSeconds: number;
}

export interface SegmentRow {
  satId: number;
  t0: number;
  t1: number;
  lons: number[];
  lats: number[];
}

export interface SegmentFilter {
  satIds?: readonly number[];
  /** Epoch seconds; segments overlapping [from, to] are returned. */
  from?: number;
  to?: number;
}

/** Guarantees ids are safe to inline in SQL (they originate from our own `satellites` table). */
function idList(ids: readonly number[]): string {
  if (!ids.every((id) => Number.isInteger(id)))
    throw new TypeError('satellite ids must be integers');
  return ids.length ? ids.join(',') : 'NULL';
}

export class TrackRepository {
  constructor(private readonly db: Database) {}

  async listSatellites(): Promise<SatelliteRow[]> {
    const rows = await this.db.all(
      'SELECT id, name, segment_count, t_start, t_end, alt_min, alt_max FROM satellites ORDER BY id',
    );
    return rows.map((r) => ({
      id: num(r.id),
      name: String(r.name),
      segmentCount: num(r.segment_count),
      start: num(r.t_start),
      end: num(r.t_end),
      altMin: num(r.alt_min),
      altMax: num(r.alt_max),
    }));
  }

  async getDataset(): Promise<DatasetRow> {
    const rows = await this.db.all('SELECT key, value FROM meta');
    const kv = new Map(rows.map((r) => [String(r.key), String(r.value)]));
    const get = (k: string) => {
      const v = kv.get(k);
      if (v === undefined) throw new Error(`Database is missing meta key "${k}" — re-run ingest`);
      return v;
    };
    return {
      version: get('version'),
      start: Number(get('start')),
      end: Number(get('end')),
      segmentCount: Number(get('segments')),
      sampleIntervalSeconds: Number(get('sample_interval')),
    };
  }

  async findSegments({ satIds, from, to }: SegmentFilter): Promise<SegmentRow[]> {
    const where: string[] = [];
    const params: Record<string, number> = {};
    if (satIds) where.push(`sat_id IN (${idList(satIds)})`);
    if (from !== undefined) {
      where.push('t1 >= $from');
      params.from = from;
    }
    if (to !== undefined) {
      where.push('t0 <= $to');
      params.to = to;
    }
    const rows = await this.db.all(
      `SELECT sat_id, t0, t1, lons, lats FROM segments
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY t0, sat_id`,
      params,
    );
    return rows.map((r) => ({
      satId: num(r.sat_id),
      t0: num(r.t0),
      t1: num(r.t1),
      lons: (r.lons as unknown[]).map(num),
      lats: (r.lats as unknown[]).map(num),
    }));
  }
}
