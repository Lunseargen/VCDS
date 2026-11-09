import { describe, expect, it } from 'vitest';
import { parseVcdsCsvLog } from '../../src/sim/vcdsCsvLog';
import { parseVcdsScanLog } from '../../src/sim/vcdsScanLog';
import { createSimVehicle, paddedRange } from '../../src/sim/vehicle';
import { SYNTHETIC_CHANNELS } from '../../src/sim/synthetic';
import { CSV_LOG, SCAN_LOG } from './fixtures';

describe('paddedRange', () => {
  it('adds 10% on each side', () => {
    expect(paddedRange([0, 10, 5])).toEqual({ min: -1, max: 11 });
  });
  it('gives ±1 for a flat series', () => {
    expect(paddedRange([3, 3])).toEqual({ min: 2, max: 4 });
  });
});

describe('createSimVehicle', () => {
  it('has only synthetic channels and no faults with no source', () => {
    const v = createSimVehicle();
    expect(v.description).toBe('Synthetic data only');
    expect(v.channels).toHaveLength(SYNTHETIC_CHANNELS.length);
    expect(v.channels.every((c) => c.source === 'synthetic' && c.kind === 'number')).toBe(true);
    expect(v.modules()).toEqual([]);
    expect(v.faults()).toEqual([]);
    expect(Object.keys(v.sample(1))).toHaveLength(SYNTHETIC_CHANNELS.length);
  });

  it('accepts null sources', () => {
    expect(createSimVehicle({ csv: null, scan: null }).channels).toHaveLength(SYNTHETIC_CHANNELS.length);
  });

  const csv = parseVcdsCsvLog(CSV_LOG);
  const scan = parseVcdsScanLog(SCAN_LOG);
  const v = createSimVehicle({ csv, scan });

  it('adds the log channels with their ranges', () => {
    expect(v.description).toBe(csv.module);
    const bits = v.channels.find((c) => c.key === '093.1')!;
    expect(bits).toMatchObject({ unit: 'bits', min: 0, max: 255, kind: 'bits', source: 'log', label: 'Group 093 / field 1' });
    const ppm = v.channels.find((c) => c.key === '176.1')!;
    expect(ppm.min).toBeCloseTo(48);
    expect(ppm.max).toBeCloseTo(72);
  });

  it('replays the log in a loop: hold for bits, linear for numbers', () => {
    expect(v.sample(0.25)['093.1']).toBe(136);
    expect(v.sample(0.25)['093.2']).toBe(2);
    expect(v.sample(2.25)['093.2']).toBe(2);
  });

  it('lists the faults with the module address, and clears them in memory only', () => {
    expect(v.modules()).toHaveLength(2);
    expect(v.faults().map((f) => [f.address, f.code])).toEqual([
      ['01', 5585],
      ['01', 9690],
    ]);
    v.clearFaults();
    expect(v.faults()).toEqual([]);
    expect(scan.modules[0].faults).toHaveLength(2);
  });
});
