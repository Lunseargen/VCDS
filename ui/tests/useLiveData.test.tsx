// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HalInterface } from '../../src/hal/interface';
import { encodeValue } from '../../src/hal/sim';
import { useLiveData } from '../src/useLiveData';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const derive = (v: Record<string, number>) => ({ ...v, b: v.a * 10 });
const zero = () => 0;
const adapter = { liveData: () => [{ id: 'a', data: encodeValue(2) }] } as unknown as HalInterface;

describe('useLiveData', () => {
  it('with the defaults, reads at once and keeps the values with no change', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveData(adapter));
    expect(result.current.values).toEqual({ a: 2 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.ticks).toBe(2);
    expect(result.current.history.get('a')).toEqual([2, 2]);
  });
  it('adds the derived values to the values and to the history', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveData(adapter, 100, zero, derive));
    expect(result.current.values).toEqual({ a: 2, b: 20 });
    expect(result.current.history.get('b')).toEqual([20]);
  });
});
