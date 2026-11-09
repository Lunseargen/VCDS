// The frame around one widget: the title, the view select (always), and in edit mode the
// channel select and remove. Drag the title to move it; drag a side or a corner to resize it.
import type { ChannelInfo } from '../../../src/sim/vehicle';
import { WIDGET_TYPES, type WidgetConfig, type WidgetType } from './layout';
import { WIDGETS } from '../widgets/Widgets';

/** The names in the "Show as" select of each widget. */
export const VIEW_NAMES: Record<WidgetType, string> = { gauge: 'Gauge', bar: 'Bar', lamps: 'Lamps', text: 'Number', graph: 'Graph' };

export interface WidgetFrameProps {
  config: WidgetConfig;
  channels: ChannelInfo[];
  value: number | undefined;
  history: number[];
  editing: boolean;
  onChange: (change: Partial<Omit<WidgetConfig, 'id'>>) => void;
  onRemove: () => void;
}

export function WidgetFrame({ config, channels, value, history, editing, onChange, onRemove }: WidgetFrameProps) {
  const channel = channels.find((c) => c.key === config.channel);
  const Body = WIDGETS[config.type];
  return (
    <div className="widget" data-testid={`widget-${config.id}`}>
      <div className="widget-head drag-handle">
        <span className="widget-title" title={channel?.label}>
          {channel ? channel.label : config.channel}
        </span>
        {channel?.source === 'synthetic' && <span className="badge">sim</span>}
        {channel?.source === 'log' && <span className="badge log">log</span>}
        {channel?.source === 'custom' && <span className="badge calc">calc</span>}
        <select className="view" aria-label="view" title="Show as" value={config.type} onChange={(e) => onChange({ type: e.target.value as WidgetType })}>
          {WIDGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {VIEW_NAMES[t]}
            </option>
          ))}
        </select>
      </div>
      {editing && (
        <div className="widget-edit">
          <select aria-label="channel" value={config.channel} onChange={(e) => onChange({ channel: e.target.value })}>
            {channels.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key} — {c.label}
              </option>
            ))}
          </select>
          <button type="button" aria-label="remove" onClick={onRemove}>
            ×
          </button>
        </div>
      )}
      <div className="widget-body">
        {channel ? <Body channel={channel} value={value} history={history} /> : <div className="missing">No channel {config.channel}</div>}
      </div>
    </div>
  );
}
