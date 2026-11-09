// The form for custom channels: name, formula, unit, optional range; and the list of channels.
import { useState } from 'react';
import type { ChannelInfo } from '../../../src/sim/vehicle';
import type { CustomDef, CustomInput } from './custom';

export interface CustomPanelProps {
  customs: CustomDef[];
  baseChannels: ChannelInfo[];
  /** Add a channel. Throws an Error with a message for the user. */
  onAdd: (input: CustomInput) => void;
  onRemove: (key: string) => void;
}

const EMPTY: CustomInput = { label: '', unit: '', expr: '', min: '', max: '' };

export function CustomPanel({ customs, baseChannels, onAdd, onRemove }: CustomPanelProps) {
  const [input, setInput] = useState<CustomInput>(EMPTY);
  const [error, setError] = useState('');
  const set = (field: keyof CustomInput) => (e: { target: { value: string } }) => setInput({ ...input, [field]: e.target.value });

  return (
    <section className="custom-panel" aria-label="custom channels">
      <h2>Custom channels</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onAdd(input);
            setInput(EMPTY);
            setError('');
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input aria-label="custom name" placeholder="Name, for example NOx ratio" value={input.label} onChange={set('label')} />
        <input aria-label="custom formula" placeholder="[176.1] / [177.1]" value={input.expr} onChange={set('expr')} className="formula" />
        <select
          aria-label="insert channel"
          value=""
          onChange={(e) => setInput({ ...input, expr: `${input.expr}[${e.target.value}]` })}
        >
          <option value="">+ channel…</option>
          {baseChannels.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key} — {c.label}
            </option>
          ))}
        </select>
        <input aria-label="custom unit" placeholder="unit" value={input.unit} onChange={set('unit')} className="short" />
        <input aria-label="custom min" placeholder="min (auto)" value={input.min} onChange={set('min')} className="short" />
        <input aria-label="custom max" placeholder="max (auto)" value={input.max} onChange={set('max')} className="short" />
        <button type="submit">Add channel</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">Functions: abs, sqrt, min, max. Operators: + - * / ( ).</p>
      {customs.map((d) => (
        <div key={d.key} className="custom-row">
          <b>{d.label}</b> <code>{d.expr}</code>{' '}
          <span className="muted small">
            {d.key} · {d.unit || 'no unit'} · {+d.min.toPrecision(4)}…{+d.max.toPrecision(4)}
          </span>{' '}
          <button type="button" aria-label={`remove ${d.label}`} onClick={() => onRemove(d.key)}>
            ×
          </button>
        </div>
      ))}
    </section>
  );
}
