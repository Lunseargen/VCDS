'use strict';
// Preload script. It gives the window a small, fixed set of functions.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('probe', {
  run: () => ipcRenderer.invoke('probe:run'),
  save: (text) => ipcRenderer.invoke('probe:save', text),
  copy: (text) => ipcRenderer.invoke('probe:copy', text),
  onLine: (callback) => {
    ipcRenderer.on('probe:line', (_event, line) => callback(line));
  },
});
