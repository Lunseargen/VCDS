# ADR-004: Feature Parity Before New Features

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| Status | Accepted |
| Decided by | Jack (user) |

## Context

The user wants to rebuild all VCDS features one-to-one before adding new functionality. VCDS has
eight core features: scan, DTC read/clear, live data, long coding, short coding, adaptations,
labels/scaling, and TDI graph. The first new feature is the shuffleboard dashboard.

## Decision

Implement the eight VCDS features in stages S2 (hardware) and S3 (features) first. Each feature
must pass its integration test against a live vehicle or simulator before S4 (UI) and S5
(shuffleboard) begin. The shuffleboard dashboard is the first new feature and is the last stage.

## Consequences

- Prevents scope creep: new features do not delay the core rebuild.
- Each feature has a clear Done-when criterion in PLAN.md.
- The shuffleboard dashboard can use the already-tested HAL and features as its data source.
- If a feature has a bug, the gate fails and work stops until fixed.

## Related

- [D8](../DECISIONS.md#d8)
- [R3](../PLAN.md#rtm)–[R10](../PLAN.md#rtm)
- [adr-003](adr-003-json-yaml-reencoding.md)
