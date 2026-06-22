const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");

const DEV_URL = "http://localhost:3000";
const PROD_URL = `file://${path.join(__dirname, "../../web/out/index.html")}`;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1a1b1e",
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  mainWindow.loadURL(isDev ? DEV_URL : PROD_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  // Open external links in the default browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  // Build a minimal menu
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "PlanCraft",
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ])
  );
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
