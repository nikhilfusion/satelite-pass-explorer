import type { AccessesQuery } from '@sat/contract';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAccesses, useMeta, useTracks } from '@/api/hooks';
import { satelliteColors } from '@/lib/colors';
import { type Bounds, boundsOf, circleRing } from '@/lib/geo';
import { epochOf, isoOf } from '@/lib/time';
import { buildTrackBuffers } from '@/lib/trackBuffers';
import { MapView } from '@/map/MapView';
import { effectiveRange, effectiveWindow, useExplorer, visibleSatellites } from '@/state/store';
import { encodeState } from '@/state/urlState';
import ui from '@/styles/ui.module.css';

import styles from './App.module.css';
import { AccessPanel } from './components/AccessPanel';
import { SatellitePanel } from './components/SatellitePanel';
import { TargetPanel } from './components/TargetPanel';
import { TimeRangePanel } from './components/TimeRangePanel';
import { useDebouncedValue } from './hooks';

export function App() {
  const meta = useMeta();
  const tracks = useTracks();
  const s = useExplorer();

  /* ---------- dataset-derived values ---------- */
  const satelliteIds = useMemo(() => meta.data?.satellites.map((x) => x.id) ?? [], [meta.data]);
  const colors = useMemo(() => satelliteColors(satelliteIds), [satelliteIds]);
  const dataset = useMemo(
    () =>
      meta.data
        ? { start: epochOf(meta.data.dataset.start), end: epochOf(meta.data.dataset.end) }
        : null,
    [meta.data],
  );
  const trackBuffers = useMemo(
    () => (tracks.data ? buildTrackBuffers(tracks.data) : null),
    [tracks.data],
  );

  const range = dataset ? effectiveRange(s.range, dataset) : ([0, 1] as [number, number]);
  const window = dataset ? effectiveWindow(s, dataset) : range;
  const visible = useMemo(
    () => visibleSatellites(satelliteIds, s.hidden),
    [satelliteIds, s.hidden],
  );

  /* ---------- accesses ---------- */
  const query = useMemo<AccessesQuery | null>(() => {
    if (!s.target || !dataset || visible.length === 0) return null;
    return {
      lat: s.target.lat,
      lon: s.target.lon,
      radiusKm: s.radiusKm,
      from: isoOf(window[0]),
      to: isoOf(window[1]),
      satellites: visible.length === satelliteIds.length ? undefined : visible,
    };
  }, [s.target, s.radiusKm, dataset, window[0], window[1], visible, satelliteIds.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const debouncedQuery = useDebouncedValue(query, 150);
  const accessesQuery = useAccesses(debouncedQuery);
  const accesses = useMemo(
    () => (s.target && query ? (accessesQuery.data?.accesses ?? []) : []),
    [s.target, query, accessesQuery.data],
  );

  /* ---------- camera requests ---------- */
  const [fit, setFit] = useState<{ key: string; bounds: Bounds } | null>(null);
  const flyToTarget = useCallback((lat: number, lon: number, radiusKm: number) => {
    const bounds = boundsOf([circleRing(lon, lat, radiusKm * 1.4)]);
    if (bounds) setFit({ key: `t-${lat}-${lon}-${radiusKm}-${Date.now()}`, bounds });
  }, []);

  const selectFromList = useCallback(
    (id: string | null) => {
      s.setSelected(id);
      const a = id ? accesses.find((x) => x.id === id) : undefined;
      if (!a || !s.target) return;
      const lines =
        a.geometry.type === 'LineString' ? [a.geometry.coordinates] : a.geometry.coordinates;
      const bounds = boundsOf(lines, [[s.target.lon, s.target.lat]]);
      if (bounds) setFit({ key: `a-${id}`, bounds });
    },
    [accesses, s],
  );

  /* ---------- URL sync (shareable state) ---------- */
  useEffect(() => {
    const qs = encodeState(s);
    const next = `${window_location().pathname}${qs ? `?${qs}` : ''}`;
    history.replaceState(null, '', next);
  }, [s.hidden, s.range, s.target, s.radiusKm, s.customWindow, s.selectedId, s.projection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore camera for a target that arrived via a shared link.
  useEffect(() => {
    if (s.target && dataset) flyToTarget(s.target.lat, s.target.lon, s.radiusKm);
    // run once when the dataset becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset !== null]);

  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the URL bar already holds the shareable link */
    }
  };

  const fatal = meta.error ?? tracks.error;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden />
          <h1>Orbit Explorer</h1>
          {meta.data ? (
            <span className={`${ui.muted} ${ui.mono}`}>
              {meta.data.dataset.segmentCount.toLocaleString()} segments · {satelliteIds.length}{' '}
              satellites
            </span>
          ) : null}
        </div>
        <div className={ui.row}>
          <div role="group" aria-label="Projection" className={ui.row}>
            {(['globe', 'mercator'] as const).map((p) => (
              <button
                key={p}
                className={`${ui.btn} ${s.projection === p ? ui.btnActive : ''}`}
                onClick={() => s.setProjection(p)}
              >
                {p === 'globe' ? 'Globe' : 'Flat'}
              </button>
            ))}
          </div>
          <button className={ui.btn} onClick={() => void share()}>
            {copied ? 'Link copied ✓' : 'Share view'}
          </button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        {meta.data && dataset ? (
          <>
            <SatellitePanel
              satellites={meta.data.satellites}
              colors={colors}
              hidden={s.hidden}
              counts={s.target ? accessesQuery.data?.summary.bySatellite : undefined}
              onToggle={s.toggleSatellite}
              onSetHidden={s.setHidden}
            />
            <TimeRangePanel dataset={dataset} range={range} onChange={s.setRange} />
            <TargetPanel
              target={s.target}
              radiusKm={s.radiusKm}
              mapRange={range}
              customWindow={s.customWindow}
              dataset={dataset}
              onTarget={(t, opts) => {
                s.setTarget(t);
                if (t && opts?.fly) flyToTarget(t.lat, t.lon, s.radiusKm);
              }}
              onRadius={s.setRadiusKm}
              onCustomWindow={s.setCustomWindow}
            />
          </>
        ) : (
          <p className={ui.muted}>{fatal ? '' : 'Loading dataset…'}</p>
        )}
      </aside>

      <main className={styles.main}>
        <div className={styles.mapWrap}>
          <MapView
            tracks={trackBuffers}
            colors={colors}
            visibleSatellites={visible}
            range={range}
            dimTracks={s.target !== null}
            target={s.target}
            radiusKm={s.radiusKm}
            accesses={accesses}
            hoveredId={s.hoveredId}
            selectedId={s.selectedId}
            projection={s.projection}
            fit={fit}
            onPickTarget={(t) => s.setTarget(t)}
            onHover={s.setHovered}
            onSelect={s.setSelected}
          />
          {tracks.isPending ? <div className={styles.overlay}>Loading tracks…</div> : null}
          {fatal ? (
            <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">
              {fatal.message}
              <button
                className={ui.btn}
                onClick={() => {
                  void meta.refetch();
                  void tracks.refetch();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>

        {s.target ? (
          <div className={styles.bottom}>
            <AccessPanel
              data={accessesQuery.data}
              loading={accessesQuery.isFetching}
              error={accessesQuery.error}
              satellites={visible}
              window={window}
              colors={colors}
              hoveredId={s.hoveredId}
              selectedId={s.selectedId}
              onHover={s.setHovered}
              onSelect={selectFromList}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

const window_location = () => window.location;
