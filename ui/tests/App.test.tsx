// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, defaultNow } from '../src/App';
import { buildDashboard, STORAGE_KEY } from '../src/dashboard/layout';
import { CUSTOM_STORAGE_KEY } from '../src/custom/custom';
import { CSV_LOG, SCAN_LOG } from '../../tests/sim/fixtures';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});

function memoryStorage(init?: string): Storage {
  const map = new Map<string, string>();
  if (init) map.set(STORAGE_KEY, init);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

const logs = { csv: [{ name: 'LOG.CSV', text: CSV_LOG }], scan: [{ name: 'Log.txt', text: SCAN_LOG }] };
let clock = 0;
const now = () => clock;

beforeEach(() => {
  clock = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Move the clock and the timers together, in 100 ms steps, like a real browser. */
function advance(ms: number) {
  for (let done = 0; done < ms; done += 100) {
    act(() => {
      clock += 100;
      vi.advanceTimersByTime(100);
    });
  }
}

describe('App', () => {
  it('streams at 10 Hz and shows the source, the widgets, and the faults', () => {
    const storage = memoryStorage();
    const { container } = render(<App logs={logs} storage={storage} now={now} />);
    advance(1000);
    expect(screen.getByTestId('status').textContent).toMatch(/^10\.0 Hz · t=1\.0 s · Simulated$/);
    expect(screen.getByText(/replay of LOG.CSV \(2 s loop\)/)).toBeTruthy();
    expect(container.querySelectorAll('.widget')).toHaveLength(9);
    fireEvent.click(screen.getByText('Scan all modules'));
    expect(screen.getByText('P242F 00')).toBeTruthy();
    expect(storage.getItem(STORAGE_KEY)).toContain('sim.rpm');
  });

  it('loads a saved dashboard', () => {
    const saved = JSON.stringify(buildDashboard([['text', 'sim.t30']]));
    const { container } = render(<App logs={logs} storage={memoryStorage(saved)} now={now} />);
    expect(container.querySelectorAll('.widget')).toHaveLength(1);
  });

  it('shows parse errors, and works with no logs', () => {
    render(<App logs={{ csv: [{ name: 'bad.csv', text: 'x' }], scan: [] }} storage={memoryStorage()} now={now} />);
    expect(screen.getByText(/bad\.csv: not a VCDS CSV log/)).toBeTruthy();
    expect(screen.getByText('No scan log found.')).toBeTruthy();
  });

  it('changes the preset, and ignores the empty choice', () => {
    const { container } = render(<App logs={logs} storage={memoryStorage()} now={now} />);
    fireEvent.change(screen.getByLabelText('preset'), { target: { value: 'Overview' } });
    expect(container.querySelectorAll('.widget')).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('preset'), { target: { value: '' } });
    expect(container.querySelectorAll('.widget')).toHaveLength(6);
  });

  it('in edit mode, adds, changes, and removes widgets', () => {
    const saved = JSON.stringify(buildDashboard([['text', 'sim.t30']]));
    const { container } = render(<App logs={logs} storage={memoryStorage(saved)} now={now} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('new widget type'), { target: { value: 'lamps' } });
    fireEvent.change(screen.getByLabelText('new widget channel'), { target: { value: '093.1' } });
    fireEvent.click(screen.getByText('Add'));
    expect(container.querySelectorAll('.lamps')).toHaveLength(1);
    fireEvent.change(screen.getAllByLabelText('view')[0], { target: { value: 'gauge' } });
    expect(container.querySelectorAll('.gauge')).toHaveLength(1);
    fireEvent.click(screen.getAllByLabelText('remove')[0]);
    expect(container.querySelectorAll('.widget')).toHaveLength(1);
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Add')).toBeNull();
  });

  it('pauses, plays, and changes the speed', () => {
    render(<App logs={logs} storage={memoryStorage()} now={now} />);
    fireEvent.click(screen.getByText('Pause'));
    advance(2000);
    expect(screen.getByTestId('status').textContent).toContain('t=0.0 s');
    fireEvent.click(screen.getByText('Play'));
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '10' } });
    advance(1000);
    expect(screen.getByTestId('status').textContent).toContain('t=10.0 s');
  });

  it('clears the simulated DTCs', () => {
    render(<App logs={logs} storage={memoryStorage()} now={now} />);
    fireEvent.click(screen.getByText('Scan all modules'));
    fireEvent.click(screen.getByText('Clear DTCs (simulated)'));
    expect(screen.queryByText('P242F 00')).toBeNull();
  });

  it('adds a custom channel, shows it in a widget, saves it, and removes it', () => {
    const storage = memoryStorage(JSON.stringify(buildDashboard([])));
    const { container } = render(<App logs={logs} storage={storage} now={now} />);
    fireEvent.click(screen.getByText('Custom channels'));
    fireEvent.change(screen.getByLabelText('custom name'), { target: { value: 'Ratio' } });
    fireEvent.change(screen.getByLabelText('custom formula'), { target: { value: '[176.1] / [093.2]' } });
    fireEvent.click(screen.getByText('Add channel'));
    expect(storage.getItem(CUSTOM_STORAGE_KEY)).toContain('"custom.1"');
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('new widget type'), { target: { value: 'text' } });
    fireEvent.change(screen.getByLabelText('new widget channel'), { target: { value: 'custom.1' } });
    fireEvent.click(screen.getByText('Add'));
    advance(200);
    expect(screen.getByText('calc')).toBeTruthy();
    expect(container.querySelector('.widget .textvalue .big')?.textContent).toMatch(/^\d+(\.\d+)?$/);
    fireEvent.click(screen.getByLabelText('remove Ratio'));
    expect(storage.getItem(CUSTOM_STORAGE_KEY)).toBe('[]');
    expect(screen.getByText('No channel custom.1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Custom channels' }));
    expect(screen.queryByLabelText('custom name')).toBeNull();
  });

  it('shows an error for a bad custom formula', () => {
    render(<App logs={logs} storage={memoryStorage()} now={now} />);
    fireEvent.click(screen.getByText('Custom channels'));
    fireEvent.change(screen.getByLabelText('custom name'), { target: { value: 'Bad' } });
    fireEvent.change(screen.getByLabelText('custom formula'), { target: { value: '[nope]' } });
    fireEvent.click(screen.getByText('Add channel'));
    expect(screen.getByRole('alert').textContent).toBe('Unknown channel: nope');
  });

  it('records each read, saves the data and the faults as CSV, and clears the recording', () => {
    const files: Array<{ name: string; blob: Blob }> = [];
    Object.assign(URL, { createObjectURL: (b: Blob) => (files.push({ name: '', blob: b }), 'blob:x'), revokeObjectURL: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      files[files.length - 1].name = this.download;
    });
    render(<App logs={logs} storage={memoryStorage()} now={now} />);
    advance(500);
    expect(screen.getByTestId('recorded').textContent).toBe('6 rows');
    fireEvent.click(screen.getByText('Save data CSV'));
    fireEvent.click(screen.getByText('Save faults CSV'));
    expect(files.map((f) => f.name)).toEqual([expect.stringMatching(/^shuffleboard-data-.*\.csv$/), expect.stringMatching(/^shuffleboard-faults-.*\.csv$/)]);
    fireEvent.click(screen.getByText('Clear recording'));
    advance(100);
    expect(screen.getByTestId('recorded').textContent).toBe('1 rows');
    click.mockRestore();
  });

  it('changes the view of a widget out of edit mode', () => {
    const saved = JSON.stringify(buildDashboard([['gauge', 'sim.rpm']]));
    const { container } = render(<App logs={logs} storage={memoryStorage(saved)} now={now} />);
    fireEvent.change(screen.getByLabelText('view'), { target: { value: 'text' } });
    expect(container.querySelector('.textvalue')).toBeTruthy();
  });

  it('starts in the light theme, and changes to dark and back', () => {
    const storage = memoryStorage();
    render(<App logs={logs} storage={storage} now={now} />);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByLabelText('theme'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storage.getItem('vcds.shuffleboard.theme')).toBe('dark');
    expect(screen.getByLabelText('theme').textContent).toBe('Light theme');
    fireEvent.click(screen.getByLabelText('theme'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('uses window.localStorage and performance.now by default, and survives a blocked storage', () => {
    const storage = memoryStorage();
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => storage });
    render(<App logs={logs} />);
    expect(storage.getItem(STORAGE_KEY)).toContain('sim.rpm');
    cleanup();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    render(<App logs={logs} />);
    expect(screen.getByText('Shuffleboard')).toBeTruthy();
    expect(typeof defaultNow()).toBe('number');
  });
});
