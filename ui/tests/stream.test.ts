import { describe, expect, it } from 'vitest';
import { encodeValue } from '../../src/hal/sim';
import { framesToValues, History, HISTORY_LENGTH, loadVehicle, makeAdapter, RateMeter, SimClock } from '../src/stream';
import { CSV_LOG, SCAN_LOG } from '../../tests/sim/fixtures';

describe('framesToValues', () => {
  it('decodes good frames and skips short frames', () => {
    expect(framesToValues([{ id: 'a', data: encodeValue(2) }, { id: 'b', data: [1] }])).toEqual({ a: 2 });
  });
});

describe('History', () => {
  it('keeps the last values of each channel', () => {
    const h = new History(3);
    for (let i = 1; i <= 5; i++) h.push({ a: i });
    expect(h.get('a')).toEqual([3, 4, 5]);
    expect(h.get('none')).toEqual([]);
    h.clear();
    expect(h.get('a')).toEqual([]);
  });
  it('has a default length of 300', () => {
    const h = new History();
    for (let i = 0; i < HISTORY_LENGTH + 5; i++) h.push({ a: i });
    expect(h.get('a')).toHaveLength(HISTORY_LENGTH);
  });
});

describe('RateMeter', () => {
  it('gives the rate after each full second', () => {
    const m = new RateMeter(0);
    for (let t = 100; t < 1000; t += 100) expect(m.tick(t)).toBe(0);
    expect(m.tick(1000)).toBe(10);
    expect(m.tick(1500)).toBe(10);
  });
});

describe('SimClock', () => {
  it('runs, changes speed, and pauses with no jump', () => {
    const c = new SimClock(1000);
    expect(c.time(2000)).toBe(1);
    c.setSpeed(2, 2000);
    expect(c.time(3000)).toBe(3);
    c.setPaused(true, 3000);
    expect(c.time(9000)).toBe(3);
    c.setPaused(false, 9000);
    expect(c.time(9500)).toBe(4);
  });
});

describe('loadVehicle', () => {
  it('works with no logs', () => {
    const d = loadVehicle({ csv: [], scan: [] });
    expect(d).toMatchObject({ csv: null, scan: null, csvName: null, scanName: null, errors: [] });
  });
  it('parses the first logs', () => {
    const d = loadVehicle({ csv: [{ name: 'a.csv', text: CSV_LOG }], scan: [{ name: 'b.txt', text: SCAN_LOG }] });
    expect(d.csvName).toBe('a.csv');
    expect(d.scanName).toBe('b.txt');
    expect(d.vehicle.faults()).toHaveLength(2);
  });
  it('reports a CSV parse error and keeps going', () => {
    const d = loadVehicle({ csv: [{ name: 'bad.csv', text: 'x' }], scan: [] });
    expect(d.csv).toBeNull();
    expect(d.csvName).toBeNull();
    expect(d.errors[0]).toMatch(/^bad\.csv: not a VCDS CSV log/);
  });
});

describe('makeAdapter', () => {
  it('uses the simulation clock', () => {
    let now = 0;
    const clock = new SimClock(0);
    const a = makeAdapter(loadVehicle({ csv: [], scan: [] }).vehicle, clock, () => now);
    now = 2000;
    expect(a.elapsed()).toBe(2);
    clock.setPaused(true, now);
    now = 9000;
    expect(a.elapsed()).toBe(2);
  });
});
