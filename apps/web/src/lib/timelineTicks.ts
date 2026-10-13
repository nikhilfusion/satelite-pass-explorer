const STEPS = [3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 2 * 86400];

/** Picks tick spacing so a window gets ≤ ~8 labelled ticks, aligned to UTC multiples of the step. */
export function timelineTicks(from: number, to: number): number[] {
  const span = to - from;
  const step = STEPS.find((s) => span / s <= 8) ?? STEPS[STEPS.length - 1]!;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t < to; t += step) ticks.push(t);
  return ticks;
}
