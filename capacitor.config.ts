import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playz.app', 
  appName: 'All in one', // 🎯 এখানে কোটেশন মার্কটি ঠিক করা হয়েছে
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
