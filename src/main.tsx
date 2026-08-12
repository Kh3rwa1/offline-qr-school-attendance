import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').then(async () => {
    // Cache the Vite module graph after the first online load. This makes a
    // close/reopen cycle usable offline even though the initial page cannot
    // be controlled by the worker that it just installed.
    if (!('caches' in window)) return;
    const cache = await caches.open('attendance-pwa-v2');
    const urls = new Set(['/']);
    for (const entry of performance.getEntriesByType('resource')) {
      const url = new URL(entry.name);
      if (url.origin === window.location.origin && !url.pathname.startsWith('/api/')) urls.add(url.href);
    }
    await Promise.all(Array.from(urls).map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) await cache.put(url, response);
      } catch { /* offline after a successful initial install */ }
    }));
  }).catch(() => undefined);
}
