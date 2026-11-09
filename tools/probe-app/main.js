'use strict';
// Main process of the probe app. It runs the read-only probe and sends text lines to the window.
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const { runProbe } = require('./probe-core');

let running = false;
let lastOutput = '';

/** Create the main window. */
function createWindow() {
  const win = new BrowserWindow({
    width: 760,
    height: 720,
    title: 'Ross-Tech Probe',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

/** Return a date text that is safe to use in a file name. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

ipcMain.handle('probe:run', async (event) => {
  if (running) return { status: 'busy', reports: 0 };
  running = true;
  const lines = [];
  const log = (line) => {
    lines.push(line);
    if (!event.sender.isDestroyed()) event.sender.send('probe:line', line);
  };
  try {
    // node-hid loads here, so a load failure shows in the output and not as a crash.
    const HID = require('node-hid');
    return await runProbe({
      HID,
      log,
      env: { platform: process.platform, arch: process.arch, version: `Electron ${process.versions.electron}` },
    });
  } catch (e) {
    log(`ERROR: the probe could not start: ${e.message}`);
    return { status: 'start-error', reports: 0 };
  } finally {
    lastOutput = lines.join('\n') + '\n';
    running = false;
  }
});

ipcMain.handle('probe:save', async (event, text) => {
  const content = typeof text === 'string' && text.length ? text : lastOutput;
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('desktop'), `probe-output-${stamp()}.txt`),
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { saved: true, path: result.filePath };
});

ipcMain.handle('probe:copy', (event, text) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
