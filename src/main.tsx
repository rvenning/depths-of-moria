import { createRoot } from 'react-dom/client';
import '@fontsource/jersey-15';
import { preloadPixelIcons } from './art/icons.ts';
import { loadRenderedBackdrops } from './art/backgrounds.ts';
import { App } from './ui/App.tsx';
import { mountGallery } from './gallery.ts';

const root = document.getElementById('root') as HTMLElement;

// a code chunk that cannot be fetched (the site was redeployed under an open page, or the connection dropped) is fixed by loading the current build; once only, so a real outage cannot loop
window.addEventListener('vite:preloadError', (ev) => {
  ev.preventDefault();
  try { if (sessionStorage.getItem('dom-reloaded')) return; sessionStorage.setItem('dom-reloaded', String(Date.now())); } catch { /* no storage: reload anyway */ }
  location.reload();
});
setTimeout(() => { try { sessionStorage.removeItem('dom-reloaded'); } catch { /* ignore */ } }, 20000);
if (location.hash.startsWith('#gallery')) void loadRenderedBackdrops().then(() => mountGallery(root));
else {
  // the pixel icons are rasterised once up front (a moment), so the first paint already has them
  void Promise.race([Promise.all([preloadPixelIcons(), loadRenderedBackdrops()]), new Promise((r) => setTimeout(r, 1500))]).then(() => { createRoot(root).render(<App />); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is a bonus */ }); });
  }
}
