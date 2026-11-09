# DECISIONS.md

The decision log of the plan. [`PLAN.md`](PLAN.md) has the tasks; each row here links to the
work item that it affects. The notes of each finished stage are in `docs/stages/`.

Add a new row at the bottom. Do not change an old row: if a decision changes, add a new row
that names the old one. The one permitted change: when the user accepts a draft, remove
"Draft:" and add "(accepted <YYYY-MM-DD>)".

| # | Date | Decision | Reason | Affects |
|---|---|---|---|---|
| D1 | 2026-11-09 | Use TypeScript + Electron for the app platform | Cross-platform (Windows, macOS, Linux), web technologies for UI, large ecosystem for HID/Bluetooth and charting libraries | [1.1](PLAN.md#t-1-1) |
| D2 | 2026-11-09 | Hardware abstraction layer supports OBDLink Bluetooth and Ross-Tech USB-CAN with a unified TypeScript interface | User owns both adapters; abstraction lets features work with either without code changes | [2.1](PLAN.md#t-2-1) |
| D3 | 2026-11-09 | Use `node-hid` / `@nodert-win10-js/node-hid` for OBDLink Bluetooth HID communication | Proven npm package, supports all three platforms, wraps libusb/hidapi | [2.2](PLAN.md#t-2-2) |
| D4 | 2026-11-09 | Re-encode all VCDS data files to JSON/YAML as the canonical format | User chose re-encoding over read-only reuse or hybrid; JSON is human-readable, YAML is config-friendly, both work in Electron renderer and Node backend | [1.2](PLAN.md#t-1-2), [1.4](PLAN.md#t-1-4) |
| D5 | 2026-11-09 | Scope starts with VW and Audi vehicles only, framework is extensible to other VAG brands (Skoda, Seat, Porsche) | Keeps initial scope manageable; user said VW/Audi focused; .rod files and PID tables are brand-specific but share the same structure | [2.1](PLAN.md#t-2-1) |
| D6 | 2026-11-09 | VCDS.exeL is a standard PE32 executable (not a custom format) and can be treated as a black-box reference | Ghidra decompilation already provides source-level reference; we do not need to re-implement the PE loader | [1.4](PLAN.md#t-1-4) |
| D7 | 2026-11-09 | Shuffleboard dashboard uses a React-based widget system with drag-and-drop layout | Electron renderer is Chromium + React; drag-and-drop libraries (dnd-kit, react-grid-layout) are mature; matches FRC Shuffleboard mental model | [5.1](PLAN.md#t-5-1), [5.2](PLAN.md#t-5-2) |
| D8 | 2026-11-09 | Feature parity comes before new features; all 8 VCDS features must work one-to-one before shuffleboard launch | User explicitly stated this order; prevents scope creep | [3.1](PLAN.md#t-3-1)–[3.6](PLAN.md#t-3-6) |
| D9 | 2026-11-09 | Use Electron-builder for packaging, target bundle size <80MB | electron-builder supports all three platforms, tree-shaking, code signing; 80MB is a reasonable target for a diagnostic tool | [4.1](PLAN.md#t-4-1) |
| D10 | 2026-11-09 | Use the `node-hid` transport for the Ross-Tech USB-CAN cable. Accept the Ross-Tech licence risk for personal use with the owner's own cable. The RT-USB.dll path of ADR-001 is not used yet | Jack owns the cable and accepts the licence risk. Direct USB on macOS and Linux is allowed by task 2.3 process p1 | [2.3](PLAN.md#t-2-3) |
| D11 | 2026-11-09 | The 2.3 done-when uses a mocked `node-hid`. The hardware check of both adapters on a live vehicle moves to new task 2.4 | Jack's decision 2. A mocked test proves the code paths without a vehicle; the cable test is manual | [2.3](PLAN.md#t-2-3), [2.4](PLAN.md#t-2-4) |
| D12 | 2026-11-09 | The FM-3 gate (verify `DEFAULT_PID_TABLE` against VCDS on a live vehicle) moves to task 2.4. Task 2.3 passes with a test that maps frames through a table | Jack's decision 4. The draft table is not verified; the mapping code is tested in 2.3 | [2.3](PLAN.md#t-2-3), [2.4](PLAN.md#t-2-4) |
| D13 | 2026-11-09 | `getAdapter` keeps returning the 2.1 stubs in task 2.3. Wiring `getAdapter` to the real adapters moves to new task 2.5 | Jack's correction 5. The default to wire it in 2.3 was wrong: the OBDLink branch still returns the stub, and wiring changes OBDLink behaviour too | [2.3](PLAN.md#t-2-3), [2.5](PLAN.md#t-2-5) |
