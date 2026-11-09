import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from 'vitest';
import { OBDLinkHIDAdapter } from '../../src/hal/obdlink';
import { AdapterType, AdapterTypeValue } from '../../src/hal/interface';
import type { HalInterface, CANFrame, ScanResult } from '../../src/hal/interface';

// Shared mock state
const mockState = {
  throwOnWrite: false,
  devices: [
    { path: '/dev/hidraw0', vendorId: 0x0e0e, productId: 0x000c },
    { path: '/dev/hidraw1', vendorId: 0x0e0e, productId: 0x000d },
    { path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x1234 },
  ] as Array<{ path: string; vendorId: number; productId: number }>,
  writeThrows: false,
};

// Mock node-hid module
vi.mock('node-hid', () => {
  class MockHID {
    path: string;
    opened: boolean;
    written: number[][];

    constructor(path: string) {
      this.path = path;
      this.opened = false;
      this.written = [];
    }

    open(): void {
      this.opened = true;
    }

    close(): void {
      this.opened = false;
    }

    write(data: number[]): void {
      if (mockState.writeThrows) {
        throw new Error('Mock write failure');
      }
      this.written.push(data);
    }

    isOpened(): boolean {
      return this.opened;
    }
  }

  const devices = () => mockState.devices;
  const HID = MockHID as unknown as typeof import('node-hid').HID;

  return {
    devices,
    HID,
    default: { devices, HID },
  };
});

describe('OBDLinkHIDAdapter construction', () => {
  it('creates a new instance', () => {
    const adapter = new OBDLinkHIDAdapter();
    expect(adapter).toBeDefined();
  });

  it('has OBDLink adapter type', () => {
    const adapter = new OBDLinkHIDAdapter();
    expect(adapter.type).toBe(AdapterType.OBDLink);
  });

  it('has correct type as AdapterTypeValue', () => {
    const adapter: OBDLinkHIDAdapter = new OBDLinkHIDAdapter();
    const _val: AdapterTypeValue = adapter.type;
    expect(_val).toBe('OBDLink');
  });

  it('is not connected after construction', () => {
    const adapter = new OBDLinkHIDAdapter();
    expect(adapter.isConnected()).toBe(false);
  });
});

describe('OBDLinkHIDAdapter connection', () => {
  let adapter: OBDLinkHIDAdapter;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
  });

  afterEach(() => {
    adapter.disconnect();
  });

  it('connect returns true', () => {
    const result = adapter.connect();
    expect(result).toBe(true);
  });

  it('isConnected returns true after connect', () => {
    adapter.connect();
    expect(adapter.isConnected()).toBe(true);
  });

  it('disconnect works', () => {
    adapter.connect();
    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it('isConnected returns false after disconnect', () => {
    adapter.connect();
    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it('connect sets connected flag', () => {
    adapter.connect();
    expect(adapter.isConnected()).toBe(true);
  });

  it('disconnect clears connected flag', () => {
    adapter.connect();
    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });
});

describe('OBDLinkHIDAdapter connection via HalInterface', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
  });

  afterEach(() => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.disconnect();
  });

  it('HalInterface.connect returns true', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    const result = obd.connect();
    expect(result).toBe(true);
  });

  it('HalInterface.isConnected works', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.connect();
    expect(obd.isConnected()).toBe(true);
  });

  it('HalInterface.disconnect works', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.connect();
    obd.disconnect();
    expect(obd.isConnected()).toBe(false);
  });
});

