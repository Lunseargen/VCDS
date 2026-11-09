// Vite plugin: reads the VCDS logs on this computer when the server starts, and gives them
// to the UI as the module `virtual:vehicle-logs`. The logs never go into a file in git.
// Directories: the env variable VCDS_LOG_DIRS (comma list), else each top-level directory of
// the repository whose name starts with 4 digits and a dash (for example `2010-Q7`).
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { Plugin } from 'vite';

export interface LogFile {
  name: string;
  text: string;
}

export interface FoundLogs {
  csv: LogFile[];
  scan: LogFile[];
}

const VIRTUAL_ID = 'virtual:vehicle-logs';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** The directories to search. */
export function logDirs(repoRoot: string, env: string | undefined): string[] {
  if (env && env.trim() !== '') {
    return env
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => resolve(repoRoot, d));
  }
  return readdirSync(repoRoot)
    .filter((name) => /^\d{4}-/.test(name))
    .map((name) => join(repoRoot, name))
    .filter((path) => statSync(path).isDirectory());
}

/**
 * Find the VCDS logs in the directories (not in subdirectories).
 * A CSV log has a `Group A:` line. A scan log has a `VCDS Version:` line and an `Address` line.
 * VCDS writes Latin-1, so the files are read as Latin-1.
 */
export function findLogs(dirs: string[]): FoundLogs {
  const found: FoundLogs = { csv: [], scan: [] };
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (!statSync(path).isFile()) continue;
      const lower = name.toLowerCase();
      if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) continue;
      const text = readFileSync(path, 'latin1');
      if (lower.endsWith('.csv') && text.includes('Group A:')) found.csv.push({ name, text });
      else if (text.includes('VCDS Version:') && /Address\s+[0-9A-F]{2}:/i.test(text)) found.scan.push({ name, text });
    }
  }
  return found;
}

export function vehicleLogsPlugin(repoRoot: string): Plugin {
  return {
    name: 'vehicle-logs',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const logs = findLogs(logDirs(repoRoot, process.env.VCDS_LOG_DIRS));
      return `export default ${JSON.stringify(logs)};`;
    },
  };
}
