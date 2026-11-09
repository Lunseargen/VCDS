import { describe, expect, it } from 'vitest';
import {
  boostMbar,
  coolantC,
  CYCLE_SECONDS,
  dpfDiffHpa,
  engineRpm,
  loadPercent,
  ripple,
  smoothstep,
  speedKmh,
  SYNTHETIC_CHANNELS,
  terminal30V,
} from '../../src/sim/synthetic';

describe('smoothstep', () => {
  it('is 0 before edge0, 1 after edge1, and 0.5 at the middle', () => {
    expect(smoothstep(0, 10, -1)).toBe(0);
    expect(smoothstep(0, 10, 11)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBe(0.5);
  });
});

describe('ripple', () => {
  it('stays in [-1, 1]', () => {
    for (let t = 0; t < 50; t += 0.37) {
      expect(Math.abs(ripple(t, 3))).toBeLessThanOrEqual(1);
    }
  });
});

describe('drive cycle', () => {
  it('idles, drives at about 100 km/h, then idles again', () => {
    expect(speedKmh(0)).toBe(0);
    expect(speedKmh(55)).toBeGreaterThan(95);
    expect(speedKmh(55)).toBeLessThan(105);
    expect(speedKmh(110)).toBe(0);
  });
  it('repeats each cycle, also for a time less than 0', () => {
    expect(speedKmh(55 + CYCLE_SECONDS)).toBeCloseTo(speedKmh(55), 9);
    expect(speedKmh(-65)).toBeCloseTo(speedKmh(55), 9);
    expect(loadPercent(-100)).toBe(loadPercent(20));
  });
  it('gives the load for each phase', () => {
    expect(loadPercent(0)).toBe(12);
    expect(loadPercent(20)).toBe(70);
    expect(loadPercent(50)).toBeGreaterThan(25);
    expect(loadPercent(50)).toBeLessThan(39);
    expect(loadPercent(85)).toBe(0);
    expect(loadPercent(100)).toBe(12);
  });
  it('gives idle speed when the vehicle stops, and a gear speed when it moves', () => {
    expect(engineRpm(0)).toBeGreaterThan(739);
    expect(engineRpm(0)).toBeLessThan(761);
    for (const t of [20, 25, 30, 40, 55, 80, 90]) {
      expect(engineRpm(t)).toBeGreaterThanOrEqual(1100);
      expect(engineRpm(t)).toBeLessThanOrEqual(2500);
    }
  });
  it('gives the bottom of a gear at the top speed of the gear before it', () => {
    let t = 15;
    while (speedKmh(t) < 100) t += 0.001;
    expect(engineRpm(t)).toBeLessThan(1101);
  });
  it('makes boost from the load', () => {
    expect(boostMbar(20)).toBe(990 + 70 * 17);
  });
  it('warms the coolant from 34 °C to 90 °C', () => {
    expect(coolantC(-5)).toBe(34);
    expect(coolantC(0)).toBe(34);
    expect(coolantC(300)).toBe(62);
    expect(coolantC(600)).toBe(90);
    expect(coolantC(9999)).toBe(90);
  });
  it('keeps terminal 30 near 14.2 V and the DPF pressure from the speed', () => {
    expect(Math.abs(terminal30V(3) - 14.2)).toBeLessThanOrEqual(0.05);
    expect(dpfDiffHpa(0)).toBe(4);
  });
});

describe('SYNTHETIC_CHANNELS', () => {
  it('has unique keys, and each value stays in its range', () => {
    const keys = SYNTHETIC_CHANNELS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const ch of SYNTHETIC_CHANNELS) {
      for (let t = 0; t < 900; t += 1.3) {
        const v = ch.read(t);
        expect(v).toBeGreaterThanOrEqual(ch.min);
        expect(v).toBeLessThanOrEqual(ch.max);
      }
    }
  });
});
