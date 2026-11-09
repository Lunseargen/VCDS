// A simulated vehicle: replayed log channels plus synthetic channels, and the modules and
// faults of a scan log. The Shuffleboard reads named values from it at 10 Hz.
import type { VcdsCsvLog } from './vcdsCsvLog';
import type { ScanFault, ScanModule, VcdsScanLog } from './vcdsScanLog';
import { loopTime, valueAt } from './replay';
import { SYNTHETIC_CHANNELS } from './synthetic';

export type ChannelSource = 'log' | 'synthetic' | 'custom';

export interface ChannelInfo {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  kind: 'number' | 'bits';
  source: ChannelSource;
}

export interface SimVehicle {
  /** Text that names the data, for example the module of the CSV log. */
  description: string;
  channels: ChannelInfo[];
  /** Values of all channels at time t (seconds). */
  sample(t: number): Record<string, number>;
  modules(): ScanModule[];
  faults(): Array<ScanFault & { address: string }>;
  /** Remove the faults in memory only. The logs do not change. */
  clearFaults(): void;
}

export interface SimSources {
  csv?: VcdsCsvLog | null;
  scan?: VcdsScanLog | null;
}

/** Range of a series, with 10% space on each side. A flat series gets a range of ±1. */
export function paddedRange(values: number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}

function logChannels(csv: VcdsCsvLog): ChannelInfo[] {
  return csv.channels.map((ch) => {
    const range = ch.kind === 'bits' ? { min: 0, max: 255 } : paddedRange(csv.samples[ch.key].map((s) => s.value));
    return {
      key: ch.key,
      label: `Group ${ch.group} / field ${ch.field}`,
      unit: ch.kind === 'bits' ? 'bits' : ch.unit,
      min: range.min,
      max: range.max,
      kind: ch.kind,
      source: 'log',
    };
  });
}

/** Make a simulated vehicle. Each source is optional; with no source, only synthetic channels exist. */
export function createSimVehicle(sources: SimSources = {}): SimVehicle {
  const csv = sources.csv ?? null;
  const scan = sources.scan ?? null;
  let cleared = false;

  const channels: ChannelInfo[] = [
    ...SYNTHETIC_CHANNELS.map(({ key, label, unit, min, max }) => ({
      key,
      label,
      unit,
      min,
      max,
      kind: 'number' as const,
      source: 'synthetic' as const,
    })),
    ...(csv ? logChannels(csv) : []),
  ];

  return {
    description: csv ? csv.module : 'Synthetic data only',
    channels,
    sample(t: number): Record<string, number> {
      const out: Record<string, number> = {};
      for (const ch of SYNTHETIC_CHANNELS) out[ch.key] = ch.read(t);
      if (csv) {
        const lt = loopTime(t, csv.duration);
        for (const ch of csv.channels) {
          out[ch.key] = valueAt(csv.samples[ch.key], lt, ch.kind === 'bits' ? 'hold' : 'linear');
        }
      }
      return out;
    },
    modules(): ScanModule[] {
      return scan ? scan.modules : [];
    },
    faults() {
      if (!scan || cleared) return [];
      return scan.modules.flatMap((m) => m.faults.map((f) => ({ ...f, address: m.address })));
    },
    clearFaults(): void {
      cleared = true;
    },
  };
}
