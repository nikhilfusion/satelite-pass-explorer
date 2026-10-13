import { useMemo } from 'react';

import { dayBoundaries, fmtDate, fmtDateTime, fmtDuration } from '@/lib/time';
import ui from '@/styles/ui.module.css';

import { DateTimeField } from './DateTimeField';
import { RangeSlider } from './RangeSlider';
import styles from './TimeRangePanel.module.css';

interface Props {
  dataset: { start: number; end: number };
  /** Effective range (never null). */
  range: [number, number];
  onChange: (range: [number, number] | null) => void;
}

const MINUTE = 60;

export function TimeRangePanel({ dataset, range, onChange }: Props) {
  const days = useMemo(
    () => dayBoundaries(dataset.start, dataset.end),
    [dataset.start, dataset.end],
  );
  const isFull = range[0] === dataset.start && range[1] === dataset.end;
  const set = (r: [number, number]) =>
    onChange(r[0] === dataset.start && r[1] === dataset.end ? null : r);

  return (
    <section className={ui.panel} aria-labelledby="time-title">
      <div className={ui.panelHead}>
        <h2 id="time-title" className={ui.title}>
          Time range
        </h2>
        <span className={`${ui.muted} ${ui.mono}`}>{fmtDuration(range[1] - range[0])}</span>
      </div>

      <RangeSlider
        min={dataset.start}
        max={dataset.end}
        step={MINUTE}
        minGap={MINUTE}
        value={range}
        onChange={set}
        formatValue={fmtDateTime}
        ticks={days.map((d, i) => ({ value: Math.max(d, dataset.start), label: `D${i + 1}` }))}
      />

      <div className={styles.fields}>
        <DateTimeField
          label="From"
          value={range[0]}
          min={dataset.start}
          max={range[1] - MINUTE}
          onCommit={(v) => set([v, range[1]])}
        />
        <DateTimeField
          label="To"
          value={range[1]}
          min={range[0] + MINUTE}
          max={dataset.end}
          onCommit={(v) => set([range[0], v])}
        />
      </div>

      <div className={styles.presets}>
        <button
          className={`${ui.btn} ${isFull ? ui.btnActive : ''}`}
          onClick={() => onChange(null)}
        >
          Full
        </button>
        {days.map((d, i) => {
          const from = Math.max(d, dataset.start);
          const to = Math.min(d + 86400, dataset.end);
          const active = range[0] === from && range[1] === to;
          return (
            <button
              key={d}
              className={`${ui.btn} ${active ? ui.btnActive : ''}`}
              title={fmtDate(d)}
              onClick={() => set([from, to])}
            >
              D{i + 1}
            </button>
          );
        })}
      </div>
    </section>
  );
}
