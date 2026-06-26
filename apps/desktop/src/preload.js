const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window-maximize-toggle"),
  isWindowMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
});
