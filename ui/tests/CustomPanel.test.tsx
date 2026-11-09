// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomPanel } from '../src/custom/CustomPanel';
import type { ChannelInfo } from '../../src/sim/vehicle';

afterEach(cleanup);

const ch = (key: string): ChannelInfo => ({ key, label: `L ${key}`, unit: '', min: 0, max: 1, kind: 'number', source: 'log' });

describe('CustomPanel', () => {
  it('builds a formula with the channel picker, adds, and clears the form', () => {
    const onAdd = vi.fn();
    render(<CustomPanel customs={[]} baseChannels={[ch('176.1'), ch('177.1')]} onAdd={onAdd} onRemove={() => {}} />);
    fireEvent.change(screen.getByLabelText('custom name'), { target: { value: 'NOx' } });
    fireEvent.change(screen.getByLabelText('insert channel'), { target: { value: '176.1' } });
    fireEvent.change(screen.getByLabelText('custom formula'), { target: { value: '[176.1] / ' } });
    fireEvent.change(screen.getByLabelText('insert channel'), { target: { value: '177.1' } });
    fireEvent.change(screen.getByLabelText('custom unit'), { target: { value: 'ratio' } });
    fireEvent.change(screen.getByLabelText('custom min'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('custom max'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Add channel'));
    expect(onAdd).toHaveBeenCalledWith({ label: 'NOx', expr: '[176.1] / [177.1]', unit: 'ratio', min: '0', max: '2' });
    expect((screen.getByLabelText('custom name') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('shows the error from onAdd and keeps the input', () => {
    const onAdd = vi.fn(() => {
      throw new Error('Give a name');
    });
    render(<CustomPanel customs={[]} baseChannels={[]} onAdd={onAdd} onRemove={() => {}} />);
    fireEvent.change(screen.getByLabelText('custom formula'), { target: { value: '[a]' } });
    fireEvent.click(screen.getByText('Add channel'));
    expect(screen.getByRole('alert').textContent).toBe('Give a name');
    expect((screen.getByLabelText('custom formula') as HTMLInputElement).value).toBe('[a]');
  });
  it('lists the channels and removes one', () => {
    const onRemove = vi.fn();
    const customs = [
      { key: 'custom.1', label: 'NOx', unit: 'ratio', expr: '[a] / [b]', min: -0.12345, max: 1.5 },
      { key: 'custom.2', label: 'Sum', unit: '', expr: '[a] + [b]', min: 0, max: 2 },
    ];
    render(<CustomPanel customs={customs} baseChannels={[]} onAdd={() => {}} onRemove={onRemove} />);
    expect(screen.getByText('[a] / [b]')).toBeTruthy();
    expect(screen.getByText(/custom\.1 · ratio · -0\.1235…1\.5/)).toBeTruthy();
    expect(screen.getByText(/custom\.2 · no unit · 0…2/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('remove Sum'));
    expect(onRemove).toHaveBeenCalledWith('custom.2');
  });
});
