// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvCell, csvFileName, downloadText, faultsToCsv, Recorder, RECORD_LIMIT, recordingToCsv } from '../src/export';
import type { ChannelInfo } from '../../src/sim/vehicle';

afterEach(() => vi.restoreAllMocks());

const ch = (key: string, label: string, unit: string): ChannelInfo => ({ key, label, unit, min: 0, max: 1, kind: 'number', source: 'log' });

describe('Recorder', () => {
  it('keeps the rows and drops the oldest after the limit', () => {
    const r = new Recorder(2);
    r.push(0, { a: 1 });
    r.push(0.1, { a: 2 });
    r.push(0.2, { a: 3 });
    expect(r.rows.map((x) => x.values.a)).toEqual([2, 3]);
    r.clear();
    expect(r.rows).toEqual([]);
  });
  it('has a default limit of 100 000 rows', () => {
    expect(RECORD_LIMIT).toBe(100_000);
    expect(new Recorder().rows).toEqual([]);
  });
});

describe('csvCell', () => {
  it('writes numbers, empties non-finite numbers, and quotes special text', () => {
    expect(csvCell(1.5)).toBe('1.5');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(Infinity)).toBe('');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });
});

describe('recordingToCsv', () => {
  it('writes a header with key, label, and unit, and 1 line for each row', () => {
    const csv = recordingToCsv(
      [ch('176.1', 'Group 176 / field 1', 'ppm'), ch('custom.1', 'Ratio, NOx', '')],
      [
        { t: 0.1234567, values: { '176.1': 150, 'custom.1': 0.6 } },
        { t: 0.2, values: { '176.1': 151, 'custom.1': Infinity } },
        { t: 0.3, values: {} },
      ],
    );
    expect(csv).toBe('t [s],176.1 Group 176 / field 1 [ppm],"custom.1 Ratio, NOx"\r\n0.123,150,0.6\r\n0.2,151,\r\n0.3,,\r\n');
  });
  it('writes only the header with no rows', () => {
    expect(recordingToCsv([], [])).toBe('t [s]\r\n');
  });
});

describe('faultsToCsv', () => {
  it('writes 1 line for each fault, with the status and the freeze frame joined', () => {
    const csv = faultsToCsv([
      {
        address: '01',
        code: 5585,
        name: 'Diesel Particulate Filter (Bank 1)',
        obdCode: 'P242F 00',
        detail: 'Restricted/Clogged',
        status: ['Confirmed', 'Tested Since Memory Clear'],
        freezeFrame: [
          { label: 'Mileage', value: '1000 km' },
          { label: 'Priority', value: '2' },
        ],
      },
    ]);
    expect(csv).toBe(
      'address,code,obd code,name,detail,status,freeze frame\r\n01,5585,P242F 00,Diesel Particulate Filter (Bank 1),Restricted/Clogged,Confirmed | Tested Since Memory Clear,Mileage=1000 km; Priority=2\r\n',
    );
  });
});

describe('csvFileName and downloadText', () => {
  it('makes a file name with no colons', () => {
    expect(csvFileName('data', new Date('2026-11-09T11:20:05.123Z'))).toBe('shuffleboard-data-2026-11-09T11-20-05.csv');
  });
  it('clicks a temporary download link and frees the URL', () => {
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('f.csv');
      expect(this.href).toBe('blob:x');
    });
    downloadText('f.csv', 'a,b\r\n');
    expect(click).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a')).toBeNull();
  });
});
