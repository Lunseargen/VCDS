# ADR-001: Hardware Abstraction Layer Design

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| Status | Accepted |
| Decided by | Jack (user) |

## Context

VCDS communicates with vehicle ECUs through multiple hardware adapters. The user owns both the
OBDLink Bluetooth adapter and the Ross-Tech USB-CAN cable. The original VCDS software has
adapter-specific code paths mixed into every feature.

## Decision

We introduce a Hardware Abstraction Layer (HAL) as a TypeScript interface that defines eight
core methods: `scan`, `dtcRead`, `dtcClear`, `liveData`, `longCode`, `shortCode`,
`adaptation`, and `rawCmd`. Two adapter implementations (OBDLink and Ross-Tech) implement this
interface. A factory creates the correct adapter based on user configuration.

## Consequences

- Features call the HAL interface and do not know which adapter is active.
- Adding a third adapter requires only a new implementation class.
- OBDLink uses `node-hid` for Bluetooth HID; Ross-Tech uses `RT-USB.dll` (userspace,
  cross-platform).
- The Ross-Tech Windows kernel driver (RT-USB64.sys) is used when available but is not
  required.

## Related

- [D2](../DECISIONS.md#d2), [D3](../DECISIONS.md#d3)
- [S2](../PLAN.md#s-2)
- [adr-002](adr-002-typescript-electron-platform.md)
