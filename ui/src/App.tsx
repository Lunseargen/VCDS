// The Shuffleboard preview: a drag-and-drop grid of widgets on simulated live data.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  addWidget,
  availablePresets,
  loadDashboard,
  removeWidget,
  saveDashboard,
  setLayout,
  updateWidget,
  GRID_COLS,
  WIDGET_TYPES,
  type Dashboard,
  type WidgetType,
} from './dashboard/layout';
import { WidgetFrame } from './dashboard/WidgetFrame';
import { FaultPanel } from './FaultPanel';
import { loadVehicle, makeAdapter, SimClock, type LoadedData } from './stream';
import { useLiveData } from './useLiveData';
import { CustomPanel } from './custom/CustomPanel';
import { compileCustoms, deriveValues, loadCustoms, makeCustom, saveCustoms, type CustomDef } from './custom/custom';
import { CYCLE_SECONDS } from '../../src/sim/synthetic';
import { applyTheme, loadTheme, saveTheme, type Theme } from './theme';
import { csvFileName, downloadText, faultsToCsv, Recorder, recordingToCsv } from './export';

const Grid = WidthProvider(GridLayout);

/** One function for all renders, so that the memoized clock and adapter stay the same. */
export const defaultNow = () => performance.now();

export interface AppProps {
  logs: { csv: Array<{ name: string; text: string }>; scan: Array<{ name: string; text: string }> };
  storage?: Storage;
  now?: () => number;
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function App({ logs, storage = safeStorage(), now = defaultNow }: AppProps) {
  const data: LoadedData = useMemo(() => loadVehicle(logs), [logs]);
  const clock = useMemo(() => new SimClock(now()), [now]);
  const adapter = useMemo(() => makeAdapter(data.vehicle, clock, now), [data, clock, now]);
  const keys = useMemo(() => data.vehicle.channels.map((c) => c.key), [data]);
  const [customs, setCustoms] = useState<CustomDef[]>(() => loadCustoms(storage));
  const compiled = useMemo(() => compileCustoms(customs, keys), [customs, keys]);
  const recorder = useRef(new Recorder());
  // Each read gets the custom values, then goes to the recorder for the CSV export.
  const derive = useCallback(
    (values: Record<string, number>) => {
      const out = deriveValues(compiled, values);
      recorder.current.push(clock.time(now()), out);
      return out;
    },
    [compiled, clock, now],
  );
  const channels = useMemo(() => [...data.vehicle.channels, ...compiled.map((c) => c.info)], [data, compiled]);
  const live = useLiveData(adapter, 100, now, derive);
  const presets = useMemo(() => availablePresets(keys), [keys]);

  const [dash, setDash] = useState<Dashboard>(() => loadDashboard(storage) ?? presets[0].build());
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [newType, setNewType] = useState<WidgetType>('gauge');
  const [newChannel, setNewChannel] = useState(keys[0]);
  const [faultVersion, setFaultVersion] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme(storage));

  useEffect(() => {
    saveDashboard(storage, dash);
  }, [storage, dash]);
  useEffect(() => {
    saveCustoms(storage, customs);
  }, [storage, customs]);
  useEffect(() => {
    applyTheme(theme);
    saveTheme(storage, theme);
  }, [storage, theme]);

  const onLayout = useCallback((layout: Layout[]) => setDash((d) => setLayout(d, layout)), []);
  const faults = useMemo(() => data.vehicle.faults(), [data, faultVersion]);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Shuffleboard</h1>
        <span className="preview">preview · simulated data</span>
        <label>
          Preset{' '}
          <select
            aria-label="preset"
            value=""
            onChange={(e) => {
              const p = presets.find((x) => x.name === e.target.value);
              if (p) setDash(p.build());
            }}
          >
            <option value="">choose…</option>
            {presets.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setEditing(!editing)} aria-pressed={editing}>
          {editing ? 'Done' : 'Edit'}
        </button>
        <button type="button" onClick={() => setShowCustom(!showCustom)} aria-pressed={showCustom}>
          Custom channels
        </button>
        {editing && (
          <span className="add">
            <select aria-label="new widget type" value={newType} onChange={(e) => setNewType(e.target.value as WidgetType)}>
              {WIDGET_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select aria-label="new widget channel" value={newChannel} onChange={(e) => setNewChannel(e.target.value)}>
              {channels.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key} — {c.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setDash((d) => addWidget(d, newType, newChannel))}>
              Add
            </button>
          </span>
        )}
        <button
          type="button"
          title="Save each recorded read of all the channels"
          onClick={() => downloadText(csvFileName('data', new Date()), recordingToCsv(channels, recorder.current.rows))}
        >
          Save data CSV
        </button>
        <button
          type="button"
          onClick={() => downloadText(csvFileName('faults', new Date()), faultsToCsv(data.vehicle.faults()))}
        >
          Save faults CSV
        </button>
        <button type="button" onClick={() => recorder.current.clear()}>
          Clear recording
        </button>
        <span className="muted small" data-testid="recorded">
          {recorder.current.rows.length} rows
        </span>
        <span className="spacer" />
        <button
          type="button"
          onClick={() => {
            clock.setPaused(!paused, now());
            setPaused(!paused);
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <select
          aria-label="speed"
          value={speed}
          onChange={(e) => {
            const s = Number(e.target.value);
            clock.setSpeed(s, now());
            setSpeed(s);
          }}
        >
          {[0.5, 1, 2, 5, 10].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="theme">
          {theme === 'light' ? 'Dark theme' : 'Light theme'}
        </button>
        <span className="status" data-testid="status">
          {live.rate.toFixed(1)} Hz · t={clock.time(now()).toFixed(1)} s · {adapter.type}
        </span>
      </header>
      <div className="source">
        {data.vehicle.description}
        {data.csvName && ` · replay of ${data.csvName} (${data.csv!.duration.toFixed(0)} s loop)`}
        {data.errors.map((e) => (
          <span key={e} className="error">
            {' '}
            · {e}
          </span>
        ))}
      </div>
      <main className="main">
        <div className="grid-wrap">
          {showCustom && (
            <CustomPanel
              customs={customs}
              baseChannels={data.vehicle.channels}
              onAdd={(input) => {
                const span = Math.max(data.csv?.duration ?? 0, CYCLE_SECONDS);
                setCustoms([...customs, makeCustom(customs, input, keys, data.vehicle.sample, span)]);
              }}
              onRemove={(key) => setCustoms(customs.filter((c) => c.key !== key))}
            />
          )}
          <Grid
            className="layout"
            layout={dash.layout}
            cols={GRID_COLS}
            rowHeight={48}
            margin={[10, 10]}
            draggableHandle=".drag-handle"
            draggableCancel="select,button,input"
            resizeHandles={['se', 'e', 's']}
            onLayoutChange={onLayout}
          >
            {dash.widgets.map((w) => (
              <div key={w.id}>
                <WidgetFrame
                  config={w}
                  channels={channels}
                  value={live.values[w.channel]}
                  history={live.history.get(w.channel)}
                  editing={editing}
                  onChange={(change) => setDash((d) => updateWidget(d, w.id, change))}
                  onRemove={() => setDash((d) => removeWidget(d, w.id))}
                />
              </div>
            ))}
          </Grid>
        </div>
        <FaultPanel
          modules={data.vehicle.modules()}
          faults={faults}
          sourceName={data.scanName}
          onClear={() => {
            adapter.dtcClear();
            setFaultVersion((v) => v + 1);
          }}
        />
      </main>
    </div>
  );
}
