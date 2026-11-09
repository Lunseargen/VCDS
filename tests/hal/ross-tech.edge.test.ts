// Edge tests for task 2.3 (RossTechUSBAdapter and the getAdapter change).
// Each test name starts with test_edge_. An it.fails test shows an open fault:
// it passes while the fault exists, and it fails when somebody fixes the fault.
// See .factory/2.3/edges.md for the attack list and the FMEA row of each test.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RossTechUSBAdapter } from '../../src/hal/ross-tech';
import { AdapterType, getAdapter, OBDLinkHIDAdapter } from '../../src/hal/interface';

const CABLE = { path: '/dev/hidraw0', vendorId: 0x04d8, productId: 0x003a };

const mockState = {
  devices: [CABLE] as Array<{ path?: string; vendorId: number; productId: number }>,
  writeThrows: false,
  closeThrows: false,
  // The read with this 1-based number throws. 0 = no read throws.
  readThrowsAt: 0,
  readCount: 0,
  // Answers that the device sends later. Each write moves the next answer into the input
  // buffer; a read with a timeout (ms > 0) can also wait for the next answer.
  readQueue: [] as number[][],
  // Reports already in the HID input buffer. A read with timeout 0 (drain) sees only these.
  buffer: [] as number[][],
  instances: [] as Array<{ path: string; opened: boolean; written: number[][] }>,
};

function resetMockState(): void {
  mockState.devices = [{ ...CABLE }];
  mockState.writeThrows = false;
  mockState.closeThrows = false;
  mockState.readThrowsAt = 0;
  mockState.readCount = 0;
  mockState.readQueue = [];
  mockState.buffer = [];
  mockState.instances = [];
}

vi.mock('node-hid', () => {
  class MockHID {
    path: string;
    opened = true;
    written: number[][] = [];

    constructor(path: string) {
      this.path = path;
      mockState.instances.push(this);
    }

    close(): void {
      if (mockState.closeThrows) {
        throw new Error('Mock close failure');
      }
      this.opened = false;
    }

    write(data: number[]): number {
      if (mockState.writeThrows) {
        throw new Error('Mock write failure');
      }
      this.written.push(data);
      const answer = mockState.readQueue.shift();
      if (answer) {
        mockState.buffer.push(answer);
      }
      return data.length;
    }

    readTimeout(ms: number): number[] {
      mockState.readCount++;
      if (mockState.readCount === mockState.readThrowsAt) {
        throw new Error('Mock read failure');
      }
      const buffered = mockState.buffer.shift();
      if (buffered) {
        return buffered;
      }
      return ms === 0 ? [] : (mockState.readQueue.shift() ?? []);
    }

    readSync(): number[] {
      return this.readTimeout(-1);
    }
  }

  const devices = () => mockState.devices;
  const HID = MockHID as unknown as typeof import('node-hid').HID;
  return { devices, HID, default: { devices, HID } };
});

type Internals = {
  _ping: () => boolean;
  _reconnect: () => boolean;
  heartbeatTimer: unknown;
};
const internals = (a: RossTechUSBAdapter): Internals => a as unknown as Internals;
const lastWrites = (): number[][] => mockState.instances[mockState.instances.length - 1].written;

let adapter: RossTechUSBAdapter;

beforeEach(() => {
  resetMockState();
  adapter = new RossTechUSBAdapter();
});

