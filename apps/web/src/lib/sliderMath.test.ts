import { describe, expect, it } from 'vitest';

import { moveHandle, panWindow, positionToValue, valueToPercent } from './sliderMath';

describe('positionToValue', () => {
  it('maps and snaps pointer positions', () => {
    expect(positionToValue(150, 100, 200, 0, 1000, 60)).toBe(240); // 25% => 250, snapped to the 60 s grid
  });
  it('clamps outside the track', () => {
    expect(positionToValue(-50, 100, 200, 0, 1000, 10)).toBe(0);
    expect(positionToValue(900, 100, 200, 0, 1000, 10)).toBe(1000);
  });
  it('is safe on zero-width tracks', () => {
    expect(positionToValue(10, 0, 0, 5, 50, 1)).toBe(5);
  });
});

describe('valueToPercent', () => {
  it('computes percentages', () => {
    expect(valueToPercent(25, 0, 100)).toBe(25);
    expect(valueToPercent(5, 5, 5)).toBe(0);
  });
});

describe('moveHandle', () => {
  it('keeps the window valid', () => {
    expect(moveHandle('start', 90, [10, 50], 0, 100, 5)).toEqual([45, 50]);
    expect(moveHandle('end', 0, [10, 50], 0, 100, 5)).toEqual([10, 15]);
    expect(moveHandle('end', 500, [10, 50], 0, 100, 5)).toEqual([10, 100]);
  });
});

describe('panWindow', () => {
  it('preserves width and clamps at the bounds', () => {
    expect(panWindow([10, 30], 15, 0, 100)).toEqual([25, 45]);
    expect(panWindow([10, 30], -50, 0, 100)).toEqual([0, 20]);
    expect(panWindow([10, 30], 500, 0, 100)).toEqual([80, 100]);
  });
});
