Ross-Tech cable probe — for the Mac
===================================

This app reads information from the Ross-Tech cable. It is READ-ONLY.
It sends nothing to the cable and nothing to the car. It cannot change the car.
You do not need to install Node.js. You do not need the Terminal.

Before you start
----------------
1. Check your Mac. Click the Apple menu, then "About This Mac".
   The app needs macOS 11 (Big Sur) or newer. Tell Jack the model and the macOS version
   if your Mac is older than macOS 11.

What you do
-----------
1. Open the file  Ross-Tech Probe-1.0.0-universal-mac.zip  (double-click it).
   The Mac makes the app  Ross-Tech Probe.  Drag it to the Desktop.
   (If Jack sent a .dmg file instead: double-click it, then drag the app to the Desktop.)
2. Plug the cable into the Mac and into the car's diagnostic port.
3. Turn the car ignition on. The engine does not need to run.
4. Close VCDS and any other diagnostic program on the Mac.
5. Open the app  Ross-Tech Probe  (see "The first time only" below).
6. Click "Run probe". Wait about 5 seconds.
7. Click "Save output". The file is saved on the Desktop with a name like
   probe-output-2026-11-09T14-30-00.txt
8. Send that file to Jack. You can also click "Copy" and paste the text in a message.

The first time only
-------------------
- The Mac says the app is from an unknown developer. This is normal: the app is not signed.
  To allow it: hold the Control key, click the app, choose Open, then click Open again.
  Or: open System Settings > Privacy & Security, scroll down, and click "Open Anyway".
- The Mac may ask for "Input Monitoring". Click Allow. Or open System Settings >
  Privacy & Security > Input Monitoring and turn on "Ross-Tech Probe". Then open the app again.

Which cable works
-----------------
- HEX-V2 and HEX-NET cables work well on the Mac.
- An older cable (HEX/KEY USB, Micro-CAN, Direct) may not appear. If the app says it found
  no cable, tell Jack which cable you have.

Safety
------
This app only reads. It does not clear faults. It does not change any setting in the car.
It is safe to run with the car connected.

Old route (only if the app does not open)
-----------------------------------------
The file  run-probe.command  in this folder still works if Node.js is installed.
