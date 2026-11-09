// Save the data as CSV: a recorder keeps each read of all the channels (the log, the
// synthetic, and the custom channels), and the fault memory goes to a second CSV file.
import type { ChannelInfo } from '../../src/sim/vehicle';
import type { ScanFault } from '../../src/sim/vcdsScanLog';

/** 100 000 rows = 2.8 h at 10 Hz. The recorder drops the oldest rows after this limit. */
export const RECORD_LIMIT = 100_000;

export interface RecordRow {
  t: number;
  values: Record<string, number>;
}

export class Recorder {
  rows: RecordRow[] = [];

  constructor(private readonly limit = RECORD_LIMIT) {}

  push(t: number, values: Record<string, number>): void {
    this.rows.push({ t, values });
    if (this.rows.length > this.limit) this.rows.splice(0, this.rows.length - this.limit);
  }

  clear(): void {
    this.rows = [];
  }
}

/** Quote a cell when it has a comma, a quote, or a line break. */
export function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const line = (cells: Array<string | number>) => cells.map(csvCell).join(',');

/**
 * One column for each channel, in the order of `channels`, after the time column.
 * The header cell is `<key> <label> [<unit>]`. A missing or non-finite value is an empty cell.
 */
export function recordingToCsv(channels: ChannelInfo[], rows: RecordRow[]): string {
  const head = ['t [s]', ...channels.map((c) => `${c.key} ${c.label}${c.unit ? ` [${c.unit}]` : ''}`)];
  const body = rows.map((r) => line([Number(r.t.toFixed(3)), ...channels.map((c) => r.values[c.key] ?? NaN)]));
  return [line(head), ...body].join('\r\n') + '\r\n';
}

export function faultsToCsv(faults: Array<ScanFault & { address: string }>): string {
  const head = ['address', 'code', 'obd code', 'name', 'detail', 'status', 'freeze frame'];
  const body = faults.map((f) =>
    line([f.address, f.code, f.obdCode, f.name, f.detail, f.status.join(' | '), f.freezeFrame.map((i) => `${i.label}=${i.value}`).join('; ')]),
  );
  return [line(head), ...body].join('\r\n') + '\r\n';
}

/** A file name with the date and time, for example `shuffleboard-data-2026-11-09T11-20-00.csv`. */
export function csvFileName(kind: string, date: Date): string {
  return `shuffleboard-${kind}-${date.toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
}

/** Give the text to the browser as a file to save. */
export function downloadText(name: string, text: string, doc: Document = document): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
