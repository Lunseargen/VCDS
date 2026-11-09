import { describe, expect, it, vi } from 'vitest';
import { decodeValue, encodeValue, SimulatedAdapter, SIM_ADAPTER_TYPE } from '../../src/hal/sim';
import { createSimVehicle } from '../../src/sim/vehicle';
import { parseVcdsScanLog } from '../../src/sim/vcdsScanLog';
import { SCAN_LOG } from '../sim/fixtures';

describe('encodeValue and decodeValue', () => {
  it('give the value back as a 32-bit float', () => {
    expect(encodeValue(1)).toEqual([0, 0, 128, 63]);
    expect(decodeValue(encodeValue(1))).toBe(1);
    expect(decodeValue(encodeValue(14.2))).toBeCloseTo(14.2, 5);
    expect(decodeValue([...encodeValue(-3), 9, 9])).toBe(-3);
  });
  it('throws for fewer than 4 bytes', () => {
    expect(() => decodeValue([1, 2, 3])).toThrow(/fewer than 4/);
  });
});

describe('SimulatedAdapter', () => {
  let clock = 1000;
  const now = () => clock;
  const vehicle = createSimVehicle({ scan: parseVcdsScanLog(SCAN_LOG) });
  const adapter = new SimulatedAdapter(vehicle, now);

  it('has a type and counts time from its start', () => {
    expect(adapter.type).toBe(SIM_ADAPTER_TYPE);
    expect(adapter.elapsed()).toBe(0);
    clock = 3500;
    expect(adapter.elapsed()).toBe(2.5);
  });

  it('uses Date.now when no clock is given', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(5000);
    expect(new SimulatedAdapter(vehicle).elapsed()).toBe(0);
    spy.mockRestore();
  });

  it('scans the modules as numbers', () => {
    expect(adapter.scan()).toEqual({ count: 2, names: [1, 10] });
  });

  it('gives frames for all channels, for named channels, and skips unknown names', () => {
    const all = adapter.liveData();
    expect(all).toHaveLength(vehicle.channels.length);
    expect(adapter.liveData([])).toHaveLength(vehicle.channels.length);
    const some = adapter.liveData(['sim.coolant', 'nope']);
    expect(some).toHaveLength(1);
    expect(some[0].id).toBe('sim.coolant');
    expect(some[0].timestamp).toBe(3500);
    expect(decodeValue(some[0].data)).toBeCloseTo(vehicle.sample(2.5)['sim.coolant'], 3);
  });

  it('reads and clears the simulated faults', () => {
    expect(adapter.dtcRead()).toEqual([5585, 9690]);
    expect(adapter.dtcClear()).toBe(true);
    expect(adapter.dtcRead()).toEqual([]);
  });

  it('never writes: the write methods report no success', () => {
    expect(adapter.longCode('01')).toEqual({ success: false, result: 'simulated adapter: no write to 01' });
    expect(adapter.shortCode('01')).toEqual({ success: false, result: 'simulated adapter: no write to 01' });
    expect(adapter.adaptation()).toEqual({ success: false, value: 0 });
  });

  it('echoes a raw command', () => {
    expect(adapter.rawCmd('7E0', [1, 2])).toEqual({ frame: { id: '7E0', data: [1, 2], timestamp: 3500 } });
    expect(adapter.rawCmd()).toEqual({ frame: { id: '', data: [], timestamp: 3500 } });
  });
});
