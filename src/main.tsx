import { createRoot } from 'react-dom/client';
import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/eb-garamond';
import { App } from './ui/App.tsx';
import { mountGallery } from './gallery.ts';

const root = document.getElementById('root') as HTMLElement;
if (location.hash.startsWith('#gallery')) mountGallery(root);
else {
  createRoot(root).render(<App />);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is a bonus */ }); });
  }
}
