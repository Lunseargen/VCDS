import { describe, expect, it } from 'vitest';
import { lastIndexAtOrBefore, loopTime, valueAt } from '../../src/sim/replay';

const s = (t: number, value: number) => ({ t, value, raw: String(value) });
const series = [s(0, 0), s(1, 10), s(2, 30), s(2, 40)];

describe('lastIndexAtOrBefore', () => {
  it('finds the last sample at or before a time', () => {
    expect(lastIndexAtOrBefore(series, -1)).toBe(-1);
    expect(lastIndexAtOrBefore(series, 0)).toBe(0);
    expect(lastIndexAtOrBefore(series, 0.5)).toBe(0);
    expect(lastIndexAtOrBefore(series, 1)).toBe(1);
    expect(lastIndexAtOrBefore(series, 2)).toBe(3);
    expect(lastIndexAtOrBefore(series, 99)).toBe(3);
    expect(lastIndexAtOrBefore([], 1)).toBe(-1);
  });
});

describe('loopTime', () => {
  it('wraps the time into [0, duration)', () => {
    expect(loopTime(5, 4)).toBe(1);
    expect(loopTime(4, 4)).toBe(0);
    expect(loopTime(-1, 4)).toBe(3);
    expect(loopTime(2.5, 4)).toBe(2.5);
  });
  it('gives 0 for a duration of 0, less than 0, or NaN', () => {
    expect(loopTime(5, 0)).toBe(0);
    expect(loopTime(5, -2)).toBe(0);
    expect(loopTime(5, NaN)).toBe(0);
  });
});

describe('valueAt', () => {
  it('throws for an empty series', () => {
    expect(() => valueAt([], 0, 'linear')).toThrow('empty series');
  });
  it('gives the first value before the first sample', () => {
    expect(valueAt(series, -5, 'linear')).toBe(0);
  });
  it('interpolates in linear mode', () => {
    expect(valueAt(series, 0.5, 'linear')).toBe(5);
    expect(valueAt(series, 1.5, 'linear')).toBe(20);
  });
  it('holds the last value in hold mode', () => {
    expect(valueAt(series, 1.5, 'hold')).toBe(10);
  });
  it('gives the last value after the end, and at 2 samples with the same time', () => {
    expect(valueAt(series, 9, 'linear')).toBe(40);
    expect(valueAt([s(1, 1), s(1, 2), s(3, 3)], 1, 'linear')).toBe(2);
    expect(valueAt([s(1, 5), s(1, 6)], 0.5 + 0.5, 'linear')).toBe(6);
  });
});
