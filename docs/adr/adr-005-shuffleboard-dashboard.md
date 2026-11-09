# ADR-005: Shuffleboard Dashboard Architecture

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| Status | Accepted |
| Decided by | Jack (user) |

## Context

The user wants a shuffleboard-style dashboard inspired by FRC (First Robotics Competition)
Shuffleboard. The dashboard plots real-time car data with gauges, bar graphs, switches, and text
displays. It should support preset module layouts and custom drag-and-drop panels.

## Decision

Build the dashboard as a React-based widget system inside the Electron renderer. Use
`react-grid-layout` or `dnd-kit` for drag-and-drop. Each widget subscribes to the live data
stream via IPC from the main process. Update latency target is under 200ms. Four widget types:
gauge (circular), bar (vertical/horizontal), switch (on/off toggle), text (large value + unit).
Preset layouts are stored as JSON and can be extended by the user.

## Consequences

- React fits naturally within Electron's renderer process.
- Drag-and-drop libraries are mature and well-documented.
- Widget virtualization keeps rendering fast with many widgets.
- Preset layouts are portable JSON files.
- The dashboard updates at the same rate as the live data panel (≥10 Hz) but with separate
  rendering to avoid blocking.

## Related

- [D7](../DECISIONS.md#d7)
- [R11](../PLAN.md#rtm), [R12](../PLAN.md#rtm)
- [S5](../PLAN.md#s-5)
- [adr-002](adr-002-typescript-electron-platform.md)
