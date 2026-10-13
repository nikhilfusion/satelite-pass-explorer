import type { Access } from '@sat/contract';

import { epochOf, fmtDate } from './time';

export type SortKey = 'time' | 'elevation' | 'duration' | 'distance';

export const SORTERS: Record<SortKey, (a: Access, b: Access) => number> = {
  time: (a, b) => a.start.localeCompare(b.start) || a.satellite.localeCompare(b.satellite),
  elevation: (a, b) => b.maxElevationDeg - a.maxElevationDeg,
  duration: (a, b) => b.durationSeconds - a.durationSeconds,
  distance: (a, b) => a.minDistanceKm - b.minDistanceKm,
};

export interface Group {
  key: string;
  label: string;
  items: Access[];
}

/** Sorted list; chronological sort is grouped by UTC day (like an operations pass list). */
export function groupAccesses(accesses: readonly Access[], sort: SortKey): Group[] {
  const sorted = [...accesses].sort(SORTERS[sort]);
  if (sort !== 'time') return [{ key: 'all', label: `Ranked by ${sort}`, items: sorted }];
  const groups = new Map<string, Group>();
  for (const a of sorted) {
    const day = fmtDate(epochOf(a.start));
    const g = groups.get(day) ?? { key: day, label: day, items: [] };
    g.items.push(a);
    groups.set(day, g);
  }
  return [...groups.values()];
}
