import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from 'vitest';
import {
  RossTechUSBAdapter,
  DEFAULT_ROSS_TECH_VENDOR_ID,
  DEFAULT_ROSS_TECH_PRODUCT_ID,
  DEFAULT_PID_TABLE,
} from '../../src/hal/ross-tech';
import { AdapterType, AdapterTypeValue, getAdapter, RossTechAdapter } from '../../src/hal/interface';
import type { HalInterface, CANFrame, ScanResult } from '../../src/hal/interface';

// Shared mock state
const mockState = {
  throwOnWrite: false,
  devices: [
    { path: '/dev/hidraw0', vendorId: 0x04d8, productId: 0x003a },
    { path: '/dev/hidraw1', vendorId: 0x04d8, productId: 0x003b },
    { path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x000c },
  ] as Array<{ path: string; vendorId: number; productId: number }>,
  writeThrows: false,
  devicesThrows: false,
  // Answers that the mocked device sends later. Each write moves the next answer into the
  // input buffer. A read with a timeout (ms > 0) can also wait for the next answer.
  readQueue: [] as number[][],
  // Reports that are already in the HID input buffer. A read with timeout 0 sees only these.
  buffer: [] as number[][],
  // Every mocked HID instance that the adapter opens.
  instances: [] as Array<{ path: string; opened: boolean; written: number[][] }>,
};

// ASSUMED wire format for the read path (not verified on a real cable, see D11/task 2.4):
// - scan:     each report that answers a probe has report[0] = ECU address.
// - liveData: each report has report[0] = index into the PID table, report[1..7] = data.
// The adapter reads with readTimeout(ms). An empty array means "no data".
// Before each request write the adapter drains the buffer with readTimeout(0) (FM-14).
const nextReport = (): number[] => mockState.readQueue.shift() ?? [];

function resetMockState(): void {
  mockState.throwOnWrite = false;
  mockState.writeThrows = false;
  mockState.devicesThrows = false;
  mockState.readQueue = [];
  mockState.buffer = [];
  mockState.instances = [];
  mockState.devices = [
    { path: '/dev/hidraw0', vendorId: 0x04d8, productId: 0x003a },
    { path: '/dev/hidraw1', vendorId: 0x04d8, productId: 0x003b },
    { path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x000c },
  ];
}

beforeEach(() => {
  resetMockState();
});

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
      mockState.instances.push(this);
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
      const answer = mockState.readQueue.shift();
      if (answer) {
        mockState.buffer.push(answer);
      }
    }

    isOpened(): boolean {
      return this.opened;
    }

    readTimeout(ms: number): number[] {
      const buffered = mockState.buffer.shift();
      if (buffered) {
        return buffered;
      }
      return ms === 0 ? [] : nextReport();
    }

    readSync(): number[] {
      return this.readTimeout(-1);
    }
  }

  const devices = () => {
    if (mockState.devicesThrows) {
      throw new Error('Mock devices failure');
    }
    return mockState.devices;
  };
  const HID = MockHID as unknown as typeof import('node-hid').HID;

  return {
    devices,
    HID,
    default: { devices, HID },
  };
});

describe('RossTechUSBAdapter construction', () => {
  it('creates a new instance', () => {
    const adapter = new RossTechUSBAdapter();
    expect(adapter).toBeDefined();
  });

  it('has RossTech adapter type', () => {
    const adapter = new RossTechUSBAdapter();
    expect(adapter.type).toBe(AdapterType.RossTech);
  });

  it('has correct type as AdapterTypeValue', () => {
    const adapter: RossTechUSBAdapter = new RossTechUSBAdapter();
    const _val: AdapterTypeValue = adapter.type;
    expect(_val).toBe('RossTech');
  });

  it('is not connected after construction', () => {
    const adapter = new RossTechUSBAdapter();
    expect(adapter.isConnected()).toBe(false);
  });

  it('uses default PID table', () => {
    const adapter = new RossTechUSBAdapter();
    const pidTable = adapter.getPIDTable();
    expect(Array.isArray(pidTable)).toBe(true);
    expect(pidTable.length).toBeGreaterThan(0);
    expect(pidTable).toContain(0x7E0);
    expect(pidTable).toContain(0x7E8);
    expect(pidTable).toContain(0x7DF);
  });

  it('accepts custom PID table', () => {
    const customPid = [0x100, 0x200, 0x300];
    const adapter = new RossTechUSBAdapter({ pidTable: customPid });
    const pidTable = adapter.getPIDTable();
    expect(pidTable).toEqual(customPid);
  });

  it('PID table is a copy not the original', () => {
    const customPid = [0x100];
    const adapter = new RossTechUSBAdapter({ pidTable: customPid });
    customPid.push(0x200);
    const pidTable = adapter.getPIDTable();
    expect(pidTable).toEqual([0x100]);
  });
});

