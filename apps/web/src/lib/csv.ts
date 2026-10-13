import type { Access } from '@sat/contract';

const HEADER = [
  'satellite',
  'start_utc',
  'end_utc',
  'duration_s',
  'tca_utc',
  'min_distance_km',
  'max_elevation_deg',
  'slant_range_km',
];

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function accessesToCsv(accesses: readonly Access[]): string {
  const rows = accesses.map((a) =>
    [
      a.satellite,
      a.start,
      a.end,
      a.durationSeconds,
      a.tca,
      a.minDistanceKm,
      a.maxElevationDeg,
      a.slantRangeKm,
    ]
      .map(cell)
      .join(','),
  );
  return [HEADER.join(','), ...rows].join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
