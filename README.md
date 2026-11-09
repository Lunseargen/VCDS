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

## Protocol notes

`docs/hardware/rosstech-protocol.md` works out how VCDS reads a VW car (2026-11-09). It uses
public standards only. It gives the correct USB IDs, and it shows that VCDS uses VW TP2.0 plus
KWP2000 service `0x21` for measuring blocks, not the OBD-II model in the current code.

`tools/probe-rosstech.mjs` is a read-only probe. Run it at the car with
`node tools/probe-rosstech.mjs > probe.txt 2>&1`. It finds the cable and reads what the cable
sends. It writes nothing to the cable or the car.

`tools/handoff/` is a hand-off copy of the probe for a non-technical user on a Mac. The user
double-clicks `run-probe.command`. The script checks Node.js, installs `node-hid` the first
time, runs the probe, and saves `probe-output-<date>.txt`. `README.txt` gives the steps. The
HEX-V2 and HEX-NET cables work on macOS; an older FTDI cable may not appear.

## Shuffleboard preview (simulated data)

`npm run dev:ui` starts the dashboard at http://localhost:5175/ (decision D14, 2026-11-09). It needs no vehicle: `SimulatedAdapter` (`src/hal/sim.ts`) gives the data through `liveData()` at 10 Hz.

**One-click start.** `run.sh` (macOS and Linux) and `start-dashboard.command` (Mac double-click) do the same thing without a terminal command: they check Node.js, install the libraries the first time, start the server, and open the browser. Press Control-C, or close the window, to stop.

- **Data.** When the server starts, `ui/logsPlugin.ts` reads the VCDS logs in each top-level `<4 digits>-*` directory (for example `2010-Q7/`), or in the comma list in `VCDS_LOG_DIRS`. The first CSV measuring-block log loops as the log channels (`093.1`, `176.1`, ...). The first scan log gives the modules and the fault memory. The `sim.*` channels are a synthetic 120 s drive cycle. The logs never go into git.
- **Auto-Scan.** The Modules panel lists every module from the scan log. **Scan all modules** reads the fault memory of each module. It then shows a summary (`Scanned N modules. Found M faults in K modules.`) and groups the DTCs under their module, each with a fault count. A module with no faults shows `No faults`. A fault opens to show its freeze frame. The scan runs on the simulated scan log (2026-11-09).
- **Views.** The select at the right of each widget header changes the view: Gauge, Bar, Lamps, Number, or Graph.
- **Layout.** Drag the header to move a widget. Drag the right side, the bottom, or the corner to resize it. **Edit** adds a widget, changes its channel, or removes it. The browser keeps the layout in localStorage (`vcds.shuffleboard.v1`).
- **Custom channels.** **Custom channels** makes a channel from a formula over other channels, for example `[176.1] / [177.1]`. Write each channel key in square brackets. The formula accepts numbers, `+ - * /`, parentheses, `abs`, `sqrt`, `min`, and `max` (`ui/src/custom/expr.ts`, no `eval`). A formula can read only log and synthetic channels, not other custom channels. A division by 0 shows `–`. An empty min or max is found from the data. The browser keeps the channels in localStorage (`vcds.shuffleboard.custom.v1`).
- **CSV.** **Save data CSV** saves each recorded read of all the channels, custom channels included (column 1 is the simulation time in seconds). The recorder keeps the last 100 000 reads (2.8 h at 10 Hz). **Clear recording** starts again. **Save faults CSV** saves the fault memory with the status and the freeze frames.
- **Theme.** The light theme is the default (2026-11-09). The **Dark theme** button changes it. The browser keeps the choice in localStorage (`vcds.shuffleboard.theme`).
- **Limits.** The VCDS label files (`.clb`) are encrypted, and the licence does not permit decryption (D10). So the log channels have the names `Group X / field N`.

## Tests

- `npm test` runs the unit tests with Vitest. The tests mock `node-hid`. No hardware is needed.
- `npx tsc --noEmit` type-checks the project. `npm run typecheck:ui` type-checks the dashboard.

The six `it.fails` tests in `tests/hal/ross-tech.edge.test.ts` mark open faults. Task 2.5 removes the `.fails` marker for each fault that it fixes.
