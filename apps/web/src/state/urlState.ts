import { clamp, epochOf, isoOf } from '@/lib/time';

import { DEFAULT_RADIUS_KM, type ExplorerState, type ProjectionMode } from './store';

/** The subset of state that is shareable via URL. */
export type SharedState = Pick<
  ExplorerState,
  'hidden' | 'range' | 'target' | 'radiusKm' | 'customWindow' | 'selectedId' | 'projection'
>;

const num = (v: string | null): number | null => {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pair = (a: string | null, b: string | null): [number, number] | null => {
  if (!a || !b) return null;
  const x = epochOf(a);
  const y = epochOf(b);
  return Number.isNaN(x) || Number.isNaN(y) || x >= y ? null : [x, y];
};

/** State -> query string (defaults are omitted to keep links short). */
export function encodeState(s: SharedState): string {
  const p = new URLSearchParams();
  if (s.hidden.length) p.set('hide', [...s.hidden].sort().join(','));
  if (s.range) {
    p.set('from', isoOf(s.range[0]));
    p.set('to', isoOf(s.range[1]));
  }
  if (s.target) {
    p.set('lat', s.target.lat.toFixed(4));
    p.set('lon', s.target.lon.toFixed(4));
  }
  if (s.radiusKm !== DEFAULT_RADIUS_KM) p.set('r', String(Math.round(s.radiusKm)));
  if (s.customWindow) {
    p.set('wfrom', isoOf(s.customWindow[0]));
    p.set('wto', isoOf(s.customWindow[1]));
  }
  if (s.selectedId) p.set('pass', s.selectedId);
  if (s.projection !== 'globe') p.set('proj', s.projection);
  return p.toString();
}

/** Query string -> partial state. Invalid values are ignored rather than throwing. */
export function decodeState(search: string): Partial<SharedState> {
  const p = new URLSearchParams(search);
  const out: Partial<SharedState> = {};

  const hide = p.get('hide');
  if (hide) out.hidden = hide.split(',').filter(Boolean);

  const range = pair(p.get('from'), p.get('to'));
  if (range) out.range = range;

  const lat = num(p.get('lat'));
  const lon = num(p.get('lon'));
  if (lat !== null && lon !== null) {
    out.target = { lat: clamp(lat, -90, 90), lon: clamp(lon, -180, 180) };
  }

  const r = num(p.get('r'));
  if (r !== null && r > 0) out.radiusKm = clamp(r, 1, 3000);

  const win = pair(p.get('wfrom'), p.get('wto'));
  if (win) out.customWindow = win;

  const pass = p.get('pass');
  if (pass) out.selectedId = pass;

  const proj = p.get('proj');
  if (proj === 'globe' || proj === 'mercator') out.projection = proj as ProjectionMode;

  return out;
}
