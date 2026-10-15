// Stockage sur l'appareil : documents, préférences, fichiers de sauvegarde.
//
// - Les documents vont dans IndexedDB (une base de données intégrée au
//   navigateur). Si elle est indisponible, on se rabat sur localStorage
//   (plus petit), et en dernier recours sur la mémoire (rien n'est gardé).
// - Les préférences (thème, dernier document…) vont dans localStorage.
//
// Toutes les applications publiées sur ferrusdantioch.github.io partagent
// le même espace de stockage : chaque clé commence donc par l'identifiant de
// l'application (ex. « plume.theme ») pour ne jamais se mélanger.

const MAGASIN = 'documents';

// --- Préférences --------------------------------------------------------------

export function creerPreferences(prefixe) {
  const cle = (nom) => `${prefixe}.${nom}`;
  return {
    lire(nom, defaut = null) {
      try {
        const brut = localStorage.getItem(cle(nom));
        return brut === null ? defaut : JSON.parse(brut);
      } catch {
        return defaut;
      }
    },
    ecrire(nom, valeur) {
      try {
        localStorage.setItem(cle(nom), JSON.stringify(valeur));
        return true;
      } catch {
        return false;
      }
    },
    supprimer(nom) {
      try {
        localStorage.removeItem(cle(nom));
      } catch {
        // rien à faire
      }
    },
  };
}

// --- Identifiants ---------------------------------------------------------------

/** Identifiant unique d'un document. */
export function nouvelId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Repli (page ouverte sans HTTPS) : 16 octets aléatoires.
  const octets = crypto.getRandomValues(new Uint8Array(16));
  return [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');
}

// --- Stockage des documents -----------------------------------------------------

/**
 * Ouvre le stockage. Renvoie un objet avec : mode ('indexeddb',
 * 'localstorage' ou 'memoire'), lire(id), lister(), enregistrer(doc),
 * supprimer(id).
 */
export async function ouvrirStockage({ nom }) {
  try {
    return new StockageIndexedDB(await ouvrirBase(nom));
  } catch {
    try {
      const essai = `${nom}.essai`;
      localStorage.setItem(essai, '1');
      localStorage.removeItem(essai);
      return new StockageLocal(`${nom}.documents`);
    } catch {
      return new StockageMemoire();
    }
  }
}

function ouvrirBase(nom) {
  return new Promise((resoudre, rejeter) => {
    if (!globalThis.indexedDB) {
      rejeter(new Error('IndexedDB absent'));
      return;
    }
    // Certains navigateurs ne répondent jamais (mode privé ancien) : délai max.
    const minuterie = setTimeout(() => rejeter(new Error('IndexedDB ne répond pas')), 5000);
    let requete;
    try {
      requete = indexedDB.open(nom, 1);
    } catch (erreur) {
      clearTimeout(minuterie);
      rejeter(erreur);
      return;
    }
    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN, { keyPath: 'id' });
    };
    requete.onsuccess = () => {
      clearTimeout(minuterie);
      const base = requete.result;
      // Si une autre version de l'application a besoin de la base, on la libère.
      base.onversionchange = () => base.close();
      resoudre(base);
    };
    requete.onerror = () => {
      clearTimeout(minuterie);
      rejeter(requete.error);
    };
  });
}

const parDateDecroissante = (a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe));

class StockageIndexedDB {
  constructor(base) {
    this.base = base;
    this.mode = 'indexeddb';
  }

  operation(type, action) {
    return new Promise((resoudre, rejeter) => {
      // « strict » : l'écriture est confirmée seulement une fois sur le disque.
      const transaction = this.base.transaction(MAGASIN, type, type === 'readwrite' ? { durability: 'strict' } : undefined);
      const requete = action(transaction.objectStore(MAGASIN));
      transaction.oncomplete = () => resoudre(requete.result);
      transaction.onerror = () => rejeter(transaction.error);
      transaction.onabort = () => rejeter(transaction.error ?? new Error('Écriture annulée'));
    });
  }

  lire(id) {
    return this.operation('readonly', (m) => m.get(id)).then((doc) => doc ?? null);
  }

  async lister() {
    const documents = await this.operation('readonly', (m) => m.getAll());
    return documents.sort(parDateDecroissante);
  }

  enregistrer(doc) {
    return this.operation('readwrite', (m) => m.put(doc));
  }

  supprimer(id) {
    return this.operation('readwrite', (m) => m.delete(id));
  }
}

class StockageLocal {
  constructor(cle) {
    this.cle = cle;
    this.mode = 'localstorage';
  }

