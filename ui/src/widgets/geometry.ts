// Pure functions for the widgets: scale, gauge arcs, number text, bit lamps, graph lines.

/** Limit x to the range [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Position of value in [min, max] as 0..1. A range of 0 width gives 0. */
export function fraction(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/** Point on a circle. 0° is at 3 o'clock; the angle increases clockwise (SVG y goes down). */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG path of a clockwise arc from angle a0 to angle a1 (degrees). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const start = polar(cx, cy, r, a0);
  const end = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M ${f(start.x)} ${f(start.y)} A ${r} ${r} 0 ${large} 1 ${f(end.x)} ${f(end.y)}`;
}

/** The gauge sweep: 240°, from 150° (lower left) to 390° (lower right). */
export const GAUGE_START = 150;
export const GAUGE_SWEEP = 240;

/** Angle of the gauge needle for a value. */
export function gaugeAngle(value: number, min: number, max: number): number {
  return GAUGE_START + GAUGE_SWEEP * fraction(value, min, max);
}

/** Number of decimals that suits the size of a range. */
export function decimalsFor(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (span >= 100) return 0;
  if (span >= 10) return 1;
  return 2;
}

/** Text for a value. A value that is not finite gives an en dash. */
export function formatValue(value: number | undefined, decimals: number): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  return value.toFixed(decimals);
}

/** The 8 bits of a byte, most significant bit first. */
export function bitsOf(value: number): boolean[] {
  const byte = Math.round(value) & 0xff;
  return Array.from({ length: 8 }, (_, i) => ((byte >> (7 - i)) & 1) === 1);
}

/**
 * SVG polyline points for a series in a box of width x height.
 * Fewer than 2 points give an empty string.
 */
export function sparkPoints(values: number[], width: number, height: number, min: number, max: number): string {
  if (values.length < 2) return '';
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - fraction(v, min, max) * height).toFixed(1)}`)
    .join(' ');
}
