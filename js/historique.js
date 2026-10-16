// Historique « Annuler / Rétablir » par instantanés.
//
// Le navigateur a sa propre pile d'annulation, mais elle ignore les
// modifications faites par notre code (taille, couleur…). On la remplace
// donc par la nôtre : après chaque action, on garde une copie du contenu et
// de la position de la sélection. Annuler revient à la copie précédente.

export class Historique {
  /**
   * @param {object} options
   * @param {() => {html: string, selection: object}} options.lire  photographie l'état actuel
   * @param {(etat: object) => void} options.ecrire  remet un état en place
   * @param {number} [options.limite]  nombre maximal d'étapes gardées
   */
  constructor({ lire, ecrire, limite = 300 }) {
    this.lire = lire;
    this.ecrire = ecrire;
    this.limite = limite;
    this.etats = [];
    this.index = -1;
  }

  /** Repart de zéro avec l'état actuel (à l'ouverture d'un document). */
  reinitialiser() {
    this.etats = [this.lire()];
    this.index = 0;
  }

  /**
   * Note la sélection juste avant une action : si l'on annule cette action,
   * c'est cette sélection qui sera rétablie. Par défaut, la sélection actuelle.
   */
  noterSelection(selection = this.lire().selection) {
    const courant = this.etats[this.index];
    if (courant) courant.selection = selection;
  }

  /**
   * Enregistre l'état actuel comme nouvelle étape. Renvoie true si ajouté.
   * `selection` remplace, si elle est donnée, la sélection actuelle.
   */
  enregistrer(selection) {
    const etat = this.lire();
    if (selection !== undefined) etat.selection = selection;
    const courant = this.etats[this.index];
    if (courant && courant.html === etat.html) {
      courant.selection = etat.selection;
      return false;
    }
    this.etats.splice(this.index + 1); // une nouvelle action efface le « Rétablir »
    this.etats.push(etat);
    if (this.etats.length > this.limite) this.etats.shift();
    this.index = this.etats.length - 1;
    return true;
  }

  /**
   * Remplace l'étape actuelle sans en créer une nouvelle (ménage invisible,
   * comme le retrait d'un caractère invisible inutilisé).
   */
  remplacerCourant() {
    if (this.index < 0) return;
    const etat = this.lire();
    this.etats[this.index] = etat;
    // Si ce ménage rend l'étape identique à la précédente, elle est inutile.
    const precedent = this.etats[this.index - 1];
    if (precedent && precedent.html === etat.html && this.index === this.etats.length - 1) {
      this.etats.pop();
      this.index--;
    }
  }

  get peutAnnuler() {
    return this.index > 0;
  }

  get peutRetablir() {
    return this.index < this.etats.length - 1;
  }

  annuler() {
    if (!this.peutAnnuler) return false;
    this.index--;
    this.ecrire(this.etats[this.index]);
    return true;
  }

  retablir() {
    if (!this.peutRetablir) return false;
    this.index++;
    this.ecrire(this.etats[this.index]);
    return true;
  }
}
