import 'maplibre-gl/dist/maplibre-gl.css';

import type { Access } from '@sat/contract';
import maplibregl, { type Map as MapLibreMap, type Popup } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type Bounds, wrapLon } from '@/lib/geo';
import { fmtDateTime } from '@/lib/time';
import { type TrackBuffers, visibilityMask } from '@/lib/trackBuffers';
import { TrackIndex } from '@/lib/trackIndex';
import type { ProjectionMode, Target } from '@/state/store';

import {
  colorExpression,
  installLayers,
  LAYER,
  setAccessData,
  setAccessHighlight,
  setTargetData,
} from './layers';
import { resolveBasemapStyle } from './style';
import { colorsToUniform, TrackLayer } from './TrackLayer';

// Read at import time: the URL-sync effect later rewrites the query string.
const DEBUG_HOOK = new URLSearchParams(window.location.search).has('debug');

/** Pixels of slack when hit-testing a track under the cursor. */
const HOVER_TOLERANCE_PX = 6;

export interface FitRequest {
  /** Changes whenever a new fit should happen (even to identical bounds). */
  key: string;
  bounds: Bounds;
}

export interface MapViewProps {
  tracks: TrackBuffers | null;
  colors: Record<string, string>;
  visibleSatellites: readonly string[];
  range: [number, number];
  dimTracks: boolean;
  target: Target | null;
  radiusKm: number;
  accesses: readonly Access[];
  hoveredId: string | null;
  selectedId: string | null;
  projection: ProjectionMode;
  fit: FitRequest | null;
  onPickTarget: (target: Target) => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onStatus?: (status: { basemap: 'loading' | 'ready' | 'fallback' }) => void;
}

/**
 * Thin imperative shell around MapLibre. React owns *what* is shown (props); this component owns
 * *how* — each concern (dataset, filter uniforms, target, highlight…) has its own effect so a
 * slider drag only touches the single call it needs, never the 700 k-vertex dataset.
 */