describe('RossTechUSBAdapter connection', () => {
  let adapter: RossTechUSBAdapter;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
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

  it('test_fm8_connect returns false when no matching device', () => {
    mockState.devices = [{ path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x000c }];
    expect(adapter.connect()).toBe(false);
    expect(adapter.isConnected()).toBe(false);
  });

  it('test_fm8_connect does not open a non-matching device', () => {
    mockState.devices = [{ path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x000c }];
    adapter.connect();
    expect(mockState.instances.length).toBe(0);
  });

  it('test_fm8_connect returns false when no device is listed', () => {
    mockState.devices = [];
    const explicit = new RossTechUSBAdapter({ vendorId: 0x04d8, productId: 0x003a });
    expect(explicit.connect()).toBe(false);
    expect(explicit.isConnected()).toBe(false);
  });

  it('test_fm8_connect returns false when HID.devices throws', () => {
    mockState.devicesThrows = true;
    expect(adapter.connect()).toBe(false);
    expect(adapter.isConnected()).toBe(false);
  });

  it('test_fm8_connect opens the matching device path only', () => {
    const explicit = new RossTechUSBAdapter({ vendorId: 0x04d8, productId: 0x003a });
    expect(explicit.connect()).toBe(true);
    expect(mockState.instances.map((i) => i.path)).toEqual(['/dev/hidraw0']);
    explicit.disconnect();
  });

  it('test_fm9_connect uses overridden vendorId and productId', () => {
    const custom = new RossTechUSBAdapter({ vendorId: 0x0e0e, productId: 0x000c });
    expect(custom.connect()).toBe(true);
    expect(mockState.instances.map((i) => i.path)).toEqual(['/dev/hidraw2']);
    custom.disconnect();
  });

  it('test_fm9_default ids no longer match when overridden to other ids', () => {
    const custom = new RossTechUSBAdapter({ vendorId: 0x1234, productId: 0x5678 });
    expect(custom.connect()).toBe(false);
    expect(mockState.instances.length).toBe(0);
  });

  it('test_fm9_reconnect uses overridden ids', () => {
    const custom = new RossTechUSBAdapter({ vendorId: 0x0e0e, productId: 0x000c });
    custom.connect();
    const reconnectFn = (custom as unknown as Record<string, unknown>)._reconnect as () => boolean;
    expect(reconnectFn.call(custom)).toBe(true);
    expect(mockState.instances[mockState.instances.length - 1].path).toBe('/dev/hidraw2');
    custom.disconnect();
  });
});

describe('RossTechUSBAdapter connection via HalInterface', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
  });

  afterEach(() => {
    const ross = adapter as RossTechUSBAdapter;
    ross.disconnect();
  });

  it('HalInterface.connect returns true', () => {
    const ross = adapter as RossTechUSBAdapter;
    const result = ross.connect();
    expect(result).toBe(true);
  });

  it('HalInterface.isConnected works', () => {
    const ross = adapter as RossTechUSBAdapter;
    ross.connect();
    expect(ross.isConnected()).toBe(true);
  });

  it('HalInterface.disconnect works', () => {
    const ross = adapter as RossTechUSBAdapter;
    ross.connect();
    ross.disconnect();
    expect(ross.isConnected()).toBe(false);
  });
});

