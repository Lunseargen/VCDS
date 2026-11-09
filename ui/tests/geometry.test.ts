import { describe, expect, it } from 'vitest';
import {
  arcPath,
  bitsOf,
  clamp,
  decimalsFor,
  formatValue,
  fraction,
  GAUGE_START,
  GAUGE_SWEEP,
  gaugeAngle,
  polar,
  sparkPoints,
} from '../src/widgets/geometry';

describe('geometry', () => {
  it('clamp and fraction', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(fraction(5, 0, 10)).toBe(0.5);
    expect(fraction(50, 0, 10)).toBe(1);
    expect(fraction(-5, 0, 10)).toBe(0);
    expect(fraction(5, 3, 3)).toBe(0);
    expect(fraction(5, 0, NaN)).toBe(0);
  });
  it('polar puts 0° at 3 o’clock and 90° below the center', () => {
    expect(polar(0, 0, 10, 0)).toEqual({ x: 10, y: 0 });
    const p = polar(0, 0, 10, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });
  it('arcPath sets the large-arc flag above 180°', () => {
    expect(arcPath(0, 0, 10, 0, 90)).toBe('M 10.00 0.00 A 10 10 0 0 1 0.00 10.00');
    expect(arcPath(0, 0, 10, 0, 270)).toContain(' 0 1 1 ');
  });
  it('gaugeAngle maps the range onto the sweep', () => {
    expect(gaugeAngle(0, 0, 10)).toBe(GAUGE_START);
    expect(gaugeAngle(10, 0, 10)).toBe(GAUGE_START + GAUGE_SWEEP);
    expect(gaugeAngle(99, 0, 10)).toBe(GAUGE_START + GAUGE_SWEEP);
  });
  it('decimalsFor and formatValue', () => {
    expect(decimalsFor(0, 5000)).toBe(0);
    expect(decimalsFor(10, 16)).toBe(2);
    expect(decimalsFor(0, 60)).toBe(1);
    expect(formatValue(1.234, 1)).toBe('1.2');
    expect(formatValue(undefined, 1)).toBe('–');
    expect(formatValue(NaN, 1)).toBe('–');
    expect(formatValue(Infinity, 1)).toBe('–');
  });
  it('bitsOf gives 8 bits, most significant first', () => {
    expect(bitsOf(136)).toEqual([true, false, false, false, true, false, false, false]);
    expect(bitsOf(256 + 1)).toEqual([false, false, false, false, false, false, false, true]);
    expect(bitsOf(0.6)).toEqual([false, false, false, false, false, false, false, true]);
  });
  it('sparkPoints scales the series into the box', () => {
    expect(sparkPoints([0], 100, 10, 0, 1)).toBe('');
    expect(sparkPoints([0, 1, 0.5], 100, 10, 0, 1)).toBe('0.0,10.0 50.0,0.0 100.0,5.0');
  });
});
