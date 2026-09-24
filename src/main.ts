import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './ui/styles.css';
import { showViewer } from './viewer/Viewer';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function bootStore() {
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'STOCKING THE SHELVES…';
  document.body.appendChild(loading);
  if (!webglAvailable()) {
    loading.textContent = 'QR MARKET NEEDS WEBGL. TRY A NEWER BROWSER.';
    return;
  }
  // let the loading screen paint before the heavy scene build
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  const { App } = await import('./app/App');
  const app = new App(root);
  app.start();
  loading.remove();
}

async function main() {
  if (import.meta.env.DEV && params.has('debug')) {
    const m = await import('./debug');
    await m.showArtDebug(root);
    return;
  }
  const isViewer = await showViewer(root, () => void bootStore());
  if (!isViewer) await bootStore();
}

void main();
