import { HttpError } from '../http/errors';
import type { SatelliteRow } from '../repositories/trackRepository';

/** In-memory index of the (tiny, immutable) satellites table: name <-> id. */
export class SatelliteCatalog {
  private readonly byName = new Map<string, number>();
  private readonly nameList: string[];

  constructor(rows: readonly SatelliteRow[]) {
    const sorted = [...rows].sort((a, b) => a.id - b.id);
    this.nameList = sorted.map((r) => r.name);
    for (const r of sorted) this.byName.set(r.name, r.id);
  }

  /** Ordered by id, so index === id. */
  names(): string[] {
    return this.nameList;
  }

  nameOf(id: number): string {
    const name = this.nameList[id];
    if (name === undefined) throw new Error(`Unknown satellite id ${id}`);
    return name;
  }

  /** Resolves user-supplied names to ids; unknown names are a client error. */
  idsFor(names: readonly string[]): number[] {
    const unknown = names.filter((n) => !this.byName.has(n));
    if (unknown.length) {
      throw new HttpError(400, 'UNKNOWN_SATELLITE', `Unknown satellite(s): ${unknown.join(', ')}`, {
        known: this.nameList,
      });
    }
    return [...new Set(names.map((n) => this.byName.get(n)!))];
  }

  allIds(): number[] {
    return this.nameList.map((_, i) => i);
  }
}
