// Read-only probe for a Ross-Tech USB cable (HEX-V2, HEX-NET, HEX/KEY, Micro-CAN, Direct).
// It finds the cable, opens it, and reads what the cable sends. It NEVER writes to the cable.
//
// WARNING: Close VCDS and any other program that uses the cable first. Only one program can
// open a HID device at a time.
//
// CAUTION: This script is read-only. It sends no bytes to the cable and no request to the car.
// It is safe to run with the cable connected to the car, or on a desk with no car.
//
// Run:  node tools/probe-rosstech.mjs
// Save: node tools/probe-rosstech.mjs > probe.txt 2>&1   (then give me probe.txt)

import HID from 'node-hid';

// The known Ross-Tech USB IDs, from the driver INF files in Software/installed/.
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

/** Print one byte buffer as a hex line and an ASCII line. */
function dump(buf) {
  const bytes = [...buf];
  const hexText = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = bytes.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
  console.log(`  bytes=${bytes.length}  hex: ${hexText}`);
  console.log(`              ascii: ${ascii}`);
}

function main() {
  console.log('=== Ross-Tech cable probe (read-only) ===');
  console.log(`node ${process.version} · platform ${process.platform} ${process.arch}`);
  console.log(`node-hid ${HID.version ? HID.version() : '(version unknown)'}`);
  console.log('');

  // Step 1: list every HID device, so we also see a cable with an ID we do not know.
  let all = [];
  try {
    all = HID.devices();
  } catch (e) {
    console.log('ERROR: cannot list HID devices:', e.message);
    console.log('On Linux, you may need a udev rule or sudo. On macOS, grant Input Monitoring.');
    return;
  }
  console.log(`Found ${all.length} HID device(s) in total.`);

  const match = (d) => ROSS_TECH.find((r) => r.vid === d.vendorId && r.pid === d.productId);
  const cables = all.filter(match);

  // Step 2: show any FTDI or ST device, even when the exact PID is new.
  const maybe = all.filter((d) => !match(d) && (d.vendorId === 0x0403 || d.vendorId === 0x0483));
  if (maybe.length) {
    console.log('');
    console.log('Note: these FTDI/ST devices are not in the known list (a new cable?):');
    for (const d of maybe) console.log(`  VID ${hx(d.vendorId)} PID ${hx(d.productId)}  ${d.product ?? ''} ${d.manufacturer ?? ''}`);
  }

  if (cables.length === 0) {
    console.log('');
    console.log('No known Ross-Tech cable found as a HID device.');
    console.log('If your cable is a HEX-V2 or HEX-NET, it should appear above.');
    console.log('An FTDI cable (HEX/KEY, Micro-CAN, Direct) is NOT a HID device on all systems,');
    console.log('so it may not show here even when it is plugged in. Tell me which cable you have.');
    return;
  }

  // Step 3: describe each cable we found.
  console.log('');
  console.log(`Found ${cables.length} Ross-Tech cable(s):`);
  for (const d of cables) {
    const r = match(d);
    console.log('');
    console.log(`  ${r.name}`);
    console.log(`    VID ${hx(d.vendorId)}  PID ${hx(d.productId)}`);
    console.log(`    manufacturer : ${d.manufacturer ?? '(none)'}`);
    console.log(`    product      : ${d.product ?? '(none)'}`);
    console.log(`    serial       : ${d.serialNumber ? '(present, hidden)' : '(none)'}`);
    console.log(`    release      : ${d.release}`);
    console.log(`    usagePage    : ${d.usagePage != null ? hx(d.usagePage) : '(n/a)'}  usage: ${d.usage != null ? hx(d.usage, 2) : '(n/a)'}`);
    console.log(`    interface    : ${d.interface}`);
  }

  // Step 4: open the first cable and read, with NO write.
  const target = cables[0];
  console.log('');
  console.log(`Opening ${match(target).name} to listen for ${READ_MS} ms (no data is sent)...`);
  let device;
  try {
    device = new HID.HID(target.path);
  } catch (e) {
    console.log('ERROR: cannot open the cable:', e.message);
    console.log('Close VCDS and any other tool that holds the cable, then run again.');
    return;
  }

  let count = 0;
  device.on('data', (buf) => {
    count++;
    console.log(`Input report #${count}:`);
    dump(buf);
  });
  device.on('error', (e) => console.log('read error:', e.message));

  setTimeout(() => {
    device.close();
    console.log('');
    if (count === 0) {
      console.log('The cable sent no data on its own. That is normal: most cables answer only');
      console.log('after a request. The IDs and the report descriptor above are still useful.');
    } else {
      console.log(`Done. The cable sent ${count} report(s). The byte lengths above are the HID report size.`);
    }
    console.log('Give me this whole output, and I will correct src/hal/ross-tech.ts.');
  }, READ_MS);
}

main();
