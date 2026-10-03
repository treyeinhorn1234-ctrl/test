import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/jacquard-24/400.css';
import './ui/styles/main.css';
import { Game } from './core/Game';
import { installUiArt } from './ui/pixelArt';
import { showSpriteViewer } from './dev/spriteViewer';
import { loadImages } from './assets/images/registry';

/**
 * ASHEN CROWN — point d'entrée.
 * `?debug=sprites` affiche le visualiseur de planches de sprites.
 */
const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

/** Taille d'un pixel d'interface : entier, proportionnel à la fenêtre. */
function updateUiScale(): void {
  const u = Math.max(2, Math.min(4, Math.floor(window.innerHeight / 400)));
  document.documentElement.style.setProperty('--u', `${u}px`);
}

await loadImages();

if (params.get('debug') === 'sprites') {
  showSpriteViewer(app);
} else {
  installUiArt();
  updateUiScale();
  window.addEventListener('resize', updateUiScale);
  const game = new Game(app);
  game.start();
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
}
