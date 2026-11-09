# GLOSSARY.md

Project terms resolved during the grill session. See the project-plan skill, `references/requirements.md`.

| Term | Definition | First used |
|---|---|---|
| VCDS | Visual Diagnosis and Diagnostic Scanner — Ross-Tech diagnostic software for VAG vehicles | Goal |
| VCDS.exeL | Standard PE32 Windows executable (~3MB); ".exeL" is Ross-Tech naming, not a custom format | [D6](DECISIONS.md) |
| Shuffleboard | FRC-style real-time dashboard with configurable widgets (gauges, bars, switches, text); the first new feature | Goal |
| HAL | Hardware Abstraction Layer — TypeScript interface that unifies OBDLink Bluetooth and Ross-Tech USB-CAN adapters | [D2](DECISIONS.md) |
| OBDLink | Bluetooth OBD2 adapter using HID protocol; wrapped by `node-hid` npm package | [D3](DECISIONS.md) |
| Ross-Tech USB-CAN | USB-to-CAN cable from Ross-Tech; uses RT-USB.dll (userspace) and RT-USB64.sys (Windows kernel driver) | [D2](DECISIONS.md) |
| .rod | Ross-Tech OBD2 Data file — XML-like sections: [CMP] codings, [ADP] adaptations, [DTC] codes, [IDN] identification | [D4](DECISIONS.md) |
| .lbl | Label file — maps OBD2 address codes to human-readable label entries | [D4](DECISIONS.md) |
| .SCL | Scaling file — comma-separated PID-to-unit/range/step mappings for value conversion | [D4](DECISIONS.md) |
| Codes.dat | 1.6MB binary file containing DTC definitions; 0x00000000 prefixed entries reference internal codes | [D4](DECISIONS.md) |
| AutoScan.txt | Text file with 300+ chassis type definitions in comma-separated format (code, name, version) | [D4](DECISIONS.md) |
| VAG | Volkswagen Ag Gruppe — the vehicle group including VW, Audi, Skoda, Seat, Porsche, Bentley | [D5](DECISIONS.md) |
| PID | Parameter ID — 4-byte identifier for a specific sensor or value in OBD2/UDS protocol | R3 |
| ECU | Electronic Control Unit — each diagnostic module in the vehicle (Engine, ABS, Transmission, etc.) | R3 |
| CAN | Controller Area Network — the vehicle bus protocol for ECU communication | R2 |
| UDS | Unified Diagnostic Services (ISO 14229) — the diagnostic protocol layer over CAN used by modern VAG vehicles | R3 |
| RTM | Requirements Traceability Matrix — links each requirement to tasks and tests | Goal |
| FMEA | Failure Mode and Effects Analysis — rates each failure mode by Severity, Occurrence, Detection (S×O×D = RPN) | Goal |
