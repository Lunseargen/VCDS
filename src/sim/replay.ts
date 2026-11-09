// Replay of logged samples. The replay loops: time t and t + duration give the same value.
import type { LogSample } from './vcdsCsvLog';

/** Index of the last sample with `t <= time`, or -1 when all samples are later. */
export function lastIndexAtOrBefore(samples: LogSample[], time: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Wrap a time into the range [0, duration). A duration of 0 or less gives 0. */
export function loopTime(time: number, duration: number): number {
  if (!(duration > 0)) return 0;
  const wrapped = time % duration;
  return wrapped < 0 ? wrapped + duration : wrapped;
}

/**
 * Value of a series at a time.
 * `hold` keeps the last value (for bit fields); `linear` interpolates between 2 samples.
 * Throws an Error for an empty series.
 */
export function valueAt(samples: LogSample[], time: number, mode: 'hold' | 'linear'): number {
  if (samples.length === 0) throw new Error('empty series');
  const i = lastIndexAtOrBefore(samples, time);
  if (i < 0) return samples[0].value;
  const a = samples[i];
  const b = samples[i + 1];
  if (mode === 'hold' || b === undefined || b.t === a.t) return a.value;
  const f = (time - a.t) / (b.t - a.t);
  return a.value + (b.value - a.value) * f;
}