  tout() {
    try {
      return JSON.parse(localStorage.getItem(this.cle)) ?? {};
    } catch {
      return {};
    }
  }

  async lire(id) {
    return this.tout()[id] ?? null;
  }

  async lister() {
    return Object.values(this.tout()).sort(parDateDecroissante);
  }

  async enregistrer(doc) {
    const tout = this.tout();
    tout[doc.id] = doc;
    localStorage.setItem(this.cle, JSON.stringify(tout)); // lève une erreur si plein
  }

  async supprimer(id) {
    const tout = this.tout();
    delete tout[id];
    localStorage.setItem(this.cle, JSON.stringify(tout));
  }
}

class StockageMemoire {
  constructor() {
    this.documents = new Map();
    this.mode = 'memoire';
  }

  async lire(id) {
    return this.documents.get(id) ?? null;
  }

  async lister() {
    return [...this.documents.values()].sort(parDateDecroissante);
  }

  async enregistrer(doc) {
    this.documents.set(doc.id, doc);
  }

  async supprimer(id) {
    this.documents.delete(id);
  }
}

/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function demanderStockagePersistant() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// --- Fichiers de sauvegarde -----------------------------------------------------

const VERSION_SAUVEGARDE = 1;
const TAILLE_MAX_FICHIER = 200 * 1024 * 1024; // 200 Mo
const TAILLE_MAX_DOCUMENT = 50 * 1024 * 1024; // 50 Mo de code HTML

/** Contenu du fichier de sauvegarde (objet prêt à convertir en JSON). */
export function creerSauvegarde(documents, config) {
  return {
    format: `${config.idStockage}-sauvegarde`,
    version: VERSION_SAUVEGARDE,
    application: config.nom,
    versionApplication: config.version,
    exporteLe: new Date().toISOString(),
    documents: documents.map(({ id, titre, html, creeLe, modifieLe }) => ({ id, titre, html, creeLe, modifieLe })),
  };
}

/** Nom du fichier : « plume-sauvegarde-AAAA-MM-JJ.json » (date locale). */
export function nomFichierSauvegarde(config, date = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${config.idStockage}-sauvegarde-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}.json`;
}

/**
 * Lit et vérifie strictement un fichier de sauvegarde. Renvoie la liste des
 * documents, ou lève une erreur dont le message s'adresse à l'utilisateur.
 */
export function lireSauvegarde(texte, config) {
  const refus = (raison) => new Error(raison);
  if (typeof texte !== 'string' || texte.length > TAILLE_MAX_FICHIER) throw refus('Ce fichier est trop volumineux pour être une sauvegarde.');
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch {
    throw refus("Ce fichier n'est pas une sauvegarde : son contenu n'est pas lisible.");
  }
  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) throw refus("Ce fichier n'est pas une sauvegarde valide.");
  if (donnees.format !== `${config.idStockage}-sauvegarde`) throw refus(`Ce fichier n'est pas une sauvegarde de ${config.nom}.`);
  if (typeof donnees.version !== 'number') throw refus("Ce fichier n'est pas une sauvegarde valide : sa version est absente.");
  if (donnees.version > VERSION_SAUVEGARDE) {
    throw refus(`Cette sauvegarde vient d'une version plus récente de ${config.nom}. Mets l'application à jour, puis réessaie.`);
  }
  if (!Array.isArray(donnees.documents)) throw refus("Ce fichier n'est pas une sauvegarde valide : la liste des documents est absente.");
  if (donnees.documents.length === 0) throw refus('Cette sauvegarde ne contient aucun document.');

  return donnees.documents.map((doc, i) => {
    const probleme = verifierDocument(doc);
    if (probleme) throw refus(`Le document n° ${i + 1} de la sauvegarde est invalide (${probleme}). Rien n'a été restauré.`);
    return { id: doc.id, titre: doc.titre, html: doc.html, creeLe: doc.creeLe, modifieLe: doc.modifieLe };
  });
}

function verifierDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'ce n’est pas un document';
  if (typeof doc.id !== 'string' || doc.id.length === 0 || doc.id.length > 200) return 'identifiant manquant';
  if (typeof doc.titre !== 'string' || doc.titre.length > 1000) return 'titre manquant';
  if (typeof doc.html !== 'string' || doc.html.length > TAILLE_MAX_DOCUMENT) return 'contenu manquant';
  for (const champ of ['creeLe', 'modifieLe']) {
    if (typeof doc[champ] !== 'string' || Number.isNaN(Date.parse(doc[champ]))) return 'date invalide';
  }
  return null;
}

/** Propose un fichier au téléchargement. */
export function telecharger(nomFichier, contenu, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.hidden = true;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
