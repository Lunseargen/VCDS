Ross-Tech cable probe — for the Mac
===================================

This tool reads information from the Ross-Tech cable. It is READ-ONLY.
It sends nothing to the cable and nothing to the car. It cannot change the car.

What you do
-----------
1. Plug the cable into the Mac and into the car's diagnostic port.
2. Turn the car ignition on. The engine does not need to run.
3. Close VCDS and any other diagnostic program on the Mac.
4. Double-click the file  run-probe.command  in this folder.
5. A black Terminal window opens. Follow the text in it. Press Return when it asks.
6. The tool runs for a few seconds, then it saves a file in this folder with a name
   like  probe-output-2026-11-09T14-30-00.txt
7. Send that file to Jack.

The first time only
-------------------
- The Mac may ask you to install Node.js. The script opens the download page. Install the
  "LTS" version, then double-click run-probe.command again.
- The script downloads one small helper the first time, so it needs the internet once.
- The first time you open run-probe.command, the Mac may say it is from an unknown developer.
  To allow it: hold the Control key, click the file, choose Open, then click Open again.
- The Mac may ask for "Input Monitoring". Open System Settings > Privacy & Security >
  Input Monitoring, turn on Terminal, then run the tool again.

Which cable works
-----------------
- HEX-V2 and HEX-NET cables work well on the Mac.
- An older cable (HEX/KEY USB, Micro-CAN, Direct) may not appear. If the tool says it found
  no cable, tell Jack which cable you have.

Safety
------
This tool only reads. It does not clear faults. It does not change any setting in the car.
It is safe to run with the car connected.
