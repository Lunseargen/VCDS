// Simulated adapter: implements HalInterface over a SimVehicle, with no hardware.
// It lets the features and the Shuffleboard run before the hardware check (task 2.4).
// It never writes to a vehicle. The write methods report success: false.
import type {
  AdaptationResponse,
  CANFrame,
  DTCCode,
  HalInterface,
  LongCodeResponse,
  RawResponse,
  ScanResult,
  ShortCodeResponse,
} from './interface';
import type { SimVehicle } from '../sim/vehicle';

export const SIM_ADAPTER_TYPE = 'Simulated';

/** Encode a number as a CAN-style frame: a 32-bit float, little-endian, in bytes 0..3. */
export function encodeValue(value: number): number[] {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return [0, 1, 2, 3].map((i) => view.getUint8(i));
}

/** Decode the bytes from encodeValue. Throws an Error for fewer than 4 bytes. */
export function decodeValue(data: number[]): number {
  if (data.length < 4) throw new Error('frame has fewer than 4 data bytes');
  const view = new DataView(new ArrayBuffer(4));
  data.slice(0, 4).forEach((b, i) => view.setUint8(i, b));
  return view.getFloat32(0, true);
}

export class SimulatedAdapter implements HalInterface {
  readonly type = SIM_ADAPTER_TYPE;
  private readonly startMs: number;

  constructor(
    private readonly vehicle: SimVehicle,
    private readonly now: () => number = Date.now,
  ) {
    this.startMs = now();
  }

  /** Seconds since the adapter was made. */
  elapsed(): number {
    return (this.now() - this.startMs) / 1000;
  }

  scan(): ScanResult {
    const names = this.vehicle.modules().map((m) => parseInt(m.address, 16));
    return { count: names.length, names };
  }

  dtcRead(): DTCCode[] {
    return this.vehicle.faults().map((f) => f.code);
  }

  /** Clears the simulated fault memory only. */
  dtcClear(): boolean {
    this.vehicle.clearFaults();
    return true;
  }

  /** One frame for each requested channel key (all channels when pids is empty). Unknown keys are skipped. */
  liveData(pids?: string[]): CANFrame[] {
    const values = this.vehicle.sample(this.elapsed());
    const keys = pids && pids.length > 0 ? pids : Object.keys(values);
    const timestamp = this.now();
    return keys
      .filter((key) => key in values)
      .map((key) => ({ id: key, data: encodeValue(values[key]), timestamp }));
  }

  longCode(address: string): LongCodeResponse {
    return { success: false, result: `simulated adapter: no write to ${address}` };
  }

  shortCode(address: string): ShortCodeResponse {
    return { success: false, result: `simulated adapter: no write to ${address}` };
  }

  adaptation(): AdaptationResponse {
    return { success: false, value: 0 };
  }

  rawCmd(id?: string, data?: number[]): RawResponse {
    return { frame: { id: id ?? '', data: data ?? [], timestamp: this.now() } };
  }
}
