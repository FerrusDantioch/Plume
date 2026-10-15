// Export PDF par l'impression du navigateur (window.print).
// Le navigateur propose « Enregistrer au format PDF » : cela marche hors
// ligne, garde le texte sélectionnable et ne demande aucune bibliothèque.
// La mise en page d'impression est dans css/print.css.

import { ouvrirFenetre } from './ui.js';

/** Nom de fichier propre à partir du titre du document. */
export function nomDeFichier(titre) {
  const propre = String(titre ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return propre || 'Sans titre';
}

export class ExportPdf {
  /**
   * @param {object} options
   * @param {object} options.preferences
   * @param {HTMLDialogElement} options.fenetreAide  aide affichée avant la première impression
   * @param {() => string} options.titre  titre du document ouvert
   * @param {() => Promise<unknown>} options.avant  à faire avant d'imprimer (enregistrer)
   */
  constructor({ preferences, fenetreAide, titre, avant }) {
    this.preferences = preferences;
    this.fenetreAide = fenetreAide;
    this.titre = titre;
    this.avant = avant;
    this.titreOrigine = null;
    // Aussi quand l'impression est lancée depuis le menu du navigateur.
    window.addEventListener('beforeprint', () => this.preparer());
    window.addEventListener('afterprint', () => this.terminer());
  }

  async exporter(declencheur) {
    await this.avant();
    if (!this.preferences.lire('aidePdfMasquee', false)) {
      const continuer = await this.montrerAide(declencheur);
      if (!continuer) return;
    }
    // Laisse le temps à la fenêtre d'aide de disparaître avant l'impression.
    setTimeout(() => {
      this.preparer();
      window.print();
      // Chrome sur ordinateur attend la fin de l'impression ; ailleurs,
      // « afterprint » remettra le titre en place.
    }, 60);
  }

  montrerAide(declencheur) {
    const fenetre = this.fenetreAide;
    const caseMasquer = fenetre.querySelector('input[type="checkbox"]');
    caseMasquer.checked = false;
    return new Promise((resoudre) => {
      fenetre.returnValue = '';
      fenetre.addEventListener(
        'close',
        () => {
          const continuer = fenetre.returnValue === 'continuer';
          if (continuer && caseMasquer.checked) this.preferences.ecrire('aidePdfMasquee', true);
          resoudre(continuer);
        },
        { once: true },
      );
      ouvrirFenetre(fenetre, { declencheur });
      fenetre.querySelector('[data-fermer="continuer"]').focus();
    });
  }

  /** Le navigateur nomme le fichier PDF d'après le titre de la page. */
  preparer() {
    if (this.titreOrigine !== null) return;
    this.titreOrigine = document.title;
    document.title = nomDeFichier(this.titre());
  }

  terminer() {
    if (this.titreOrigine === null) return;
    document.title = this.titreOrigine;
    this.titreOrigine = null;
  }
}
