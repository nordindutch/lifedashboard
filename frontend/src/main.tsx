import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { scheduleMoodNotifications } from './lib/moodNotifications';
import './index.css';

const isCapacitor =
  typeof window !== 'undefined' &&
  typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';

if (isCapacitor) {
  void (async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // non-critical
    }
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

void scheduleMoodNotifications();
