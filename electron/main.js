const { app, BrowserWindow, session, net } = require('electron');
const path = require('path');
const { URL } = require('url');

const DEFAULT_PROD_URL = 'https://app.budgetbuilder95.com/';
const DEFAULT_FALLBACK_URL = 'https://staging.budgetbuilder95.com/';
const DEFAULT_OFFLINE_PATH = '#/offline';
const DEFAULT_DEV_SERVER_URL = 'http://localhost:3000';
const OFFLINE_ERROR_CODES = new Set([
  -2,
  -3,
  -6,
  -7,
  -109,
  -118,
  -120,
  -137,
  -138,
  -310,
  -324,
  -501,
  -130,
  -105,
  -106,
]);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const PROD_URL = normalizeUrl(
  process.env.BUDGET_BUILDER_PROD_URL || DEFAULT_PROD_URL,
);
const FALLBACK_URL = normalizeUrl(
  process.env.BUDGET_BUILDER_FALLBACK_URL ||
    process.env.BUDGET_BUILDER_STAGING_URL ||
    DEFAULT_FALLBACK_URL,
);
const OFFLINE_PATH = process.env.BUDGET_BUILDER_OFFLINE_PATH || DEFAULT_OFFLINE_PATH;
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL ||
  process.env.ELECTRON_START_URL ||
  DEFAULT_DEV_SERVER_URL;

const DEFAULT_CSP = process.env.BUDGET_BUILDER_CSP || [
  "default-src 'self';",
  "base-uri 'self';",
  "connect-src 'self' https://app.budgetbuilder95.com https://staging.budgetbuilder95.com http://localhost:* ws://localhost:*;",
  "font-src 'self' data: https://fonts.gstatic.com;",
  "frame-ancestors 'none';",
  "frame-src 'self' https://app.budgetbuilder95.com https://staging.budgetbuilder95.com;",
  "img-src 'self' data: blob: https://app.budgetbuilder95.com https://staging.budgetbuilder95.com;",
  "media-src 'self' blob: data:;",
  "object-src 'none';",
  "script-src 'self' 'unsafe-eval' https://app.budgetbuilder95.com https://staging.budgetbuilder95.com http://localhost:*;",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
].join(' ');

let mainWindow;

function normalizeUrl(candidate) {
  if (!candidate) {
    return undefined;
  }

  try {
    const normalized = new URL(candidate);
    if (!normalized.pathname.endsWith('/')) {
      normalized.pathname = `${normalized.pathname}/`;
    }
    return normalized.toString();
  } catch (error) {
    console.warn('Invalid URL provided, falling back to default', candidate, error);
    return undefined;
  }
}

function applyContentSecurityPolicy() {
  const currentSession = session.defaultSession;
  if (!currentSession) {
    return;
  }

  currentSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['Content-Security-Policy'] = [DEFAULT_CSP];
    callback({
      cancel: false,
      responseHeaders,
    });
  });
}

async function waitForDevServer(url, { retries = 40, delay = 250 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await pingUrl(url);
      return;
    } catch (error) {
      if (attempt === retries) {
        console.error('Dev server never became available', error);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function pingUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: targetUrl, method: 'HEAD' });
    let completed = false;
    const finish = () => {
      if (!completed) {
        completed = true;
        resolve();
      }
    };
    request.on('response', (response) => {
      response.on('data', () => {});
      response.on('end', finish);
      response.on('error', (error) => {
        if (!completed) {
          reject(error);
        }
      });
      // In case HEAD isn't allowed fall back to success when status < 500.
      if (response.statusCode && response.statusCode < 500) {
        finish();
      }
    });
    request.on('error', (error) => {
      if (!completed) {
        reject(error);
      }
    });
    request.end();
  });
}

function installOfflineDetection(win, { primaryUrl, offlineUrl }) {
  if (!win || win.isDestroyed()) {
    return;
  }

  let showingOffline = false;
  let resolvedOfflineUrl = offlineUrl;

  const resetToPrimary = () => {
    if (showingOffline || !primaryUrl) {
      showingOffline = false;
    }
  };

  win.webContents.on('did-navigate', (_event, url) => {
    if (!/^https?:/i.test(url)) {
      return;
    }

    try {
      resolvedOfflineUrl = buildOfflineUrl(url);
    } catch (error) {
      console.warn('Failed to update offline URL after navigation', error);
    }
  });

  win.webContents.on('did-finish-load', () => {
    resetToPrimary();
    if (!win.isDestroyed()) {
      win.webContents.send('app:network-status', { online: true });
    }
  });

  win.webContents.on(
    'did-fail-load',
    async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (win.isDestroyed() || !isMainFrame) {
        return;
      }

      if (!OFFLINE_ERROR_CODES.has(errorCode)) {
        return;
      }

      if (showingOffline) {
        return;
      }

      showingOffline = true;
      try {
        win.webContents.send('app:network-status', {
          online: false,
          errorCode,
          errorDescription,
          url: validatedURL,
        });
      } catch (error) {
        console.warn('Failed to notify renderer about offline status', error);
      }

      if (resolvedOfflineUrl) {
        try {
          await win.loadURL(resolvedOfflineUrl, {
            userAgent: win.webContents.getUserAgent?.(),
          });
        } catch (loadError) {
          console.error('Unable to load offline fallback view', loadError);
        }
      }
    },
  );

  return {
    updateOfflineUrl: (nextOfflineUrl) => {
      resolvedOfflineUrl = nextOfflineUrl || resolvedOfflineUrl;
    },
  };
}

async function loadDevContent(win) {
  try {
    await waitForDevServer(DEV_SERVER_URL);
  } catch (error) {
    console.warn('Continuing despite dev server wait failure', error);
  }

  await win.loadURL(DEV_SERVER_URL);
  win.webContents.openDevTools({ mode: 'detach' });
}

async function loadHostedContent(win) {
  const primaryUrl = PROD_URL || DEFAULT_PROD_URL;
  const fallbackUrl = FALLBACK_URL && FALLBACK_URL !== primaryUrl ? FALLBACK_URL : undefined;
  const offlineUrl = buildOfflineUrl(primaryUrl);

  const offlineManager = installOfflineDetection(win, { primaryUrl, offlineUrl });

  try {
    await win.loadURL(primaryUrl);
  } catch (error) {
    console.error('Failed to load primary hosted application URL', error);
    if (fallbackUrl) {
      try {
        offlineManager?.updateOfflineUrl(buildOfflineUrl(fallbackUrl));
        await win.loadURL(fallbackUrl);
        return;
      } catch (fallbackError) {
        console.error('Failed to load fallback hosted application URL', fallbackError);
      }
    }
    throw error;
  }
}

function buildOfflineUrl(primaryUrl) {
  try {
    const url = new URL(primaryUrl);
    const offlineUrl = new URL(OFFLINE_PATH, url);
    return offlineUrl.toString();
  } catch (error) {
    console.warn('Failed to build offline URL, offline view disabled', error);
    return undefined;
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minHeight: 720,
    minWidth: 1024,
    show: false,
    backgroundColor: '#0b172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (isDev) {
    loadDevContent(window).catch((error) => {
      console.error('Unable to load development content', error);
    });
  } else {
    loadHostedContent(window).catch((error) => {
      console.error('Unable to load hosted content', error);
      window.webContents.send('app:network-status', {
        online: false,
        error: error.message,
      });
    });
  }

  return window;
}

app.on('ready', () => {
  applyContentSecurityPolicy();
  mainWindow = createMainWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
