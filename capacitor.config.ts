import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codex.life',
  appName: 'Project Codex',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
    // Points the WebView at the live server instead of bundled assets.
    // This means the app always runs the latest version without an APK update.
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
