'use strict';
// Read-only probe for a Ross-Tech USB cable.
// CAUTION: This module never writes to the cable. It must not call device.write,
// device.sendFeatureReport, or any other write function. A unit test checks this rule.

// The known Ross-Tech USB IDs, from the driver INF files.
const ROSS_TECH = [
  { vid: 0x0483, pid: 0xa0cb, name: 'HEX-V2 (HID)' },
  { vid: 0x0483, pid: 0xa00f, name: 'HEX-NET (HID)' },
  { vid: 0x0403, pid: 0xfa20, name: 'HEX or KEY USB (FTDI)' },
  { vid: 0x0403, pid: 0xfa23, name: 'Micro-CAN (FTDI)' },
  { vid: 0x0403, pid: 0xfa24, name: 'Direct USB (FTDI)' },
  { vid: 0x0403, pid: 0xfa25, name: 'USB Converter (FTDI)' },
];

const FTDI_VID = 0x0403;
const ST_VID = 0x0483;
const DEFAULT_READ_MS = 4000; // How long to listen for data from the cable.
const HEX_WIDTH = 4;

/** Format a number as hex text, for example 0x0483. */
function hx(n, w = HEX_WIDTH) {
  return '0x' + n.toString(16).toUpperCase().padStart(w, '0');
}

/** Find the Ross-Tech table row for a device. Return undefined if no row matches. */
function matchCable(d) {
  return ROSS_TECH.find((r) => r.vid === d.vendorId && r.pid === d.productId);
}

/** Return two text lines for a byte buffer: a hex line and an ASCII line. */
function dumpLines(buf) {
  const bytes = [...buf];
  const hexText = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
  return [`  bytes=${bytes.length}  hex: ${hexText}`, `              ascii: ${ascii}`];
}

/** Return the text lines that describe one cable. */
function describeCable(d) {
  const r = matchCable(d);
  return [
    '',
    `  ${r.name}`,
    `    VID ${hx(d.vendorId)}  PID ${hx(d.productId)}`,
    `    manufacturer : ${d.manufacturer ?? '(none)'}`,
    `    product      : ${d.product ?? '(none)'}`,
    `    serial       : ${d.serialNumber ? '(present, hidden)' : '(none)'}`,
    `    release      : ${d.release}`,
    `    usagePage    : ${d.usagePage != null ? hx(d.usagePage) : '(n/a)'}  usage: ${d.usage != null ? hx(d.usage, 2) : '(n/a)'}`,
    `    interface    : ${d.interface}`,
  ];
}

/** Wait for a number of milliseconds. */
function defaultWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the read-only probe.
 * @param {object} opts
 * @param {object} opts.HID       The node-hid module (or a mock).
 * @param {function} opts.log     Called with one line of text at a time.
 * @param {number} [opts.readMs]  Listen time in milliseconds.
 * @param {function} [opts.wait]  Function that returns a Promise after N milliseconds.
 * @param {object} [opts.env]     Object with platform, arch, and version text.
 * @returns {Promise<{status: string, reports: number}>}
 */
async function runProbe({ HID, log, readMs = DEFAULT_READ_MS, wait = defaultWait, env = {} }) {
  log('=== Ross-Tech cable probe (read-only) ===');
  log(`platform ${env.platform ?? '(unknown)'} ${env.arch ?? ''} · runtime ${env.version ?? '(unknown)'}`);
  log(`node-hid ${HID.version ? HID.version() : '(version unknown)'}`);
  log('');

  // Step 1: list every HID device, so we also see a cable with an ID we do not know.
  let all;
  try {
    all = HID.devices();
  } catch (e) {
    log(`ERROR: cannot list HID devices: ${e.message}`);
    log('On macOS, grant Input Monitoring to this app in System Settings > Privacy & Security.');
    return { status: 'list-error', reports: 0 };
  }
  log(`Found ${all.length} HID device(s) in total.`);

  const cables = all.filter(matchCable);

  // Step 2: show any FTDI or ST device, even when the exact PID is new.
  const maybe = all.filter((d) => !matchCable(d) && (d.vendorId === FTDI_VID || d.vendorId === ST_VID));
  if (maybe.length) {
    log('');
    log('Note: these FTDI/ST devices are not in the known list (a new cable?):');
    for (const d of maybe) {
      log(`  VID ${hx(d.vendorId)} PID ${hx(d.productId)}  ${d.product ?? ''} ${d.manufacturer ?? ''}`);
    }
  }

  if (cables.length === 0) {
    log('');
    log('No known Ross-Tech cable found as a HID device.');
    log('If your cable is a HEX-V2 or HEX-NET, it should appear above.');
    log('An FTDI cable (HEX/KEY, Micro-CAN, Direct) is NOT a HID device on all systems,');
    log('so it may not show here even when it is plugged in. Tell Jack which cable you have.');
    return { status: 'no-cable', reports: 0 };
  }

  // Step 3: describe each cable we found.
  log('');
  log(`Found ${cables.length} Ross-Tech cable(s):`);
  for (const d of cables) {
    for (const line of describeCable(d)) log(line);
  }

  // Step 4: open the first cable and read. NEVER write.
  const target = cables[0];
  log('');
  log(`Opening ${matchCable(target).name} to listen for ${readMs} ms (no data is sent)...`);
  let device;
  try {
    device = new HID.HID(target.path);
  } catch (e) {
    log(`ERROR: cannot open the cable: ${e.message}`);
    log('Close VCDS and any other tool that holds the cable, then run again.');
    return { status: 'open-error', reports: 0 };
  }

  let count = 0;
  device.on('data', (buf) => {
    count++;
    log(`Input report #${count}:`);
    for (const line of dumpLines(buf)) log(line);
  });
  device.on('error', (e) => log(`read error: ${e.message}`));

  await wait(readMs);
  device.close();

  log('');
  if (count === 0) {
    log('The cable sent no data on its own. That is normal: most cables answer only');
    log('after a request. The IDs above are still useful.');
  } else {
    log(`Done. The cable sent ${count} report(s). The byte lengths above are the HID report size.`);
  }
  log('Send this whole output to Jack.');
  return { status: count === 0 ? 'no-data' : 'data', reports: count };
}

module.exports = { ROSS_TECH, hx, matchCable, dumpLines, describeCable, runProbe };