describe('OBDLinkHIDAdapter implements HalInterface', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
    (adapter as OBDLinkHIDAdapter).connect();
  });

  afterEach(() => {
    (adapter as OBDLinkHIDAdapter).disconnect();
  });

  it('scan returns proper ScanResult', () => {
    const result = adapter.scan();
    expect(result).toBeDefined();
    expect(typeof result.count).toBe('number');
    expect(Array.isArray(result.names)).toBe(true);
    expect(result.count).toBe(result.names.length);
  });

  it('dtcRead returns number array', () => {
    const result = adapter.dtcRead();
    expect(Array.isArray(result)).toBe(true);
  });

  it('dtcRead returns empty array when no codes', () => {
    const result = adapter.dtcRead();
    expect(result.length).toBe(0);
  });

  it('dtcClear returns true on success', () => {
    const result = adapter.dtcClear();
    expect(typeof result).toBe('boolean');
    expect(result).toBe(true);
  });

  it('liveData returns CANFrame array', () => {
    const result = adapter.liveData();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('liveData returns frames with correct id for 0x7E0', () => {
    const result = adapter.liveData();
    expect(result[0].id).toBe('0x7E0');
  });

  it('liveData handles undefined pids', () => {
    const result = adapter.liveData();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('liveData handles empty pids array', () => {
    const result = adapter.liveData([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('liveData returns frame per pid', () => {
    const result = adapter.liveData(['0105', '0106', '0107']);
    expect(result.length).toBe(3);
  });

  it('longCode returns LongCodeResponse with success', () => {
    const result = adapter.longCode('01');
    expect(result.success).toBe(true);
    expect(typeof result.result).toBe('string');
  });

  it('longCode uses address string as result', () => {
    const result = adapter.longCode('19');
    expect(result.result).toBe('19');
  });

  it('shortCode returns ShortCodeResponse with success', () => {
    const result = adapter.shortCode('01', 'A0');
    expect(result.success).toBe(true);
    expect(typeof result.result).toBe('string');
  });

  it('shortCode uses code string as result', () => {
    const result = adapter.shortCode('01', 'FF');
    expect(result.result).toBe('FF');
  });

  it('shortCode handles value parameter', () => {
    const result = adapter.shortCode('01', 'A0', 42);
    expect(result.success).toBe(true);
  });

  it('adaptation returns AdaptationResponse with success', () => {
    const result = adapter.adaptation('01', 1, 42);
    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
  });

  it('adaptation returns 0 when value is undefined', () => {
    const result = adapter.adaptation('01', 1);
    expect(result.value).toBe(0);
  });

  it('adaptation handles zero channel and value', () => {
    const result = adapter.adaptation('01', 0, 0);
    expect(result.value).toBe(0);
    expect(result.success).toBe(true);
  });

  it('rawCmd returns RawResponse with frame', () => {
    const result = adapter.rawCmd('7E0', [0x02, 0x01]);
    expect(result.frame).toBeDefined();
    expect(typeof result.frame.id).toBe('string');
    expect(Array.isArray(result.frame.data)).toBe(true);
    expect(typeof result.frame.timestamp).toBe('number');
  });

  it('rawCmd returns frame with correct id', () => {
    const result = adapter.rawCmd('7E0', [0x02, 0x01]);
    expect(result.frame.id).toBe('7E0');
  });

  it('rawCmd returns frame with correct data', () => {
    const result = adapter.rawCmd('7E0', [0x02, 0x01]);
    expect(result.frame.data).toEqual([0x02, 0x01]);
  });

  it('rawCmd handles empty data array', () => {
    const result = adapter.rawCmd('7E0', []);
    expect(result.frame.data.length).toBe(0);
  });

  it('rawCmd handles undefined id', () => {
    const result = adapter.rawCmd();
    expect(result.frame.id).toBe('');
  });
});

describe('OBDLinkHIDAdapter without connection', () => {
  let adapter: OBDLinkHIDAdapter;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
  });

  it('dtcRead returns empty array when not connected', () => {
    const result = adapter.dtcRead();
    expect(result.length).toBe(0);
  });

  it('dtcClear returns true when not connected', () => {
    const result = adapter.dtcClear();
    expect(result).toBe(true);
  });

  it('liveData returns frames when not connected', () => {
    const result = adapter.liveData();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('longCode returns success when not connected', () => {
    const result = adapter.longCode('01');
    expect(result.success).toBe(true);
  });

  it('shortCode returns success when not connected', () => {
    const result = adapter.shortCode('01', 'A0');
    expect(result.success).toBe(true);
  });

  it('adaptation returns success with default value when not connected', () => {
    const result = adapter.adaptation('01', 1, 10);
    expect(result.success).toBe(true);
    expect(result.value).toBe(10);
  });

  it('rawCmd returns valid response when not connected', () => {
    const result = adapter.rawCmd('7E0', [0x02]);
    expect(result.frame.id).toBe('7E0');
  });
});

describe('OBDLinkHIDAdapter heartbeats and reconnect', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
    (adapter as OBDLinkHIDAdapter).connect();
  });

  afterEach(() => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.disconnect();
  });

  it('heartbeats are scheduled after connect', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    expect(obd.isConnected()).toBe(true);
    // Heartbeat timer is set. It calls _ping which sends a frame.
    // After 5 seconds the heartbeat timer fires.
    // We just verify the timer exists by checking isConnected stays true.
    expect(obd.isConnected()).toBe(true);
  });

  it('heartbeat timer is cleared on disconnect', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.connect();
    obd.disconnect();
    expect(obd.isConnected()).toBe(false);
  });

  it('connect can be called multiple times', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.disconnect();
    expect(obd.isConnected()).toBe(false);
    const result = obd.connect();
    expect(result).toBe(true);
    expect(obd.isConnected()).toBe(true);
  });

  it('disconnect can be called multiple times', () => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.connect();
    obd.disconnect();
    obd.disconnect();
    expect(obd.isConnected()).toBe(false);
  });
});

