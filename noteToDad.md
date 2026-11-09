# A note for Dad

Thanks for the help. There is one job that needs the cable and the car, and there is one
thing you can look at for fun. This note tells you how to do both.

Everything here is **read-only**. Nothing changes the car. Nothing clears a fault. It is safe.

---

## Job 1: Probe the cable (this is the one I need)

This reads the cable so I can make the software talk to it. It needs the cable, the car, and
your Mac. It takes about 5 minutes.

### What you need

- The Ross-Tech cable (the HEX-V2, HEX-NET, or the older cable).
- The car.
- Your Mac.

### The steps

1. Plug the cable into the Mac and into the car's diagnostic port (under the dash, near the
   steering wheel).
2. Turn the car key to "on". The engine does not need to run.
3. Close VCDS and any other car program on the Mac.
4. Open the folder I sent you, named `handoff`.
5. Double-click the file `run-probe.command`.
6. A black window opens. Read it and press Return when it asks.
7. Wait a few seconds. The tool makes a file with a name like
   `probe-output-2026-11-09T14-30-00.txt`.
8. Send me that file (text me it, or email it).

That is all I need. Thank you.

### The first time only

- The Mac may ask you to install "Node.js". The tool opens the download page for you. Install
  the **LTS** version, then double-click `run-probe.command` again.
- The Mac may say the file is from an "unknown developer". To allow it: hold the **Control**
  key, click the file, choose **Open**, then click **Open** again.
- The Mac may ask for "Input Monitoring". Open **System Settings > Privacy & Security >
  Input Monitoring**, turn on **Terminal**, then run the tool again.
- The tool needs the internet the first time, to download one small helper.

### If it cannot find the cable

The newer cables (HEX-V2, HEX-NET) work best. An older cable may not show. If the tool says it
found no cable, text me which cable you have, and I will tell you the next step.

---

## Job 2 (optional): Look at the dashboard

This is the screen I am building. It runs on **example data**, so it does **not** need the car
or the cable. You can open it any time to see how it looks.

1. Open the main project folder (the one named `VCDS`).
2. Double-click `start-dashboard.command`.
3. The browser opens the dashboard on its own.
4. To stop it, close the black window.

The dashboard shows gauges, graphs, and numbers. You can drag a box to move it, or drag its
edge to make it bigger. This part is just for a look. The real car data comes later, after
Job 1.

---

## One more time: it is safe

The probe only **reads**. It sends nothing to the cable and nothing to the car. It cannot
change a setting, and it cannot clear a fault. You can run it with the car connected.

Thank you, Dad.
