import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/base.css';
import './styles/views.css';
import { createRoot } from 'react-dom/client';
import App from './App';

// Canvas-drawn artwork (case labels, floor stencils) uses the display face, so
// make sure it is loaded before the stage is built.
const fonts = [document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('600 20px "IBM Plex Mono"')];
const mount = () => createRoot(document.getElementById('root')!).render(<App />);
Promise.race([Promise.all(fonts), new Promise((r) => setTimeout(r, 1500))]).then(mount, mount);
