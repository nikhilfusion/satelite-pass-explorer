import type { Access } from '@sat/contract';
import { useEffect, useMemo, useRef } from 'react';

import { groupAccesses, type SortKey } from '@/lib/accessSort';
import { epochOf, fmtDuration, fmtTime } from '@/lib/time';
import ui from '@/styles/ui.module.css';

import styles from './AccessTable.module.css';

interface Props {
  accesses: readonly Access[];
  colors: Record<string, string>;
  sort: SortKey;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

export function AccessTable({
  accesses,
  colors,
  sort,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: Props) {
  const groups = useMemo(() => groupAccesses(accesses, sort), [accesses, sort]);
  const selectedRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (accesses.length === 0) {
    return (
      <p className={`${ui.muted} ${styles.empty}`}>
        No accesses within this radius and time window.
      </p>
    );
  }

  return (
    <div className={styles.scroll} role="region" aria-label="Accesses">
      <div className={`${styles.head} ${ui.muted}`}>
        <span>Pass (UTC)</span>
        <span>Sat</span>
        <span>Dur</span>
        <span>Max el</span>
        <span>Min dist</span>
      </div>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className={styles.day}>{g.label}</h3>
          <ul className={styles.list}>
            {g.items.map((a) => (
              <li
                key={a.id}
                ref={a.id === selectedId ? selectedRef : undefined}
                className={styles.row}
                data-hover={a.id === hoveredId}
                data-selected={a.id === selectedId}
                data-testid="access-row"
                onMouseEnter={() => onHover(a.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(a.id === selectedId ? null : a.id)}
              >
                <span className={ui.mono}>
                  {fmtTime(epochOf(a.start))}
                  <span className={ui.muted}> → </span>
                  {fmtTime(epochOf(a.end))}
                </span>
                <span className={ui.mono}>
                  <span
                    className={ui.dot}
                    style={{
                      background: colors[a.satellite],
                      display: 'inline-block',
                      marginRight: 5,
                    }}
                  />
                  {a.satellite}
                </span>
                <span className={ui.mono}>{fmtDuration(a.durationSeconds)}</span>
                <span className={ui.mono}>{a.maxElevationDeg.toFixed(1)}°</span>
                <span className={ui.mono}>{a.minDistanceKm.toFixed(0)} km</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
