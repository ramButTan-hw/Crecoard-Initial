const { app, BrowserWindow, shell, Menu, ipcMain, screen, session, desktopCapturer, Notification } = require("electron");
const path = require("path");
const isDev = !app.isPackaged;

// The desktop app is a thin shell around the deployed web app — it loads the
// live site (not a bundled static export, which the app's API routes can't be
// exported into). CRECOARD_URL overrides the target (e.g. a staging deploy).
const BASE_URL = isDev
  ? "http://localhost:3000"
  : (process.env.CRECOARD_URL || "https://crecoard.com");

// Some GPU/driver combos refuse to composite hardware-accelerated windows that
// are re-parented into the desktop's WorkerW layer (wallpaper mode renders
// black). Setting CRECOARD_WALLPAPER_SOFTWARE=1 falls back to software
// rendering app-wide, which those setups can composite.
if (process.env.CRECOARD_WALLPAPER_SOFTWARE === "1") {
  app.disableHardwareAcceleration();
  console.log("[wallpaper] hardware acceleration disabled (CRECOARD_WALLPAPER_SOFTWARE=1)");
}

let mainWindow;

// ─── Deep links (crecoard://) — OAuth handoff from the system browser ─────────
// Sign-in opens the user's real browser; Supabase redirects back to
// crecoard://auth?... which Windows routes to this app.
const PROTOCOL = "crecoard";
if (isDev && process.platform === "win32") {
  // Unpackaged dev: register "electron.exe <app path>" as the protocol handler
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let pendingDeepLink = null; // cold start: hold the link until the window is ready

function handleDeepLink(url) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return;
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send("deep-link", url);
  } else {
    pendingDeepLink = url;
  }
}

// Windows delivers deep links to the second instance's argv — forward and quit
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    handleDeepLink(argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`)));
  });
  app.on("open-url", (event, url) => { // macOS
    event.preventDefault();
    handleDeepLink(url);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#1a1b1e",
    icon: path.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  mainWindow.loadURL(BASE_URL);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  // Cold-start deep link (app launched BY the crecoard:// link)
  mainWindow.webContents.once("did-finish-load", () => {
    const argvLink = process.argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`));
    const link = pendingDeepLink ?? argvLink;
    pendingDeepLink = null;
    if (link) mainWindow.webContents.send("deep-link", link);
  });

  // Open external links in the default browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

ipcMain.handle("open-external", (_event, url) => {
  // http(s) only — never shell-execute arbitrary strings from the renderer
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    return shell.openExternal(url);
  }
});

// ─── Native reminder notifications ────────────────────────────────────────────
// The renderer polls the user's due reminders (see DesktopReminders.tsx) and
// calls this to surface each as an OS toast. Clicking it focuses the app and
// tells the renderer where to navigate.
ipcMain.handle("notify", (_event, payload) => {
  try {
    if (!Notification.isSupported()) return { ok: false, error: "notifications unsupported" };
    const title = typeof payload?.title === "string" && payload.title ? payload.title : "Reminder";
    const body = typeof payload?.body === "string" ? payload.body : "";
    const url = typeof payload?.url === "string" ? payload.url : null;
    const n = new Notification({ title, body, icon: path.join(__dirname, "../assets/icon.png") });
    n.on("click", () => {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (url) mainWindow.webContents.send("reminder-click", url);
    });
    n.show();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle("window-maximize-toggle", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  }
  win.maximize();
  return true;
});

ipcMain.handle("window-is-maximized", () => {
  const win = BrowserWindow.getFocusedWindow();
  return !!win?.isMaximized();
});

ipcMain.handle("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// ─── Pop-out board window ─────────────────────────────────────────────────────
// A plain, resizable, borderless window that shows a board with its functions.
// No desktop-shell integration — just a normal floating window. Light and simple.
let popoutWindow = null;

const fs = require("fs");
function castStateFile() { return path.join(app.getPath("userData"), "popout.json"); }
function savePopoutState(boardId, sizeState) {
  try {
    if (boardId) fs.writeFileSync(castStateFile(), JSON.stringify({ boardId, ...sizeState }));
    else fs.rmSync(castStateFile(), { force: true });
  } catch {}
}
function readPopoutState() {
  try { return JSON.parse(fs.readFileSync(castStateFile(), "utf8")); } catch { return null; }
}

function destroyPopoutWindow() {
  if (popoutWindow) {
    try { popoutWindow.destroy(); } catch {}
    popoutWindow = null;
  }
}

function createPopoutWindow(boardId, saved) {
  destroyPopoutWindow();

  popoutWindow = new BrowserWindow({
    width: saved?.width ?? 1000,
    height: saved?.height ?? 680,
    x: saved?.x, y: saved?.y,
    minWidth: 360, minHeight: 280,
    frame: false,       // borderless
    resizable: true,    // ← the whole point
    movable: true,
    skipTaskbar: false, // it's a real window; show it in the taskbar
    backgroundColor: "#0d0e11",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false, // keep live wallpapers / visualizers animating while occluded
    },
  });

  const q = `board=${encodeURIComponent(boardId ?? "")}&popout=1`;
  popoutWindow.loadURL(`${BASE_URL}/wallpaper?${q}`);

  popoutWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[popout] page failed to load (${code} ${desc}) ${url}`);
  });

  // Persist size/position so the pop-out reopens where you left it
  const persist = () => {
    if (!popoutWindow) return;
    const b = popoutWindow.getBounds();
    savePopoutState(boardId ?? null, { x: b.x, y: b.y, width: b.width, height: b.height });
  };
  popoutWindow.on("resize", persist);
  popoutWindow.on("move", persist);
  popoutWindow.on("closed", () => { popoutWindow = null; });

  savePopoutState(boardId ?? null, saved);
  console.log("[popout] board window opened");
  return { ok: true };
}

// IPC names unchanged so preload / TopBar need no edits.
ipcMain.handle("wallpaper-set", (_event, boardId) => createPopoutWindow(boardId, readPopoutState()));
ipcMain.handle("wallpaper-clear", () => { destroyPopoutWindow(); savePopoutState(null); return { ok: true }; });
ipcMain.handle("wallpaper-active", () => !!popoutWindow);
// Frameless windows have no OS controls — the page's close button calls this.
ipcMain.handle("popout-minimize", () => { popoutWindow?.minimize(); });
ipcMain.handle("popout-toggle-top", () => {
  if (!popoutWindow) return false;
  const next = !popoutWindow.isAlwaysOnTop();
  popoutWindow.setAlwaysOnTop(next);
  return next;
});

app.on("before-quit", destroyPopoutWindow);

app.whenReady().then(() => {
  // Windows groups notifications/taskbar by AppUserModelID — match the packaged
  // appId so reminder toasts show as "Crecoard", not the Electron default.
  if (process.platform === "win32") app.setAppUserModelId("com.plancraft.app");

  // Allow the app's own pages to use the mic / audio capture (the Visualizer item).
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "audioCapture" || permission === "display-capture");
  });

  // System-audio Visualizer: auto-answer getDisplayMedia with the primary screen
  // (video, immediately discarded by the renderer) + Windows loopback audio —
  // so it visualizes whatever is playing on the PC, with no screen-share picker.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] })
      .then((sources) => callback({ video: sources[0], audio: process.platform === "win32" ? "loopback" : undefined }))
      .catch(() => callback({}));
  }, { useSystemPicker: false });

  createWindow();
  Menu.setApplicationMenu(null);
  // Reopen the last pop-out board, if one was open last session.
  const saved = readPopoutState();
  if (saved?.boardId) {
    setTimeout(() => createPopoutWindow(saved.boardId, saved), 1500);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