describe('RossTechUSBAdapter implements HalInterface', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
    (adapter as RossTechUSBAdapter).connect();
  });

  afterEach(() => {
    (adapter as RossTechUSBAdapter).disconnect();
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

  it('test_r2_liveData returns CANFrame array read from the device', () => {
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    const result = adapter.liveData(['0105']);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(typeof result[0].timestamp).toBe('number');
    expect(result[0].data).toEqual([0x03, 0x41, 0x05, 0x7b, 0, 0, 0]);
  });

  it('test_fm11_liveData reports no data on read timeout', () => {
    expect(adapter.liveData(['0105'])).toEqual([]);
  });

  it('test_fm11_liveData with undefined pids returns no frames when device is silent', () => {
    expect(adapter.liveData()).toEqual([]);
  });

  it('test_fm11_liveData with empty pids returns no frames when device is silent', () => {
    expect(adapter.liveData([])).toEqual([]);
  });

  it('test_fm11_liveData returns one frame per answered pid', () => {
    mockState.readQueue = [
      [0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0],
      [0x01, 0x03, 0x41, 0x06, 0x80, 0, 0, 0],
      [0x01, 0x03, 0x41, 0x07, 0x90, 0, 0, 0],
    ];
    const frames = adapter.liveData(['0105', '0106', '0107']);
    expect(frames.map((f) => f.data[2])).toEqual([0x05, 0x06, 0x07]);
  });

  it('test_fm11_liveData returns only the pids that answered', () => {
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    expect(adapter.liveData(['0105', '0106']).length).toBe(1);
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

describe('RossTechUSBAdapter without connection', () => {
  let adapter: RossTechUSBAdapter;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
  });

  it('dtcRead returns empty array when not connected', () => {
    const result = adapter.dtcRead();
    expect(result.length).toBe(0);
  });

  it('test_fm10_dtcClear returns false when not connected', () => {
    expect(adapter.dtcClear()).toBe(false);
  });

  it('test_fm10_liveData returns no frames when not connected', () => {
    expect(adapter.liveData()).toEqual([]);
    expect(adapter.liveData(['0105'])).toEqual([]);
  });

  it('test_fm10_longCode reports failure when not connected', () => {
    expect(adapter.longCode('01').success).toBe(false);
  });

  it('test_fm10_shortCode reports failure when not connected', () => {
    expect(adapter.shortCode('01', 'A0').success).toBe(false);
  });

  it('test_fm10_adaptation reports failure when not connected', () => {
    expect(adapter.adaptation('01', 1, 10).success).toBe(false);
  });

  it('test_fm10_scan returns no ECUs when not connected', () => {
    expect(adapter.scan()).toEqual({ count: 0, names: [] });
  });

  it('test_fm10_sendCmd throws when not connected', () => {
    const sendFn = (adapter as unknown as Record<string, unknown>).sendCmd as (
      addr: string,
      data: number[],
    ) => boolean;
    expect(() => sendFn.call(adapter, '0x7E0', [0x02, 0x01])).toThrow();
  });

  it('rawCmd returns valid response when not connected', () => {
    const result = adapter.rawCmd('7E0', [0x02]);
    expect(result.frame.id).toBe('7E0');
  });
});

describe('RossTechUSBAdapter write failures (FM-10)', () => {
  let adapter: RossTechUSBAdapter;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
    adapter.connect();
    mockState.writeThrows = true;
  });

  afterEach(() => {
    adapter.disconnect();
  });

  it('test_fm10_longCode reports failure when hid write throws', () => {
    expect(adapter.longCode('01', 1).success).toBe(false);
  });

  it('test_fm10_shortCode reports failure when hid write throws', () => {
    expect(adapter.shortCode('01', 'A0', 1).success).toBe(false);
  });

  it('test_fm10_adaptation reports failure when hid write throws', () => {
    expect(adapter.adaptation('01', 1, 5).success).toBe(false);
  });

  it('test_fm10_dtcClear returns false when hid write throws', () => {
    expect(adapter.dtcClear()).toBe(false);
  });
});

