// Electron main process: window, local storage, Apple Health import, food database lookups
// and the --screenshot option used by automated checks.

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AppleHealthAggregator } from '../core/appleHealth';

const argv = process.argv.slice(1);
const shotIdx = argv.indexOf('--screenshot');
const screenshotPath = shotIdx >= 0 && argv[shotIdx + 1] ? path.resolve(process.cwd(), argv[shotIdx + 1]) : null;

if (screenshotPath) {
  // Keep automated runs away from the person's own saved data.
  app.setPath('userData', path.join(app.getPath('temp'), `beheart-screenshot-${process.pid}`));
}

function dataFile(): string {
  return path.join(app.getPath('userData'), 'beheart-data.json');
}

const USER_AGENT = 'BeHeart/0.1 (desktop health tracker)';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Food database answered ${res.status}`);
  return res.json();
}

function registerIpc(): void {
  ipcMain.handle('data:load', async () => {
    try {
      const raw = await fs.promises.readFile(dataFile(), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  ipcMain.handle('data:save', async (_e, data: unknown) => {
    await fs.promises.mkdir(path.dirname(dataFile()), { recursive: true });
    const tmp = dataFile() + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(data), 'utf8');
    await fs.promises.rename(tmp, dataFile());
    return true;
  });

  ipcMain.handle('data:location', () => dataFile());

  ipcMain.handle('data:export', async (_e, data: unknown) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export BeHeart data',
      defaultPath: 'beheart-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return null;
    await fs.promises.writeFile(res.filePath, JSON.stringify(data, null, 2), 'utf8');
    return res.filePath;
  });

  ipcMain.handle('health:import', async (_e, age: number) => {
    const win = BrowserWindow.getFocusedWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose your Apple Health export.xml',
      properties: ['openFile'],
      filters: [{ name: 'Apple Health export', extensions: ['xml'] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const agg = new AppleHealthAggregator();
    const rl = readline.createInterface({ input: fs.createReadStream(res.filePaths[0], { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) agg.line(line);
    return { file: path.basename(res.filePaths[0]), records: agg.records, used: agg.used, days: agg.result(age) };
  });

  ipcMain.handle('food:search', async (_e, query: string) => {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,generic_name,brands,nutriments`;
    const json = await fetchJson(url);
    return Array.isArray(json.products) ? json.products : [];
  });

  ipcMain.handle('food:barcode', async (_e, code: string) => {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,generic_name,brands,nutriments`;
    const json = await fetchJson(url);
    return json.status === 1 ? json.product : null;
  });

  ipcMain.handle('app:isScreenshot', () => screenshotPath != null);
  ipcMain.handle('app:startOptions', () => {
    const screenIdx = argv.indexOf('--screen');
    return {
      screen: screenIdx >= 0 ? argv[screenIdx + 1] ?? null : null,
      premium: argv.includes('--premium'),
    };
  });
}

function createWindow(): void {
  // --window 390x844 previews the iPhone layout (same React Native screens).
  const sizeArg = argv.indexOf('--window') >= 0 ? /^(\d+)x(\d+)$/.exec(argv[argv.indexOf('--window') + 1] ?? '') : null;
  const width = sizeArg ? Number(sizeArg[1]) : 1280;
  const height = sizeArg ? Number(sizeArg[2]) : 820;
  const win = new BrowserWindow({
    width,
    height,
    useContentSize: !!sizeArg,
    minWidth: sizeArg ? 320 : 1000,
    minHeight: sizeArg ? 480 : 640,
    title: 'BeHeart',
    backgroundColor: '#0B0F14',
    autoHideMenuBar: true,
    // Screenshot runs draw off-screen, so the picture is right even when the window is
    // started hidden, minimised or covered by other windows.
    ...(screenshotPath ? { show: false, paintWhenInitiallyHidden: true, useContentSize: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      ...(screenshotPath ? { offscreen: true, backgroundThrottling: false } : {}),
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'index.html'));

  if (screenshotPath) {
    // Count painted frames from the off-screen renderer and keep the latest one.
    let frames = 0;
    let lastFrame: Electron.NativeImage | null = null;
    win.webContents.setFrameRate(60);
    win.webContents.on('paint', (_e, _dirty, image) => {
      frames++;
      if (!image.isEmpty()) lastFrame = image;
    });

    const save = async () => {
      // Prefer a full capture; fall back to the last painted frame. Never save an empty picture.
      let image = await win.webContents.capturePage().catch(() => null);
      if (!image || image.isEmpty()) image = lastFrame;
      if (!image || image.isEmpty()) return false;
      await fs.promises.mkdir(path.dirname(screenshotPath), { recursive: true });
      // Write to a temporary file, then rename, so nobody can read a half-written PNG.
      const tmp = `${screenshotPath}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, image.toPNG());
      await fs.promises.rename(tmp, screenshotPath);
      console.log(`Saved screenshot to ${screenshotPath} (${image.getSize().width}x${image.getSize().height}, ${frames} frames)`);
      return true;
    };

    win.webContents.once('did-finish-load', () => {
      const started = Date.now();
      const tick = async () => {
        win.webContents.invalidate();
        // Wait for about 120 drawn frames (and at least 2 s so data and charts have settled).
        const ready = frames >= 120 && Date.now() - started >= 2000;
        const timedOut = Date.now() - started > 15000;
        if (ready || timedOut) {
          try {
            let ok = await save();
            for (let i = 0; !ok && i < 10; i++) {
              await new Promise((r) => setTimeout(r, 300));
              win.webContents.invalidate();
              ok = await save();
            }
            if (!ok) {
              console.error('Screenshot failed: nothing was drawn');
              process.exitCode = 1;
            }
          } catch (err) {
            console.error('Screenshot failed', err);
            process.exitCode = 1;
          }
          app.quit();
          return;
        }
        setTimeout(tick, 100);
      };
      setTimeout(tick, 500);
    });
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
