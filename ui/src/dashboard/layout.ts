// Dashboard model: the widgets, their grid positions, the presets, and the saved state.

export type WidgetType = 'gauge' | 'bar' | 'lamps' | 'text' | 'graph';

export const WIDGET_TYPES: WidgetType[] = ['gauge', 'bar', 'lamps', 'text', 'graph'];

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  channel: string;
}

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dashboard {
  widgets: WidgetConfig[];
  layout: GridItem[];
}

export const GRID_COLS = 12;

/** Default size (columns x rows) of each widget type. */
export const DEFAULT_SIZE: Record<WidgetType, { w: number; h: number }> = {
  gauge: { w: 3, h: 4 },
  bar: { w: 3, h: 2 },
  lamps: { w: 3, h: 2 },
  text: { w: 2, h: 2 },
  graph: { w: 6, h: 3 },
};

/** Make a dashboard from a list of [type, channel] pairs, placed left to right, top to bottom. */
export function buildDashboard(items: Array<[WidgetType, string]>): Dashboard {
  const widgets: WidgetConfig[] = [];
  const layout: GridItem[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  items.forEach(([type, channel], n) => {
    const { w, h } = DEFAULT_SIZE[type];
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const id = `w${n + 1}`;
    widgets.push({ id, type, channel });
    layout.push({ i: id, x, y, w, h });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  });
  return { widgets, layout };
}

export interface Preset {
  name: string;
  /** Channel keys that must exist; otherwise the preset is not offered. */
  needs: string[];
  build: () => Dashboard;
}

export const PRESETS: Preset[] = [
  {
    name: 'Engine (synthetic)',
    needs: ['sim.rpm'],
    build: () =>
      buildDashboard([
        ['gauge', 'sim.rpm'],
        ['gauge', 'sim.speed'],
        ['gauge', 'sim.boost'],
        ['gauge', 'sim.coolant'],
        ['graph', 'sim.rpm'],
        ['graph', 'sim.boost'],
        ['bar', 'sim.load'],
        ['bar', 'sim.dpf'],
        ['text', 'sim.t30'],
      ]),
  },
  {
    name: '2010 Q7 log: groups 093 / 176 / 177',
    needs: ['093.1', '176.1', '177.1'],
    build: () =>
      buildDashboard([
        ['lamps', '093.1'],
        ['text', '093.2'],
        ['text', '093.3'],
        ['text', '093.4'],
        ['graph', '176.1'],
        ['graph', '177.1'],
        ['bar', '176.2'],
        ['bar', '177.2'],
        ['gauge', '176.3'],
        ['gauge', '177.3'],
      ]),
  },
  {
    name: 'Overview',
    needs: ['sim.rpm'],
    build: () =>
      buildDashboard([
        ['gauge', 'sim.rpm'],
        ['gauge', 'sim.speed'],
        ['text', 'sim.coolant'],
        ['text', 'sim.t30'],
        ['graph', 'sim.boost'],
        ['bar', 'sim.load'],
      ]),
  },
];

/** The presets whose channels all exist. */
export function availablePresets(channelKeys: string[]): Preset[] {
  const have = new Set(channelKeys);
  return PRESETS.filter((p) => p.needs.every((k) => have.has(k)));
}

/** Add a widget at the bottom of the grid. The new id is unique in the dashboard. */
export function addWidget(dash: Dashboard, type: WidgetType, channel: string): Dashboard {
  let n = dash.widgets.length + 1;
  const ids = new Set(dash.widgets.map((w) => w.id));
  while (ids.has(`w${n}`)) n++;
  const id = `w${n}`;
  const bottom = dash.layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return {
    widgets: [...dash.widgets, { id, type, channel }],
    layout: [...dash.layout, { i: id, x: 0, y: bottom, ...DEFAULT_SIZE[type] }],
  };
}

export function removeWidget(dash: Dashboard, id: string): Dashboard {
  return {
    widgets: dash.widgets.filter((w) => w.id !== id),
    layout: dash.layout.filter((item) => item.i !== id),
  };
}

export function updateWidget(dash: Dashboard, id: string, change: Partial<Omit<WidgetConfig, 'id'>>): Dashboard {
  return { ...dash, widgets: dash.widgets.map((w) => (w.id === id ? { ...w, ...change } : w)) };
}

/** Keep only x, y, w, h, and i of each grid item (react-grid-layout adds more fields). */
export function setLayout(dash: Dashboard, layout: GridItem[]): Dashboard {
  return { ...dash, layout: layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })) };
}

function isWidget(value: unknown): value is WidgetConfig {
  const w = value as WidgetConfig;
  return (
    typeof w === 'object' &&
    w !== null &&
    typeof w.id === 'string' &&
    typeof w.channel === 'string' &&
    WIDGET_TYPES.includes(w.type)
  );
}

function isGridItem(value: unknown): value is GridItem {
  const g = value as GridItem;
  return (
    typeof g === 'object' &&
    g !== null &&
    typeof g.i === 'string' &&
    [g.x, g.y, g.w, g.h].every((n) => Number.isInteger(n) && n >= 0)
  );
}

/** Read a saved dashboard. Bad or old data gives null. */
export function parseDashboard(text: string | null): Dashboard | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as Dashboard;
    if (!Array.isArray(data.widgets) || !Array.isArray(data.layout)) return null;
    if (!data.widgets.every(isWidget) || !data.layout.every(isGridItem)) return null;
    return { widgets: data.widgets, layout: data.layout };
  } catch {
    return null;
  }
}

export const STORAGE_KEY = 'vcds.shuffleboard.v1';

/** Load the saved dashboard. A storage error gives null. */
export function loadDashboard(storage: Pick<Storage, 'getItem'> | undefined): Dashboard | null {
  try {
    return parseDashboard(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Save the dashboard. A storage error is ignored, and the result is false. */
export function saveDashboard(storage: Pick<Storage, 'setItem'> | undefined, dash: Dashboard): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(dash));
    return true;
  } catch {
    return false;
  }
}
