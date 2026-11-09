import { describe, expect, it } from 'vitest';
import {
  compileCustoms,
  CUSTOM_STORAGE_KEY,
  deriveValues,
  estimateRange,
  loadCustoms,
  makeCustom,
  saveCustoms,
  type CustomDef,
  type CustomInput,
} from '../src/custom/custom';
import { compileExpr } from '../src/custom/expr';

const base = ['176.1', '177.1', 'sim.rpm'];
const sample = (t: number) => ({ '176.1': 100 + t, '177.1': 200, 'sim.rpm': 900 });
const input = (over: Partial<CustomInput> = {}): CustomInput => ({ label: ' NOx ratio ', unit: ' ratio ', expr: ' [176.1] / [177.1] ', min: '', max: '', ...over });
const def = (over: Partial<CustomDef> = {}): CustomDef => ({ key: 'custom.1', label: 'R', unit: '', expr: '[176.1] / [177.1]', min: 0, max: 1, ...over });

function store(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

describe('estimateRange', () => {
  it('pads the range of the finite samples', () => {
    const r = estimateRange(compileExpr('[176.1] / [177.1]').evaluate, sample, 100, 10);
    expect(r.min).toBeLessThan(0.5);
    expect(r.max).toBeGreaterThan(0.95);
  });
  it('gives 0..1 when no sample is finite', () => {
    expect(estimateRange(() => NaN, sample, 10)).toEqual({ min: 0, max: 1 });
  });
});

describe('makeCustom', () => {
  it('makes a channel, trims the text, and finds the range from the data', () => {
    const d = makeCustom([], input(), base, sample, 100);
    expect(d).toMatchObject({ key: 'custom.1', label: 'NOx ratio', unit: 'ratio', expr: '[176.1] / [177.1]' });
    expect(d.max).toBeGreaterThan(d.min);
  });
  it('uses the given min and max, and finds only the missing one', () => {
    expect(makeCustom([], input({ min: '0', max: '2' }), base, sample, 100)).toMatchObject({ min: 0, max: 2 });
    const d = makeCustom([], input({ min: '-5' }), base, sample, 100);
    expect(d.min).toBe(-5);
    expect(d.max).toBeGreaterThan(0.9);
  });
  it('takes the next free key', () => {
    expect(makeCustom([def({ key: 'custom.2' })], input(), base, sample, 100).key).toBe('custom.3');
    expect(makeCustom([def({ key: 'custom.5' })], input(), base, sample, 100).key).toBe('custom.2');
  });
  it('rejects bad input with a message', () => {
    expect(() => makeCustom([], input({ label: '  ' }), base, sample, 100)).toThrow('Give a name');
    expect(() => makeCustom([], input({ expr: '1 +' }), base, sample, 100)).toThrow('formula ends too soon');
    expect(() => makeCustom([], input({ expr: '2 * 3' }), base, sample, 100)).toThrow('at least 1 [channel]');
    expect(() => makeCustom([], input({ expr: '[x] + [custom.1]' }), base, sample, 100)).toThrow('Unknown channel: x, custom.1');
    expect(() => makeCustom([], input({ min: 'abc' }), base, sample, 100)).toThrow('Min is not a number');
    expect(() => makeCustom([], input({ max: 'Infinity' }), base, sample, 100)).toThrow('Max is not a number');
    expect(() => makeCustom([], input({ min: '1', max: '1' }), base, sample, 100)).toThrow('Max must be more than min');
  });
});

describe('compileCustoms and deriveValues', () => {
  it('compiles the good channels and skips the bad ones', () => {
    const defs = [def(), def({ key: 'custom.2', expr: '1 +' }), def({ key: 'custom.3', expr: '[x]' }), def({ key: 'custom.4', expr: '5' })];
    const c = compileCustoms(defs, base);
    expect(c.map((x) => x.def.key)).toEqual(['custom.1']);
    expect(c[0].info).toEqual({ key: 'custom.1', label: 'R', unit: '', min: 0, max: 1, kind: 'number', source: 'custom' });
  });
  it('adds the custom values to a copy of the values', () => {
    const values = { '176.1': 50, '177.1': 100 };
    const out = deriveValues(compileCustoms([def()], base), values);
    expect(out).toEqual({ '176.1': 50, '177.1': 100, 'custom.1': 0.5 });
    expect(values).not.toHaveProperty('custom.1');
  });
  it('gives the same object when no channel is defined', () => {
    const values = { a: 1 };
    expect(deriveValues([], values)).toBe(values);
  });
});

describe('loadCustoms and saveCustoms', () => {
  it('saves and loads the channels', () => {
    const s = store();
    expect(saveCustoms(s, [def()])).toBe(true);
    expect(loadCustoms(s)).toEqual([def()]);
  });
  it('gives an empty list for no storage, no data, bad JSON, or bad rows', () => {
    expect(loadCustoms(undefined)).toEqual([]);
    expect(loadCustoms(store())).toEqual([]);
    expect(loadCustoms(store({ [CUSTOM_STORAGE_KEY]: '{' }))).toEqual([]);
    expect(loadCustoms(store({ [CUSTOM_STORAGE_KEY]: '{"a":1}' }))).toEqual([]);
    for (const bad of [null, 5, def({ key: 'x.1' }), { ...def(), min: 'a' }, { ...def(), label: 1 }, { ...def(), unit: 1 }, { ...def(), expr: 1 }, { ...def(), key: 1 }, { ...def(), max: null }]) {
      expect(loadCustoms(store({ [CUSTOM_STORAGE_KEY]: JSON.stringify([bad]) }))).toEqual([]);
    }
  });
  it('reports a failed save', () => {
    expect(saveCustoms(undefined, [])).toBe(false);
    expect(
      saveCustoms(
        {
          setItem: () => {
            throw new Error('full');
          },
        },
        [],
      ),
    ).toBe(false);
  });
});
