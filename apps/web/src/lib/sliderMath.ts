import { clamp } from './time';

/** Pointer x (px) inside a track -> value, snapped to `step`. */
export function positionToValue(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  min: number,
  max: number,
  step: number,
): number {
  if (trackWidth <= 0) return min;
  const ratio = clamp((clientX - trackLeft) / trackWidth, 0, 1);
  return clamp(Math.round((min + ratio * (max - min)) / step) * step, min, max);
}

export const valueToPercent = (v: number, min: number, max: number) =>
  max === min ? 0 : ((v - min) / (max - min)) * 100;

/**
 * Moves one handle while keeping `a <= b - minGap`. Dragging past the other handle pins it
 * (instead of swapping), which keeps the interaction predictable.
 */
export function moveHandle(
  handle: 'start' | 'end',
  next: number,
  [a, b]: readonly [number, number],
  min: number,
  max: number,
  minGap: number,
): [number, number] {
  if (handle === 'start') return [clamp(next, min, b - minGap), b];
  return [a, clamp(next, a + minGap, max)];
}

/** Pans a fixed-width window by `delta`, clamped to [min, max]. */
export function panWindow(
  [a, b]: readonly [number, number],
  delta: number,
  min: number,
  max: number,
): [number, number] {
  const width = b - a;
  const start = clamp(a + delta, min, max - width);
  return [start, start + width];
}