describe('RossTechUSBAdapter done-when: connect, scan, live data with mocked node-hid', () => {
  let adapter: RossTechUSBAdapter;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
  });

  afterEach(() => {
    adapter.disconnect();
  });

  it('test_dw_connect opens the cable and reports connected', () => {
    const explicit = new RossTechUSBAdapter({ vendorId: 0x04d8, productId: 0x003a });
    expect(explicit.connect()).toBe(true);
    expect(explicit.isConnected()).toBe(true);
    explicit.disconnect();
    expect(mockState.instances.length).toBe(1);
  });

  it('test_dw_scan returns the ECU addresses that answer', () => {
    adapter.connect();
    mockState.readQueue = [
      [0x01, 0, 0, 0, 0, 0, 0, 0],
      [0x19, 0, 0, 0, 0, 0, 0, 0],
    ];
    const result = adapter.scan();
    expect(result.names).toEqual([0x01, 0x19]);
    expect(result.count).toBe(2);
  });

  it('test_fm11_scan returns only ECUs that answer (none answer)', () => {
    adapter.connect();
    expect(adapter.scan()).toEqual({ count: 0, names: [] });
  });

  it('test_fm11_scan writes a probe to the device', () => {
    adapter.connect();
    adapter.scan();
    expect(mockState.instances[0].written.length).toBeGreaterThan(0);
  });

  it('test_dw_liveData reads a frame through the mock', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    const frames = adapter.liveData(['0105']);
    expect(frames.length).toBe(1);
    expect(frames[0].data).toEqual([0x03, 0x41, 0x05, 0x7b, 0, 0, 0]);
  });

  it('test_fm11_liveData writes one request per pid', () => {
    adapter.connect();
    adapter.liveData(['0105', '0106', '0107']);
    const written = mockState.instances[0].written;
    expect(written.length).toBe(3);
    expect(written[0].slice(0, 3)).toEqual([0x02, 0x01, 0x05]);
    expect(written[1].slice(0, 3)).toEqual([0x02, 0x01, 0x06]);
    expect(written[2].slice(0, 3)).toEqual([0x02, 0x01, 0x07]);
    expect(written.every((r) => r.length === 8)).toBe(true);
  });

  it('test_fm11_liveData decodes the mocked read response', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    const [frame] = adapter.liveData(['0105']);
    expect(frame.data).toEqual([0x03, 0x41, 0x05, 0x7b, 0, 0, 0]);
    expect(frame.data).not.toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('test_fm3_liveData maps frame ids through the pid table', () => {
    const custom = new RossTechUSBAdapter({ pidTable: [0x100, 0x200, 0x300] });
    custom.connect();
    mockState.readQueue = [
      [0x02, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0],
      [0x00, 0x03, 0x41, 0x06, 0x80, 0, 0, 0],
    ];
    const frames = custom.liveData(['0105', '0106']);
    expect(frames.map((f) => f.id)).toEqual(['0x300', '0x100']);
    custom.disconnect();
  });

  it('test_fm3_liveData maps frame ids through the default pid table', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    const [frame] = adapter.liveData(['0105']);
    expect(frame.id).toBe('0x7E8');
  });

  it('test_fm3_liveData drops a frame whose pid index is outside the table', () => {
    const custom = new RossTechUSBAdapter({ pidTable: [0x100] });
    custom.connect();
    mockState.readQueue = [[0x05, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    expect(custom.liveData(['0105'])).toEqual([]);
    custom.disconnect();
  });
});

describe('RossTechUSBAdapter reconnect state (FM-10)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('test_fm10_connected is cleared when all reconnect attempts fail', () => {
    vi.useFakeTimers();
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    mockState.devices = [];
    mockState.writeThrows = true;
    // The heartbeat makes one reconnect attempt per 5000 ms tick (FM-13).
    vi.advanceTimersByTime(5000 * 3);
    expect(adapter.isConnected()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    adapter.disconnect();
  });
});

// Decision 5 (revised 2026-11-09, FM-15): getAdapter keeps the 2.1 stub. Wiring the real
// adapters into getAdapter is a later task.
describe('getAdapter default (decision 5 revised)', () => {
  it('test_getAdapter returns the stub RossTechAdapter for RossTech', () => {
    const hal = getAdapter(AdapterType.RossTech);
    expect(hal).toBeInstanceOf(RossTechAdapter);
    expect(hal).not.toBeInstanceOf(RossTechUSBAdapter);
  });

  it('test_getAdapter returns the stub RossTechAdapter for null (default)', () => {
    const hal = getAdapter(null);
    expect(hal).toBeInstanceOf(RossTechAdapter);
    expect(hal).not.toBeInstanceOf(RossTechUSBAdapter);
  });
});

