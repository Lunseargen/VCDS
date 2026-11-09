import { describe, it, expect } from 'vitest';
import {
  HalInterface,
  AdapterType,
  AdapterTypeValue,
  getAdapter,
  OBDLinkAdapter,
  RossTechAdapter,
} from '../../src/hal/interface';

// ---------------------------------------------------------------------------
// 1. ScanResult edge cases (count, names)
// ---------------------------------------------------------------------------
describe('ScanResult edge cases', () => {
  it('scan returns result with number count', () => {
    const hal = getAdapter(AdapterType.OBDLink);
    const result = hal.scan();
    expect(typeof result.count).toBe('number');
  });

  it('scan returns result with names that have length property', () => {
    const hal = getAdapter(AdapterType.OBDLink);
    const result = hal.scan();
    expect(result.names).toBeDefined();
    expect(result.count).toBe(result.names.length);
  });

  it('scan handles empty names array', () => {
    const hal = getAdapter(AdapterType.OBDLink);
    const result = hal.scan();
    expect(result.count).toBe(0);
    expect(result.names).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Factory: null, undefined, unknown type handling
// ---------------------------------------------------------------------------
describe('Factory edge cases', () => {
  it('getAdapter returns OBDLinkAdapter for OBDLink constant', () => {
    const adapter = getAdapter(AdapterType.OBDLink);
    expect(adapter instanceof OBDLinkAdapter).toBe(true);
  });

  it('getAdapter returns RossTechAdapter for RossTech constant', () => {
    const adapter = getAdapter(AdapterType.RossTech);
    expect(adapter instanceof RossTechAdapter).toBe(true);
  });

  it('getAdapter returns HalInterface implementation', () => {
    const obd = getAdapter(AdapterType.OBDLink);
    const ross = getAdapter(AdapterType.RossTech);
    expect(obd).toBeDefined();
    expect(ross).toBeDefined();
    expect(typeof obd.scan).toBe('function');
    expect(typeof ross.scan).toBe('function');
  });

  it('getAdapter returns valid adapter for null (RossTech fallback)', () => {
    const adapter = getAdapter(null);
    expect(adapter).toBeDefined();
    expect(typeof adapter.scan).toBe('function');
  });

  it('getAdapter returns valid adapter for undefined', () => {
    const adapter = getAdapter(undefined);
    expect(adapter).toBeDefined();
    expect(typeof adapter.dtcRead).toBe('function');
  });

  it('getAdapter returns RossTechAdapter for unknown string type', () => {
    const adapter = getAdapter('unknown' as unknown as string);
    expect(adapter).toBeInstanceOf(RossTechAdapter);
  });

  it('getAdapter returns HalInterface with all 8 methods', () => {
    const adapter = getAdapter(AdapterType.OBDLink);
    expect(typeof adapter.scan).toBe('function');
    expect(typeof adapter.dtcRead).toBe('function');
    expect(typeof adapter.dtcClear).toBe('function');
    expect(typeof adapter.liveData).toBe('function');
    expect(typeof adapter.longCode).toBe('function');
    expect(typeof adapter.shortCode).toBe('function');
    expect(typeof adapter.adaptation).toBe('function');
    expect(typeof adapter.rawCmd).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 3. Method edge cases (empty strings, zero values, boundary values)
// ---------------------------------------------------------------------------
describe('Method edge cases', () => {
  const hal: HalInterface = getAdapter(AdapterType.OBDLink);

  it('scan returns result with non-negative count', () => {
    const result = hal.scan();
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('scan returns names with length property', () => {
    const result = hal.scan();
    expect(typeof result.names.length).toBe('number');
  });

  it('dtcRead returns empty array when no codes', () => {
    const result = hal.dtcRead();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('dtcRead returns number array', () => {
    const result = hal.dtcRead();
    expect(result.every((n: number) => typeof n === 'number')).toBe(true);
  });

  it('dtcClear returns true on no codes to clear', () => {
    const result = hal.dtcClear();
    expect(typeof result).toBe('boolean');
    expect(result).toBe(true);
  });

  it('liveData returns empty array for empty filter', () => {
    const result = hal.liveData([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('liveData returns empty array for undefined filter', () => {
    const result = hal.liveData();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('liveData returns number array for valid filters', () => {
    const result = hal.liveData(['0105']);
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((n: number) => typeof n === 'number')).toBe(true);
  });

  it('liveData handles multiple valid filters', () => {
    const result = hal.liveData(['01', '02', '03']);
    expect(result.length).toBe(3);
  });

  it('liveData handles single empty string filter', () => {
    const result = hal.liveData(['']);
    expect(result.length).toBe(1);
  });

  it('longCode returns object with success and result for valid address', () => {
    const result = hal.longCode('01');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect(typeof (result as Record<string, unknown>).result).toBe('string');
  });

  it('longCode returns object for empty address', () => {
    const result = hal.longCode('');
    expect((result as Record<string, unknown>).success).toBe(true);
  });

  it('longCode handles block and value params', () => {
    const result = hal.longCode('01', 1, 'FF');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect(typeof (result as Record<string, unknown>).result).toBe('string');
  });

  it('longCode handles negative block number', () => {
    const result = hal.longCode('01', -1);
    expect((result as Record<string, unknown>).success).toBe(true);
  });

  it('longCode handles large address string', () => {
    const longAddr = 'A'.repeat(10000);
    const result = hal.longCode(longAddr);
    expect((result as Record<string, unknown>).success).toBe(true);
    expect(typeof (result as Record<string, unknown>).result).toBe('string');
  });

  it('shortCode returns object with success and result for valid inputs', () => {
    const result = hal.shortCode('01', 'A0');
    expect((result as Record<string, unknown>).success).toBe(true);
    expect(typeof (result as Record<string, unknown>).result).toBe('string');
  });

  it('shortCode handles empty address and code', () => {
    const result = hal.shortCode('', '');
    expect((result as Record<string, unknown>).success).toBe(true);
  });

  it('shortCode handles zero value', () => {
    const result = hal.shortCode('01', 'A0', 0);
    expect((result as Record<string, unknown>).success).toBe(true);
  });

  it('shortCode handles large value', () => {
    const result = hal.shortCode('01', 'A0', 4294967295);
    expect((result as Record<string, unknown>).success).toBe(true);
  });

  it('adaptation returns object with success and value for all inputs', () => {
    const result = hal.adaptation('01', 1, 42);
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).value).toBe(42);
  });

  it('adaptation returns 0 when value is undefined', () => {
    const result = hal.adaptation('01', 0);
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).value).toBe(0);
  });

  it('adaptation handles zero channel and value', () => {
    const result = hal.adaptation('01', 0, 0);
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).value).toBe(0);
  });

  it('adaptation handles negative channel', () => {
    const result = hal.adaptation('01', -1, 42);
    expect((result as Record<string, unknown>).success).toBe(true);
    expect((result as Record<string, unknown>).value).toBe(42);
  });

  it('rawCmd returns response with frame for valid id and data', () => {
    const result = hal.rawCmd('7E0', [0x02, 0x01]);
    const r = result as Record<string, unknown>;
    const frame = r.frame as Record<string, unknown>;
    expect(frame.id).toBe('7E0');
    expect(Array.isArray(frame.data)).toBe(true);
    expect((frame.data as number[]).length).toBe(2);
    expect(typeof frame.timestamp).toBe('number');
  });

  it('rawCmd returns response with empty data array', () => {
    const result = hal.rawCmd('7E0', []);
    const r = result as Record<string, unknown>;
    const frame = r.frame as Record<string, unknown>;
    expect(frame.id).toBe('7E0');
    expect((frame.data as number[]).length).toBe(0);
  });

  it('rawCmd handles empty id string', () => {
    const result = hal.rawCmd('', [0x00]);
    const r = result as Record<string, unknown>;
    const frame = r.frame as Record<string, unknown>;
    expect(frame.id).toBe('');
  });

  it('rawCmd handles very long id string', () => {
    const longId = '7'.repeat(10000);
    const result = hal.rawCmd(longId, []);
    const r = result as Record<string, unknown>;
    const frame = r.frame as Record<string, unknown>;
    expect(frame.id).toBe(longId);
    expect((frame.id as string).length).toBe(10000);
  });

  it('rawCmd handles data array with max byte values', () => {
    const result = hal.rawCmd('7E0', [255, 255, 255, 255, 255, 255, 255, 255]);
    const r = result as Record<string, unknown>;
    const frame = r.frame as Record<string, unknown>;
    const data = frame.data as number[];
    expect(data.length).toBe(8);
    expect(data.every((b: number) => b <= 255)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Type compatibility: both adapters satisfy HalInterface
// ---------------------------------------------------------------------------
describe('Type compatibility', () => {
  it('OBDLinkAdapter satisfies all HalInterface method signatures', () => {
    const adapter: HalInterface = new OBDLinkAdapter();

    // scan: returns object with count and names
    const scan = adapter.scan() as Record<string, unknown>;
    expect(typeof scan.count).toBe('number');
    expect(typeof scan.names.length).toBe('number');

    // dtcRead: number[]
    const dtc = adapter.dtcRead();
    expect(Array.isArray(dtc)).toBe(true);

    // dtcClear: boolean
    const cleared = adapter.dtcClear();
    expect(typeof cleared).toBe('boolean');

    // liveData: number[]
    const data = adapter.liveData(['A', 'B']);
    expect(Array.isArray(data)).toBe(true);

    // longCode: LongCodeResponse
    const coded = adapter.longCode('') as Record<string, unknown>;
    expect(typeof coded.success).toBe('boolean');
    expect(typeof coded.result).toBe('string');

    // shortCode: ShortCodeResponse
    const scoded = adapter.shortCode('', 'A0') as Record<string, unknown>;
    expect(typeof scoded.success).toBe('boolean');
    expect(typeof scoded.result).toBe('string');

    // adaptation: AdaptationResponse
    const adapt = adapter.adaptation('', 0, 0) as Record<string, unknown>;
    expect(typeof adapt.success).toBe('boolean');
    expect(typeof adapt.value).toBe('number');

    // rawCmd: RawResponse
    const raw = adapter.rawCmd('', []) as Record<string, unknown>;
    const frame = raw.frame as Record<string, unknown>;
    expect(typeof frame.id).toBe('string');
    expect(Array.isArray(frame.data)).toBe(true);
    expect(typeof frame.timestamp).toBe('number');
  });

  it('RossTechAdapter satisfies all HalInterface method signatures', () => {
    const adapter: HalInterface = new RossTechAdapter();

    const scan = adapter.scan() as Record<string, unknown>;
    expect(typeof scan.count).toBe('number');
    expect(typeof scan.names.length).toBe('number');

    const dtc = adapter.dtcRead();
    expect(Array.isArray(dtc)).toBe(true);

    const cleared = adapter.dtcClear();
    expect(typeof cleared).toBe('boolean');

    const data = adapter.liveData(['A']);
    expect(Array.isArray(data)).toBe(true);

    const coded = adapter.longCode('') as Record<string, unknown>;
    expect(typeof coded.success).toBe('boolean');
    expect(typeof coded.result).toBe('string');

    const scoded = adapter.shortCode('', 'A0') as Record<string, unknown>;
    expect(typeof scoded.success).toBe('boolean');
    expect(typeof scoded.result).toBe('string');

    const adapt = adapter.adaptation('', 0, 0) as Record<string, unknown>;
    expect(typeof adapt.success).toBe('boolean');
    expect(typeof adapt.value).toBe('number');

    const raw = adapter.rawCmd('', []) as Record<string, unknown>;
    const frame = raw.frame as Record<string, unknown>;
    expect(typeof frame.id).toBe('string');
    expect(Array.isArray(frame.data)).toBe(true);
    expect(typeof frame.timestamp).toBe('number');
  });
});