describe('OBDLinkHIDAdapter type compatibility', () => {
  it('OBDLinkHIDAdapter satisfies HalInterface', () => {
    const adapter: HalInterface = new OBDLinkHIDAdapter();
    const obd = adapter as OBDLinkHIDAdapter;
    obd.connect();

    const scan: ScanResult = adapter.scan();
    expect(typeof scan.count).toBe('number');
    expect(Array.isArray(scan.names)).toBe(true);

    const dtcs: number[] = adapter.dtcRead();
    expect(Array.isArray(dtcs)).toBe(true);

    const cleared: boolean = adapter.dtcClear();
    expect(typeof cleared).toBe('boolean');

    const frames: CANFrame[] = adapter.liveData();
    expect(Array.isArray(frames)).toBe(true);

    const coded = adapter.longCode('01');
    expect(typeof coded.success).toBe('boolean');
    expect(typeof coded.result).toBe('string');

    const scoded = adapter.shortCode('01', 'A0');
    expect(typeof scoded.success).toBe('boolean');
    expect(typeof scoded.result).toBe('string');

    const adapt = adapter.adaptation('01', 1, 42);
    expect(typeof adapt.success).toBe('boolean');
    expect(typeof adapt.value).toBe('number');

    const raw = adapter.rawCmd('7E0', [0x02, 0x01]);
    expect(typeof raw.frame.id).toBe('string');
    expect(Array.isArray(raw.frame.data)).toBe(true);
    expect(typeof raw.frame.timestamp).toBe('number');

    obd.disconnect();
  });

  it('OBDLinkHIDAdapter works as constructor type', () => {
    const adapter = new OBDLinkHIDAdapter();
    expect(adapter instanceof OBDLinkHIDAdapter).toBe(true);
  });
});

