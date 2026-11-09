import { describe, it, expect } from 'vitest';
import {
  CANFrame,
  HalInterface,
  AdapterType,
  OBDLinkAdapter,
  RossTechAdapter,
  getAdapter,
} from '../../src/hal/interface';

// Test p2: CANFrame type correctness
describe('CANFrame type', () => {
  it('accepts a valid CANFrame with hex id string', () => {
    const frame: CANFrame = {
      id: '0x7E0',
      data: [0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00],
      timestamp: 1000,
    };
    expect(frame.id).toBe('0x7E0');
    expect(frame.data).toHaveLength(8);
    expect(frame.timestamp).toBe(1000);
  });

  it('accepts id in 4-byte hex format', () => {
    const frame: CANFrame = {
      id: '0x7DF',
      data: Array(8).fill(0),
      timestamp: 0,
    };
    expect(frame.id).toMatch(/^0x[0-9A-Fa-f]{1,4}$/);
  });

  it('accepts data as array of 8 bytes', () => {
    const frame: CANFrame = {
      id: '0x000',
      data: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
      timestamp: 9999,
    };
    expect(frame.data.every((b) => typeof b === 'number')).toBe(true);
    expect(frame.data.length).toBe(8);
  });

  it('accepts timestamp as a number in milliseconds', () => {
    const frame: CANFrame = {
      id: '0x100',
      data: [0, 0, 0, 0, 0, 0, 0, 0],
      timestamp: 42,
    };
    expect(typeof frame.timestamp).toBe('number');
  });
});

// Test p1: All 8 interface method signatures exist
describe('HalInterface method signatures', () => {
  let hal: HalInterface;

  it('has scan method', () => {
    hal = getAdapter(AdapterType.OBDLink);
    expect(typeof hal.scan).toBe('function');
  });

  it('has dtcRead method', () => {
    expect(typeof hal.dtcRead).toBe('function');
  });

  it('has dtcClear method', () => {
    expect(typeof hal.dtcClear).toBe('function');
  });

  it('has liveData method', () => {
    expect(typeof hal.liveData).toBe('function');
  });

  it('has longCode method', () => {
    expect(typeof hal.longCode).toBe('function');
  });

  it('has shortCode method', () => {
    expect(typeof hal.shortCode).toBe('function');
  });

  it('has adaptation method', () => {
    expect(typeof hal.adaptation).toBe('function');
  });

  it('has rawCmd method', () => {
    expect(typeof hal.rawCmd).toBe('function');
  });

  it('all 8 methods are callable on OBDLink adapter', () => {
    const result1 = hal.scan();
    const result2 = hal.dtcRead();
    const result3 = hal.dtcClear();
    const result4 = hal.liveData();
    const result5 = hal.longCode('01');
    const result6 = hal.shortCode('01', '1234');
    const result7 = hal.adaptation('01', 1, 2);
    const result8 = hal.rawCmd('7E0', [0x02, 0x01]);
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result4).toBeDefined();
    expect(result5).toBeDefined();
    expect(result6).toBeDefined();
    expect(result7).toBeDefined();
    expect(result8).toBeDefined();
  });

  it('all 8 methods are callable on RossTech adapter', () => {
    const rossHal: HalInterface = getAdapter(AdapterType.RossTech);
    const result1 = rossHal.scan();
    const result2 = rossHal.dtcRead();
    const result3 = rossHal.dtcClear();
    const result4 = rossHal.liveData();
    const result5 = rossHal.longCode('01');
    const result6 = rossHal.shortCode('01', '1234');
    const result7 = rossHal.adaptation('01', 1, 2);
    const result8 = rossHal.rawCmd('7E0', [0x02, 0x01]);
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result4).toBeDefined();
    expect(result5).toBeDefined();
    expect(result6).toBeDefined();
    expect(result7).toBeDefined();
    expect(result8).toBeDefined();
  });
});

// Test p3: Factory pattern works
describe('Factory pattern', () => {
  it('getAdapter returns OBDLinkAdapter for OBDLink type', () => {
    const adapter = getAdapter(AdapterType.OBDLink);
    expect(adapter).toBeInstanceOf(OBDLinkAdapter);
  });

  it('getAdapter returns RossTechAdapter for RossTech type', () => {
    const adapter = getAdapter(AdapterType.RossTech);
    expect(adapter).toBeInstanceOf(RossTechAdapter);
  });

  it('getAdapter returns HalInterface implementation', () => {
    const obd = getAdapter(AdapterType.OBDLink);
    const ross = getAdapter(AdapterType.RossTech);
    expect(obd).toBeDefined();
    expect(ross).toBeDefined();
  });
});

// Test each method call individually
describe('Individual method calls', async () => {
  const hal: HalInterface = getAdapter('OBDLink');

  it('scan returns array of addresses', async () => {
    const addresses = await hal.scan();
    expect(Array.isArray(addresses.names)).toBe(true);
  });

  it('dtcRead returns DTC codes', async () => {
    const dtcs = await hal.dtcRead();
    expect(Array.isArray(dtcs)).toBe(true);
  });

  it('dtcClear returns success status', async () => {
    const success = await hal.dtcClear();
    expect(typeof success).toBe('boolean');
  });

  it('liveData returns CANFrames', async () => {
    const frames = await hal.liveData(['0105']);
    expect(Array.isArray(frames)).toBe(true);
  });

  it('longCode takes an address string parameter', () => {
    const result = hal.longCode('01');
    expect(result).toBeDefined();
  });

  it('shortCode takes address and code parameters', () => {
    const result = hal.shortCode('01', '1234');
    expect(result).toBeDefined();
  });

  it('adaptation takes address, subFn, and value parameters', () => {
    const result = hal.adaptation('01', 1, 2);
    expect(result).toBeDefined();
  });

  it('rawCmd takes id and data array parameters', () => {
    const result = hal.rawCmd('7E0', [0x02, 0x01]);
    expect(result).toBeDefined();
  });
});
