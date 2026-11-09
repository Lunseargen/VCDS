import * as HID from 'node-hid';
import {
  CANFrame,
  HalInterface,
  AdapterType,
  AdapterTypeValue,
  ScanResult,
  DTCCode,
  LongCodeResponse,
  ShortCodeResponse,
  AdaptationResponse,
  RawResponse,
} from './interface';

// Ross-Tech USB-CAN cable HID vendor and product IDs.
// NOT VERIFIED: these IDs are a guess (0x04d8 is the generic Microchip vendor ID).
// Task 2.4 checks them on the real cable. Override them with RossTechOptions.
export const DEFAULT_ROSS_TECH_VENDOR_ID = 0x04d8;
export const DEFAULT_ROSS_TECH_PRODUCT_ID = 0x003a;

// VCDS diagnostic CAN IDs
const VCDS_REQUEST_ID = '0x7E0';
const VCDS_BROADCAST_ID = '0x7DF';

// HID report size in bytes
const HID_REPORT_SIZE = 8;

// Time in milliseconds that one HID read waits for a report.
// An empty report means "no data".
const READ_TIMEOUT_MS = 100;

// Upper limit of stale reports that one drain removes before a request write.
// The limit stops an endless drain if the bus sends reports without a pause.
const MAX_DRAIN_REPORTS = 64;

// Largest value of a one-byte field (block or channel) in a request report.
const MAX_BYTE = 0xff;

// Upper limit of scan answers that one scan reads (one byte of ECU address space).
const MAX_SCAN_RESPONSES = 0xff;

// Largest CAN identifier (29-bit extended frame). A pidTable entry must be an integer in 0..MAX_CAN_ID.
const MAX_CAN_ID = 0x1fffffff;

// Live data PID that liveData() requests when the caller gives no PID.
const DEFAULT_LIVE_PID = '0105';

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL_MS = 5000;

// Auto-reconnect: the heartbeat makes one open attempt per tick (the tick is the delay).
// After this number of failed attempts in a row, the adapter disconnects.
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * PID table mapping CAN IDs to VCDS PID indices.
 * A live data report gives an index into this table in report[0].
 * NOT VERIFIED: the values are not checked against VCDS or a vehicle.
 * Task 2.4 checks them on a live vehicle (FM-3, D12). Override with RossTechOptions.pidTable.
 */
export const DEFAULT_PID_TABLE: readonly number[] = [
  0x7E0, 0x7E8, 0x7DF, 0x7EC, 0x7E4, 0x7E5, 0x7E6, 0x7E7,
];

/**
 * Settings for RossTechUSBAdapter. All fields are optional.
 * The defaults are NOT VERIFIED (task 2.4).
 */
export interface RossTechOptions {
  /** HID vendor ID of the cable. Default: DEFAULT_ROSS_TECH_VENDOR_ID. */
  vendorId?: number;
  /** HID product ID of the cable. Default: DEFAULT_ROSS_TECH_PRODUCT_ID. */
  productId?: number;
  /** CAN ID table for live data frame IDs. Default: DEFAULT_PID_TABLE. */
  pidTable?: number[];
}

/**
 * Return true if the value is an integer in 0..255 (one byte of a request report).
 */
function isByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_BYTE;
}

/**
 * Ross-Tech USB-CAN adapter implementation.
 * Communicates with the Ross-Tech cable via HID for CAN frame exchange.
 * The HID report format is an assumption (see tests/hal/ross-tech.test.ts); task 2.4 checks it.
 */
export class RossTechUSBAdapter implements HalInterface {
  readonly type: AdapterTypeValue = AdapterType.RossTech;

  private hidDevice: HID.HID | null = null;
  private connected: boolean = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pidTable: number[];
  private readonly vendorId: number;
  private readonly productId: number;
  private reconnectFailures: number = 0;

  /**
   * Create a new RossTechUSBAdapter instance.
   * The device is not connected yet. Call connect() to open the HID device.
   * @param options - Optional USB IDs and PID table. Missing fields use the defaults.
   * @throws RangeError if pidTable is empty or has an entry that is not an integer in 0..0x1FFFFFFF.
   */
  constructor(options: RossTechOptions = {}) {
    this.vendorId = options.vendorId ?? DEFAULT_ROSS_TECH_VENDOR_ID;
    this.productId = options.productId ?? DEFAULT_ROSS_TECH_PRODUCT_ID;
    const table = [...(options.pidTable ?? DEFAULT_PID_TABLE)];
    if (table.length === 0) {
      throw new RangeError('pidTable must not be empty');
    }
    for (const id of table) {
      if (!Number.isInteger(id) || id < 0 || id > MAX_CAN_ID) {
        throw new RangeError(`pidTable entry is not a CAN ID: ${String(id)}`);
      }
    }
    this.pidTable = table;
  }

