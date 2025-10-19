import type { CapacitorConfig } from '@capacitor/cli';

const rawEnv = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase();
const isProduction = rawEnv === 'production';

const DEFAULT_PRODUCTION_ORIGIN = 'https://app.production.example.com';
const hostedOrigin = process.env.CAPACITOR_PRODUCTION_URL ?? process.env.APP_HOSTED_ORIGIN ?? DEFAULT_PRODUCTION_ORIGIN;
const overrideUrl = process.env.CAPACITOR_SERVER_URL ?? process.env.APP_SERVER_URL;

const resolvedServerUrl = overrideUrl ?? (isProduction && hostedOrigin ? hostedOrigin : undefined);

const serverConfig: CapacitorConfig['server'] = {
  androidScheme: 'https',
  iosScheme: 'https',
  cleartext: false,
  ...(resolvedServerUrl ? { url: resolvedServerUrl } : {}),
};

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID ?? 'com.example.app',
  appName: process.env.CAPACITOR_APP_NAME ?? 'Example App',
  webDir: process.env.CAPACITOR_WEB_DIR ?? 'dist',
  server: serverConfig,
};

export default config;
