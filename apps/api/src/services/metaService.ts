import type { MetaResponse } from '@sat/contract';
import { epochToIso } from '@sat/contract';

import type { TrackRepository } from '../repositories/trackRepository';

export class MetaService {
  private cached?: Promise<MetaResponse>;

  constructor(private readonly repo: TrackRepository) {}

  /** Dataset facts never change while the process runs: compute once. */
  getMeta(): Promise<MetaResponse> {
    this.cached ??= this.load();
    return this.cached;
  }

  private async load(): Promise<MetaResponse> {
    const [dataset, satellites] = await Promise.all([
      this.repo.getDataset(),
      this.repo.listSatellites(),
    ]);
    return {
      dataset: {
        version: dataset.version,
        start: epochToIso(dataset.start),
        end: epochToIso(dataset.end),
        segmentCount: dataset.segmentCount,
        sampleIntervalSeconds: dataset.sampleIntervalSeconds,
      },
      satellites: satellites.map((s) => ({
        id: s.name,
        segmentCount: s.segmentCount,
        start: epochToIso(s.start),
        end: epochToIso(s.end),
        minAltitudeKm: Math.round(s.altMin * 10) / 10,
        maxAltitudeKm: Math.round(s.altMax * 10) / 10,
      })),
    };
  }
}
