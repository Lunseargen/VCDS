// Synthetic engine channels for a 3.0 TDI on a repeated drive cycle.
// These values are NOT measured. The ranges come from the freeze frames of the 2013 Q7 log
// (coolant 34..80 °C, terminal 30 11.7..14.2 V, ambient 970..990 mbar).
// All functions are deterministic, so tests can check exact values.

export const CYCLE_SECONDS = 120;

/** Smooth step from 0 to 1 between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Small deterministic ripple in the range [-1, 1]. */
export function ripple(t: number, seed: number): number {
  return (Math.sin(t * 1.7 + seed) + Math.sin(t * 3.1 + seed * 2) * 0.5) / 1.5;
}

/** Vehicle speed in km/h: idle, accelerate, cruise, slow down, idle. */
export function speedKmh(t: number): number {
  const c = ((t % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const up = smoothstep(15, 35, c);
  const down = 1 - smoothstep(75, 95, c);
  const cruise = 100 + (c > 35 && c < 75 ? ripple(c, 1) * 4 : 0);
  return Math.max(0, cruise * Math.min(up, down));
}

/** Engine load in %: high while the speed goes up, low on the slow-down. */
export function loadPercent(t: number): number {
  const c = ((t % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const accel = c > 15 && c < 35 ? 70 : 0;
  const cruise = c >= 35 && c < 75 ? 32 + ripple(c, 2) * 6 : 0;
  const idle = c <= 15 || c >= 95 ? 12 : 0;
  return accel + cruise + idle;
}

/** Engine speed in 1/min, from the vehicle speed with a 6-step gearbox. */
export function engineRpm(t: number): number {
  const v = speedKmh(t);
  if (v < 1) return 750 + ripple(t, 3) * 10;
  const gearTop = [0, 20, 40, 60, 80, 100, Infinity];
  const gear = gearTop.findIndex((top) => v < top);
  const low = gearTop[gear - 1];
  const high = Math.min(gearTop[gear], 140);
  return 1100 + ((v - low) / (high - low)) * 1400;
}

/** Absolute boost pressure in mbar. */
export function boostMbar(t: number): number {
  return 990 + loadPercent(t) * 17;
}

/** Coolant temperature in °C: warms from 34 °C to 90 °C in 10 minutes, then holds. */
export function coolantC(t: number): number {
  return 34 + 56 * smoothstep(0, 600, Math.max(0, t));
}

/** Battery voltage at terminal 30 in V. */
export function terminal30V(t: number): number {
  return 14.2 + ripple(t, 4) * 0.05;
}

/** Differential pressure of the particle filter in hPa. */
export function dpfDiffHpa(t: number): number {
  return 4 + speedKmh(t) * 0.3;
}

export interface SyntheticChannel {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  read: (t: number) => number;
}

export const SYNTHETIC_CHANNELS: SyntheticChannel[] = [
  { key: 'sim.rpm', label: 'Engine speed', unit: '/min', min: 0, max: 5000, read: engineRpm },
  { key: 'sim.speed', label: 'Vehicle speed', unit: 'km/h', min: 0, max: 200, read: speedKmh },
  { key: 'sim.load', label: 'Engine load', unit: '%', min: 0, max: 100, read: loadPercent },
  { key: 'sim.boost', label: 'Boost pressure', unit: 'mbar', min: 900, max: 2600, read: boostMbar },
  { key: 'sim.coolant', label: 'Coolant temperature', unit: '°C', min: 0, max: 130, read: coolantC },
  { key: 'sim.t30', label: 'Voltage terminal 30', unit: 'V', min: 10, max: 16, read: terminal30V },
  { key: 'sim.dpf', label: 'DPF diff. pressure', unit: 'hPa', min: 0, max: 60, read: dpfDiffHpa },
];
