import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ROSS_TECH, hx, matchCable, dumpLines, describeCable, runProbe } = require('../probe-core.js');

const HEX_V2 = {
  vendorId: 0x0483, productId: 0xa0cb, path: 'dev-path', manufacturer: 'Ross-Tech',
  product: 'HEX-V2', serialNumber: '123', release: 0x100, usagePage: 0xff00, usage: 1, interface: 0,
};

/** Make a mock device. It records every method call, so a test can check for a write. */
function makeDevice() {
  const handlers = {};
  const calls = [];
  const device = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'on') return (name, fn) => { handlers[name] = fn; calls.push('on'); };
      if (prop === 'close') return () => { calls.push('close'); };
      // Any other method (write, sendFeatureReport, ...) is recorded as a call.
      return (...args) => { calls.push(String(prop)); return args; };
    },
  });
  return { device, handlers, calls };
}

function makeHID({ devices = [], throwList = false, throwOpen = false, version = true } = {}) {
  const m = makeDevice();
  const HID = {
    devices: () => { if (throwList) throw new Error('list failed'); return devices; },
    HID: function HIDCtor() { if (throwOpen) throw new Error('open failed'); return m.device; },
  };
  if (version) HID.version = () => '3.x';
  return { HID, ...m };
}

async function run(hidOpts, extra = {}) {
  const lines = [];
  const h = makeHID(hidOpts);
  const result = await runProbe({ HID: h.HID, log: (l) => lines.push(l), wait: async () => {}, ...extra });
  return { lines, text: lines.join('\n'), result, ...h };
}

describe('helpers', () => {
  it('hx pads and upper-cases', () => {
    expect(hx(0x483)).toBe('0x0483');
    expect(hx(0xa, 2)).toBe('0x0A');
  });
  it('matchCable finds a known device and rejects an unknown one', () => {
    expect(matchCable(HEX_V2).name).toBe('HEX-V2 (HID)');
    expect(matchCable({ vendorId: 1, productId: 2 })).toBeUndefined();
    expect(ROSS_TECH).toHaveLength(6);
  });
  it('dumpLines gives hex and ascii, with dots for control bytes', () => {
    const [a, b] = dumpLines(Buffer.from([0x41, 0x00, 0x7f]));
    expect(a).toBe('  bytes=3  hex: 41 00 7f');
    expect(b).toBe('              ascii: A..');
  });
  it('dumpLines handles an empty buffer', () => {
    expect(dumpLines(Buffer.alloc(0))[0]).toBe('  bytes=0  hex: ');
  });
  it('describeCable shows the fields', () => {
    const t = describeCable(HEX_V2).join('\n');
    expect(t).toContain('HEX-V2 (HID)');
    expect(t).toContain('(present, hidden)');
    expect(t).not.toContain('123');
    expect(t).toContain('usagePage    : 0xFF00  usage: 0x01');
  });
  it('describeCable shows placeholders for missing fields', () => {
    const t = describeCable({ vendorId: 0x0483, productId: 0xa00f, release: 1, interface: 2 }).join('\n');
    expect(t).toContain('(none)');
    expect(t).toContain('(n/a)');
  });
});

