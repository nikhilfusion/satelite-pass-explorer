import { describe, expect, it } from 'vitest';

import { timelineTicks } from './timelineTicks';

const T = Date.parse('2027-03-01T00:00:00Z') / 1000;

describe('timelineTicks', () => {
  it('uses hourly ticks for short windows', () => {
    const ticks = timelineTicks(T + 30 * 60, T + 5 * 3600);
    expect(ticks).toEqual(
      [T + 3600, T + 7200, T + 10800, T + 14400, T + 18000].filter((t) => t < T + 5 * 3600),
    );
  });

  it('never produces more than ~8 ticks', () => {
    for (const span of [3600, 6 * 3600, 86400, 3 * 86400, 7 * 86400]) {
      expect(timelineTicks(T, T + span).length).toBeLessThanOrEqual(8);
    }
  });

  it('aligns to multiples of the step', () => {
    const ticks = timelineTicks(T + 100, T + 7 * 86400);
    expect(ticks.every((t) => t % 86400 === 0)).toBe(true);
  });
});
