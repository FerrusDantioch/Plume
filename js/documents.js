// Gestion des documents : ouverture, création, duplication, corbeille,
// restauration, et enregistrement automatique du document ouvert.
//
// Corbeille : un document supprimé reçoit une date « supprimeLe » et
// disparaît de la liste. Il reste récupérable pendant 30 jours ; ensuite, il
// est effacé pour de bon au lancement suivant de l'application.

import { nouvelId, demanderStockagePersistant } from './storage.js';
import { nettoyerHtml } from './sanitize.js';

const DELAI_ENREGISTREMENT = 800; // ms après la dernière frappe
const DOCUMENT_VIDE = '<p><br></p>';
export const JOURS_CORBEILLE = 30;
const DUREE_CORBEILLE = JOURS_CORBEILLE * 24 * 60 * 60 * 1000;

export const titreAffiche = (doc) => doc?.titre?.trim() || 'Sans titre';
export const estALaCorbeille = (doc) => typeof doc?.supprimeLe === 'string';

/** Nombre de jours avant l'effacement définitif d'un document de la corbeille (au moins 1). */
export function joursRestants(doc, date = Date.now()) {
  const reste = Date.parse(doc.supprimeLe) + DUREE_CORBEILLE - date;
  return Math.max(1, Math.ceil(reste / (24 * 60 * 60 * 1000)));
}

const maintenant = () => new Date().toISOString();

export class Documents {
  /**
   * @param {object} options
   * @param {object} options.stockage  voir storage.js
   * @param {object} options.preferences  voir storage.js
   * @param {import('./editor.js').Editeur} options.editeur
   * @param {HTMLInputElement} options.champTitre
   * @param {(etat: string, date?: string) => void} options.indiquer  affiche l'état d'enregistrement
   * @param {() => void} [options.surAffichage]  un document vient d'être affiché
   */
  constructor({ stockage, preferences, editeur, champTitre, indiquer, surAffichage = () => {} }) {
    this.stockage = stockage;
    this.preferences = preferences;
    this.editeur = editeur;
    this.champTitre = champTitre;
    this.indiquer = indiquer;
    this.surAffichage = surAffichage;
    this.courant = null; // document ouvert
    this.modifie = false; // des changements ne sont pas encore enregistrés
    this.minuterie = 0;
    this.file = Promise.resolve(); // les enregistrements se font l'un après l'autre
    this.persistanceDemandee = false;
  }

  /** Au lancement : vide la corbeille des vieux documents, rouvre le dernier document (ou en crée un). */
  async demarrer() {
    await this.recupererSecours();
    await this.purgerCorbeille();
    const dernier = this.preferences.lire('dernierDocument');
    let doc = typeof dernier === 'string' ? await this.stockage.lire(dernier) : null;
    if (estALaCorbeille(doc)) doc = null;
    if (!doc) doc = (await this.lister())[0] ?? null;
    if (!doc) doc = await this.creer();
    this.afficher(doc);
  }

  afficher(doc) {
    clearTimeout(this.minuterie);
    // D'abord l'affichage : s'il échouait, le document ouvert ne change pas
    // (sinon la frappe suivante serait enregistrée dans le mauvais document).
    this.editeur.charger(doc.html);
    this.courant = doc;
    this.modifie = false;
    this.champTitre.value = doc.titre;
    this.preferences.ecrire('dernierDocument', doc.id);
    this.indiquer('enregistre', doc.modifieLe);
    this.surAffichage(doc);
  }

  /** Documents (hors corbeille), du plus récent au plus ancien. */
  async lister() {
    return (await this.stockage.lister()).filter((d) => !estALaCorbeille(d));
  }

  /** Documents de la corbeille, du dernier supprimé au premier. */
  async listerCorbeille() {
    const corbeille = (await this.stockage.lister()).filter(estALaCorbeille);
    return corbeille.sort((a, b) => b.supprimeLe.localeCompare(a.supprimeLe));
  }

  // --- Enregistrement automatique ---------------------------------------------

