// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChannelInfo } from '../../src/sim/vehicle';
import { Bar, Gauge, Graph, Lamps, TextValue } from '../src/widgets/Widgets';
import { WidgetFrame } from '../src/dashboard/WidgetFrame';
import { FaultPanel } from '../src/FaultPanel';

afterEach(cleanup);

const rpm: ChannelInfo = { key: 'sim.rpm', label: 'Engine speed', unit: '/min', min: 0, max: 5000, kind: 'number', source: 'synthetic' };
const bits: ChannelInfo = { key: '093.1', label: 'Group 093 / field 1', unit: 'bits', min: 0, max: 255, kind: 'bits', source: 'log' };

describe('widgets', () => {
  it('Gauge shows the value and a fill arc', () => {
    const { container } = render(<Gauge channel={rpm} value={2500} history={[]} />);
    expect(screen.getByText('2500')).toBeTruthy();
    expect(container.querySelector('.gauge-fill')).not.toBeNull();
  });
  it('Gauge with no value shows a dash and no fill', () => {
    const { container } = render(<Gauge channel={rpm} value={undefined} history={[]} />);
    expect(screen.getByText('–')).toBeTruthy();
    expect(container.querySelector('.gauge-fill')).toBeNull();
  });
  it('Bar sets the fill width', () => {
    const { container } = render(<Bar channel={rpm} value={1250} history={[]} />);
    expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('25%');
    render(<Bar channel={rpm} value={undefined} history={[]} />);
  });
  it('Lamps light the set bits', () => {
    const { container } = render(<Lamps channel={bits} value={136} history={[]} />);
    expect(container.querySelectorAll('.lamp.on')).toHaveLength(2);
    const none = render(<Lamps channel={bits} value={undefined} history={[]} />);
    expect(none.container.querySelectorAll('.lamp.on')).toHaveLength(0);
  });
  it('TextValue shows the value and the unit', () => {
    render(<TextValue channel={rpm} value={812.4} history={[]} />);
    expect(screen.getByText('812')).toBeTruthy();
    expect(screen.getByText('/min')).toBeTruthy();
  });
  it('Graph draws a line only with 2 or more points', () => {
    const one = render(<Graph channel={rpm} value={1} history={[1]} />);
    expect(one.container.querySelector('.graph-line')).toBeNull();
    const two = render(<Graph channel={rpm} value={1} history={[1, 2]} />);
    expect(two.container.querySelector('.graph-line')).not.toBeNull();
  });
});

describe('WidgetFrame', () => {
  const channels = [rpm, bits];
  it('shows the label, the badge, and the body', () => {
    render(
      <WidgetFrame config={{ id: 'w1', type: 'text', channel: 'sim.rpm' }} channels={channels} value={900} history={[]} editing={false} onChange={() => {}} onRemove={() => {}} />,
    );
    expect(screen.getByText('Engine speed')).toBeTruthy();
    expect(screen.getByText('sim')).toBeTruthy();
    expect(screen.queryByLabelText('channel')).toBeNull();
    expect((screen.getByLabelText('view') as HTMLSelectElement).value).toBe('text');
    expect(screen.getByText('Number')).toBeTruthy();
  });
  it('changes the view out of edit mode', () => {
    const onChange = vi.fn();
    render(
      <WidgetFrame config={{ id: 'w1', type: 'gauge', channel: 'sim.rpm' }} channels={channels} value={900} history={[]} editing={false} onChange={onChange} onRemove={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('view'), { target: { value: 'graph' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'graph' });
  });
  it('in edit mode, changes the channel and the type, and removes', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    render(
      <WidgetFrame config={{ id: 'w1', type: 'lamps', channel: '093.1' }} channels={channels} value={1} history={[]} editing onChange={onChange} onRemove={onRemove} />,
    );
    expect(screen.getByText('log')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('channel'), { target: { value: 'sim.rpm' } });
    fireEvent.change(screen.getByLabelText('view'), { target: { value: 'graph' } });
    fireEvent.click(screen.getByLabelText('remove'));
    expect(onChange).toHaveBeenCalledWith({ channel: 'sim.rpm' });
    expect(onChange).toHaveBeenCalledWith({ type: 'graph' });
    expect(onRemove).toHaveBeenCalled();
  });
  it('shows a message for a channel that does not exist', () => {
    render(
      <WidgetFrame config={{ id: 'w1', type: 'gauge', channel: 'gone' }} channels={channels} value={undefined} history={[]} editing={false} onChange={() => {}} onRemove={() => {}} />,
    );
    expect(screen.getByText('No channel gone')).toBeTruthy();
    expect(screen.getByText('gone')).toBeTruthy();
  });
});

describe('FaultPanel', () => {
  const modules = [{ address: '01', name: 'Engine', partNumber: 'P1', component: 'C1', coding: '', faults: [] }];
  const faults = [
    { address: '01', code: 5585, name: 'DPF', obdCode: 'P242F 00', detail: 'Clogged', status: ['Confirmed'], freezeFrame: [{ label: 'Mileage', value: '1 km' }] },
    { address: '01', code: 9690, name: 'NOx', obdCode: '', detail: 'High', status: [], freezeFrame: [] },
  ];
  it('shows no-log text and no clear button with nothing', () => {
    render(<FaultPanel modules={[]} faults={[]} sourceName={null} onClear={() => {}} />);
    expect(screen.getByText('No scan log found.')).toBeTruthy();
    expect(screen.queryByText('Clear DTCs (simulated)')).toBeNull();
  });
  it('lists the faults, opens and closes a freeze frame, and clears', () => {
    const onClear = vi.fn();
    render(<FaultPanel modules={modules} faults={faults} sourceName="log.txt" onClear={onClear} />);
    expect(screen.getByText(/Source: log.txt/)).toBeTruthy();
    expect(screen.getByText('9690')).toBeTruthy();
    fireEvent.click(screen.getByText('P242F 00'));
    expect(screen.getByText('Mileage')).toBeTruthy();
    fireEvent.click(screen.getByText('P242F 00'));
    expect(screen.queryByText('Mileage')).toBeNull();
    fireEvent.click(screen.getByText('9690'));
    expect(screen.getByText('No freeze frame')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear DTCs (simulated)'));
    expect(onClear).toHaveBeenCalled();
  });
});
