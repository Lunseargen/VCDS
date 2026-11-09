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
- Your Mac. It must run macOS 11 (Big Sur) or newer. To check: click the Apple menu, then
  **About This Mac**. If your Mac is older, text me the model and the version.
- The file `Ross-Tech Probe-1.0.0-universal-mac.zip` that I sent you.

You do not need to install anything else. You do not need the Terminal.

### The steps

1. Double-click the `.zip` file. The Mac makes an app named **Ross-Tech Probe**. Drag the app
   to the Desktop.
2. Plug the cable into the Mac and into the car's diagnostic port (under the dash, near the
   steering wheel).
3. Turn the car key to "on". The engine does not need to run.
4. Close VCDS and any other car program on the Mac.
5. Open the app **Ross-Tech Probe** (see "The first time only" below).
6. Click **Run probe**. Wait about 5 seconds.
7. Click **Save output**. The file goes to the Desktop with a name like
   `probe-output-2026-11-09T14-30-00.txt`.
8. Send me that file (text me it, or email it). Or click **Copy** and paste the text in a message.

That is all I need. Thank you.

### The first time only

- The Mac may say the app is from an "unknown developer". This is normal. To allow it: hold the
  **Control** key, click the app, choose **Open**, then click **Open** again. Or open
  **System Settings > Privacy & Security**, scroll down, and click **Open Anyway**.
- The Mac may ask for "Input Monitoring". Click **Allow**. Or open **System Settings >
  Privacy & Security > Input Monitoring**, turn on **Ross-Tech Probe**, then open the app again.

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

## Job 3 (optional): Use your Claude to go further

You have Claude too. Claude can read this project and the probe file, and work out the next
step to make the cable talk to the car. You do not need to know the code. You give Claude the
files and one instruction, and Claude does the work.

> **CAUTION:** The write parts of this software are not finished. A wrong command can change a
> setting in the car. Tell Claude to stay **read-only**. Do not let Claude send any command to
> the car until Jack checks the work first.

### The steps

1. Finish Job 1 first. You need the `probe-output-...txt` file.
2. Open the main project folder (the one named `VCDS`).
3. Open Claude on that folder:
   - In the Claude app: start a new chat, then drag the `VCDS` folder into the chat.
   - Or, in Claude Code (the terminal tool): open the Terminal, type `cd ` and a space, drag
     the `VCDS` folder onto the window, press Return, then type `claude` and press Return.
4. Also give Claude the `probe-output-...txt` file from Job 1 (drag it in, or tell Claude the
   file name).
5. Copy the instruction below and paste it to Claude.

### The instruction to paste

```
I have a Ross-Tech VCDS cable and this project. Read docs/hardware/rosstech-protocol.md
and the probe-output file I gave you. Work out the cable's USB framing (Layer 1) from the
probe output. Then tell me, in plain words, what you found and what the next step is.

Rules:
- Stay read-only. Do not send any command to the cable or the car.
- Do not change src/hal/ross-tech.ts yet. Only explain the plan.
- Do not try to open or decode the protected VCDS.exeL file.

When you have the plan, write it to a new file named docs/hardware/next-step.md, and tell me
to send that file to Jack.
```

6. When Claude finishes, send me the new file `docs/hardware/next-step.md`. I take it from there.

This part is optional. Job 1 is the one I really need. Job 3 only helps me go faster.

---

## One more time: it is safe

The probe only **reads**. It sends nothing to the cable and nothing to the car. It cannot
change a setting, and it cannot clear a fault. You can run it with the car connected.

Thank you, Dad.
