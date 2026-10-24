// Petit serveur web local pour essayer l'application sur son ordinateur.
// Il n'a besoin de rien d'autre que Node.js.
//
// Utilisation, depuis le dossier omni-texte :
//   node outils/serveur.mjs
// puis ouvrir http://localhost:8000/omni-texte/ dans le navigateur.
//
// L'application est servie dans un sous-dossier (/omni-texte/), comme sur
// GitHub Pages : cela permet de vérifier que tous les chemins sont relatifs.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 8000;
const SOUS_DOSSIER = '/omni-texte/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const serveur = createServer(async (requete, reponse) => {
  const url = new URL(requete.url, 'http://localhost');
  if (!url.pathname.startsWith(SOUS_DOSSIER)) {
    reponse.writeHead(302, { Location: SOUS_DOSSIER });
    reponse.end();
    return;
  }
  let chemin = decodeURIComponent(url.pathname.slice(SOUS_DOSSIER.length)) || 'index.html';
  if (chemin.endsWith('/')) chemin += 'index.html';
  const fichier = normalize(join(RACINE, chemin));
  // Interdit de sortir du dossier de l'application.
  if (!fichier.startsWith(RACINE + sep) || fichier.includes(`${sep}node_modules${sep}`)) {
    reponse.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(fichier)).isFile()) throw new Error('pas un fichier');
    const contenu = await readFile(fichier);
    reponse.writeHead(200, {
      'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    reponse.end(contenu);
  } catch {
    reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Fichier introuvable');
  }
});

serveur.listen(PORT, () => {
  console.log(`Application disponible sur http://localhost:${PORT}${SOUS_DOSSIER}`);
  console.log('Pour arrêter : Ctrl+C dans cette fenêtre.');
});
