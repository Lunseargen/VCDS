# VCDS Rebuild

## Hardware adapters

The hardware abstraction layer (HAL) is in `src/hal/`. The interface `HalInterface` is in `src/hal/interface.ts`.

- `RossTechUSBAdapter` in `src/hal/ross-tech.ts` uses `node-hid` to talk to the Ross-Tech USB-CAN cable. Decision D10 (2026-11-09) selects this transport for personal use with the owner's cable.
- `getAdapter` in `src/hal/interface.ts` still returns stubs. Decision D13 (2026-11-09) moves the wiring to the real adapters to task 2.5.

## Constructor options

`new RossTechUSBAdapter(options)` accepts these optional fields:

- `vendorId`: default `0x04d8`. NOT VERIFIED.
- `productId`: default `0x003a`. NOT VERIFIED.
- `pidTable`: default `DEFAULT_PID_TABLE`, eight CAN IDs. NOT VERIFIED.

The constructor throws `RangeError` if `pidTable` is empty. It also throws if an entry is not an integer in 0..0x1FFFFFFF.

The defaults are unverified. Task 2.4 checks them on a live cable and vehicle (decisions D11 and D12, 2026-11-09). Pass the verified IDs and table when they are known.

## CAUTION: read-only on a vehicle until task 2.5

Before task 2.5 passes, use only these calls on a real vehicle: `connect`, `scan`, `liveData`, `dtcRead`, `disconnect`.

Do not call `dtcClear`, `longCode`, `shortCode`, `adaptation`, or `rawCmd` on a real ECU. These write paths are not complete. Task 2.5 completes them (faults FM-10 and FM-12 in `PLAN.md`).

## Tests

- `npm test` runs the unit tests with Vitest. The tests mock `node-hid`. No hardware is needed.
- `npx tsc --noEmit` type-checks the project.

The six `it.fails` tests in `tests/hal/ross-tech.edge.test.ts` mark open faults. Task 2.5 removes the `.fails` marker for each fault that it fixes.
