import { CapacitorConfig } from '@capacitor/cli';

const HOSTED_ORIGIN = process.env.BUDGET95_HOSTED_ORIGIN || 'https://app.budgetbuilder95.com/';
const DEV_SERVER = process.env.BUDGET95_DEV_SERVER || 'http://localhost:8000';

const useLocalServer = process.env.BUDGET95_CAP_USE_LOCAL === '1';

const config: CapacitorConfig = {
  appId: 'com.budgetbuilder.mobile',
  appName: 'Budget Builder 95',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: useLocalServer ? DEV_SERVER : HOSTED_ORIGIN,
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
};

export default config;
