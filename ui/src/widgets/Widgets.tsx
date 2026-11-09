// The 5 widget types. Each widget shows one channel. All drawing is SVG or plain HTML.
import type { ChannelInfo } from '../../../src/sim/vehicle';
import {
  arcPath,
  bitsOf,
  decimalsFor,
  formatValue,
  fraction,
  GAUGE_START,
  GAUGE_SWEEP,
  gaugeAngle,
  polar,
  sparkPoints,
} from './geometry';

export interface WidgetProps {
  channel: ChannelInfo;
  value: number | undefined;
  history: number[];
}

export function Gauge({ channel, value }: WidgetProps) {
  const v = value ?? channel.min;
  const angle = gaugeAngle(v, channel.min, channel.max);
  const tip = polar(60, 60, 40, angle);
  const dec = decimalsFor(channel.min, channel.max);
  return (
    <svg className="gauge" viewBox="0 0 120 100" role="img" aria-label={`${channel.label} gauge`}>
      <path className="gauge-track" d={arcPath(60, 60, 46, GAUGE_START, GAUGE_START + GAUGE_SWEEP)} />
      {angle > GAUGE_START && <path className="gauge-fill" d={arcPath(60, 60, 46, GAUGE_START, angle)} />}
      <line className="gauge-needle" x1={60} y1={60} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)} />
      <circle className="gauge-hub" cx={60} cy={60} r={3} />
      <text className="gauge-value" x={60} y={84} textAnchor="middle">
        {formatValue(value, dec)}
      </text>
      <text className="gauge-unit" x={60} y={96} textAnchor="middle">
        {channel.unit}
      </text>
    </svg>
  );
}

export function Bar({ channel, value }: WidgetProps) {
  const pct = fraction(value ?? channel.min, channel.min, channel.max) * 100;
  const dec = decimalsFor(channel.min, channel.max);
  return (
    <div className="bar">
      <div className="bar-track" role="meter" aria-valuenow={value} aria-valuemin={channel.min} aria-valuemax={channel.max}>
        <div className="bar-fill" style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
      <div className="bar-text">
        <span>{formatValue(value, dec)}</span> <span className="unit">{channel.unit}</span>
      </div>
    </div>
  );
}

export function Lamps({ value }: WidgetProps) {
  const bits = bitsOf(value ?? 0);
  return (
    <div className="lamps">
      {bits.map((on, i) => (
        <div key={i} className={on ? 'lamp on' : 'lamp'} title={`bit ${7 - i}`}>
          {7 - i}
        </div>
      ))}
    </div>
  );
}

export function TextValue({ channel, value }: WidgetProps) {
  const dec = decimalsFor(channel.min, channel.max);
  return (
    <div className="textvalue">
      <span className="big">{formatValue(value, dec)}</span>
      <span className="unit">{channel.unit}</span>
    </div>
  );
}

export function Graph({ channel, value, history }: WidgetProps) {
  const dec = decimalsFor(channel.min, channel.max);
  const points = sparkPoints(history, 300, 80, channel.min, channel.max);
  return (
    <div className="graph">
      <svg viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label={`${channel.label} graph`}>
        <line className="graph-axis" x1={0} y1={80} x2={300} y2={80} />
        {points && <polyline className="graph-line" points={points} />}
      </svg>
      <div className="graph-text">
        {formatValue(value, dec)} <span className="unit">{channel.unit}</span>
      </div>
    </div>
  );
}

export const WIDGETS = {
  gauge: Gauge,
  bar: Bar,
  lamps: Lamps,
  text: TextValue,
  graph: Graph,
};
