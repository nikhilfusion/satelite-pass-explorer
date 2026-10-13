import { useEffect, useState } from 'react';

import { formatLat, formatLon } from '@/lib/geo';
import { PLACES, radiusToSlider, sliderToRadius } from '@/lib/places';
import { clamp } from '@/lib/time';
import type { Target } from '@/state/store';
import ui from '@/styles/ui.module.css';

import { DateTimeField } from './DateTimeField';
import styles from './TargetPanel.module.css';

interface Props {
  target: Target | null;
  radiusKm: number;
  mapRange: [number, number];
  customWindow: [number, number] | null;
  dataset: { start: number; end: number };
  onTarget: (t: Target | null, opts?: { fly?: boolean }) => void;
  onRadius: (km: number) => void;
  onCustomWindow: (w: [number, number] | null) => void;
}

export function TargetPanel({
  target,
  radiusKm,
  mapRange,
  customWindow,
  dataset,
  onTarget,
  onRadius,
  onCustomWindow,
}: Props) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  useEffect(() => {
    setLat(target ? target.lat.toFixed(4) : '');
    setLon(target ? target.lon.toFixed(4) : '');
  }, [target]);

  const commitCoords = () => {
    const la = Number(lat);
    const lo = Number(lon);
    if (lat.trim() && lon.trim() && Number.isFinite(la) && Number.isFinite(lo)) {
      onTarget({ lat: clamp(la, -90, 90), lon: clamp(lo, -180, 180) }, { fly: true });
    }
  };

  const window = customWindow ?? mapRange;

  return (
    <section className={ui.panel} aria-labelledby="target-title">
      <div className={ui.panelHead}>
        <h2 id="target-title" className={ui.title}>
          Ground target
        </h2>
        {target ? (
          <button className={ui.btn} onClick={() => onTarget(null)}>
            Clear
          </button>
        ) : null}
      </div>

      {target ? (
        <p className={`${ui.mono} ${styles.coords}`}>
          {formatLat(target.lat)} · {formatLon(target.lon)}
        </p>
      ) : (
        <p className={ui.muted}>Click anywhere on the map to list the accesses over that point.</p>
      )}

      <div className={styles.coordInputs}>
        <label>
          <span className={ui.muted}>Lat</span>
          <input
            className={ui.input}
            inputMode="decimal"
            value={lat}
            placeholder="25.2048"
            onChange={(e) => setLat(e.target.value)}
            onBlur={commitCoords}
            onKeyDown={(e) => e.key === 'Enter' && commitCoords()}
          />
        </label>
        <label>
          <span className={ui.muted}>Lon</span>
          <input
            className={ui.input}
            inputMode="decimal"
            value={lon}
            placeholder="55.2708"
            onChange={(e) => setLon(e.target.value)}
            onBlur={commitCoords}
            onKeyDown={(e) => e.key === 'Enter' && commitCoords()}
          />
        </label>
      </div>

      <div className={styles.places}>
        {PLACES.map((p) => (
          <button
            key={p.name}
            className={ui.btn}
            onClick={() => onTarget({ lat: p.lat, lon: p.lon }, { fly: true })}
          >
            {p.name}
          </button>
        ))}
      </div>

      <label className={styles.radius}>
        <span className={ui.row} style={{ justifyContent: 'space-between' }}>
          <span className={ui.muted}>Radius</span>
          <span className={ui.mono}>{radiusKm} km</span>
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={radiusToSlider(radiusKm)}
          aria-label="Radius in kilometres"
          onChange={(e) => onRadius(sliderToRadius(Number(e.target.value)))}
        />
      </label>

      <label className={styles.follow}>
        <input
          type="checkbox"
          checked={!customWindow}
          onChange={(e) => onCustomWindow(e.target.checked ? null : [...mapRange])}
        />
        <span>Use the map time range</span>
      </label>

      <div className={styles.window}>
        <DateTimeField
          label="Start"
          value={window[0]}
          min={dataset.start}
          max={window[1] - 60}
          disabled={!customWindow}
          onCommit={(v) => onCustomWindow([v, window[1]])}
        />
        <DateTimeField
          label="End"
          value={window[1]}
          min={window[0] + 60}
          max={dataset.end}
          disabled={!customWindow}
          onCommit={(v) => onCustomWindow([window[0], v])}
        />
      </div>
    </section>
  );
}