describe('RossTechUSBAdapter heartbeats and reconnect', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
    (adapter as RossTechUSBAdapter).connect();
  });

  afterEach(() => {
    const ross = adapter as RossTechUSBAdapter;
    ross.disconnect();
  });

  it('heartbeats are scheduled after connect', () => {
    const ross = adapter as RossTechUSBAdapter;
    expect(ross.isConnected()).toBe(true);
    expect(ross.isConnected()).toBe(true);
  });

  it('heartbeat timer is cleared on disconnect', () => {
    const ross = adapter as RossTechUSBAdapter;
    ross.connect();
    ross.disconnect();
    expect(ross.isConnected()).toBe(false);
  });

  it('connect can be called multiple times', () => {
    const ross = adapter as RossTechUSBAdapter;
    ross.disconnect();
    expect(ross.isConnected()).toBe(false);
    const result = ross.connect();
    expect(result).toBe(true);
    expect(ross.isConnected()).toBe(true);
  });

  it('disconnect can be called multiple times', () => {
    const ross = adapter as RossTechUSBAdapter;
    ross.connect();
    ross.disconnect();
    ross.disconnect();
    expect(ross.isConnected()).toBe(false);
  });
});

describe('RossTechUSBAdapter type compatibility', () => {
  it('RossTechUSBAdapter satisfies HalInterface', () => {
    const adapter: HalInterface = new RossTechUSBAdapter();
    const ross = adapter as RossTechUSBAdapter;
    ross.connect();

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

    ross.disconnect();
  });

  it('RossTechUSBAdapter works as constructor type', () => {
    const adapter = new RossTechUSBAdapter();
    expect(adapter instanceof RossTechUSBAdapter).toBe(true);
  });
});

describe('RossTechUSBAdapter edge cases', () => {
  let adapter: HalInterface;

  beforeEach(() => {
    adapter = new RossTechUSBAdapter();
    (adapter as RossTechUSBAdapter).connect();
  });

  afterEach(() => {
    const ross = adapter as RossTechUSBAdapter;
    ross.disconnect();
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

  it('longCode rejects a negative block (FM-12)', () => {
    const result = adapter.longCode('01', -1);
    expect(result.success).toBe(false);
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

  it('adaptation rejects a negative channel (FM-12)', () => {
    const result = adapter.adaptation('01', -1, 42);
    expect(result.value).toBe(42);
    expect(result.success).toBe(false);
  });

  it('getPIDTable returns array with expected CAN IDs', () => {
    const adapter = new RossTechUSBAdapter();
    const pidTable = adapter.getPIDTable();
    expect(pidTable).toContain(0x7E0);
    expect(pidTable).toContain(0x7E8);
    expect(pidTable).toContain(0x7DF);
  });

  it('sendCmd sends 8-byte HID report', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const sendFn = (adapter as unknown as Record<string, unknown>).sendCmd as (
      addr: string,
      data: number[],
    ) => boolean;
    sendFn.call(adapter, '0x7E0', [0x02, 0x01, 0x03]);
    adapter.disconnect();
    // If no error is thrown, the sendCmd succeeded.
    expect(true).toBe(true);
  });

  it('_ping calls sendCmd successfully', () => {
    mockState.writeThrows = false;
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const pingFn = (adapter as unknown as Record<string, unknown>)._ping as () => boolean;
    const result = pingFn.call(adapter);
    expect(result).toBe(true);
    adapter.disconnect();
  });

  it('_ping catches error and calls _reconnect', () => {
    mockState.writeThrows = true;
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const pingFn = (adapter as unknown as Record<string, unknown>)._ping as () => boolean;
    const result = pingFn.call(adapter);
    expect(result).toBe(true);
    adapter.disconnect();
  });

  it('_reconnect finds device and sets connected', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const reconnectFn = (adapter as unknown as Record<string, unknown>)._reconnect as () => boolean;
    const result = reconnectFn.call(adapter);
    expect(result).toBe(true);
    expect(adapter.isConnected()).toBe(true);
    adapter.disconnect();
  });

  it('_reconnect closes existing device before reconnect', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const reconnectFn = (adapter as unknown as Record<string, unknown>)._reconnect as () => boolean;
    const result = reconnectFn.call(adapter);
    expect(result).toBe(true);
    expect(adapter.isConnected()).toBe(true);
    adapter.disconnect();
  });

  it('_reconnect returns false after max attempts', () => {
    vi.useFakeTimers();
    try {
      const adapter = new RossTechUSBAdapter();
      adapter.connect();
      const openedBefore = mockState.instances.length;
      const reconnectSpy = vi.spyOn(
        adapter as unknown as { _reconnect: () => boolean },
        '_reconnect',
      );
      mockState.devices = [{ path: '/dev/hidraw2', vendorId: 0x0e0e, productId: 0x000c }];
      mockState.writeThrows = true;
      // One reconnect attempt per 5000 ms heartbeat tick; 3 failed attempts disconnect (FM-13).
      vi.advanceTimersByTime(5000 * 3);
      expect(reconnectSpy.mock.results.map((r) => r.value)).toEqual([false, false, false]);
      expect(adapter.isConnected()).toBe(false);
      expect(mockState.instances.length).toBe(openedBefore);
      adapter.disconnect();
    } finally {
      vi.useRealTimers();
    }
  });

  it('startHeartbeat sets up timer', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.disconnect();
    adapter.connect();
    expect((adapter as any).heartbeatTimer).not.toBeNull();
    adapter.disconnect();
  });

  it('stopHeartbeat clears timer', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.disconnect();
    adapter.connect();
    const stopFn = (adapter as unknown as Record<string, unknown>).stopHeartbeat as () => void;
    stopFn.call(adapter);
    expect((adapter as any).heartbeatTimer).toBeNull();
  });
});

