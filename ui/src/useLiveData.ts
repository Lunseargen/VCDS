// React hook: polls HalInterface.liveData() at a fixed rate, decodes the frames, and keeps history.
import { useEffect, useRef, useState } from 'react';
import type { HalInterface } from '../../src/hal/interface';
import { framesToValues, History, RateMeter } from './stream';

export interface LiveState {
  values: Record<string, number>;
  rate: number;
  ticks: number;
}

const defaultNow = () => performance.now();
const identity = (v: Record<string, number>) => v;

/**
 * `derive` adds computed values (the custom channels) to each read, before the history.
 * Give stable functions (useCallback or module level); a new function restarts the stream.
 */
export function useLiveData(
  adapter: HalInterface,
  periodMs = 100,
  now: () => number = defaultNow,
  derive: (values: Record<string, number>) => Record<string, number> = identity,
) {
  const history = useRef(new History());
  const [state, setState] = useState<LiveState>({ values: {}, rate: 0, ticks: 0 });
  useEffect(() => {
    const read = () => {
      const values = derive(framesToValues(adapter.liveData()));
      history.current.push(values);
      return values;
    };
    // The first read fills the widgets at once. It is not part of the rate.
    const first = read();
    setState((s) => ({ values: first, rate: s.rate, ticks: s.ticks + 1 }));
    const meter = new RateMeter(now());
    const id = setInterval(() => {
      const values = read();
      const rate = meter.tick(now());
      setState((s) => ({ values, rate, ticks: s.ticks + 1 }));
    }, periodMs);
    return () => clearInterval(id);
  }, [adapter, periodMs, now, derive]);
  return { ...state, history: history.current };
}