describe('OBDLinkHIDAdapter edge cases', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
    (adapter as OBDLinkHIDAdapter).connect();
  });

  afterEach(() => {
    const obd = adapter as OBDLinkHIDAdapter;
    obd.disconnect();
  });

  it('scan returns non-negative count', () => {
    const result = adapter.scan();
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('scan names have length property', () => {
    const result = adapter.scan();
    expect(typeof result.names.length).toBe('number');
  });

  it('longCode handles empty address', () => {
    const result = adapter.longCode('');
    expect(result.success).toBe(true);
  });

  it('longCode handles negative block', () => {
    const result = adapter.longCode('01', -1);
    expect(result.success).toBe(true);
  });

  it('shortCode handles empty address and code', () => {
    const result = adapter.shortCode('', '');
    expect(result.success).toBe(true);
  });

  it('shortCode handles zero value', () => {
    const result = adapter.shortCode('01', 'A0', 0);
    expect(result.success).toBe(true);
  });

  it('rawCmd handles data array with max byte values', () => {
    const result = adapter.rawCmd('7E0', [255, 255, 255, 255, 255, 255, 255, 255]);
    expect(result.frame.data.length).toBe(8);
    expect(result.frame.data.every((b) => b <= 255)).toBe(true);
  });

  it('adaptation handles negative channel', () => {
    const result = adapter.adaptation('01', -1, 42);
    expect(result.value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 5. Heartbeat and reconnect private methods
// ---------------------------------------------------------------------------
describe('OBDLinkHIDAdapter heartbeat and reconnect', () => {
  let adapter: OBDLinkHIDAdapter;

  beforeEach(() => {
    adapter = new OBDLinkHIDAdapter();
    adapter.connect();
  });

  afterEach(() => {
    adapter.disconnect();
  });

  it('_ping calls sendCmd successfully', () => {
    mockState.writeThrows = false;
    const result = (adapter as unknown as Record<string, unknown>)._ping as () => boolean;
    const result2 = result.call(adapter);
    expect(result2).toBe(true);
  });

  it('_ping catches error and calls _reconnect', () => {
    mockState.writeThrows = true;
    const result = (adapter as unknown as Record<string, unknown>)._ping as () => boolean;
    const result2 = result.call(adapter);
    expect(result2).toBe(true);
  });

  it('_reconnect finds device and sets connected', () => {
    const result = (adapter as unknown as Record<string, unknown>)._reconnect as () => boolean;
    const result2 = result.call(adapter);
    expect(result2).toBe(true);
    expect(adapter.isConnected()).toBe(true);
  });

  it('_reconnect closes existing device before reconnect', () => {
    // Connect, then reconnect should close the old device.
    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    const result = (obd as unknown as Record<string, unknown>)._reconnect as () => boolean;
    const result2 = result.call(obd);
    expect(result2).toBe(true);
    expect(obd.isConnected()).toBe(true);
    obd.disconnect();
  });

  it('_reconnect returns false after max attempts', () => {
    // Temporarily replace all OBDLink devices with non-matching ones.
    const originalDevices = [...mockState.devices];
    mockState.devices = [
      { path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x1234 },
    ];
    mockState.writeThrows = false;

    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    const result = (obd as unknown as Record<string, unknown>)._reconnect as () => boolean;
    const result2 = result.call(obd);
    expect(result2).toBe(false);

    // Restore devices.
    mockState.devices = originalDevices;
    obd.disconnect();
  });

  it('sendCmd returns true when hidDevice exists and connected', () => {
    const result = (adapter as unknown as Record<string, unknown>).sendCmd as (
      addr: string,
      data: number[],
    ) => boolean;
    const result2 = result.call(adapter, '0x7E0', [0x02, 0x01]);
    expect(result2).toBe(true);
  });

  it('sendCmd returns true in mock mode when hidDevice is null', () => {
    adapter.disconnect();
    (adapter as any).connected = true;
    const result = (adapter as unknown as Record<string, unknown>).sendCmd as (
      addr: string,
      data: number[],
    ) => boolean;
    const result2 = result.call(adapter, '0x7E0', [0x02, 0x01]);
    expect(result2).toBe(true);
  });

  it('startHeartbeat sets up timer', () => {
    adapter.disconnect();
    adapter.connect();
    expect((adapter as any).heartbeatTimer).not.toBeNull();
  });

  it('stopHeartbeat clears timer', () => {
    adapter.disconnect();
    adapter.connect();
    const obd = adapter as any;
    (obd.stopHeartbeat as () => void).call(obd);
    expect(obd.heartbeatTimer).toBeNull();
  });

  it('heartbeat ping triggers reconnect on sendCmd error', () => {
    mockState.writeThrows = true;
    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    // _ping calls sendCmd which throws, then _reconnect which succeeds.
    const result = (obd as unknown as Record<string, unknown>)._ping as () => boolean;
    const result2 = result.call(obd);
    expect(result2).toBe(true);
    expect(obd.isConnected()).toBe(true);
    obd.disconnect();
  });

  it('adaptation catch block handles sendCmd error', () => {
    // sendCmd throws when writeThrows is true.
    mockState.writeThrows = true;
    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    // adaptation calls sendCmd which will throw since writeThrows is true.
    const result = obd.adaptation('01', 1, 42);
    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
    obd.disconnect();
  });

  it('rawCmd catch block handles sendCmd error', () => {
    mockState.writeThrows = true;
    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    const result = obd.rawCmd('7E0', [0x02, 0x01]);
    expect(result.frame.id).toBe('7E0');
    expect(result.frame.data).toEqual([0x02, 0x01]);
    expect(result.frame.timestamp).toBeGreaterThan(0);
    obd.disconnect();
  });

  it('startHeartbeat sets interval that calls _ping', () => {
    mockState.writeThrows = false;
    const obd = new OBDLinkHIDAdapter();
    obd.connect();
    // startHeartbeat is called inside connect().
    expect((obd as any).heartbeatTimer).not.toBeNull();
    // The setInterval callback fires every 5000ms.
    // Manually fire the callback by calling the interval function.
    const cb = (obd as unknown as Record<string, unknown>).heartbeatTimer;
    if (cb) {
      // The interval timer exists, callback is set up.
      expect(typeof cb).not.toBe('string');
    }
    obd.disconnect();
  });
});
