// Parser for a VCDS measuring-block CSV log (for example LOG-01-093-176-177.CSV).
// A VCDS log has up to 3 groups. Each group has 5 columns: a time stamp and 4 fields.
// Each group has its own time stamp, because VCDS reads the groups one after the other.

export type ChannelKind = 'number' | 'bits';

export interface LogChannel {
  /** Unique key, `<group>.<field>`, for example `093.1`. */
  key: string;
  group: string;
  /** Field number in the group, 1..4. */
  field: number;
  unit: string;
  kind: ChannelKind;
}

export interface LogSample {
  /** Time in seconds from the start of the log. */
  t: number;
  /** Numeric value. A `bits` channel gives the binary string as a number (base 2). */
  value: number;
  /** Text as VCDS wrote it (for example `10001000`). */
  raw: string;
}

export interface VcdsCsvLog {
  /** First line of the file: date, VCID, VCDS version. */
  header: string;
  /** Second line: part number and component of the module. */
  module: string;
  groups: string[];
  channels: LogChannel[];
  /** Samples for each channel key, in time order. */
  samples: Record<string, LogSample[]>;
  /** Time of the last sample of all channels, in seconds. */
  duration: number;
}

const FIELDS_PER_GROUP = 4;

function cell(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}

function unitFor(unitRow: string[], stampRow: string[], col: number): string {
  const short = cell(stampRow, col);
  if (short !== '') return short;
  const long = cell(unitRow, col);
  if (long === '' || long === '(no units)') return '';
  return long;
}

function parseValue(raw: string, kind: ChannelKind): number {
  if (kind === 'bits') return parseInt(raw, 2);
  return Number(raw);
}

/**
 * Parse the text of a VCDS CSV log.
 * Throws an Error if the text has no group line or no `Marker` line.
 */
export function parseVcdsCsvLog(text: string): VcdsCsvLog {
  const lines = text.split(/\r?\n/);
  const rows = lines.map((line) => line.split(','));

  const groupLine = lines.findIndex((line) => line.includes('Group A:'));
  const markerLine = lines.findIndex((line) => line.startsWith('Marker'));
  if (groupLine < 0 || markerLine < 0) {
    throw new Error('not a VCDS CSV log: no group line or no Marker line');
  }

  const groups = (lines[groupLine].match(/'(\w+)/g) ?? []).map((g) => g.slice(1));
  const unitRow = rows[groupLine + 1] ?? [];
  const stampRow = rows[markerLine];
  const timeCols: number[] = [];
  stampRow.forEach((value, col) => {
    if (value.trim() === 'STAMP') timeCols.push(col);
  });
  if (timeCols.length === 0 || groups.length === 0) {
    throw new Error('not a VCDS CSV log: no group ids or no time columns');
  }

  const dataRows = rows.slice(markerLine + 1).filter((row) => row.length > 1);

  const channels: LogChannel[] = [];
  const samples: Record<string, LogSample[]> = {};
  let duration = 0;

  timeCols.forEach((timeCol, g) => {
    const group = groups[g] ?? `G${g + 1}`;
    for (let field = 1; field <= FIELDS_PER_GROUP; field++) {
      const col = timeCol + field;
      const unit = unitFor(unitRow, stampRow, col);
      const kind: ChannelKind = cell(unitRow, col) === 'Bin. Bits' ? 'bits' : 'number';
      const series: LogSample[] = [];
      for (const row of dataRows) {
        const t = Number(cell(row, timeCol));
        const raw = cell(row, col);
        if (raw === '' || !Number.isFinite(t)) continue;
        const value = parseValue(raw, kind);
        if (!Number.isFinite(value)) continue;
        series.push({ t, value, raw });
        if (t > duration) duration = t;
      }
      if (series.length === 0) continue;
      const key = `${group}.${field}`;
      channels.push({ key, group, field, unit, kind });
      samples[key] = series;
    }
  });

  return {
    header: cell([lines[0] ?? ''], 0),
    module: (lines[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean).join(' '),
    groups,
    channels,
    samples,
    duration,
  };
}