afterEach(() => {
  mockState.closeThrows = false;
  adapter.disconnect();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Priority 1: the synchronous reconnect delay (FM-13)
// ---------------------------------------------------------------------------
describe('edge: heartbeat reconnect blocks the thread', () => {
  // FIXED (FM-13): the heartbeat makes one open attempt per tick. No call waits.
  it('test_edge_reconnect_does_not_block_event_loop', () => {
    adapter.connect();
    mockState.devices = [];
    mockState.writeThrows = true;
    const start = process.hrtime.bigint();
    internals(adapter)._ping();
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    expect(elapsedMs).toBeLessThan(200);
  });

  // FIXED (FM-13): _reconnect no longer calls Atomics.wait and sets connected = false
  // before the open attempt. The spy proves that a forbidden Atomics.wait has no effect.
  it('test_edge_reconnect_state_is_consistent_when_sleep_throws', () => {
    adapter.connect();
    mockState.devices = [];
    mockState.writeThrows = true;
    vi.spyOn(Atomics, 'wait').mockImplementation(() => {
      throw new TypeError('Atomics.wait cannot be called in this context');
    });
    try {
      internals(adapter)._ping();
    } catch (_err) {
      // The state check below is the assertion.
    }
    expect(adapter.isConnected()).toBe(false);
  });

  // Changed for FM-13: one reconnect attempt per heartbeat tick, so the timer stops after
  // the third failed tick, not after one _reconnect call.
  it('test_edge_reconnect_failure_stops_heartbeat_timer', () => {
    vi.useFakeTimers();
    adapter.connect();
    expect(vi.getTimerCount()).toBe(1);
    mockState.devices = [];
    mockState.writeThrows = true;
    vi.advanceTimersByTime(5000 * 2);
    expect(adapter.isConnected()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(vi.getTimerCount()).toBe(0);
    expect(internals(adapter).heartbeatTimer).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Priority 2: dtcRead false "no DTCs" (FM-10)
// ---------------------------------------------------------------------------
describe('edge: dtcRead reports a failure as "no DTCs"', () => {
  // FIXED: dtcRead now lets a write error propagate, the same as scan() and liveData().
  it('test_edge_dtcRead_write_failure_is_not_no_dtcs', () => {
    adapter.connect();
    mockState.writeThrows = true;
    expect(() => adapter.dtcRead()).toThrow('Mock write failure');
  });

  it('test_edge_dtcRead_not_connected_returns_empty', () => {
    expect(adapter.dtcRead()).toEqual([]);
  });

  // OPEN: dtcRead never reads the ECU answer. An ECU with stored DTCs gives [] = "no DTCs".
  it.fails('test_edge_dtcRead_does_not_report_no_dtcs_when_ecu_answers', () => {
    adapter.connect();
    mockState.readQueue = [[0x03, 0x59, 0x01, 0x12, 0x34, 0x00, 0x00, 0x00]];
    expect(adapter.dtcRead()).not.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Stale answers: a request that does not read its answer (FM-14)
// ---------------------------------------------------------------------------
describe('edge: unread answers corrupt the next read', () => {
  // FIXED (FM-14): each request write first drains the unread answers of earlier requests.
  it('test_edge_liveData_does_not_return_a_stale_dtc_answer', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x59, 0x01, 0x12, 0x34, 0x00, 0x00, 0x00]];
    adapter.dtcRead();
    mockState.readQueue.push([0x01, 0x41, 0x05, 0x7b, 0x00, 0x00, 0x00, 0x00]);
    const frames = adapter.liveData(['0105']);
    expect(frames[0].data.slice(0, 3)).toEqual([0x41, 0x05, 0x7b]);
  });

  it('test_edge_scan_does_not_count_a_stale_answer_as_an_ecu', () => {
    adapter.connect();
    mockState.readQueue = [[0x6e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]];
    adapter.dtcClear();
    mockState.readQueue.push([0x01, 0, 0, 0, 0, 0, 0, 0]);
    expect(adapter.scan().names).toEqual([0x01]);
  });
});

// ---------------------------------------------------------------------------
// Priority 3: getAdapter (FM-15)
// ---------------------------------------------------------------------------
describe('edge: getAdapter default', () => {
  it('test_edge_getAdapter_does_not_open_hid_on_construction', () => {
    getAdapter(null);
    getAdapter(undefined);
    getAdapter(AdapterType.RossTech);
    expect(mockState.instances).toHaveLength(0);
  });

  // OPEN: before this task getAdapter(null|undefined|unknown|RossTech) returned the stub
  // (scan = 100 ECUs, dtcClear = true). Now it returns an unconnected RossTechUSBAdapter.
  // HalInterface has no connect(), so a caller that holds only HalInterface cannot use the cable.
  it.fails('test_edge_getAdapter_result_can_reach_the_cable_through_HalInterface', () => {
    const hal = getAdapter(AdapterType.RossTech);
    mockState.readQueue = [[0x01, 0, 0, 0, 0, 0, 0, 0]];
    expect(hal.scan().count).toBe(1);
  });

  // OPEN: decision 5 says "same pattern as OBDLink in 2.2", but the OBDLink branch still
  // returns the 2.1 stub OBDLinkAdapter. The two branches now differ.
  it.fails('test_edge_getAdapter_OBDLink_uses_the_same_pattern_as_RossTech', () => {
    expect(getAdapter(AdapterType.OBDLink)).toBeInstanceOf(OBDLinkHIDAdapter);
  });
});

// ---------------------------------------------------------------------------
// HID reports: empty, short, oversized (FM-11 / FM-3)
// ---------------------------------------------------------------------------
describe('edge: HID report sizes', () => {
  // FIXED (FM-11): a report shorter than 8 bytes gives no frame. A full report gives 7 data bytes.
  it('test_edge_liveData_short_report_gives_fixed_data_length', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x41]];
    const frames = adapter.liveData(['0105']);
    for (const f of frames) {
      expect(f.data).toHaveLength(7);
    }
  });

  it('test_edge_liveData_oversized_report_is_cut_to_7_data_bytes', () => {
    adapter.connect();
    mockState.readQueue = [Array.from({ length: 64 }, (_, i) => (i === 0 ? 1 : i))];
    const frames = adapter.liveData(['0105']);
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('test_edge_scan_stops_at_255_answers', () => {
    adapter.connect();
    mockState.readQueue = Array.from({ length: 300 }, () => [0x01, 0, 0, 0, 0, 0, 0, 0]);
    expect(adapter.scan().count).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// PID table option (FM-3)
// ---------------------------------------------------------------------------
describe('edge: pidTable option', () => {
  // FIXED: the constructor rejects an empty table and an entry that is not a CAN ID.
  // Before: [] dropped every answer as "no data", -1 gave id '0x-1', NaN gave '0xNAN',
  // and a hole crashed liveData with a TypeError.
  it('test_edge_pidTable_rejects_invalid_entries', () => {
    const bad: number[][] = [[], [-1], [Number.NaN], [1.5], [0x20000000], new Array(2)];
    for (const pidTable of bad) {
      expect(() => new RossTechUSBAdapter({ pidTable })).toThrow(RangeError);
    }
  });

  it('test_edge_pidTable_accepts_11_and_29_bit_ids', () => {
    const custom = new RossTechUSBAdapter({ pidTable: [0, 0x7ff, 0x800, 0x1fffffff] });
    expect(custom.getPIDTable()).toEqual([0, 0x7ff, 0x800, 0x1fffffff]);
  });

  it('test_edge_pidTable_duplicates_map_each_index', () => {
    const custom = new RossTechUSBAdapter({ pidTable: [0x7e8, 0x7e8] });
    custom.connect();
    mockState.readQueue = [[0x00, 1, 0, 0, 0, 0, 0, 0], [0x01, 2, 0, 0, 0, 0, 0, 0]];
    const frames = custom.liveData(['0105', '010C']);
    custom.disconnect();
    expect(frames.map((f) => f.id)).toEqual(['0x7E8', '0x7E8']);
  });
});

// ---------------------------------------------------------------------------
// USB IDs (FM-8 / FM-9)
// ---------------------------------------------------------------------------
describe('edge: vendorId and productId options', () => {
  it('test_edge_vendorId_0_is_kept_and_not_replaced_by_default', () => {
    mockState.devices = [{ path: '/dev/hidraw9', vendorId: 0, productId: 0 }, { ...CABLE }];
    const custom = new RossTechUSBAdapter({ vendorId: 0, productId: 0 });
    expect(custom.connect()).toBe(true);
    custom.disconnect();
    expect(mockState.instances[0].path).toBe('/dev/hidraw9');
  });

  it('test_edge_invalid_ids_never_match', () => {
    for (const id of [Number.NaN, -1, 0x10000]) {
      const custom = new RossTechUSBAdapter({ vendorId: id, productId: id });
      expect(custom.connect()).toBe(false);
    }
    expect(mockState.instances).toHaveLength(0);
  });

  it('test_edge_matching_device_without_path_is_not_opened', () => {
    mockState.devices = [{ vendorId: CABLE.vendorId, productId: CABLE.productId }];
    expect(adapter.connect()).toBe(false);
    expect(mockState.instances).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Connection state and timers (FM-8 / FM-10)
// ---------------------------------------------------------------------------
describe('edge: connect, disconnect, heartbeat timers', () => {
  it('test_edge_connect_twice_closes_first_device_and_keeps_one_timer', () => {
    vi.useFakeTimers();
    adapter.connect();
    adapter.connect();
    expect(mockState.instances).toHaveLength(2);
    expect(mockState.instances[0].opened).toBe(false);
    expect(mockState.instances[1].opened).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('test_edge_connect_twice_with_close_error_still_connects', () => {
    adapter.connect();
    mockState.closeThrows = true;
    expect(adapter.connect()).toBe(true);
    expect(adapter.isConnected()).toBe(true);
  });

  it('test_edge_failed_second_connect_clears_state_and_timer', () => {
    vi.useFakeTimers();
    adapter.connect();
    mockState.devices = [];
    expect(adapter.connect()).toBe(false);
    expect(adapter.isConnected()).toBe(false);
    expect(mockState.instances[0].opened).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('test_edge_disconnect_when_never_connected_is_safe', () => {
    vi.useFakeTimers();
    expect(() => adapter.disconnect()).not.toThrow();
    expect(adapter.isConnected()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('test_edge_no_ping_after_disconnect', () => {
    vi.useFakeTimers();
    adapter.connect();
    adapter.disconnect();
    vi.advanceTimersByTime(20000);
    expect(mockState.instances[0].written).toHaveLength(0);
  });

  it('test_edge_heartbeat_reconnect_success_keeps_one_timer', () => {
    vi.useFakeTimers();
    adapter.connect();
    mockState.writeThrows = true;
    vi.advanceTimersByTime(5000);
    mockState.writeThrows = false;
    expect(adapter.isConnected()).toBe(true);
    expect(mockState.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Read errors in the middle of a call (FM-10)
// ---------------------------------------------------------------------------
describe('edge: read throws in the middle of a call', () => {
  it('test_edge_liveData_read_error_propagates_not_partial_result', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0x41, 0x05, 0x7b, 0, 0, 0, 0]];
    mockState.readThrowsAt = 2;
    expect(() => adapter.liveData(['0105', '010C'])).toThrow('Mock read failure');
  });

  it('test_edge_scan_read_error_propagates_not_partial_result', () => {
    adapter.connect();
    mockState.readQueue = [[0x01, 0, 0, 0, 0, 0, 0, 0], [0x17, 0, 0, 0, 0, 0, 0, 0]];
    mockState.readThrowsAt = 2;
    expect(() => adapter.scan()).toThrow('Mock read failure');
  });
});

// ---------------------------------------------------------------------------
// Invalid and hostile PIDs (FM-11)
// ---------------------------------------------------------------------------
describe('edge: liveData pid input', () => {
  // FIXED: a non-string pid (possible from untyped IPC data) crashed with
  // "pid.slice is not a function". It is now skipped like any other malformed pid.
  it('test_edge_liveData_non_string_pid_is_skipped', () => {
    adapter.connect();
    const pids = [1050, null, { length: 4 }] as unknown as string[];
    expect(adapter.liveData(pids)).toEqual([]);
    expect(lastWrites()).toHaveLength(0);
  });

  it('test_edge_liveData_pid_with_newline_fullwidth_or_script_is_skipped', () => {
    adapter.connect();
    const pids = ['0105\n', '０１０５', '<script>', '01 05', '0x05', ''];
    expect(adapter.liveData(pids)).toEqual([]);
    expect(lastWrites()).toHaveLength(0);
  });

  it('test_edge_liveData_lower_case_pid_is_accepted', () => {
    adapter.connect();
    adapter.liveData(['01ff']);
    expect(lastWrites()[0].slice(0, 3)).toEqual([0x02, 0x01, 0xff]);
  });
});

// ---------------------------------------------------------------------------
// ECU addressing and value range of coding calls (FM-12)
// ---------------------------------------------------------------------------
describe('edge: coding calls address and range', () => {
  // OPEN: the HID report has no ECU address field and sendCmd ignores _address.
  // longCode('01') and longCode('19') write the same bytes, and both report success.
  it.fails('test_edge_longCode_writes_differ_for_different_ecu_addresses', () => {
    adapter.connect();
    adapter.longCode('01', 1);
    adapter.longCode('19', 1);
    const [a, b] = lastWrites();
    expect(a).not.toEqual(b);
  });

  // OPEN: rawCmd ignores the frame id, so a raw frame for 0x7E8 and for 0x7E0 is the same write.
  it.fails('test_edge_rawCmd_writes_differ_for_different_ids', () => {
    adapter.connect();
    adapter.rawCmd('7E0', [0x02, 0x10, 0x03]);
    adapter.rawCmd('7E8', [0x02, 0x10, 0x03]);
    const [a, b] = lastWrites();
    expect(a).not.toEqual(b);
  });

  // FIXED (FM-12 range part): a block outside 0..255 gives success: false and no write.
  it('test_edge_longCode_block_out_of_range_is_not_written_as_another_block', () => {
    adapter.connect();
    const res = adapter.longCode('01', 256);
    expect(res.success && lastWrites()[0][2] === 0).toBe(false);
  });

  // FIXED (FM-12 range part): a channel outside 0..255 gives success: false and no write.
  it('test_edge_adaptation_channel_out_of_range_is_not_written_as_channel_0', () => {
    adapter.connect();
    const res = adapter.adaptation('01', 256, 1);
    expect(res.success && lastWrites()[0][2] === 0).toBe(false);
  });

  // OPEN: RawResponse has no success field. A failed write gives the same response as a sent one.
  it.fails('test_edge_rawCmd_write_failure_is_visible', () => {
    adapter.connect();
    mockState.writeThrows = true;
    const failed = adapter.rawCmd('7E0', [1, 2, 3]);
    mockState.writeThrows = false;
    const sent = adapter.rawCmd('7E0', [1, 2, 3]);
    expect({ ...failed.frame, timestamp: 0 }).not.toEqual({ ...sent.frame, timestamp: 0 });
  });
});
