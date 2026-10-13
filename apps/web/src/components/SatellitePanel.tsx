import type { Satellite } from '@sat/contract';

import ui from '@/styles/ui.module.css';

import styles from './SatellitePanel.module.css';

interface Props {
  satellites: readonly Satellite[];
  colors: Record<string, string>;
  hidden: readonly string[];
  /** Pass counts for the current target (omitted when no target). */
  counts?: Record<string, number>;
  onToggle: (id: string) => void;
  onSetHidden: (ids: string[]) => void;
}

export function SatellitePanel({
  satellites,
  colors,
  hidden,
  counts,
  onToggle,
  onSetHidden,
}: Props) {
  const ids = satellites.map((s) => s.id);
  const visibleCount = ids.length - hidden.filter((h) => ids.includes(h)).length;

  return (
    <section className={ui.panel} aria-labelledby="sat-title">
      <div className={ui.panelHead}>
        <h2 id="sat-title" className={ui.title}>
          Satellites{' '}
          <span className={ui.mono}>
            {visibleCount}/{ids.length}
          </span>
        </h2>
        <div className={ui.row}>
          <button className={ui.btn} onClick={() => onSetHidden([])}>
            All
          </button>
          <button className={ui.btn} onClick={() => onSetHidden(ids)}>
            None
          </button>
          <button
            className={ui.btn}
            onClick={() => onSetHidden(ids.filter((id) => !hidden.includes(id)))}
          >
            Invert
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {satellites.map((s) => {
          const on = !hidden.includes(s.id);
          return (
            <li key={s.id} className={styles.item} data-on={on}>
              <label
                className={styles.label}
                title={`${s.id}: altitude ${s.minAltitudeKm}–${s.maxAltitudeKm} km`}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(s.id)} />
                <span className={ui.dot} style={{ background: colors[s.id] }} />
                <span className={ui.mono}>{s.id}</span>
              </label>
              {counts && on ? (
                <span className={`${ui.chip} ${styles.count}`} title="passes over the target">
                  {counts[s.id] ?? 0}
                </span>
              ) : null}
              <button
                className={`${ui.btn} ${styles.only}`}
                onClick={() => onSetHidden(ids.filter((id) => id !== s.id))}
                title="Show only this satellite"
              >
                only
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
