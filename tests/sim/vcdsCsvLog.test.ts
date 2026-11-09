import { describe, expect, it } from 'vitest';
import { parseVcdsCsvLog } from '../../src/sim/vcdsCsvLog';
import { CSV_LOG } from './fixtures';

describe('parseVcdsCsvLog', () => {
  const log = parseVcdsCsvLog(CSV_LOG);

  it('reads the header, the module, and the groups', () => {
    expect(log.header).toBe('Monday,09,November,2026,10:00:00:00001,VCID:TEST,VCDS Version: 23.3');
    expect(log.module).toBe('4L0 997 401 H 3.0l V6 TDI');
    expect(log.groups).toEqual(['093', '176']);
  });

  it('makes one channel for each field with data, and skips empty fields', () => {
    expect(log.channels.map((c) => c.key)).toEqual(['093.1', '093.2', '093.3', '176.1', '176.2']);
  });

  it('reads bit fields in base 2, and marks them as bits', () => {
    const ch = log.channels[0];
    expect(ch).toEqual({ key: '093.1', group: '093', field: 1, unit: 'Bin. Bits', kind: 'bits' });
    expect(log.samples['093.1']).toEqual([
      { t: 0, value: 136, raw: '10001000' },
      { t: 0.5, value: 128, raw: '10000000' },
    ]);
  });

  it('uses the short unit first, then the long unit, and drops "(no units)"', () => {
    const unit = Object.fromEntries(log.channels.map((c) => [c.key, c.unit]));
    expect(unit['093.2']).toBe('%');
    expect(unit['093.3']).toBe('');
    expect(unit['176.1']).toBe('ppm');
    expect(unit['176.2']).toBe('V2');
  });

  it('skips rows with a bad time and values that are not numbers', () => {
    expect(log.samples['093.2'].map((s) => s.value)).toEqual([1.5, 2.5]);
    expect(log.samples['176.1'].map((s) => s.t)).toEqual([1, 1.5, 2]);
    expect(log.samples['176.2'].map((s) => s.value)).toEqual([0.1, 0.3]);
  });

  it('gives the time of the last sample as the duration', () => {
    expect(log.duration).toBe(2);
  });

  it('names a group with no id G<n>', () => {
    const text = CSV_LOG.replace(",'176", '');
    expect(parseVcdsCsvLog(text).channels.map((c) => c.group)).toContain('G2');
  });

  it('throws when the Marker line or the group line is missing', () => {
    expect(() => parseVcdsCsvLog('a,b\n1,2')).toThrow(/no group line/);
    expect(() => parseVcdsCsvLog(CSV_LOG.replace('Marker', 'Other'))).toThrow(/no group line/);
  });

  it('throws when no time column or no group id exists', () => {
    expect(() => parseVcdsCsvLog(CSV_LOG.replace(/STAMP/g, 'X'))).toThrow(/no time columns/);
    expect(() => parseVcdsCsvLog(CSV_LOG.replace(/'\d+/g, ''))).toThrow(/no group ids/);
  });

  it('gives empty text for a missing header and module', () => {
    const text = ["Group A:,'001", 'u', 'Marker,STAMP', ',0,5'].join('\n');
    const small = parseVcdsCsvLog(text);
    expect(small.module).toBe('u');
    expect(small.channels).toHaveLength(1);
  });
});
