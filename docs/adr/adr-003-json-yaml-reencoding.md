# ADR-003: JSON/YAML Re-encoding of Data Files

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| Status | Accepted |
| Decided by | Jack (user) |

## Context

VCDS uses multiple proprietary and text-based data file formats: Codes.dat (binary), AutoScan.txt
(text), .rod (XML-like), .lbl (commented text), .SCL (CSV), .cfg (key-value). The original app
reads these formats directly. The user wants to re-encode all files to JSON/YAML as the canonical
format for the rebuilt app.

## Decision

Build parsers that read each original format and convert to JSON/YAML. Store the converted files
in `data/`. The rebuilt app reads JSON/YAML instead of the original formats. Parsers are written
in Python for the initial conversion but the TypeScript app can also re-parse originals if needed.

## Consequences

- JSON is human-readable and easy to version-control.
- YAML is suitable for configuration files that users may edit by hand.
- Round-trip testing ensures no data loss during conversion.
- The original files remain in `Software/installed/` for reference and for the parsers.
- Ghidra decompilation output provides a reference for the Codes.dat binary structure.

## Related

- [D4](../DECISIONS.md#d4)
- [S1](../PLAN.md#s-1)
- [adr-004](adr-004-feature-parity-then-innovation.md)