export function MapView(props: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const trackLayerRef = useRef<TrackLayer | null>(null);
  const [ready, setReady] = useState(false);

  // Latest props for event handlers registered once (avoids re-binding on every render).
  const live = useRef(props);
  live.current = props;
  const highlightRef = useRef<{ hovered: string | null; selected: string | null }>({
    hovered: null,
    selected: null,
  });

  const { tracks } = props;
  const index = useMemo(() => (tracks ? new TrackIndex(tracks) : null), [tracks]);
  const indexRef = useRef(index);
  indexRef.current = index;

  /* ---- create map once ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;
    let map: MapLibreMap | null = null;
    let popup: Popup | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let raf = 0;

    void (async () => {
      live.current.onStatus?.({ basemap: 'loading' });
      const { style, usedFallback } = await resolveBasemapStyle();
      if (disposed) return;

      map = new maplibregl.Map({
        container,
        style,
        center: [30, 20],
        zoom: 1.6,
        minZoom: 0.8,
        maxZoom: 12,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
      mapRef.current = map;
      // Opt-in debug/e2e hook: open the app with ?debug to get `window.__orbitMap`.
      if (DEBUG_HOOK) (window as unknown as { __orbitMap?: MapLibreMap }).__orbitMap = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');

      map.on('style.load', () => {
        if (!map) return;
        map.setProjection({ type: live.current.projection });
        const trackLayer = new TrackLayer();
        map.addLayer(trackLayer);
        trackLayerRef.current = trackLayer;
        installLayers(map, live.current.colors);
        setReady(true);
        live.current.onStatus?.({ basemap: usedFallback ? 'fallback' : 'ready' });
      });

      popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'orbitPopup',
        offset: 10,
      });

      map.on('click', (e) => {
        if (!map || !e.lngLat) return;
        const hit = map.queryRenderedFeatures(e.point, { layers: [LAYER.accessHit] })[0];
        if (hit) {
          const id = String(hit.properties?.id);
          live.current.onSelect(live.current.selectedId === id ? null : id);
          return;
        }
        live.current.onPickTarget({ lat: e.lngLat.lat, lon: wrapLon(e.lngLat.lng) });
      });

      map.on('mousemove', (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          if (!map || !map.getLayer(LAYER.accessHit)) return;
          const hit = map.queryRenderedFeatures(e.point, { layers: [LAYER.accessHit] })[0];
          const id = hit ? String(hit.properties?.id) : null;
          if (id !== live.current.hoveredId) live.current.onHover(id);
          map.getCanvas().style.cursor = 'crosshair';

          // Tooltip for background tracks (only when no access is under the cursor).
          const idx = indexRef.current;
          const { tracks: buf, visibleSatellites, range } = live.current;
          if (!hit && idx && buf && e.lngLat) {
            const tolerance = (HOVER_TOLERANCE_PX * 360) / (512 * 2 ** map.getZoom());
            const found = idx.nearest(wrapLon(e.lngLat.lng), e.lngLat.lat, tolerance, {
              mask: visibilityMask(buf.satellites, visibleSatellites),
              from: range[0] - buf.epoch0,
              to: range[1] - buf.epoch0,
            });
            if (found) {
              popup
                ?.setLngLat(e.lngLat)
                .setText(`${found.satellite} · ${fmtDateTime(found.time)} UTC`)
                .addTo(map);
              return;
            }
          }
          popup?.remove();
        });
      });
      map.on('mouseout', () => {
        popup?.remove();
        live.current.onHover(null);
      });

      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      popup?.remove();
      map?.remove();
      mapRef.current = null;
      trackLayerRef.current = null;
      setReady(false);
    };
  }, []);

  const { colors, visibleSatellites, range, dimTracks } = props;

  /* ---- dataset: uploaded to the GPU once ---- */
  useEffect(() => {
    if (ready) trackLayerRef.current?.setData(tracks);
  }, [ready, tracks]);

  /* ---- colours ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (tracks)
      trackLayerRef.current?.setState({ colors: colorsToUniform(tracks.satellites, colors) });
    if (map.getLayer(LAYER.accessLine)) {
      map.setPaintProperty(LAYER.accessLine, 'line-color', colorExpression(colors));
    }
  }, [ready, colors, tracks]);

  /* ---- filters: satellites + time range => shader uniforms only ---- */
  useEffect(() => {
    if (!ready || !tracks) return;
    trackLayerRef.current?.setState({
      mask: visibilityMask(tracks.satellites, visibleSatellites),
      from: range[0] - tracks.epoch0,
      to: range[1] - tracks.epoch0,
    });
  }, [ready, tracks, visibleSatellites, range]);

  /* ---- dim background while a target is active ---- */
  useEffect(() => {
    if (ready) trackLayerRef.current?.setState({ opacity: dimTracks ? 0.2 : 0.8 });
  }, [ready, dimTracks]);

  /* ---- target marker + radius ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) setTargetData(map, props.target, props.radiusKm);
  }, [ready, props.target, props.radiusKm]);

  /* ---- access highlight geometry ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setAccessData(map, props.accesses);
    // New features have no state yet: re-apply the current highlight from scratch.
    const next = { hovered: live.current.hoveredId, selected: live.current.selectedId };
    setAccessHighlight(map, { hovered: null, selected: null }, next);
    highlightRef.current = next;
  }, [ready, props.accesses]);

  /* ---- hover / selection (feature-state only) ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const next = { hovered: props.hoveredId, selected: props.selectedId };
    setAccessHighlight(map, highlightRef.current, next);
    highlightRef.current = next;
  }, [ready, props.hoveredId, props.selectedId]);

  /* ---- projection ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) map.setProjection({ type: props.projection });
  }, [ready, props.projection]);

  /* ---- camera ---- */
  const { fit } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !fit) return;
    map.fitBounds(fit.bounds, {
      padding: { top: 70, bottom: 70, left: 70, right: 70 },
      maxZoom: 6,
      duration: 900,
    });
    // `fit.key` is the trigger; bounds are read from the same object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fit?.key]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="map"
      data-ready={ready}
    />
  );
}