describe('runProbe', () => {
  it('reports no devices', async () => {
    const r = await run({ devices: [] });
    expect(r.result).toEqual({ status: 'no-cable', reports: 0 });
    expect(r.text).toContain('Found 0 HID device(s)');
    expect(r.text).toContain('No known Ross-Tech cable found');
  });
  it('uses defaults for env and version', async () => {
    const r = await run({ devices: [], version: false });
    expect(r.text).toContain('(unknown)');
    expect(r.text).toContain('(version unknown)');
  });
  it('shows env values', async () => {
    const r = await run({ devices: [] }, { env: { platform: 'darwin', arch: 'x64', version: 'Electron 33' } });
    expect(r.text).toContain('platform darwin x64');
    expect(r.text).toContain('runtime Electron 33');
  });
  it('reports a list error', async () => {
    const r = await run({ throwList: true });
    expect(r.result.status).toBe('list-error');
    expect(r.text).toContain('ERROR: cannot list HID devices: list failed');
    expect(r.text).toContain('Input Monitoring');
  });
  it('lists unknown FTDI and ST devices', async () => {
    const r = await run({ devices: [
      { vendorId: 0x0403, productId: 0x9999, product: 'X', manufacturer: 'Y' },
      { vendorId: 0x0483, productId: 0x1111 },
      { vendorId: 0x1234, productId: 0x1 },
    ] });
    expect(r.text).toContain('not in the known list');
    expect(r.text).toContain('VID 0x0403 PID 0x9999  X Y');
    expect(r.text).toContain('VID 0x0483 PID 0x1111');
    expect(r.text).not.toContain('0x1234');
    expect(r.result.status).toBe('no-cable');
  });
  it('handles a known cable that sends no data', async () => {
    const r = await run({ devices: [HEX_V2] });
    expect(r.result).toEqual({ status: 'no-data', reports: 0 });
    expect(r.text).toContain('Found 1 Ross-Tech cable(s)');
    expect(r.text).toContain('listen for 4000 ms');
    expect(r.text).toContain('sent no data');
    expect(r.calls).toContain('close');
  });
  it('handles an open error', async () => {
    const r = await run({ devices: [HEX_V2], throwOpen: true });
    expect(r.result.status).toBe('open-error');
    expect(r.text).toContain('ERROR: cannot open the cable: open failed');
  });
  it('logs data reports and read errors', async () => {
    const lines = [];
    const h = makeHID({ devices: [HEX_V2] });
    const wait = async () => {
      h.handlers.data(Buffer.from('Hi'));
      h.handlers.data(Buffer.from([1]));
      h.handlers.error(new Error('boom'));
    };
    const result = await runProbe({ HID: h.HID, log: (l) => lines.push(l), wait, readMs: 10 });
    const text = lines.join('\n');
    expect(result).toEqual({ status: 'data', reports: 2 });
    expect(text).toContain('Input report #1:');
    expect(text).toContain('Input report #2:');
    expect(text).toContain('ascii: Hi');
    expect(text).toContain('read error: boom');
    expect(text).toContain('sent 2 report(s)');
    expect(text).toContain('listen for 10 ms');
  });
  it('opens only the first cable', async () => {
    const second = { ...HEX_V2, path: 'second' };
    const open = vi.fn();
    const h = makeHID({ devices: [HEX_V2, second] });
    const HID = { ...h.HID, HID: function C(p) { open(p); return h.device; } };
    await runProbe({ HID, log: () => {}, wait: async () => {} });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('dev-path');
  });
  it('uses the real timer when no wait function is given', async () => {
    vi.useFakeTimers();
    const h = makeHID({ devices: [HEX_V2] });
    const p = runProbe({ HID: h.HID, log: () => {}, readMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    expect((await p).status).toBe('no-data');
    vi.useRealTimers();
  });
  it('uses the default listen time', async () => {
    const lines = [];
    const h = makeHID({ devices: [HEX_V2] });
    await runProbe({ HID: h.HID, log: (l) => lines.push(l), wait: async () => {} });
    expect(lines.join('\n')).toContain('4000 ms');
  });
});

describe('read-only safety', () => {
  it('never calls write, sendFeatureReport, or any method except on and close', async () => {
    const h = makeHID({ devices: [HEX_V2] });
    const wait = async () => { h.handlers.data(Buffer.from([1, 2, 3])); };
    await runProbe({ HID: h.HID, log: () => {}, wait });
    expect(h.calls.filter((c) => c !== 'on' && c !== 'close')).toEqual([]);
    expect(h.calls).not.toContain('write');
    expect(h.calls).not.toContain('sendFeatureReport');
  });
  it('the source file has no write call', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../probe-core.js', import.meta.url), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(src).not.toMatch(/\.write\s*\(|sendFeatureReport|getFeatureReport\s*\(/);
  });
});
