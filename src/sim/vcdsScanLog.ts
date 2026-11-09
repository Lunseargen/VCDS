// Parser for a VCDS scan or fault log in text form (for example Log-<VIN>.txt).
// It reads the VIN, the modules, the fault codes, and the freeze frames.

export interface FreezeFrameItem {
  label: string;
  value: string;
}

export interface ScanFault {
  /** VAG fault code, for example 5585. */
  code: number;
  name: string;
  /** OBD-II code with its sub-code, for example `P242F 00`. */
  obdCode: string;
  /** Text after the OBD-II code, for example `Restricted/Clogged`. */
  detail: string;
  /** Status lines, for example `Confirmed - Tested Since Memory Clear`. */
  status: string[];
  freezeFrame: FreezeFrameItem[];
}

export interface ScanModule {
  /** Module address as 2 hex digits, for example `01`. */
  address: string;
  name: string;
  partNumber: string;
  component: string;
  coding: string;
  faults: ScanFault[];
}

export interface VcdsScanLog {
  vin: string;
  version: string;
  modules: ScanModule[];
}

const ADDRESS_RE = /^\s*Address\s+([0-9A-Fa-f]{2}):\s*(.+?)(?:\s{2,}Labels:.*)?\s*$/;
const FAULT_RE = /^(\d+)\s+-\s+(.+?)\s*$/;
const OBD_RE = /^\s+([PUBC][0-9A-F]{4}\s+[0-9A-F]{2})\s+(?:\[\d+\]\s+)?-\s+(.+?)\s*$/;
const ITEM_RE = /^\s+([^:]+?):\s+(.*?)\s*$/;

function field(line: string, label: string, firstOnly = true): string | null {
  const index = line.indexOf(`${label}:`);
  if (index < 0) return null;
  const rest = line.slice(index + label.length + 1).trim();
  // Text such as "4L2 910 401 A    HW: 4L0 907 401 E" has a second field after 2+ spaces.
  return firstOnly ? rest.split(/\s{2,}/)[0] : rest.replace(/\s{2,}/g, ' ');
}

/**
 * Normalise text that was read with the wrong encoding.
 * VCDS writes Latin-1, so a UTF-8 reader shows U+FFFD in place of `°` and `³`.
 */
export function cleanText(text: string): string {
  return text.replace(/�([CF])\b/g, '°$1').replace(/m�/g, 'm³');
}

/** Parse the text of a VCDS scan log. Unknown lines are ignored. */
export function parseVcdsScanLog(text: string): VcdsScanLog {
  const lines = cleanText(text).split(/\r?\n/);
  const log: VcdsScanLog = { vin: '', version: '', modules: [] };
  let module: ScanModule | null = null;
  let fault: ScanFault | null = null;
  let inFreeze = false;

  for (const line of lines) {
    const vin = line.match(/^VIN:\s*(\w+)/);
    if (vin) {
      log.vin = vin[1];
      continue;
    }
    const version = line.match(/^VCDS Version:\s*(.+?)\s*$/);
    if (version && log.version === '') {
      log.version = version[1];
      continue;
    }

    const address = line.match(ADDRESS_RE);
    if (address) {
      module = {
        address: address[1].toUpperCase(),
        name: address[2].trim(),
        partNumber: '',
        component: '',
        coding: '',
        faults: [],
      };
      log.modules.push(module);
      fault = null;
      inFreeze = false;
      continue;
    }
    if (!module) continue;

    const part = field(line, 'Control Module Part Number');
    if (part !== null) {
      module.partNumber = part;
      continue;
    }
    const component = field(line, 'Component and/or Version', false);
    if (component !== null) {
      module.component = component;
      continue;
    }
    const coding = field(line, 'Software Coding');
    if (coding !== null) {
      module.coding = coding;
      continue;
    }

    const faultMatch = line.match(FAULT_RE);
    if (faultMatch) {
      fault = {
        code: Number(faultMatch[1]),
        name: faultMatch[2],
        obdCode: '',
        detail: '',
        status: [],
        freezeFrame: [],
      };
      module.faults.push(fault);
      inFreeze = false;
      continue;
    }
    if (!fault) continue;

    const obd = line.match(OBD_RE);
    if (obd && fault.obdCode === '') {
      fault.obdCode = obd[1].replace(/\s+/, ' ');
      fault.detail = obd[2];
      continue;
    }
    if (line.trim() === 'Freeze Frame:') {
      inFreeze = true;
      continue;
    }
    if (inFreeze) {
      const item = line.match(ITEM_RE);
      if (item) fault.freezeFrame.push({ label: item[1], value: item[2] });
      continue;
    }
    const status = line.trim();
    if (status !== '' && !status.startsWith('[')) fault.status.push(status);
  }

  return log;
}

/** Read a number and its unit from a freeze-frame value such as `12.360 V`. */
export function parseQuantity(value: string): { value: number; unit: string } | null {
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2].trim() };
}