  /**
   * Connect to the Ross-Tech USB-CAN cable via HID.
   * Opens only a device with the configured vendor ID and product ID.
   * Returns true on success, false if no matching device opens.
   */
  connect(): boolean {
    this.stopHeartbeat();
    this.closeDevice();
    if (!this.openMatchingDevice()) {
      this.connected = false;
      return false;
    }
    this.connected = true;
    this.reconnectFailures = 0;
    this.startHeartbeat();
    return true;
  }

  /**
   * Disconnect from the Ross-Tech USB-CAN cable.
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.closeDevice();
    this.connected = false;
  }

  /**
   * Check if the adapter is currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the current PID table mapping.
   * Returns a copy of the PID table array.
   */
  getPIDTable(): number[] {
    return [...this.pidTable];
  }

  /**
   * Scan for available ECUs on the CAN bus.
   * Writes one broadcast probe, then reads answers until an empty report.
   * report[0] of each answer is the ECU address.
   * Returns no ECUs when not connected. A HID error propagates to the caller.
   */
  scan(): ScanResult {
    const names: number[] = [];
    if (!this.isConnected()) {
      return { count: 0, names };
    }
    this.sendCmd(VCDS_BROADCAST_ID, [0x02, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
    for (let i = 0; i < MAX_SCAN_RESPONSES; i++) {
      const report = this.readReport();
      if (report.length === 0) {
        break;
      }
      names.push(report[0]);
    }
    return { count: names.length, names };
  }

  /**
   * Read diagnostic trouble codes from the vehicle.
   * Sends the request. The response decode is not implemented yet, so the result is empty.
   * Returns [] when not connected. A HID write error propagates, so a failure does not look like "no DTCs".
   */
  dtcRead(): DTCCode[] {
    if (!this.isConnected()) {
      return [];
    }
    this.sendCmd(VCDS_REQUEST_ID, [0x02, 0x19, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
    return [];
  }

  /**
   * Clear diagnostic trouble codes.
   * Returns true if the request was written, false if not connected or the write failed.
   */
  dtcClear(): boolean {
    return this.trySend([0x02, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  /**
   * Read live data for the given PIDs.
   * Writes one 8-byte request [0x02, service, pid, 0...] for each PID and reads one report.
   * report[0] is an index into the PID table, report[1..7] is the frame data (7 bytes).
   * A PID with no answer, a report shorter than 8 bytes, an index outside the table,
   * or a malformed PID gives no frame.
   * Returns [] when not connected. A HID error propagates to the caller.
   */
  liveData(pids?: string[]): CANFrame[] {
    if (!this.isConnected()) {
      return [];
    }
    const requested = pids && pids.length > 0 ? pids : [DEFAULT_LIVE_PID];
    const frames: CANFrame[] = [];
    for (const pid of requested) {
      if (typeof pid !== 'string' || !/^[0-9A-Fa-f]{4}$/.test(pid)) {
        continue;
      }
      const service = parseInt(pid.slice(0, 2), 16);
      const pidByte = parseInt(pid.slice(2, 4), 16);
      this.sendCmd(VCDS_REQUEST_ID, [0x02, service, pidByte, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const report = this.readReport();
      if (report.length < HID_REPORT_SIZE || report[0] >= this.pidTable.length) {
        continue;
      }
      frames.push({
        id: '0x' + this.pidTable[report[0]].toString(16).toUpperCase(),
        data: report.slice(1, HID_REPORT_SIZE),
        timestamp: Date.now(),
      });
    }
    return frames;
  }

  /**
   * Perform long coding on an ECU module.
   * success is false if not connected, if the write failed, or if block is not an integer
   * in 0..255 (then nothing is written).
   * @param address - The ECU address (e.g. '01', '19').
   * @param block - Optional block number for coding, 0..255.
   * @param _value - Optional coding value string (not sent yet).
   */
  longCode(address: string, block?: number, _value?: string): LongCodeResponse {
    const data: number[] = [0x04, 0x2E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    if (block !== undefined) {
      if (!isByte(block)) {
        return { success: false, result: String(address) };
      }
      data[2] = block;
    }
    return { success: this.trySend(data), result: String(address) };
  }

  /**
   * Perform short coding on an ECU module.
   * success is false if not connected or the write failed.
   * @param _address - The ECU address.
   * @param code - The coding code.
   * @param value - Optional coding value.
   */
  shortCode(_address: string, code: string, value?: number): ShortCodeResponse {
    const data: number[] = [0x03, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    if (value !== undefined) {
      data[3] = value & 0xFF;
    }
    return { success: this.trySend(data), result: String(code) };
  }

  /**
   * Read or write adaptation values in an ECU.
   * success is false if not connected, if the write failed, or if channel is not an integer
   * in 0..255 (then nothing is written).
   * @param _address - The ECU address.
   * @param channel - Optional adaptation channel number, 0..255.
   * @param value - Optional value to set.
   */
  adaptation(_address: string, channel?: number, value?: number): AdaptationResponse {
    const data: number[] = [0x03, 0x22, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    if (channel !== undefined) {
      if (!isByte(channel)) {
        return { success: false, value: value ?? 0 };
      }
      data[2] = channel;
    }
    return { success: this.trySend(data), value: value ?? 0 };
  }

  /**
   * Send a raw CAN frame command.
   * Returns the frame that the caller gave. A send error does not change the response.
   * @param id - The CAN frame ID (e.g. '7E0').
   * @param data - The raw data bytes.
   */
  rawCmd(id?: string, data?: number[]): RawResponse {
    const frameId = id ?? '';
    const frameData = data ?? [];
    this.trySend(frameData);
    return {
      frame: {
        id: frameId,
        data: frameData,
        timestamp: Date.now(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Start the heartbeat monitoring timer.
   * Pings the device every HEARTBEAT_INTERVAL_MS milliseconds.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this._ping();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat monitoring timer.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Find the first HID device with the configured vendor ID and product ID, and open it.
   * Returns false if no device matches or if HID throws.
   */
  private openMatchingDevice(): boolean {
    try {
      for (const dev of HID.devices()) {
        if (
          dev.vendorId === this.vendorId &&
          dev.productId === this.productId &&
          dev.path !== undefined
        ) {
          this.hidDevice = new HID.HID(dev.path);
          return true;
        }
      }
      return false;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Close the HID device if one is open. Close errors are ignored.
   */
  private closeDevice(): void {
    const device = this.hidDevice;
    this.hidDevice = null;
    if (device) {
      try {
        device.close();
      } catch (_err) {
        // The device is already gone. Nothing to do.
      }
    }
  }

  /**
   * Return the open HID device. Throws if the adapter is not connected.
   */
  private requireDevice(): HID.HID {
    if (!this.hidDevice || !this.connected) {
      throw new Error('Ross-Tech adapter is not connected');
    }
    return this.hidDevice;
  }

  /**
   * Send an 8-byte HID report to the device.
   * First drains the stale input, so that the next read gets the answer to this request
   * and not an unread answer to an earlier request (FM-14).
   * Throws if the adapter is not connected, or if the drain or the write fails.
   */
  private sendCmd(_address: string, data: number[]): boolean {
    const device = this.requireDevice();
    this.drainInput(device);
    const report: number[] = new Array(HID_REPORT_SIZE).fill(0);
    for (let i = 0; i < Math.min(data.length, HID_REPORT_SIZE); i++) {
      report[i] = data[i];
    }
    device.write(report);
    return true;
  }

  /**
   * Send a request and return false instead of an error.
   */
  private trySend(data: number[]): boolean {
    try {
      return this.sendCmd(VCDS_REQUEST_ID, data);
    } catch (_err) {
      return false;
    }
  }

  /**
   * Read and discard the reports that are already in the HID input buffer.
   * A read with timeout 0 returns [] when the buffer is empty.
   */
  private drainInput(device: HID.HID): void {
    for (let i = 0; i < MAX_DRAIN_REPORTS; i++) {
      if (device.readTimeout(0).length === 0) {
        return;
      }
    }
  }

  /**
   * Read one HID report. Returns [] when no report arrives before READ_TIMEOUT_MS.
   */
  private readReport(): number[] {
    return this.requireDevice().readTimeout(READ_TIMEOUT_MS);
  }

  /**
   * Send a ping frame for heartbeat monitoring.
   * Calls _reconnect() if the ping fails.
   */
  private _ping(): boolean {
    try {
      return this.sendCmd(VCDS_REQUEST_ID, [
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
    } catch (_err) {
      return this._reconnect();
    }
  }

  /**
   * Make one attempt to open the HID device again. The heartbeat calls this once per tick.
   * The adapter is not connected from the start of the attempt until the device opens.
   * After MAX_RECONNECT_ATTEMPTS failed attempts in a row, the adapter disconnects
   * and the heartbeat stops. No call blocks the thread.
   */
  private _reconnect(): boolean {
    this.connected = false;
    this.closeDevice();
    if (this.openMatchingDevice()) {
      this.connected = true;
      this.reconnectFailures = 0;
      return true;
    }
    this.reconnectFailures++;
    if (this.reconnectFailures >= MAX_RECONNECT_ATTEMPTS) {
      this.disconnect();
    }
    return false;
  }
}
