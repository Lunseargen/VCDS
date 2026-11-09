// A small, safe formula language for custom channels. It never calls eval().
// Syntax: numbers, channel keys in square brackets ([176.1], [sim.rpm]), + - * /, unary -,
// parentheses, and the functions abs(x), sqrt(x), min(a, b, ...), max(a, b, ...).

export class ExprError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(`${message} at position ${position + 1}`);
  }
}

type Token =
  | { kind: 'num'; value: number; pos: number }
  | { kind: 'ref'; key: string; pos: number }
  | { kind: 'name'; name: string; pos: number }
  | { kind: 'op'; op: string; pos: number }
  | { kind: 'end'; pos: number };

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(text.slice(i));
    if (num) {
      tokens.push({ kind: 'num', value: Number(num[0]), pos: i });
      i += num[0].length;
      continue;
    }
    if (ch === '[') {
      const close = text.indexOf(']', i);
      if (close < 0) throw new ExprError('missing ]', i);
      const key = text.slice(i + 1, close).trim();
      if (key === '') throw new ExprError('empty channel key', i);
      tokens.push({ kind: 'ref', key, pos: i });
      i = close + 1;
      continue;
    }
    const name = /^[a-z]+/i.exec(text.slice(i));
    if (name) {
      tokens.push({ kind: 'name', name: name[0].toLowerCase(), pos: i });
      i += name[0].length;
      continue;
    }
    if ('+-*/(),'.includes(ch)) {
      tokens.push({ kind: 'op', op: ch, pos: i });
      i++;
      continue;
    }
    throw new ExprError(`unexpected "${ch}"`, i);
  }
  tokens.push({ kind: 'end', pos: text.length });
  return tokens;
}

type Values = Record<string, number>;
type Node = (v: Values) => number;

const FUNCTIONS: Record<string, { arity: 'one' | 'many'; fn: (...a: number[]) => number }> = {
  abs: { arity: 'one', fn: Math.abs },
  sqrt: { arity: 'one', fn: Math.sqrt },
  min: { arity: 'many', fn: Math.min },
  max: { arity: 'many', fn: Math.max },
};

export interface CompiledExpr {
  /** The channel keys that the formula reads, in first-use order, with no duplicates. */
  refs: string[];
  /** The value of the formula. A missing channel gives NaN. Division by 0 gives ±Infinity or NaN. */
  evaluate: (values: Values) => number;
}

/** Compile a formula. Throws an ExprError for bad syntax. */
export function compileExpr(text: string): CompiledExpr {
  const tokens = tokenize(text);
  const refs: string[] = [];
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (op: string) => {
    const t = peek();
    return t.kind === 'op' && t.op === op;
  };
  const expect = (op: string) => {
    if (!isOp(op)) throw new ExprError(`expected "${op}"`, peek().pos);
    p++;
  };

  function expr(): Node {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[p++] as { op: string }).op;
      const a = left;
      const b = term();
      left = op === '+' ? (v) => a(v) + b(v) : (v) => a(v) - b(v);
    }
    return left;
  }

  function term(): Node {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[p++] as { op: string }).op;
      const a = left;
      const b = unary();
      left = op === '*' ? (v) => a(v) * b(v) : (v) => a(v) / b(v);
    }
    return left;
  }

  function unary(): Node {
    if (isOp('-')) {
      p++;
      const a = unary();
      return (v) => -a(v);
    }
    return primary();
  }

  function primary(): Node {
    const t = peek();
    if (t.kind === 'num') {
      p++;
      return () => t.value;
    }
    if (t.kind === 'ref') {
      p++;
      if (!refs.includes(t.key)) refs.push(t.key);
      return (v) => (t.key in v ? v[t.key] : NaN);
    }
    if (t.kind === 'name') {
      const f = FUNCTIONS[t.name];
      if (!f) throw new ExprError(`unknown function "${t.name}"`, t.pos);
      p++;
      expect('(');
      const args = [expr()];
      while (isOp(',')) {
        p++;
        args.push(expr());
      }
      expect(')');
      if (f.arity === 'one' && args.length !== 1) throw new ExprError(`${t.name} takes 1 argument`, t.pos);
      return (v) => f.fn(...args.map((a) => a(v)));
    }
    if (isOp('(')) {
      p++;
      const inner = expr();
      expect(')');
      return inner;
    }
    throw new ExprError(t.kind === 'end' ? 'formula ends too soon' : 'expected a number, a [channel], or "("', t.pos);
  }

  const root = expr();
  if (peek().kind !== 'end') throw new ExprError('unexpected text', peek().pos);
  return { refs, evaluate: root };
}
