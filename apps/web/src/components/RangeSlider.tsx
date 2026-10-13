import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { moveHandle, panWindow, positionToValue, valueToPercent } from '@/lib/sliderMath';

import styles from './RangeSlider.module.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: readonly [number, number];
  /** Minimum distance between the handles. */
  minGap?: number;
  ticks?: { value: number; label: string }[];
  onChange: (value: [number, number]) => void;
  formatValue?: (v: number) => string;
}

type Drag =
  { kind: 'start' | 'end' } | { kind: 'pan'; originValue: number; originRange: [number, number] };

/**
 * Dual-handle range slider with window panning (drag the filled bar). Pointer-capture based,
 * so it works for mouse, touch and pen without document-level listeners.
 */
export function RangeSlider({
  min,
  max,
  step,
  value,
  minGap = step,
  ticks = [],
  onChange,
  formatValue = String,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [a, b] = value;

  const valueAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    return positionToValue(clientX, rect?.left ?? 0, rect?.width ?? 0, min, max, step);
  };

  const begin = (d: Drag) => (e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current =
      d.kind === 'pan' ? { ...d, originValue: valueAt(e.clientX), originRange: [a, b] } : d;
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const v = valueAt(e.clientX);
    if (d.kind === 'pan') onChange(panWindow(d.originRange, v - d.originValue, min, max));
    else onChange(moveHandle(d.kind, v, [a, b], min, max, minGap));
  };

  const end = () => {
    drag.current = null;
  };

  const key = (handle: 'start' | 'end') => (e: KeyboardEvent) => {
    const jump = e.shiftKey ? step * 60 : step * 5;
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? jump
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -jump
          : 0;
    if (!delta) return;
    e.preventDefault();
    onChange(moveHandle(handle, (handle === 'start' ? a : b) + delta, [a, b], min, max, minGap));
  };

  const left = valueToPercent(a, min, max);
  const right = valueToPercent(b, min, max);

  return (
    <div className={styles.root}>
      <div ref={trackRef} className={styles.track}>
        {ticks.map((t) => (
          <span
            key={t.value}
            className={styles.tick}
            style={{ left: `${valueToPercent(t.value, min, max)}%` }}
          />
        ))}
        <div
          className={styles.fill}
          style={{ left: `${left}%`, width: `${right - left}%` }}
          onPointerDown={begin({ kind: 'pan', originValue: 0, originRange: [a, b] })}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          title="Drag to slide the whole window"
          data-testid="slider-fill"
        />
        {(['start', 'end'] as const).map((h) => (
          <div
            key={h}
            role="slider"
            tabIndex={0}
            aria-label={h === 'start' ? 'Range start' : 'Range end'}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={h === 'start' ? a : b}
            aria-valuetext={formatValue(h === 'start' ? a : b)}
            className={styles.handle}
            style={{ left: `${h === 'start' ? left : right}%` }}
            onPointerDown={begin({ kind: h })}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={key(h)}
          />
        ))}
      </div>
      <div className={styles.labels}>
        {ticks.map((t) => (
          <span key={t.value} style={{ left: `${valueToPercent(t.value, min, max)}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
