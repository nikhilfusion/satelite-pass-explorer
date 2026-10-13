import type { Access } from '@sat/contract';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import { circlePolygons } from '@/lib/geo';

export const SRC = { target: 'target', accesses: 'accesses' } as const;
export const LAYER = {
  circleFill: 'target-circle-fill',
  circleLine: 'target-circle-line',
  pin: 'target-pin',
  accessHit: 'accesses-hit',
  accessCasing: 'accesses-casing',
  accessLine: 'accesses-line',
} as const;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** `['match', ['get', 'sat'], 'A', '#..', 'B', '#..', fallback]` */
export function colorExpression(
  colors: Record<string, string>,
  prop = 'sat',
): ExpressionSpecification {
  const pairs = Object.entries(colors).flatMap(([id, color]) => [id, color]);
  if (pairs.length === 0) return ['literal', '#888888'] as unknown as ExpressionSpecification;
  return ['match', ['get', prop], ...pairs, '#888888'] as unknown as ExpressionSpecification;
}

/**
 * Installs (or re-installs, after a basemap style swap) every custom source + layer.
 * Layer order = draw order: (GPU track layer, added by the caller) < target < access highlight.
 */
export function installLayers(map: MapLibreMap, colors: Record<string, string>): void {
  const colorExpr = colorExpression(colors);

  if (!map.getSource(SRC.target)) {
    map.addSource(SRC.target, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: LAYER.circleFill,
      type: 'fill',
      source: SRC.target,
      filter: ['==', ['get', 'kind'], 'circle'],
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.07 },
    });
    map.addLayer({
      id: LAYER.circleLine,
      type: 'line',
      source: SRC.target,
      filter: ['==', ['get', 'kind'], 'ring'],
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [3, 2] },
    });
    map.addLayer({
      id: LAYER.pin,
      type: 'circle',
      source: SRC.target,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#f72585',
        'circle-stroke-width': 3,
      },
    });
  }

  if (!map.getSource(SRC.accesses)) {
    map.addSource(SRC.accesses, { type: 'geojson', data: EMPTY, promoteId: 'id' });
    map.addLayer({
      id: LAYER.accessCasing,
      type: 'line',
      source: SRC.accesses,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#05070b',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          9,
          ['boolean', ['feature-state', 'hover'], false],
          8,
          6.5,
        ],
        'line-opacity': 0.85,
      },
    });
    map.addLayer({
      id: LAYER.accessLine,
      type: 'line',
      source: SRC.accesses,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colorExpr,
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          6,
          ['boolean', ['feature-state', 'hover'], false],
          5,
          3.5,
        ],
      },
    });
    // Wide invisible stroke = forgiving hit area for hover/click.
    map.addLayer({
      id: LAYER.accessHit,
      type: 'line',
      source: SRC.accesses,
      paint: { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 },
    });
  }
}

const source = (map: MapLibreMap, id: string) => map.getSource(id) as GeoJSONSource | undefined;

export function setTargetData(
  map: MapLibreMap,
  target: { lat: number; lon: number } | null,
  radiusKm: number,
): void {
  const src = source(map, SRC.target);
  if (!src) return;
  if (!target) {
    src.setData(EMPTY);
    return;
  }
  const polygons = circlePolygons(target.lon, target.lat, radiusKm);
  const features: GeoJSON.Feature[] = [
    {
      type: 'Feature',
      properties: { kind: 'pin' },
      geometry: { type: 'Point', coordinates: [target.lon, target.lat] },
    },
  ];
  if (polygons.length) {
    features.push({
      type: 'Feature',
      properties: { kind: 'circle' },
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    });
    features.push({
      type: 'Feature',
      properties: { kind: 'ring' },
      geometry: {
        type: 'MultiLineString',
        coordinates: polygons.map((p) => p[0] as [number, number][]),
      },
    });
  }
  src.setData({ type: 'FeatureCollection', features });
}

export function setAccessData(map: MapLibreMap, accesses: readonly Access[]): void {
  source(map, SRC.accesses)?.setData({
    type: 'FeatureCollection',
    features: accesses.map((a) => ({
      type: 'Feature',
      properties: { id: a.id, sat: a.satellite },
      geometry: a.geometry,
    })),
  });
}

/** Applies the hover/selected highlight via feature-state (no data re-upload). */
export function setAccessHighlight(
  map: MapLibreMap,
  prev: { hovered: string | null; selected: string | null },
  next: { hovered: string | null; selected: string | null },
): void {
  if (!map.getSource(SRC.accesses)) return;
  const set = (id: string | null, state: Record<string, boolean>) => {
    if (id) map.setFeatureState({ source: SRC.accesses, id }, state);
  };
  if (prev.hovered !== next.hovered) {
    set(prev.hovered, { hover: false });
    set(next.hovered, { hover: true });
  }
  if (prev.selected !== next.selected) {
    set(prev.selected, { selected: false });
    set(next.selected, { selected: true });
  }
}
