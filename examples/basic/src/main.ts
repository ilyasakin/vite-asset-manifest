import './style.css';
import logoUrl from '../assets/logo.svg';

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const heading = document.createElement('h1');
  heading.textContent = 'vite-asset-manifest';

  const logo = document.createElement('img');
  logo.src = logoUrl;
  logo.alt = 'logo';
  logo.width = 64;

  const description = document.createElement('p');
  description.textContent =
    'Static-import CSS and SVG, plus a dynamic import below — all of them should appear in dist/manifest.json.';

  const status = document.createElement('p');
  status.id = 'lazy-status';
  status.textContent = 'loading lazy chunk…';

  app.append(heading, logo, description, status);
}

(async () => {
  const { greet } = await import('./lazy.js');
  const status = document.querySelector<HTMLElement>('#lazy-status');
  if (status) status.textContent = greet('vite-asset-manifest');
})();
