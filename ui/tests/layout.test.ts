import { describe, expect, it } from 'vitest';
import {
  addWidget,
  availablePresets,
  buildDashboard,
  DEFAULT_SIZE,
  GRID_COLS,
  loadDashboard,
  parseDashboard,
  PRESETS,
  removeWidget,
  saveDashboard,
  setLayout,
  STORAGE_KEY,
  updateWidget,
} from '../src/dashboard/layout';

describe('buildDashboard', () => {
  it('places widgets left to right and starts a new row when the row is full', () => {
    const d = buildDashboard([
      ['graph', 'a'],
      ['gauge', 'b'],
      ['gauge', 'c'],
      ['bar', 'd'],
    ]);
    expect(d.widgets.map((w) => w.id)).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(d.layout.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [6, 0],
      [9, 0],
      [0, 4],
    ]);
  });
  it('keeps each item inside the grid', () => {
    for (const p of PRESETS) {
      for (const item of p.build().layout) expect(item.x + item.w).toBeLessThanOrEqual(GRID_COLS);
    }
  });
});

describe('availablePresets', () => {
  it('offers only the presets whose channels exist', () => {
    expect(availablePresets(['sim.rpm']).map((p) => p.name)).toEqual(['Engine (synthetic)', 'Overview']);
    expect(availablePresets(['sim.rpm', '093.1', '176.1', '177.1'])).toHaveLength(3);
    expect(availablePresets([])).toEqual([]);
  });
});

describe('edits', () => {
  const base = buildDashboard([
    ['gauge', 'a'],
    ['text', 'b'],
  ]);
  it('addWidget adds at the bottom with a new id', () => {
    const removed = removeWidget(base, 'w1');
    const d = addWidget(removed, 'bar', 'c');
    expect(d.widgets.map((w) => w.id)).toEqual(['w2', 'w3']);
    expect(d.layout[1]).toEqual({ i: 'w3', x: 0, y: 2, ...DEFAULT_SIZE.bar });
    expect(addWidget({ widgets: [], layout: [] }, 'text', 'x').layout[0].y).toBe(0);
  });
  it('removeWidget and updateWidget', () => {
    expect(removeWidget(base, 'w2').layout.map((l) => l.i)).toEqual(['w1']);
    const u = updateWidget(base, 'w2', { type: 'graph' });
    expect(u.widgets[1]).toEqual({ id: 'w2', type: 'graph', channel: 'b' });
    expect(u.widgets[0]).toBe(base.widgets[0]);
  });
  it('setLayout keeps only the 5 grid fields', () => {
    const d = setLayout(base, [{ i: 'w1', x: 1, y: 2, w: 3, h: 4, moved: false } as never]);
    expect(d.layout).toEqual([{ i: 'w1', x: 1, y: 2, w: 3, h: 4 }]);
  });
});

describe('parseDashboard', () => {
  const good = buildDashboard([['gauge', 'a']]);
  it('reads good data', () => {
    expect(parseDashboard(JSON.stringify(good))).toEqual(good);
  });
  it('gives null for missing, bad, or old data', () => {
    expect(parseDashboard(null)).toBeNull();
    expect(parseDashboard('')).toBeNull();
    expect(parseDashboard('{bad')).toBeNull();
    expect(parseDashboard('{}')).toBeNull();
    expect(parseDashboard('null')).toBeNull();
    expect(parseDashboard(JSON.stringify({ ...good, widgets: [{ id: 'w1', type: 'dial', channel: 'a' }] }))).toBeNull();
    expect(parseDashboard(JSON.stringify({ ...good, widgets: [null] }))).toBeNull();
    expect(parseDashboard(JSON.stringify({ ...good, layout: [{ i: 'w1', x: -1, y: 0, w: 1, h: 1 }] }))).toBeNull();
    expect(parseDashboard(JSON.stringify({ ...good, layout: [null] }))).toBeNull();
  });
});

describe('loadDashboard and saveDashboard', () => {
  const dash = buildDashboard([['text', 'a']]);
  it('saves and loads through a storage', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(saveDashboard(storage, dash)).toBe(true);
    expect(map.has(STORAGE_KEY)).toBe(true);
    expect(loadDashboard(storage)).toEqual(dash);
  });
  it('gives null or false with no storage or a storage that throws', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadDashboard(undefined)).toBeNull();
    expect(loadDashboard(bad)).toBeNull();
    expect(saveDashboard(undefined, dash)).toBe(false);
    expect(saveDashboard(bad, dash)).toBe(false);
  });
});
