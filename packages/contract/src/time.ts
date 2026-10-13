/** Epoch seconds <-> ISO helpers. The whole system works in UTC epoch seconds internally. */

export function isoToEpoch(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO date: ${iso}`);
  return Math.floor(ms / 1000);
}

export function epochToIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().replace('.000Z', 'Z');
}
