// Fabrication et lecture d'archives ZIP, sans bibliothèque.
//
// Un fichier Word (.docx) est en réalité une archive ZIP qui contient
// plusieurs fichiers texte (XML).
// - creerZip assemble ces fichiers en une archive. Ils sont stockés sans
//   compression : c'est plus simple, toujours accepté par Word, et la taille
//   reste raisonnable pour du texte.
// - lireZip ouvre une archive (fichiers stockés tels quels ou compressés avec
//   « deflate », la méthode de Word, Google Docs et LibreOffice). La
//   décompression utilise DecompressionStream, intégré aux navigateurs.
// Commun à la suite (le futur tableur pourra s'en servir pour .xlsx).

// Table de calcul du CRC-32 (somme de contrôle exigée par le format ZIP).
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date et heure au format MS-DOS, utilisé dans les archives ZIP. */
function dateDos(date) {
  return {
    heure: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    jour: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Crée une archive ZIP.
 * @param {{nom: string, contenu: string | Uint8Array}[]} fichiers
 * @param {string} type  type MIME de l'archive produite
 * @returns {Blob}
 */
export function creerZip(fichiers, type = 'application/zip', date = new Date()) {
  const encodeur = new TextEncoder();
  const { heure, jour } = dateDos(date);
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  let tailleCentrale = 0;

  for (const fichier of fichiers) {
    const nom = encodeur.encode(fichier.nom);
    const donnees = typeof fichier.contenu === 'string' ? encodeur.encode(fichier.contenu) : fichier.contenu;
    const crc = crc32(donnees);

    // En-tête local (30 octets), suivi du nom puis des données.
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // signature
    local.setUint16(4, 20, true); // version nécessaire (2.0)
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // pas de compression
    local.setUint16(10, heure, true);
    local.setUint16(12, jour, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, donnees.length, true);
    local.setUint32(22, donnees.length, true);
    local.setUint16(26, nom.length, true);
    local.setUint16(28, 0, true);
    locaux.push(local, nom, donnees);

    // Entrée du répertoire central (46 octets), suivie du nom.
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // créé avec la version 2.0
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, heure, true);
    central.setUint16(14, jour, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, donnees.length, true);
    central.setUint32(24, donnees.length, true);
    central.setUint16(28, nom.length, true);
    central.setUint32(42, decalage, true); // position de l'en-tête local
    centraux.push(central, nom);

    decalage += 30 + nom.length + donnees.length;
    tailleCentrale += 46 + nom.length;
  }

  // Fin du répertoire central (22 octets).
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentrale, true);
  fin.setUint32(16, decalage, true);

  return new Blob([...locaux, ...centraux, fin], { type });
}

// --- Lecture --------------------------------------------------------------------

/** Erreur de lecture d'archive (le message s'adresse à l'utilisateur). */
export class ErreurArchive extends Error {}

/** Décompresse des données « deflate » en refusant de dépasser `tailleMax` octets. */
async function decompresser(donnees, tailleMax) {
  if (typeof DecompressionStream !== 'function') {
    throw new ErreurArchive("Ce navigateur ne sait pas ouvrir ce fichier. Mets-le à jour, puis réessaie.");
  }
  const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const lecteur = flux.getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > tailleMax) {
      await lecteur.cancel();
      throw new ErreurArchive('Ce fichier est trop volumineux.');
    }
    morceaux.push(value);
  }
  const resultat = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, position);
    position += morceau.length;
  }
  return resultat;
}

/**
 * Ouvre une archive ZIP. Renvoie un objet avec :
 * - noms : la liste des fichiers de l'archive ;
 * - lire(nom) : le contenu d'un fichier (Uint8Array), ou null s'il n'existe pas.
 * Lève une ErreurArchive si l'archive est illisible.
 * @param {Uint8Array} octets
 * @param {number} tailleMax  taille maximale d'un fichier décompressé
 */
export function lireZip(octets, tailleMax = 100 * 1024 * 1024) {
  const illisible = () => new ErreurArchive("Ce fichier n'est pas lisible : il est peut-être abîmé, protégé par un mot de passe, ou ce n'est pas un vrai fichier Word.");
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  // La fin du répertoire central se trouve dans les derniers octets (avant un
  // éventuel commentaire de 65 535 octets au plus).
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 22 - 65535); i--) {
    if (vue.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw illisible();
  const nombre = vue.getUint16(fin + 10, true);
  let position = vue.getUint32(fin + 16, true);
  const entrees = new Map();
  const decodeur = new TextDecoder();
  for (let i = 0; i < nombre; i++) {
    if (position + 46 > octets.length || vue.getUint32(position, true) !== 0x02014b50) throw illisible();
    const drapeaux = vue.getUint16(position + 8, true);
    const methode = vue.getUint16(position + 10, true);
    const tailleCompressee = vue.getUint32(position + 20, true);
    const taille = vue.getUint32(position + 24, true);
    const longueurNom = vue.getUint16(position + 28, true);
    const longueurExtra = vue.getUint16(position + 30, true);
    const longueurCommentaire = vue.getUint16(position + 32, true);
    const decalageLocal = vue.getUint32(position + 42, true);
    const nom = decodeur.decode(octets.subarray(position + 46, position + 46 + longueurNom));
    entrees.set(nom, { drapeaux, methode, tailleCompressee, taille, decalageLocal });
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }

  return {
    noms: [...entrees.keys()],
    async lire(nom) {
      const e = entrees.get(nom);
      if (!e) return null;
      if (e.drapeaux & 1) throw illisible(); // fichier chiffré
      if (e.taille > tailleMax) throw new ErreurArchive('Ce fichier est trop volumineux.');
      const debutLocal = e.decalageLocal;
      if (debutLocal + 30 > octets.length || vue.getUint32(debutLocal, true) !== 0x04034b50) throw illisible();
      const debut = debutLocal + 30 + vue.getUint16(debutLocal + 26, true) + vue.getUint16(debutLocal + 28, true);
      const donnees = octets.subarray(debut, debut + e.tailleCompressee);
      if (donnees.length !== e.tailleCompressee) throw illisible();
      if (e.methode === 0) return donnees;
      if (e.methode === 8) {
        try {
          return await decompresser(donnees, tailleMax);
        } catch (erreur) {
          if (erreur instanceof ErreurArchive) throw erreur;
          throw illisible();
        }
      }
      throw illisible(); // méthode de compression inconnue
    },
  };
}
