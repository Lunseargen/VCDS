// Live data stream for the UI: reads the simulated adapter at a fixed rate and keeps a
// short history of each channel for the graphs. The data path is the same as for real
// hardware: HalInterface.liveData() gives frames, and decodeValue() reads each frame.
import { decodeValue, SimulatedAdapter } from '../../src/hal/sim';
import { createSimVehicle, type SimVehicle } from '../../src/sim/vehicle';
import { parseVcdsCsvLog, type VcdsCsvLog } from '../../src/sim/vcdsCsvLog';
import { parseVcdsScanLog, type VcdsScanLog } from '../../src/sim/vcdsScanLog';

export const HISTORY_LENGTH = 300; // 30 s at 10 Hz

export interface Frame {
  values: Record<string, number>;
  /** Simulation time in seconds. */
  t: number;
}

/** Decode the frames of liveData() into a map of channel values. Bad frames are skipped. */
export function framesToValues(frames: Array<{ id: string; data: number[] }>): Record<string, number> {
  const values: Record<string, number> = {};
  for (const frame of frames) {
    try {
      values[frame.id] = decodeValue(frame.data);
    } catch {
      // A frame with fewer than 4 bytes has no value.
    }
  }
  return values;
}

/** Ring buffer of the last HISTORY_LENGTH values of each channel. */
export class History {
  private readonly data = new Map<string, number[]>();

  constructor(private readonly length = HISTORY_LENGTH) {}

  push(values: Record<string, number>): void {
    for (const [key, value] of Object.entries(values)) {
      const series = this.data.get(key) ?? [];
      series.push(value);
      if (series.length > this.length) series.splice(0, series.length - this.length);
      this.data.set(key, series);
    }
  }

  get(key: string): number[] {
    return this.data.get(key) ?? [];
  }

  clear(): void {
    this.data.clear();
  }
}

/** Counts ticks and gives the rate over the last full second. */
export class RateMeter {
  private count = 0;
  private windowStart: number;
  rate = 0;

  constructor(now: number) {
    this.windowStart = now;
  }

  tick(now: number): number {
    this.count++;
    const span = now - this.windowStart;
    if (span >= 1000) {
      this.rate = (this.count * 1000) / span;
      this.count = 0;
      this.windowStart = now;
    }
    return this.rate;
  }
}

export interface LoadedData {
  vehicle: SimVehicle;
  csv: VcdsCsvLog | null;
  scan: VcdsScanLog | null;
  csvName: string | null;
  scanName: string | null;
  errors: string[];
}

/** Parse the first CSV log and the first scan log. A parse error is reported, not thrown. */
export function loadVehicle(logs: { csv: Array<{ name: string; text: string }>; scan: Array<{ name: string; text: string }> }): LoadedData {
  const errors: string[] = [];
  let csv: VcdsCsvLog | null = null;
  let scan: VcdsScanLog | null = null;
  const csvFile = logs.csv[0] ?? null;
  const scanFile = logs.scan[0] ?? null;
  if (csvFile) {
    try {
      csv = parseVcdsCsvLog(csvFile.text);
    } catch (e) {
      errors.push(`${csvFile.name}: ${(e as Error).message}`);
    }
  }
  if (scanFile) scan = parseVcdsScanLog(scanFile.text);
  return {
    vehicle: createSimVehicle({ csv, scan }),
    csv,
    scan,
    csvName: csv ? csvFile!.name : null,
    scanName: scanFile ? scanFile.name : null,
    errors,
  };
}

/**
 * A clock for the simulation. Speed changes and pauses do not make the time jump.
 */
export class SimClock {
  private base = 0;
  private since: number;
  speed = 1;
  paused = false;

  constructor(now: number) {
    this.since = now;
  }

  time(now: number): number {
    return this.paused ? this.base : this.base + ((now - this.since) / 1000) * this.speed;
  }

  private rebase(now: number): void {
    this.base = this.time(now);
    this.since = now;
  }

  setSpeed(speed: number, now: number): void {
    this.rebase(now);
    this.speed = speed;
  }

  setPaused(paused: boolean, now: number): void {
    this.rebase(now);
    this.paused = paused;
  }
}

/** An adapter whose clock is the SimClock (in ms), so pause and speed work. */
export function makeAdapter(vehicle: SimVehicle, clock: SimClock, now: () => number): SimulatedAdapter {
  return new SimulatedAdapter(vehicle, () => clock.time(now()) * 1000);
}
