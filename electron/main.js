const { app, BrowserWindow, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function resolveIcon() {
  const distIcons = path.join(__dirname, '..', 'dist', 'icons');
  const sourceIcons = path.join(__dirname, '..', 'icons');

  const platformCandidates = process.platform === 'win32'
    ? ['budget95.ico', 'budget95-512.png']
    : process.platform === 'darwin'
      ? ['budget95.icns', 'budget95-512.png']
      : ['budget95-512.png', 'budget95.ico'];

  for (const directory of [distIcons, sourceIcons]) {
    for (const filename of platformCandidates) {
      const candidate = path.join(directory, filename);
      try {
        if (fs.existsSync(candidate)) {
          const icon = nativeImage.createFromPath(candidate);
          if (icon && !icon.isEmpty()) {
            return icon;
          }
        }
      } catch (error) {
        console.warn('Failed to load icon candidate:', candidate, error);
      }
    }
  }

  return undefined;
}

function createWindow() {
  const appIcon = resolveIcon();

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#000000',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const appPath = app.getAppPath();
  const indexFile = path.join(appPath, 'dist', 'index.html');
  console.log('getAppPath:', appPath);
  console.log('index path:', indexFile);
  const devServer = process.env.BUDGET95_DEV_SERVER || 'http://localhost:8000/';
  if (isDev) {
    window.loadURL(devServer).catch((error) => {
      console.warn(`Falling back to packaged assets because ${devServer} was unreachable:`, error.message);
      return window.loadFile(indexFile);
    }).catch((error) => {
      console.error('Failed to load local assets in development mode:', error);
    });
  } else {
    window.loadFile(indexFile).catch((error) => {
      console.error('Failed to load packaged assets:', error);
    });
  }

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
