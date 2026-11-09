# ADR-002: TypeScript + Electron Platform

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| Status | Accepted |
| Decided by | Jack (user) |

## Context

The original VCDS is a Windows-only Win32 desktop application. The user wants a cross-platform
desktop app that runs on Windows, macOS, and Linux. Options included native (C++/Qt), hybrid
( Electron), and web (PWA). Electron was selected.

## Decision

Use TypeScript and Electron for the entire application. The Electron main process handles
hardware communication and feature logic. The renderer process uses React for the UI.
Electron-builder packages the app for all three platforms. Target bundle size is under 80MB.

## Consequences

- One codebase for all platforms.
- Web technologies (HTML/CSS/JS) speed up UI development.
- Electron bundle is larger than a native app but 80MB is acceptable for a diagnostic tool.
- TypeScript strict mode prevents runtime type errors.
- Large npm ecosystem provides HID, charting, and drag-and-drop libraries.

## Related

- [D1](../DECISIONS.md#d1), [D7](../DECISIONS.md#d7), [D9](../DECISIONS.md#d9)
- [S4](../PLAN.md#s-4)
- [adr-001](adr-001-hardware-abstraction.md)
