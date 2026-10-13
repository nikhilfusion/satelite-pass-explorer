import type { StyleSpecification } from 'maplibre-gl';

/**
 * Vector basemap: OpenFreeMap (OpenMapTiles schema, OpenStreetMap data) — public, key-less, and
 * not hosted by us. Override with VITE_BASEMAP_STYLE_URL (e.g. a MapTiler / Protomaps style).
 */
export const BASEMAP_STYLE_URL: string =
  import.meta.env.VITE_BASEMAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/dark';

/** Offline-safe fallback: the tracks are still fully usable on a plain dark globe. */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: 'offline-fallback',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#111a2b' } }],
};

/**
 * Resolves the style to hand to MapLibre. We probe the style URL first so that a blocked or
 * offline basemap degrades to the fallback immediately, instead of leaving a blank map.
 */
export async function resolveBasemapStyle(
  url: string = BASEMAP_STYLE_URL,
  timeoutMs = 4000,
): Promise<{ style: string | StyleSpecification; usedFallback: boolean }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { style: url, usedFallback: false };
  } catch {
    return { style: FALLBACK_STYLE, usedFallback: true };
  }
}
