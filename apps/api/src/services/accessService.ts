import type { AccessesQuery, AccessesResponse } from '@sat/contract';
import { epochToIso, isoToEpoch } from '@sat/contract';

import { buildAccess, groupContiguous } from '../domain/accesses';
import type { AccessRepository } from '../repositories/accessRepository';
import type { SatelliteCatalog } from './satelliteCatalog';

export class AccessService {
  constructor(
    private readonly repo: AccessRepository,
    private readonly catalog: SatelliteCatalog,
  ) {}

  async findAccesses(query: AccessesQuery): Promise<AccessesResponse> {
    const started = performance.now();
    const satIds = query.satellites?.length
      ? this.catalog.idsFor(query.satellites)
      : this.catalog.allIds();
    const from = isoToEpoch(query.from);
    const to = isoToEpoch(query.to);

    const edges = await this.repo.findEdgesWithinRadius({
      lat: query.lat,
      lon: query.lon,
      radiusKm: query.radiusKm,
      from,
      to,
      satIds,
    });

    const accesses = groupContiguous(edges)
      .map((run) => buildAccess(run, this.catalog.nameOf(run[0]!.satelliteId)))
      .sort((a, b) => a.start.localeCompare(b.start) || a.satellite.localeCompare(b.satellite));

    const bySatellite: Record<string, number> = {};
    for (const a of accesses) bySatellite[a.satellite] = (bySatellite[a.satellite] ?? 0) + 1;

    return {
      query: {
        lat: query.lat,
        lon: query.lon,
        radiusKm: query.radiusKm,
        from: epochToIso(from),
        to: epochToIso(to),
        satellites: satIds.map((id) => this.catalog.nameOf(id)),
      },
      summary: {
        count: accesses.length,
        bySatellite,
        totalDurationSeconds: accesses.reduce((sum, a) => sum + a.durationSeconds, 0),
        tookMs: Math.round(performance.now() - started),
      },
      accesses,
    };
  }
}
