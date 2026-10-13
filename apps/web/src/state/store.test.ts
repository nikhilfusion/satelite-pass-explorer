import { beforeEach, describe, expect, it } from 'vitest';

import {
  effectiveRange,
  effectiveWindow,
  initialState,
  useExplorer,
  visibleSatellites,
} from './store';

beforeEach(() => useExplorer.setState({ ...initialState }));

describe('explorer store', () => {
  it('toggles satellites on and off', () => {
    useExplorer.getState().toggleSatellite('A');
    expect(useExplorer.getState().hidden).toEqual(['A']);
    useExplorer.getState().toggleSatellite('A');
    expect(useExplorer.getState().hidden).toEqual([]);
  });

  it('clears pass selection when the target changes', () => {
    useExplorer.setState({ selectedId: 'A-1', hoveredId: 'A-1' });
    useExplorer.getState().setTarget({ lat: 1, lon: 2 });
    expect(useExplorer.getState()).toMatchObject({ selectedId: null, hoveredId: null });
  });
});

describe('selectors', () => {
  const ds = { start: 100, end: 900 };
  it('filters visible satellites', () => {
    expect(visibleSatellites(['A', 'B', 'C'], ['B'])).toEqual(['A', 'C']);
  });
  it('defaults the range to the dataset extent', () => {
    expect(effectiveRange(null, ds)).toEqual([100, 900]);
    expect(effectiveRange([200, 300], ds)).toEqual([200, 300]);
  });
  it('lets a custom access window override the map range', () => {
    expect(effectiveWindow({ customWindow: null, range: [200, 300] }, ds)).toEqual([200, 300]);
    expect(effectiveWindow({ customWindow: [150, 250], range: [200, 300] }, ds)).toEqual([
      150, 250,
    ]);
  });
});
