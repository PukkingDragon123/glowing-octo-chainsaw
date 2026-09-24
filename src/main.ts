import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/silkscreen/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './ui/styles.css';
import { App } from './app/App';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && params.has('debug')) {
  void import('./debug').then((m) => m.showArtDebug(root));
} else {
  const app = new App(root);
  app.start();
}