  /** À appeler à chaque modification du texte ou du titre. */
  signalerModification() {
    if (!this.courant) return;
    this.modifie = true;
    this.indiquer('modification');
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.enregistrer(), DELAI_ENREGISTREMENT);
  }

  /**
   * Enregistre tout de suite. Avec { forcer: true } (Ctrl+S), écrit même si
   * rien n'a changé. Renvoie true si tout est enregistré.
   */
  enregistrer({ forcer = false } = {}) {
    clearTimeout(this.minuterie);
    if (forcer && this.courant) this.modifie = true;
    this.file = this.file.then(() => this.ecrire());
    return this.file;
  }

  async ecrire() {
    if (!this.courant || !this.modifie) return true;
    this.modifie = false;
    const doc = {
      ...this.courant,
      titre: this.champTitre.value.trim(),
      html: this.editeur.html(),
      modifieLe: maintenant(),
    };
    try {
      await this.stockage.enregistrer(doc);
      if (this.courant?.id === doc.id) {
        this.courant = doc;
        if (!this.modifie) this.indiquer('enregistre', doc.modifieLe);
      }
      if (!this.persistanceDemandee) {
        this.persistanceDemandee = true;
        demanderStockagePersistant();
      }
      return true;
    } catch (erreur) {
      console.warn("Erreur d'enregistrement :", erreur);
      if (this.courant?.id === doc.id) this.modifie = true;
      this.indiquer('erreur');
      return false;
    }
  }

  /**
   * Copie de secours synchrone dans localStorage, quand la page se ferme :
   * si l'écriture dans IndexedDB n'a pas le temps de finir, elle sera
   * récupérée au prochain lancement.
   */
  ecrireSecours() {
    if (!this.courant || !this.modifie) return;
    this.preferences.ecrire('secours', {
      id: this.courant.id,
      titre: this.champTitre.value.trim(),
      html: this.editeur.html(),
      creeLe: this.courant.creeLe,
      modifieLe: maintenant(),
    });
  }

  async recupererSecours() {
    const secours = this.preferences.lire('secours');
    if (!secours) return;
    this.preferences.supprimer('secours');
    const valide =
      typeof secours === 'object' && typeof secours.id === 'string' && typeof secours.html === 'string' &&
      typeof secours.titre === 'string' && typeof secours.modifieLe === 'string';
    if (!valide) return;
    const existant = await this.stockage.lire(secours.id);
    if (existant && (existant.modifieLe > secours.modifieLe || (existant.html === secours.html && existant.titre === secours.titre))) return;
    await this.stockage.enregistrer({
      id: secours.id,
      titre: secours.titre,
      html: nettoyerHtml(secours.html),
      creeLe: existant?.creeLe ?? (typeof secours.creeLe === 'string' ? secours.creeLe : secours.modifieLe),
      modifieLe: secours.modifieLe,
    });
  }

  // --- Opérations sur les documents -------------------------------------------

  async creer() {
    const date = maintenant();
    const doc = { id: nouvelId(), titre: '', html: DOCUMENT_VIDE, creeLe: date, modifieLe: date };
    await this.stockage.enregistrer(doc);
    return doc;
  }

  async nouveau() {
    await this.enregistrer();
    this.afficher(await this.creer());
  }

  /** Crée un document à partir d'un fichier ouvert (voir importer.js) et l'affiche. */
  async importer({ titre, html }) {
    await this.enregistrer();
    const date = maintenant();
    const doc = { id: nouvelId(), titre: titre.trim().slice(0, 200), html: nettoyerHtml(html), creeLe: date, modifieLe: date };
    await this.stockage.enregistrer(doc);
    try {
      this.afficher(doc);
    } catch (erreur) {
      await this.stockage.supprimer(doc.id); // pas de document fantôme
      throw erreur;
    }
    return doc;
  }

  async ouvrir(id) {
    if (id === this.courant?.id) return;
    await this.enregistrer();
    const doc = await this.stockage.lire(id);
    if (doc) this.afficher(doc);
  }

  /** Crée une copie et la renvoie (le document ouvert ne change pas). */
  async dupliquer(id) {
    await this.enregistrer();
    const source = await this.stockage.lire(id);
    if (!source) return null;
    const date = maintenant();
    const copie = { ...source, id: nouvelId(), titre: `${titreAffiche(source)} (copie)`, creeLe: date, modifieLe: date };
    await this.stockage.enregistrer(copie);
    return copie;
  }

  // --- Corbeille ----------------------------------------------------------------

  /** Met un document à la corbeille. Si c'est le document ouvert, un autre s'ouvre. */
  async mettreALaCorbeille(id) {
    // Les dernières modifications partent avec lui ; si elles n'ont pas pu
    // être enregistrées, on ne fait rien (elles seraient perdues).
    const enregistre = await this.enregistrer();
    if (!enregistre && id === this.courant?.id) return null;
    const doc = await this.stockage.lire(id);
    if (!doc) return null;
    const jete = { ...doc, supprimeLe: maintenant() };
    await this.stockage.enregistrer(jete);
    if (id === this.courant?.id) {
      const reste = await this.lister();
      this.afficher(reste[0] ?? (await this.creer()));
    }
    return jete;
  }

  /** Sort un document de la corbeille : il revient dans la liste. */
  async remettre(id) {
    const doc = await this.stockage.lire(id);
    if (!doc) return null;
    const remis = { ...doc };
    delete remis.supprimeLe;
    await this.stockage.enregistrer(remis);
    return remis;
  }

  async supprimerDefinitivement(id) {
    if (id === this.courant?.id) return; // jamais le document ouvert
    await this.stockage.supprimer(id);
  }

  async viderCorbeille() {
    for (const doc of await this.listerCorbeille()) await this.supprimerDefinitivement(doc.id);
  }

  /** Efface pour de bon les documents mis à la corbeille il y a plus de 30 jours. */
  async purgerCorbeille(date = Date.now()) {
    for (const doc of await this.listerCorbeille()) {
      const depuis = Date.parse(doc.supprimeLe);
      if (Number.isNaN(depuis) || date - depuis > DUREE_CORBEILLE) await this.stockage.supprimer(doc.id);
    }
  }

  /**
   * Ajoute les documents d'une sauvegarde. Rien n'est jamais remplacé : un
   * document qui a le même identifiant qu'un document existant est ajouté
   * comme copie, sauf s'il est strictement identique (déjà présent ; s'il
   * était à la corbeille, il en sort).
   */
  async restaurer(documents) {
    await this.enregistrer();
    const existants = new Map((await this.stockage.lister()).map((d) => [d.id, d]));
    let ajoutes = 0;
    let dejaPresents = 0;
    for (const doc of documents) {
      const propre = { ...doc, titre: doc.titre.trim().slice(0, 200), html: nettoyerHtml(doc.html) };
      const existant = existants.get(doc.id);
      if (existant) {
        if (nettoyerHtml(existant.html) === propre.html && existant.titre === propre.titre) {
          if (estALaCorbeille(existant)) {
            await this.remettre(existant.id);
            ajoutes++;
          } else {
            dejaPresents++;
          }
          continue;
        }
        propre.id = nouvelId();
        propre.titre = `${titreAffiche(propre)} (restauré)`;
      }
      await this.stockage.enregistrer(propre);
      existants.set(propre.id, propre);
      ajoutes++;
    }
    return { ajoutes, dejaPresents };
  }
}
