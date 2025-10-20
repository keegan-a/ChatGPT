const { app, BrowserWindow, Menu, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const PRODUCTION_ORIGIN = process.env.BUDGET95_HOSTED_ORIGIN || 'https://app.budgetbuilder95.com/';

const BASE64_FALLBACK_MAP = {
  'budget95.ico': 'budget95.ico.base64',
  'budget95.icns': 'budget95.icns.base64',
  'budget95-512.png': 'budget95-512.png.base64',
};

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

  for (const candidate of platformCandidates) {
    const base64Source = BASE64_FALLBACK_MAP[candidate];
    if (!base64Source) {
      continue;
    }

    const sourcePath = path.join(sourceIcons, base64Source);
    try {
      if (fs.existsSync(sourcePath)) {
        const data = fs.readFileSync(sourcePath, 'utf8');
        const buffer = Buffer.from(data.replace(/\s+/g, ''), 'base64');
        if (buffer.length) {
          const icon = nativeImage.createFromBuffer(buffer);
          if (icon && !icon.isEmpty()) {
            return icon;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load base64 icon fallback:', sourcePath, error);
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
  const offlineFile = path.join(appPath, 'dist', 'offline.html');
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
    window.loadURL(PRODUCTION_ORIGIN).catch((error) => {
      console.error('Failed to reach hosted origin. Loading offline backup:', error);
      return window.loadFile(offlineFile).catch((offlineError) => {
        console.error('Unable to load offline screen:', offlineError);
      });
    });
  }

  if (isDev) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (isDev) {
      return;
    }
    console.warn('Renderer failed to load URL:', validatedURL, errorCode, errorDescription);
    window.loadFile(offlineFile).catch((error) => {
      console.error('Unable to load offline fallback after failure:', error);
    });
  });
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
  const contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://api.openai.com; img-src 'self' data: blob:; media-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [contentSecurityPolicy]
    };

    callback({ responseHeaders });
  });

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
