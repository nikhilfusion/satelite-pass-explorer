/** UTC time helpers. The whole UI is deliberately UTC-only: passes are an operational, global data set. */

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

const d = (epoch: number) => new Date(epoch * 1000);

/** 2027-03-01 */
export const fmtDate = (epoch: number) => d(epoch).toISOString().slice(0, 10);

/** 06:58:00 */
export const fmtTime = (epoch: number) => d(epoch).toISOString().slice(11, 19);

/** 2027-03-01 06:58 */
export const fmtDateTime = (epoch: number) => `${fmtDate(epoch)} ${fmtTime(epoch).slice(0, 5)}`;

/** 2m 18s · 1h 05m · 45s */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
}

/** Text for the UTC date-time inputs: `2027-03-01 06:58`. */
export const toInputValue = (epoch: number) =>
  d(epoch).toISOString().slice(0, 16).replace('T', ' ');

/** Inverse of toInputValue; accepts a space or `T` separator, interpreted as UTC. Null when unparsable. */
export function fromInputValue(value: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(value.trim());
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:00Z`);
  return Number.isNaN(ms) ? null : ms / 1000;
}

/** Start of the UTC day containing `epoch`. */
export const startOfUtcDay = (epoch: number) => Math.floor(epoch / 86400) * 86400;

export const isoOf = (epoch: number) => d(epoch).toISOString().replace('.000Z', 'Z');
export const epochOf = (iso: string) => Math.floor(Date.parse(iso) / 1000);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** UTC day boundaries inside the dataset, used for tick marks and one-click day presets. */
export function dayBoundaries(start: number, end: number): number[] {
  const out: number[] = [];
  // A trailing sliver (the data set ends at 00:01 of the last day) is not worth a day preset.
  for (let t = startOfUtcDay(start); end - t >= 3600; t += 86400) out.push(t);
  return out;
}
