import type { Access } from '@sat/contract';
import { useMemo } from 'react';

import { epochOf, fmtDate, fmtTime } from '@/lib/time';
import { timelineTicks } from '@/lib/timelineTicks';
import ui from '@/styles/ui.module.css';

import styles from './Timeline.module.css';

interface Props {
  satellites: readonly string[];
  accesses: readonly Access[];
  window: [number, number];
  colors: Record<string, string>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

const pct = (t: number, from: number, to: number) => ((t - from) / (to - from)) * 100;

/** One lane per satellite; each pass is a bar positioned by time. Hover/selection mirror the map and list. */
export function Timeline({
  satellites,
  accesses,
  window: [from, to],
  colors,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: Props) {
  const lanes = useMemo(() => {
    const by = new Map<string, Access[]>(satellites.map((s) => [s, []]));
    for (const a of accesses) by.get(a.satellite)?.push(a);
    return [...by.entries()];
  }, [satellites, accesses]);
  const ticks = useMemo(() => timelineTicks(from, to), [from, to]);
  const fmtTick = (t: number) =>
    to - from > 2 * 86400 || t % 86400 === 0 ? fmtDate(t).slice(5) : fmtTime(t).slice(0, 5);

  return (
    <div className={styles.root} aria-label="Pass timeline">
      {lanes.map(([sat, items]) => (
        <div key={sat} className={styles.lane}>
          <span className={`${styles.name} ${ui.mono}`} style={{ color: colors[sat] }}>
            {sat}
          </span>
          <div className={styles.track}>
            {ticks.map((t) => (
              <span key={t} className={styles.grid} style={{ left: `${pct(t, from, to)}%` }} />
            ))}
            {items.map((a) => {
              const s = epochOf(a.start);
              const e = epochOf(a.end);
              return (
                <button
                  key={a.id}
                  className={styles.bar}
                  data-hover={a.id === hoveredId}
                  data-selected={a.id === selectedId}
                  style={{
                    left: `${pct(s, from, to)}%`,
                    width: `max(3px, ${pct(e, from, to) - pct(s, from, to)}%)`,
                    background: colors[sat],
                  }}
                  title={`${sat} ${fmtTime(s)}–${fmtTime(e)} · ${a.maxElevationDeg.toFixed(0)}° max`}
                  onMouseEnter={() => onHover(a.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(a.id === selectedId ? null : a.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className={styles.axis}>
        <span className={styles.name} />
        <div className={styles.track}>
          {ticks
            .filter((t) => pct(t, from, to) < 94)
            .map((t) => (
              <span key={t} className={styles.tickLabel} style={{ left: `${pct(t, from, to)}%` }}>
                {fmtTick(t)}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
