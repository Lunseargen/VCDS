import { describe, expect, it } from 'vitest';
import { cleanText, parseQuantity, parseVcdsScanLog } from '../../src/sim/vcdsScanLog';
import { SCAN_LOG } from './fixtures';

describe('parseVcdsScanLog', () => {
  const log = parseVcdsScanLog(SCAN_LOG);

  it('reads the VIN and the first version only', () => {
    expect(log.vin).toBe('TESTVIN0000000001');
    expect(log.version).toBe('23.3.1.0');
  });

  it('reads the modules, with the address in upper case', () => {
    expect(log.modules.map((m) => [m.address, m.name])).toEqual([
      ['01', 'Engine (J623-CRCA)'],
      ['0A', 'Test Module'],
    ]);
    const m = log.modules[0];
    expect(m.partNumber).toBe('4L2 910 401 A');
    expect(m.component).toBe('3.0TDI FSA H21 0014');
    expect(m.coding).toBe('2A2A40');
    expect(log.modules[1].faults).toEqual([]);
  });

  it('reads the faults, the OBD codes, the status, and the freeze frame', () => {
    const [dpf, nox] = log.modules[0].faults;
    expect(dpf).toEqual({
      code: 5585,
      name: 'Diesel Particulate Filter (Bank 1)',
      obdCode: 'P242F 00',
      detail: 'Restricted/Clogged',
      status: ['Confirmed - Tested Since Memory Clear'],
      freezeFrame: [
        { label: 'Fault Status', value: '00000001' },
        { label: 'Mileage', value: '1000 km' },
        { label: 'Coolant temp.', value: '34°C' },
      ],
    });
    expect(nox.obdCode).toBe('P1032 00');
    expect(nox.detail).toBe('Signal too High');
    expect(nox.status).toEqual(['Intermittent', 'P0000 00 - second code line']);
    expect(nox.freezeFrame).toEqual([]);
  });

  it('gives an empty log for text with no modules', () => {
    expect(parseVcdsScanLog('nothing here')).toEqual({ vin: '', version: '', modules: [] });
  });
});

describe('cleanText', () => {
  it('repairs the degree sign and m³', () => {
    expect(cleanText('20�C 68�F 5 m�')).toBe('20°C 68°F 5 m³');
  });
  it('keeps other text', () => {
    expect(cleanText('�X')).toBe('�X');
  });
});

describe('parseQuantity', () => {
  it('reads a number and a unit', () => {
    expect(parseQuantity('12.360 V')).toEqual({ value: 12.36, unit: 'V' });
    expect(parseQuantity('-5 °C')).toEqual({ value: -5, unit: '°C' });
    expect(parseQuantity('7')).toEqual({ value: 7, unit: '' });
  });
  it('gives null for text that does not start with a number', () => {
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });
});
