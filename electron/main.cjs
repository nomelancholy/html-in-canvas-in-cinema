const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// chrome://flags/#canvas-draw-element와 같은 Chromium 기능을 앱 자체에서
// 활성화합니다. 반드시 app.ready 이전에 호출해야 합니다.
app.commandLine.appendSwitch("enable-features", "CanvasDrawElement");

const isKiosk = process.env.HIC_KIOSK === "1";

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: "#080a0f",
    autoHideMenuBar: true,
    fullscreen: isKiosk,
    kiosk: isKiosk,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (process.env.HIC_SMOKE_TEST === "1") {
    window.webContents.once("did-finish-load", async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const initialScreenshotPath = path.join(app.getPath("temp"), "hic-electron-initial.png");
      fs.writeFileSync(initialScreenshotPath, (await window.webContents.capturePage()).toPNG());
      const target = await window.webContents.executeJavaScript(`(() => {
        const rect = document.querySelector('#html-source [data-answer="drawElementImage"]')?.getBoundingClientRect();
        return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
      })()`);
      if (target) {
        window.webContents.sendInputEvent({ type: "mouseDown", x: target.x, y: target.y, button: "left", clickCount: 1 });
        window.webContents.sendInputEvent({ type: "mouseUp", x: target.x, y: target.y, button: "left", clickCount: 1 });
        await new Promise((resolve) => setTimeout(resolve, 700));
        const transitionScreenshotPath = path.join(app.getPath("temp"), "hic-electron-transition.png");
        fs.writeFileSync(transitionScreenshotPath, (await window.webContents.capturePage()).toPNG());
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      const result = await window.webContents.executeJavaScript(`({
        title: document.title,
        nativeHtmlInCanvas: typeof document.querySelector('canvas')?.getContext('webgl2')?.texElementImage2D === 'function',
        runtimeLabel: document.querySelector('#runtime-status')?.textContent?.trim(),
        runtimeMode: document.documentElement.dataset.htmlInCanvas,
        reachedScene: document.querySelector('#html-source')?.dataset.scene,
        canvasSize: [document.querySelector('canvas')?.width, document.querySelector('canvas')?.height],
        webglError: document.querySelector('canvas')?.dataset.webglError,
        bodyTextLength: document.body.innerText.trim().length
      })`);
      const screenshotPath = path.join(app.getPath("temp"), "hic-electron-smoke.png");
      const screenshot = await window.webContents.capturePage();
      fs.writeFileSync(screenshotPath, screenshot.toPNG());
      console.log(`HIC_SMOKE_RESULT=${JSON.stringify({ ...result, chromium: process.versions.chrome, initialScreenshotPath, screenshotPath })}`);
      app.quit();
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
