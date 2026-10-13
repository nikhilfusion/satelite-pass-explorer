import type { AccessesResponse } from '@sat/contract';
import { useState } from 'react';

import type { SortKey } from '@/lib/accessSort';
import { accessesToCsv, downloadText } from '@/lib/csv';
import { fmtDuration } from '@/lib/time';
import ui from '@/styles/ui.module.css';

import styles from './AccessPanel.module.css';
import { AccessTable } from './AccessTable';
import { Timeline } from './Timeline';

interface Props {
  data: AccessesResponse | undefined;
  loading: boolean;
  error: Error | null;
  satellites: readonly string[];
  window: [number, number];
  colors: Record<string, string>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  time: 'Time',
  elevation: 'Max elevation',
  duration: 'Duration',
  distance: 'Closest',
};

export function AccessPanel({
  data,
  loading,
  error,
  satellites,
  window,
  colors,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: Props) {
  const [sort, setSort] = useState<SortKey>('time');
  const accesses = data?.accesses ?? [];

  return (
    <section className={styles.root} aria-labelledby="acc-title" data-loading={loading}>
      <header className={styles.head}>
        <h2 id="acc-title" className={ui.title}>
          Accesses
        </h2>
        {data ? (
          <span className={ui.mono} data-testid="access-summary">
            {data.summary.count} pass{data.summary.count === 1 ? '' : 'es'} ·{' '}
            {fmtDuration(data.summary.totalDurationSeconds)} total
            <span className={ui.muted}> · {data.summary.tookMs} ms</span>
          </span>
        ) : null}
        {loading ? <span className={styles.spinner} aria-label="Loading" /> : null}
        <span className={styles.spacer} />
        <label className={ui.row}>
          <span className={ui.muted}>Sort</span>
          <select
            className={ui.input}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {Object.entries(SORT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className={ui.btn}
          disabled={accesses.length === 0}
          onClick={() => downloadText('accesses.csv', accessesToCsv(accesses))}
        >
          Export CSV
        </button>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : (
        <div className={styles.body}>
          <AccessTable
            accesses={accesses}
            colors={colors}
            sort={sort}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={onHover}
            onSelect={onSelect}
          />
          <Timeline
            satellites={satellites}
            accesses={accesses}
            window={window}
            colors={colors}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={onHover}
            onSelect={onSelect}
          />
        </div>
      )}
    </section>
  );
}
