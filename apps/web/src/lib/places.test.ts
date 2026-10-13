import { describe, expect, it } from 'vitest';

import { PLACES, radiusToSlider, sliderToRadius } from './places';

describe('log radius slider', () => {
  it('maps the ends of the slider to 10 km and 3000 km', () => {
    expect(sliderToRadius(0)).toBe(10);
    expect(sliderToRadius(1000)).toBe(3000);
  });

  it('round-trips within rounding error', () => {
    for (const km of [10, 50, 250, 500, 1200, 3000]) {
      expect(Math.abs(sliderToRadius(radiusToSlider(km)) - km)).toBeLessThanOrEqual(1);
    }
  });

  it('is monotonic', () => {
    expect(sliderToRadius(300)).toBeLessThan(sliderToRadius(600));
  });
});

describe('PLACES', () => {
  it('has valid coordinates', () => {
    for (const p of PLACES) {
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
    }
  });
});
