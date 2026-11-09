import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { findLogs, logDirs, vehicleLogsPlugin } from '../logsPlugin';
import { CSV_LOG, SCAN_LOG } from '../../tests/sim/fixtures';

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'vcds-logs-'));
  mkdirSync(join(root, '2010-Q7'));
  mkdirSync(join(root, '2010-Q7', 'sub'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, '2099-file'), 'not a directory');
  writeFileSync(join(root, '2010-Q7', 'LOG.CSV'), CSV_LOG, 'latin1');
  writeFileSync(join(root, '2010-Q7', 'other.csv'), 'a,b', 'latin1');
  writeFileSync(join(root, '2010-Q7', 'Log-X.txt'), SCAN_LOG, 'latin1');
  writeFileSync(join(root, '2010-Q7', 'notes.txt'), 'hello', 'latin1');
  writeFileSync(join(root, '2010-Q7', 'image.png'), 'x');
  return root;
}

describe('logDirs', () => {
  it('uses the env list when it is set', () => {
    expect(logDirs('/r', ' a , ,/b ')).toEqual(['/r/a', '/b']);
  });
  it('else finds the dated directories of the repository', () => {
    const root = makeRepo();
    expect(logDirs(root, undefined)).toEqual([join(root, '2010-Q7')]);
    expect(logDirs(root, '  ')).toEqual([join(root, '2010-Q7')]);
  });
});

describe('findLogs', () => {
  it('finds CSV logs and scan logs, and skips other files and missing directories', () => {
    const root = makeRepo();
    const found = findLogs([join(root, '2010-Q7'), join(root, 'missing')]);
    expect(found.csv.map((f) => f.name)).toEqual(['LOG.CSV']);
    expect(found.scan.map((f) => f.name)).toEqual(['Log-X.txt']);
    expect(found.scan[0].text).toContain('�'.length ? 'Coolant temp.' : '');
  });
  it('reads the files as Latin-1', () => {
    const root = mkdtempSync(join(tmpdir(), 'vcds-latin-'));
    writeFileSync(join(root, 'Log.txt'), Buffer.from('VCDS Version: 1\nAddress 01: M\n34\xb0C', 'latin1'));
    expect(findLogs([root]).scan[0].text).toContain('34°C');
  });
});

describe('vehicleLogsPlugin', () => {
  const saved = process.env.VCDS_LOG_DIRS;
  afterEach(() => {
    if (saved === undefined) delete process.env.VCDS_LOG_DIRS;
    else process.env.VCDS_LOG_DIRS = saved;
  });
  it('resolves and loads the virtual module', () => {
    const root = makeRepo();
    delete process.env.VCDS_LOG_DIRS;
    const plugin = vehicleLogsPlugin(root) as {
      resolveId: (id: string) => string | null;
      load: (id: string) => string | null;
    };
    expect(plugin.resolveId('virtual:vehicle-logs')).toBe('\0virtual:vehicle-logs');
    expect(plugin.resolveId('other')).toBeNull();
    expect(plugin.load('other')).toBeNull();
    const code = plugin.load('\0virtual:vehicle-logs')!;
    expect(code.startsWith('export default ')).toBe(true);
    const data = JSON.parse(code.slice('export default '.length, -1));
    expect(data.csv).toHaveLength(1);
    expect(data.scan).toHaveLength(1);
  });
});
