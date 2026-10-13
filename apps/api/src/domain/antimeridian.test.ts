import { describe, expect, it } from 'vitest';

import { splitAtAntimeridian, type Vertex } from './antimeridian';

describe('splitAtAntimeridian', () => {
  it('returns a single part when nothing crosses', () => {
    const v: Vertex[] = [
      [10, 0, 500],
      [20, 5, 500],
    ];
    expect(splitAtAntimeridian(v)).toEqual([v]);
  });

  it('splits eastbound crossings and interpolates the crossing latitude/altitude', () => {
    const parts = splitAtAntimeridian([
      [170, 0, 500],
      [-170, 20, 520],
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]![1]).toEqual([180, 10, 510]);
    expect(parts[1]![0]).toEqual([-180, 10, 510]);
  });

  it('splits westbound crossings', () => {
    const parts = splitAtAntimeridian([
      [-175, 0, 500],
      [175, -10, 500],
      [165, -20, 500],
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]!.at(-1)![0]).toBe(-180);
    expect(parts[1]![0]![0]).toBe(180);
    expect(parts[1]).toHaveLength(3);
  });

  it('handles multiple crossings and drops degenerate parts', () => {
    const parts = splitAtAntimeridian([
      [179, 0, 0],
      [-179, 0, 0],
      [179, 0, 0],
    ]);
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.length >= 2)).toBe(true);
  });
});