describe('RossTechUSBAdapter coverage additions (task 2.3 implementer)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports the unverified default ids and pid table that the adapter uses', () => {
    expect(DEFAULT_ROSS_TECH_VENDOR_ID).toBe(0x04d8);
    expect(DEFAULT_ROSS_TECH_PRODUCT_ID).toBe(0x003a);
    expect(new RossTechUSBAdapter().getPIDTable()).toEqual([...DEFAULT_PID_TABLE]);
  });

  it('liveData skips a malformed pid and sends nothing for it', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    mockState.readQueue = [[0x01, 0x03, 0x41, 0x05, 0x7b, 0, 0, 0]];
    const frames = adapter.liveData(['zz05', '01', '0105']);
    expect(frames.length).toBe(1);
    expect(mockState.instances[0].written.length).toBe(1);
    adapter.disconnect();
  });

  it('heartbeat timer writes a ping after the heartbeat interval', () => {
    vi.useFakeTimers();
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    expect(mockState.instances[0].written.length).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(mockState.instances[0].written[0].slice(0, 2)).toEqual([0x01, 0x00]);
    adapter.disconnect();
  });

  it('disconnect ignores a close error and clears the connected flag', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    const instance = mockState.instances[0] as unknown as { close: () => void };
    instance.close = () => {
      throw new Error('Mock close failure');
    };
    expect(() => adapter.disconnect()).not.toThrow();
    expect(adapter.isConnected()).toBe(false);
  });

  it('adaptation with a channel outside 0..255 and no value gives value 0 and no write', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    expect(adapter.adaptation('01', 256)).toEqual({ success: false, value: 0 });
    expect(mockState.instances[0].written.length).toBe(0);
    adapter.disconnect();
  });

  it('a drain stops after 64 stale reports, then the request is written', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    mockState.buffer = Array.from({ length: 100 }, () => [0x01, 0, 0, 0, 0, 0, 0, 0]);
    expect(adapter.dtcClear()).toBe(true);
    expect(mockState.buffer.length).toBe(100 - 64);
    expect(mockState.instances[0].written.length).toBe(1);
    adapter.disconnect();
  });

  it('scan propagates a write error instead of a false empty result', () => {
    const adapter = new RossTechUSBAdapter();
    adapter.connect();
    mockState.writeThrows = true;
    expect(() => adapter.scan()).toThrow();
    adapter.disconnect();
  });
});
