import { describe, expect, it } from 'vitest';

import {
  dayBoundaries,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtTime,
  fromInputValue,
  startOfUtcDay,
  toInputValue,
} from './time';

const t = Date.parse('2027-03-01T06:58:09Z') / 1000;

describe('time formatting (UTC)', () => {
  it('formats date and time', () => {
    expect(fmtDate(t)).toBe('2027-03-01');
    expect(fmtTime(t)).toBe('06:58:09');
    expect(fmtDateTime(t)).toBe('2027-03-01 06:58');
  });

  it.each([
    [45, '45s'],
    [138, '2m 18s'],
    [3900, '1h 05m'],
    [0, '0s'],
  ])('formats %is as %s', (s, out) => expect(fmtDuration(s)).toBe(out));
});

describe('input value codec', () => {
  it('round-trips minute precision', () => {
    const v = toInputValue(t);
    expect(v).toBe('2027-03-01 06:58');
    expect(fromInputValue(v)).toBe(Date.parse('2027-03-01T06:58:00Z') / 1000);
  });

  it('rejects partial or invalid input', () => {
    expect(fromInputValue('2027-03-01')).toBeNull();
    expect(fromInputValue('2027-13-45 99:99')).toBeNull();
    expect(fromInputValue('2027-03-01T06:58')).toBe(Date.parse('2027-03-01T06:58:00Z') / 1000);
  });
});

describe('startOfUtcDay', () => {
  it('floors to midnight UTC', () => {
    expect(startOfUtcDay(t)).toBe(Date.parse('2027-03-01T00:00:00Z') / 1000);
  });
});

describe('dayBoundaries', () => {
  const start = Date.parse('2027-03-01T00:00:00Z') / 1000;

  it('lists each UTC midnight inside the range (start included)', () => {
    const end = Date.parse('2027-03-03T05:00:00Z') / 1000;
    expect(dayBoundaries(start, end)).toEqual([start, start + 86400, start + 2 * 86400]);
  });

  it('ignores a trailing sliver shorter than an hour', () => {
    const end = Date.parse('2027-03-03T00:01:00Z') / 1000;
    expect(dayBoundaries(start, end)).toEqual([start, start + 86400]);
  });
});
