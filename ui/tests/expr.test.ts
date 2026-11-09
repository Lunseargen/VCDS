import { describe, expect, it } from 'vitest';
import { compileExpr, ExprError, tokenize } from '../src/custom/expr';

const v = { '176.1': 150, '177.1': 250, 'sim.rpm': 900, zero: 0 };
const run = (text: string, values: Record<string, number> = v) => compileExpr(text).evaluate(values);

describe('tokenize', () => {
  it('reads numbers, refs, names, and operators, and skips spaces', () => {
    const t = tokenize(' 1.5e2 [ 176.1 ] abs(+-*/,)');
    expect(t.map((x) => x.kind)).toEqual(['num', 'ref', 'name', 'op', 'op', 'op', 'op', 'op', 'op', 'op', 'end']);
    expect(t[0]).toMatchObject({ value: 150, pos: 1 });
    expect(t[1]).toMatchObject({ key: '176.1', pos: 7 });
    expect(t[2]).toMatchObject({ name: 'abs' });
  });
  it('lowers the case of function names', () => {
    expect(tokenize('MAX')[0]).toMatchObject({ name: 'max' });
  });
  it('rejects a missing ], an empty key, and a bad character', () => {
    expect(() => tokenize('[176.1')).toThrow('missing ] at position 1');
    expect(() => tokenize('1 + [ ]')).toThrow('empty channel key at position 5');
    expect(() => tokenize('1 % 2')).toThrow('unexpected "%" at position 3');
  });
});

describe('compileExpr', () => {
  it('computes the ratio of 2 channels (the example from Jack)', () => {
    expect(run('[176.1] / [177.1]')).toBeCloseTo(0.6);
  });
  it('follows the order of operations and the parentheses', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('10 - 4 - 3')).toBe(3);
    expect(run('8 / 4 / 2')).toBe(1);
    expect(run('2 * -3')).toBe(-6);
    expect(run('--2')).toBe(2);
    expect(run('-[sim.rpm] + 1000')).toBe(100);
  });
  it('calls the functions', () => {
    expect(run('abs(-3)')).toBe(3);
    expect(run('sqrt(16)')).toBe(4);
    expect(run('min([176.1], [177.1], 100)')).toBe(100);
    expect(run('max(1, 2)')).toBe(2);
    expect(run('max(7)')).toBe(7);
  });
  it('gives the refs in first-use order with no duplicates', () => {
    expect(compileExpr('[b] + [a] * [b]').refs).toEqual(['b', 'a']);
    expect(compileExpr('1 + 2').refs).toEqual([]);
  });
  it('gives NaN for a missing channel, and Infinity for a division by 0', () => {
    expect(run('[gone] + 1')).toBeNaN();
    expect(run('[176.1] / [zero]')).toBe(Infinity);
    expect(run('[zero] / [zero]')).toBeNaN();
  });
  it('rejects bad syntax with the position', () => {
    expect(() => compileExpr('')).toThrow('formula ends too soon at position 1');
    expect(() => compileExpr('1 +')).toThrow('formula ends too soon');
    expect(() => compileExpr('* 2')).toThrow('expected a number, a [channel], or "(" at position 1');
    expect(() => compileExpr('(1 + 2')).toThrow('expected ")"');
    expect(() => compileExpr('1 2')).toThrow('unexpected text at position 3');
    expect(() => compileExpr('foo(1)')).toThrow('unknown function "foo"');
    expect(() => compileExpr('abs 1')).toThrow('expected "("');
    expect(() => compileExpr('abs(1, 2)')).toThrow('abs takes 1 argument');
    expect(() => compileExpr('max(1,)')).toThrow(ExprError);
  });
  it('never runs code: a JavaScript text is a syntax error', () => {
    expect(() => compileExpr('alert(1)')).toThrow('unknown function "alert"');
    expect(() => compileExpr('constructor.constructor("x")()')).toThrow(ExprError);
    expect(() => compileExpr('toString(1)')).toThrow('unknown function "tostring"');
  });
  it('keeps the position on the error', () => {
    try {
      compileExpr('1 + )');
    } catch (e) {
      expect((e as ExprError).position).toBe(4);
    }
    expect.assertions(1);
  });
});
