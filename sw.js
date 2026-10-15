// Service worker : garde une copie de l'application sur l'appareil pour
// qu'elle fonctionne sans connexion internet.
//
// - À l'installation, tous les fichiers de la liste FICHIERS sont copiés
//   dans un cache dont le nom contient la version (ex. « plume-1.0.0 »).
// - Ensuite, chaque fichier est servi depuis ce cache (« cache d'abord »).
// - Quand la version change dans js/config.js, le navigateur détecte ce
//   service worker modifié, prépare le nouveau cache, et l'application
//   propose « Recharger ». Les anciens caches de CETTE application sont
//   alors supprimés (jamais ceux des autres applications du même site).

importScripts('js/config.js');

const CONFIG = self.CONFIG_APP;
const PREFIXE = `${CONFIG.idStockage}-`;
const CACHE = `${PREFIXE}${CONFIG.version}`;

// Liste de tous les fichiers de l'application (à tenir à jour si l'on en
// ajoute un : le test tests/hors-ligne.spec.js le vérifie).
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/polices.css',
  'css/themes.css',
  'css/base.css',
  'css/redaction.css',
  'css/print.css',
  'js/config.js',
  'js/app.js',
  'js/barre-outils.js',
  'js/documents.js',
  'js/editor.js',
  'js/historique.js',
  'js/impression.js',
  'js/mise-en-forme.js',
  'js/palettes.js',
  'js/paragraphes.js',
  'js/pwa.js',
  'js/sanitize.js',
  'js/selection.js',
  'js/storage.js',
  'js/theme.js',
  'js/tiroir-documents.js',
  'js/ui.js',
  'assets/logo-omni-systeme.webp',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-192.png',
  'icons/icone-maskable-512.png',
  'fonts/oxanium-latin-500-normal.woff2',
  'fonts/oxanium-latin-700-normal.woff2',
  'fonts/oxanium-latin-800-normal.woff2',
  'fonts/oxanium-latin-ext-500-normal.woff2',
  'fonts/oxanium-latin-ext-700-normal.woff2',
  'fonts/oxanium-latin-ext-800-normal.woff2',
  'fonts/literata-latin-400-normal.woff2',
  'fonts/literata-latin-400-italic.woff2',
  'fonts/literata-latin-600-normal.woff2',
  'fonts/literata-latin-600-italic.woff2',
  'fonts/literata-latin-ext-400-normal.woff2',
  'fonts/literata-latin-ext-400-italic.woff2',
  'fonts/literata-latin-ext-600-normal.woff2',
  'fonts/literata-latin-ext-600-italic.woff2',
  'fonts/jetbrains-mono-latin-400-normal.woff2',
  'fonts/jetbrains-mono-latin-400-italic.woff2',
  'fonts/jetbrains-mono-latin-700-normal.woff2',
  'fonts/jetbrains-mono-latin-700-italic.woff2',
  'fonts/jetbrains-mono-latin-ext-400-normal.woff2',
  'fonts/jetbrains-mono-latin-ext-400-italic.woff2',
  'fonts/jetbrains-mono-latin-ext-700-normal.woff2',
  'fonts/jetbrains-mono-latin-ext-700-italic.woff2',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) =>
      // « reload » : on contourne le cache HTTP pour être sûr d'avoir les
      // fichiers de la nouvelle version.
      cache.addAll(FICHIERS.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        if (nom.startsWith(PREFIXE) && nom !== CACHE) await caches.delete(nom);
      }
      await self.clients.claim();
    })(),
  );
});

// L'application demande l'activation de la nouvelle version (bouton « Recharger »).
self.addEventListener('message', (evenement) => {
  if (evenement.data?.type === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin || !requete.url.startsWith(self.registration.scope)) return;

  evenement.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (requete.mode === 'navigate') {
        // Toute page de l'application affiche index.html.
        const page = (await cache.match('./')) ?? (await cache.match('index.html'));
        if (page) return page;
        return fetch(requete);
      }
      const enCache = await cache.match(requete, { ignoreSearch: true });
      return enCache ?? fetch(requete);
    })(),
  );
});
