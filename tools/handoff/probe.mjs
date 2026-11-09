// Read-only probe for a Ross-Tech USB cable (HEX-V2, HEX-NET, HEX/KEY, Micro-CAN, Direct).
// It finds the cable, opens it, and reads what the cable sends. It NEVER writes to the cable.
// It writes the result to a text file next to this script, and it prints the result too.
//
// WARNING: Close VCDS and any other program that uses the cable first. Only one program can
// open a HID device at a time.
//
// CAUTION: This script is read-only. It sends no bytes to the cable and no request to the car.
// It is safe to run with the cable connected to the car, or on a desk with no car.

import HID from 'node-hid';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// The known Ross-Tech USB IDs, from the Ross-Tech driver INF files.
const ROSS_TECH = [
  { vid: 0x0483, pid: 0xa0cb, name: 'HEX-V2 (HID)' },
  { vid: 0x0483, pid: 0xa00f, name: 'HEX-NET (HID)' },
  { vid: 0x0403, pid: 0xfa20, name: 'HEX or KEY USB (FTDI)' },
  { vid: 0x0403, pid: 0xfa23, name: 'Micro-CAN (FTDI)' },
  { vid: 0x0403, pid: 0xfa24, name: 'Direct USB (FTDI)' },
  { vid: 0x0403, pid: 0xfa25, name: 'USB Converter (FTDI)' },
];

const READ_MS = 4000; // How long to listen for data from the cable.
const hx = (n, w = 4) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');

// Collect every output line, so the script can save the file and print the text.
const lines = [];
const say = (s = '') => {
  lines.push(s);
  console.log(s);
};

/** Add one byte buffer as a hex line and an ASCII line. */
function dump(buf) {
  const bytes = [...buf];
  const hexText = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
  say(`  bytes=${bytes.length}  hex: ${hexText}`);
  say(`              ascii: ${ascii}`);
}

/** Save the collected lines to a text file next to this script. Return the file path. */
function saveFile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(HERE, `probe-output-${stamp}.txt`);
  try {
    writeFileSync(path, lines.join('\n') + '\n', 'utf8');
    return path;
  } catch (e) {
    console.log('WARNING: could not save the output file:', e.message);
    return null;
  }
}

function finish() {
  const path = saveFile();
  console.log('');
  if (path) {
    console.log('================================================================');
    console.log('DONE. The result is saved in this file:');
    console.log('  ' + path);
    console.log('Send that file to Jack.');
    console.log('================================================================');
  } else {
    console.log('DONE. Copy the text above and send it to Jack.');
  }
}

function main() {
  say('=== Ross-Tech cable probe (read-only) ===');
  say(`date: ${new Date().toString()}`);
  say(`node ${process.version} · platform ${process.platform} ${process.arch}`);
  say(`node-hid ${HID.version ? HID.version() : '(version unknown)'}`);
  say('');

  // Step 1: list every HID device, so we also see a cable with an ID we do not know.
  let all = [];
  try {
    all = HID.devices();
  } catch (e) {
    say('ERROR: cannot list the USB devices: ' + e.message);
    say('On a Mac, open System Settings > Privacy & Security > Input Monitoring,');
    say('and allow Terminal. Then run this again.');
    finish();
    return;
  }
  say(`Found ${all.length} USB HID device(s) in total.`);

  const match = (d) => ROSS_TECH.find((r) => r.vid === d.vendorId && r.pid === d.productId);
  const cables = all.filter(match);

  // Step 2: show any FTDI or ST device, even when the exact PID is new.
  const maybe = all.filter((d) => !match(d) && (d.vendorId === 0x0403 || d.vendorId === 0x0483));
  if (maybe.length) {
    say('');
    say('Note: these devices are from the cable chip makers but have a new ID:');
    for (const d of maybe) say(`  VID ${hx(d.vendorId)} PID ${hx(d.productId)}  ${d.product ?? ''} ${d.manufacturer ?? ''}`);
  }

  if (cables.length === 0) {
    say('');
    say('No known Ross-Tech cable was found as a HID device.');
    say('If the cable is a HEX-V2 or HEX-NET, it should appear above. Check that it is');
    say('plugged into the computer. An older FTDI cable (HEX/KEY, Micro-CAN, Direct) does');
    say('not always show here; tell Jack which cable you have.');
    finish();
    return;
  }

  // Step 3: describe each cable we found.
  say('');
  say(`Found ${cables.length} Ross-Tech cable(s):`);
  for (const d of cables) {
    const r = match(d);
    say('');
    say(`  ${r.name}`);
    say(`    VID ${hx(d.vendorId)}  PID ${hx(d.productId)}`);
    say(`    manufacturer : ${d.manufacturer ?? '(none)'}`);
    say(`    product      : ${d.product ?? '(none)'}`);
    say(`    serial       : ${d.serialNumber ? '(present, hidden)' : '(none)'}`);
    say(`    release      : ${d.release}`);
    say(`    usagePage    : ${d.usagePage != null ? hx(d.usagePage) : '(n/a)'}  usage: ${d.usage != null ? hx(d.usage, 2) : '(n/a)'}`);
    say(`    interface    : ${d.interface}`);
  }

  // Step 4: open the first cable and read, with NO write.
  const target = cables[0];
  say('');
  say(`Opening ${match(target).name} to listen for ${READ_MS} ms (it sends no data)...`);
  let device;
  try {
    device = new HID.HID(target.path);
  } catch (e) {
    say('ERROR: cannot open the cable: ' + e.message);
    say('Close VCDS and any other tool that uses the cable, then run this again.');
    finish();
    return;
  }

  let count = 0;
  device.on('data', (buf) => {
    count++;
    say(`Input report #${count}:`);
    dump(buf);
  });
  device.on('error', (e) => say('read error: ' + e.message));

  setTimeout(() => {
    try {
      device.close();
    } catch {
      // The device is already gone. Nothing to do.
    }
    say('');
    if (count === 0) {
      say('The cable sent no data on its own. That is normal: most cables answer only after');
      say('a request. The IDs and the device details above are still useful.');
    } else {
      say(`The cable sent ${count} report(s). The byte lengths above are the HID report size.`);
    }
    finish();
  }, READ_MS);
}

main();
