# How the Ross-Tech cable reads data

This document works out how VCDS reads data from the car. It uses public standards and the
clean files in `Software/installed/`. It does NOT extract any code from `VCDS.exeL`, because
that file is packed with Enigma Protector (2026-11-09).

Read this with `src/hal/ross-tech.ts`. The current code uses an OBD-II model. This document
shows that model is likely wrong for a VW car, and it gives the correct model.

## The two layers

The data path has two separate layers. Keep them apart.

| Layer | Link | Who defines it | State |
|---|---|---|---|
| 1. Transport | PC to cable, over USB | Ross-Tech (private) | Unknown. The probe must capture it. |
| 2. Diagnostic | Cable to car, over CAN | VW and ISO (public) | Known. This document gives it. |

Layer 1 is the cable's own USB framing. Nobody publishes it, and it sits behind the
protector. The read-only probe (`tools/probe-rosstech.mjs`) captures its real bytes at the
car. We do not guess it.

Layer 2 is the content that layer 1 carries. It follows public VW and ISO standards, so I can
give it now, with no capture and no extraction.

## Layer 1: the USB IDs (corrected)

The driver INF files in `Software/installed/` are plain text. They give the real USB IDs.

| Cable | Transport | VID | PID |
|---|---|---|---|
| HEX-V2 | USB HID | `0x0483` | `0xA0CB` |
| HEX-NET | USB HID | `0x0483` | `0xA00F` |
| HEX or KEY USB | FTDI serial | `0x0403` | `0xFA20` |
| Micro-CAN | FTDI serial | `0x0403` | `0xFA23` |
| Direct USB | FTDI serial | `0x0403` | `0xFA24` |

Source: `HEXNET.inf` and `RT-USB64.inf`.

The newer cables (HEX-V2, HEX-NET) are USB HID. `VCDS.exeL` imports `HID.DLL`, and
`VCIConfig.exe` uses `hidapi.dll`, which confirms the HID transport. The older cables use the
FTDI chip (`FTD2XX.dll`), which is a serial transport, not HID.

> **CAUTION:** The current `src/hal/ross-tech.ts` uses `0x04d8` / `0x003a`. Those IDs are
> wrong for every Ross-Tech cable above. Task 2.4 corrects them.

## Layer 2: the diagnostic protocol (public)

VCDS does not read a VW car the way a generic OBD-II scan tool does. It uses the VW stack.

### The transport sub-layer

- Older VW cars (the era of the logs here) use **VW TP2.0** on CAN. TP2.0 opens a channel to
  one ECU, then sends and receives messages on that channel. It splits a long message into
  several CAN frames. It is not ISO-TP.
- Newer VW cars use **ISO-TP** (ISO 15765-2) and UDS.

### The application sub-layer

| Function | Old cars: KWP2000 (ISO 14230) | New cars: UDS (ISO 14229) |
|---|---|---|
| Read a measuring block | service `0x21` ReadDataByLocalIdentifier, parameter = block number; reply `0x61` | service `0x22` ReadDataByIdentifier, 2-byte identifier; reply `0x62` |
| Read fault codes (DTC) | service `0x18` ReadDTCByStatus; reply `0x58` | service `0x19` ReadDTCInformation; reply `0x59` |
| Start a session | service `0x10` StartDiagnosticSession | service `0x10` DiagnosticSessionControl |

### Measuring blocks: the key point for this project

VW calls a group of live values a "measuring block". The block number is the parameter to
service `0x21`. For example, a request to read measuring block 1 of the engine is `0x21 0x01`,
and the reply begins with `0x61`, then the block data.

This explains the custom channel that Jack wants, `176.1/177.1`:

- `176` and `177` are **measuring block numbers** (groups).
- `.1` is **field 1** inside the block.
- So `176.1/177.1` divides field 1 of block 176 by field 1 of block 177.

A real read of that channel sends `0x21 0xB0` (176) and `0x21 0xB1` (177) on a TP2.0 channel
to the engine ECU, and divides the two decoded fields. The custom-channel engine in the
dashboard (`ui/src/custom/`) already does the division; the adapter must supply the two base
channels.

### Scan

A scan opens a TP2.0 channel to each ECU address in turn (for example `01` engine, `03` ABS,
`17` instruments) and reads the module identity. An address that answers is a present module.

## What this says about the current code

| Current code | The correct model | Action |
|---|---|---|
| USB IDs `0x04d8`/`0x003a` | HID `0x0483`/`0xA0CB` (HEX-V2) | Task 2.4 |
| ISO-TP on `0x7E0`/`0x7E8` with `DEFAULT_PID_TABLE` | TP2.0 channel + KWP2000 `0x21` block reads | Re-model in task 2.5 |
| `liveData` builds a frame from a guessed HID layout | The HID layout is layer 1; the probe gives it | Task 2.4 |
| `dtcRead` sends `0x19` (UDS) | Old VW cars use `0x18` (KWP2000) | Pick by car; task 2.5 |

## What is still unknown

Only **layer 1** (the cable's USB framing). Public sources do not have it, and I will not take
it from the protected binary. The probe at the car gives it. With the probe output plus this
layer-2 model, I can rewrite `src/hal/ross-tech.ts` correctly.

## Sources

- Ross-Tech HEX-V2 page (HID, no serial pass-through): https://www.ross-tech.com/vcds/hex-v2.php
- VW TP2.0 transport: https://jazdw.net/tp20
- PyVCDS (KWP2000 over VW transport, measuring blocks as `0x21` parameters):
  https://github.com/baconwaifu/PyVCDS
- KWP2000 service `0x21` / reply `0x61` (ISO 14230-3): https://www.ime-actia.de/en/vehicle-diagnostics/kwp-2000-on-k-line/
- aep/vag_reverse_engineering (UDS `0x22` capture): https://github.com/aep/vag_reverse_engineering/blob/master/LOG.md
- The USB IDs: `Software/installed/HEXNET.inf`, `Software/installed/RT-USB64.inf`
