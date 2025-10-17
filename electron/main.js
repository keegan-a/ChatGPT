const { app, BrowserWindow, Menu, nativeImage } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const packagedIconPath = path.join(__dirname, '..', 'dist', 'icons', 'budget95-icon-512.png');
  let appIcon = undefined;
  try {
    if (require('fs').existsSync(packagedIconPath)) {
      appIcon = nativeImage.createFromPath(packagedIconPath);
    }
    if (!appIcon || appIcon.isEmpty()) {
      const fallbackPath = path.join(__dirname, '..', 'icons', 'budget95-icon-512x512.base64.txt');
      const raw = require('fs').readFileSync(fallbackPath, 'utf8').trim();
      const base64 = raw.includes(',') ? raw.split(',').pop() : raw;
      const buffer = Buffer.from(base64, 'base64');
      appIcon = nativeImage.createFromBuffer(buffer);
    }
  } catch (error) {
    console.warn('Unable to load icon for Electron window:', error);
  }

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#000000',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const fileUrl = `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
  const devServer = process.env.BUDGET95_DEV_SERVER || 'http://localhost:8000/';
  const startUrl = isDev ? devServer : fileUrl;

  window.loadURL(startUrl).catch((error) => {
    if (isDev) {
      console.warn(`Falling back to packaged assets because ${startUrl} was unreachable:`, error.message);
      return window.loadURL(fileUrl);
    } else {
      throw error;
    }
  });

  if (isDev) {
    window.webContents.openDevTools({ mode: 'detach' });
  }
}

const menuTemplate = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
