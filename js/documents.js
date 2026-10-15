// Gestion des documents : ouverture, création, duplication, suppression,
// restauration, et enregistrement automatique du document ouvert.

import { nouvelId, demanderStockagePersistant } from './storage.js';
import { nettoyerHtml } from './sanitize.js';

const DELAI_ENREGISTREMENT = 800; // ms après la dernière frappe
const DOCUMENT_VIDE = '<p><br></p>';

export const titreAffiche = (doc) => doc?.titre?.trim() || 'Sans titre';

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

  /** Au lancement : rouvre le dernier document (ou en crée un). */
  async demarrer() {
    await this.recupererSecours();
    const dernier = this.preferences.lire('dernierDocument');
    let doc = typeof dernier === 'string' ? await this.stockage.lire(dernier) : null;
    if (!doc) doc = (await this.stockage.lister())[0] ?? null;
    if (!doc) doc = await this.creer();
    this.afficher(doc);
  }

  afficher(doc) {
    clearTimeout(this.minuterie);
    this.courant = doc;
    this.modifie = false;
    this.editeur.charger(doc.html);
    this.champTitre.value = doc.titre;
    this.preferences.ecrire('dernierDocument', doc.id);
    this.indiquer('enregistre', doc.modifieLe);
    this.surAffichage(doc);
  }

  lister() {
    return this.stockage.lister();
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

  async supprimer(id) {
    if (id === this.courant?.id) {
      // On oublie les changements en attente : le document va disparaître.
      clearTimeout(this.minuterie);
      this.modifie = false;
      await this.file;
    }
    await this.stockage.supprimer(id);
    if (id === this.courant?.id) {
      const reste = await this.stockage.lister();
      this.afficher(reste[0] ?? (await this.creer()));
    }
  }

  /**
   * Ajoute les documents d'une sauvegarde. Rien n'est jamais remplacé : un
   * document qui a le même identifiant qu'un document existant est ajouté
   * comme copie, sauf s'il est strictement identique (déjà présent).
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
          dejaPresents++;
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
