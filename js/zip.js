// Fabrication d'une archive ZIP, sans bibliothèque.
//
// Un fichier Word (.docx) est en réalité une archive ZIP qui contient
// plusieurs fichiers texte (XML). Ce module assemble ces fichiers en une
// archive. Les fichiers sont stockés sans compression : c'est plus simple,
// toujours accepté par Word, et la taille reste raisonnable pour du texte.
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
