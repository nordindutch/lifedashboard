import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codex.life',
  appName: 'Project Codex',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
    // WebView loads this URL (not frontend/dist). After you change the UI, deploy a fresh
    // `npm run build` to that host — otherwise the app keeps showing an old bundle (e.g. old login).
    url: 'https://codex.nordinkole.nl',
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_codex',
      iconColor: '#818cf8',
      sound: 'default',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
