import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playz.app', // আপনার অ্যাপের আইডি যেমন আছে তেমনই রাখবেন
  appName: 'PlayZ', // আপনার অ্যাপের নাম
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  // 🎯 এই প্লাগিন অংশটুকু যোগ করুন (এটাই CORS বাইপাস করবে)
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
