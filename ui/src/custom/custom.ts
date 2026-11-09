// Custom channels: a name, a unit, a formula over other channels, and a range.
// They are computed in the UI from the decoded live values, and saved in localStorage.
import type { ChannelInfo } from '../../../src/sim/vehicle';
import { paddedRange } from '../../../src/sim/vehicle';
import { compileExpr, type CompiledExpr } from './expr';

export interface CustomDef {
  key: string;
  label: string;
  unit: string;
  expr: string;
  min: number;
  max: number;
}

export interface CompiledCustom {
  def: CustomDef;
  info: ChannelInfo;
  evaluate: CompiledExpr['evaluate'];
}

export interface CustomInput {
  label: string;
  unit: string;
  expr: string;
  /** Empty text means: find the range from the data. */
  min: string;
  max: string;
}

export const CUSTOM_PREFIX = 'custom.';
export const CUSTOM_STORAGE_KEY = 'vcds.shuffleboard.custom.v1';

/** Range of a formula over the data: `points` samples from t = 0 to t = span. */
export function estimateRange(
  evaluate: CompiledExpr['evaluate'],
  sample: (t: number) => Record<string, number>,
  span: number,
  points = 240,
): { min: number; max: number } {
  const values: number[] = [];
  for (let i = 0; i < points; i++) {
    const v = evaluate(sample((span * i) / points));
    if (Number.isFinite(v)) values.push(v);
  }
  return values.length === 0 ? { min: 0, max: 1 } : paddedRange(values);
}

function parseLimit(text: string, name: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) throw new Error(`${name} is not a number`);
  return n;
}

/**
 * Check the input and make a new custom channel. Throws an Error with a message for the user.
 * A formula may read only base channels (not other custom channels), so no loop can occur.
 */
export function makeCustom(
  existing: CustomDef[],
  input: CustomInput,
  baseKeys: string[],
  sample: (t: number) => Record<string, number>,
  span: number,
): CustomDef {
  const label = input.label.trim();
  if (label === '') throw new Error('Give a name');
  const compiled = compileExpr(input.expr);
  if (compiled.refs.length === 0) throw new Error('The formula must read at least 1 [channel]');
  const unknown = compiled.refs.filter((k) => !baseKeys.includes(k));
  if (unknown.length > 0) throw new Error(`Unknown channel: ${unknown.join(', ')}`);
  let min = parseLimit(input.min, 'Min');
  let max = parseLimit(input.max, 'Max');
  if (min === null || max === null) {
    const found = estimateRange(compiled.evaluate, sample, span);
    min = min ?? found.min;
    max = max ?? found.max;
  }
  if (!(max > min)) throw new Error('Max must be more than min');
  let n = existing.length + 1;
  const keys = new Set(existing.map((d) => d.key));
  while (keys.has(`${CUSTOM_PREFIX}${n}`)) n++;
  return { key: `${CUSTOM_PREFIX}${n}`, label, unit: input.unit.trim(), expr: input.expr.trim(), min, max };
}

/** Compile the saved channels. A channel with a bad formula or an unknown channel is skipped. */
export function compileCustoms(defs: CustomDef[], baseKeys: string[]): CompiledCustom[] {
  const out: CompiledCustom[] = [];
  for (const def of defs) {
    try {
      const c = compileExpr(def.expr);
      if (c.refs.length === 0 || !c.refs.every((k) => baseKeys.includes(k))) continue;
      out.push({
        def,
        evaluate: c.evaluate,
        info: { key: def.key, label: def.label, unit: def.unit, min: def.min, max: def.max, kind: 'number', source: 'custom' },
      });
    } catch {
      // A bad saved formula is skipped.
    }
  }
  return out;
}

/** The base values plus the custom values. */
export function deriveValues(compiled: CompiledCustom[], values: Record<string, number>): Record<string, number> {
  if (compiled.length === 0) return values;
  const out = { ...values };
  for (const c of compiled) out[c.def.key] = c.evaluate(values);
  return out;
}

function isDef(value: unknown): value is CustomDef {
  const d = value as CustomDef;
  return (
    typeof d === 'object' &&
    d !== null &&
    typeof d.key === 'string' &&
    d.key.startsWith(CUSTOM_PREFIX) &&
    typeof d.label === 'string' &&
    typeof d.unit === 'string' &&
    typeof d.expr === 'string' &&
    Number.isFinite(d.min) &&
    Number.isFinite(d.max)
  );
}

/** Read the saved custom channels. Bad data gives an empty list. */
export function loadCustoms(storage: Pick<Storage, 'getItem'> | undefined): CustomDef[] {
  try {
    const data = JSON.parse(storage?.getItem(CUSTOM_STORAGE_KEY) ?? '[]');
    return Array.isArray(data) && data.every(isDef) ? data : [];
  } catch {
    return [];
  }
}

export function saveCustoms(storage: Pick<Storage, 'setItem'> | undefined, defs: CustomDef[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(defs));
    return true;
  } catch {
    return false;
  }
}
