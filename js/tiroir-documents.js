// Panneau latéral « Mes documents » : liste, création, ouverture d'un
// fichier, duplication, mise à la corbeille ; et panneau « Corbeille » :
// remettre un document, le supprimer définitivement, vider la corbeille.

import { titreAffiche, joursRestants } from './documents.js';
import { ouvrirFenetre, demander, afficherMessage } from './ui.js';

const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « 15 octobre 2026 à 14:32 ». */
export function dateLisible(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatDate.format(date)} à ${formatHeure.format(date)}`;
}

/** Début du texte d'un document (pour l'aperçu dans la liste). */
function extrait(html) {
  const doc = new DOMParser().parseFromString(String(html).slice(0, 4000), 'text/html');
  for (const bloc of doc.body.querySelectorAll('p, h1, h2, h3, li, br')) bloc.append(' ');
  const texte = doc.body.textContent.replace(/​/g, '').replace(/\s+/g, ' ').trim();
  return texte.length > 140 ? `${texte.slice(0, 140).trimEnd()}…` : texte;
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export class TiroirDocuments {
  /**
   * @param {object} options
   * @param {HTMLDialogElement} options.fenetre  le panneau « Mes documents »
   * @param {HTMLElement} options.liste
   * @param {HTMLButtonElement} options.boutonOuvrir  le bouton « Documents » de la barre
   * @param {HTMLButtonElement} options.boutonNouveau
   * @param {HTMLButtonElement} options.boutonFichier  « Ouvrir un fichier »
   * @param {object} options.corbeille  éléments du panneau « Corbeille »
   * @param {import('./documents.js').Documents} options.documents
   * @param {import('./editor.js').Editeur} options.editeur
   * @param {() => Promise<boolean>} options.ouvrirFichier  choisit et ouvre un fichier ; true si un document a été créé
   */
  constructor({ fenetre, liste, boutonOuvrir, boutonNouveau, boutonFichier, corbeille, documents, editeur, ouvrirFichier }) {
    Object.assign(this, { fenetre, liste, boutonOuvrir, boutonNouveau, documents, editeur, corbeille });

    boutonOuvrir.addEventListener('click', () => this.ouvrir());
    boutonNouveau.addEventListener('click', async () => {
      await documents.nouveau();
      this.fermerVersLaFeuille();
    });
    boutonFichier.addEventListener('click', async () => {
      if (await ouvrirFichier()) this.fermerVersLaFeuille();
    });
    corbeille.bouton.addEventListener('click', () => this.ouvrirCorbeille());
    corbeille.boutonRetour.addEventListener('click', async () => {
      corbeille.fenetre.close();
      await this.ouvrir();
      corbeille.bouton.focus();
    });
    corbeille.boutonVider.addEventListener('click', () => this.viderCorbeille());
  }

  async ouvrir() {
    await this.documents.enregistrer();
    await this.rafraichir();
    ouvrirFenetre(this.fenetre, { declencheur: this.boutonOuvrir });
    const actuel = this.liste.querySelector('[aria-current="true"] .document-ouvrir');
    (actuel ?? this.boutonNouveau).focus();
  }

  /** Ferme le panneau ; le focus va dans la feuille (et non sur le bouton « Documents »). */
  fermerVersLaFeuille() {
    this.fenetre.declencheur = this.editeur.racine;
    this.fenetre.close();
    this.editeur.focaliser();
  }

  async rafraichir() {
    const documents = await this.documents.lister();
    const elements = documents.map((doc) => this.element(doc));
    if (elements.length === 0) elements.push(elementVide('Aucun document.'));
    this.liste.replaceChildren(...elements);
    const jetes = (await this.documents.listerCorbeille()).length;
    this.corbeille.libelle.textContent = jetes ? `Corbeille (${jetes})` : 'Corbeille (vide)';
  }

  element(doc) {
    const titre = titreAffiche(doc);
    const estOuvert = doc.id === this.documents.courant?.id;
    const li = document.createElement('li');
    li.className = 'document';
    li.dataset.id = doc.id;
    if (estOuvert) li.setAttribute('aria-current', 'true');

    const ouvrir = document.createElement('button');
    ouvrir.type = 'button';
    ouvrir.className = 'document-ouvrir';
    ouvrir.append(texte('span', 'document-titre', titre));
    if (estOuvert) ouvrir.append(texte('span', 'document-etiquette-ouvert', 'Ouvert actuellement'));
    ouvrir.append(
      texte('span', 'document-date', `Modifié le ${dateLisible(doc.modifieLe)}`),
      texte('span', 'document-extrait', extrait(doc.html) || 'Document vide'),
    );
    ouvrir.addEventListener('click', async () => {
      await this.documents.ouvrir(doc.id);
      this.fermerVersLaFeuille();
    });

    const actions = document.createElement('div');
    actions.className = 'document-actions';
    actions.append(
      boutonIcone('i-dupliquer', `Dupliquer « ${titre} »`, 'Dupliquer', () => this.dupliquer(doc)),
      boutonIcone('i-supprimer', `Mettre « ${titre} » à la corbeille`, 'Mettre à la corbeille', () => this.jeter(doc)),
    );
    li.append(ouvrir, actions);
    return li;
  }

  async dupliquer(doc) {
    const copie = await this.documents.dupliquer(doc.id);
    await this.rafraichir();
    if (copie) {
      afficherMessage(`Copie créée : « ${titreAffiche(copie)} ».`);
      this.liste.querySelector(`[data-id="${CSS.escape(copie.id)}"] .document-ouvrir`)?.focus();
    }
  }

  /** Met un document à la corbeille ; le message propose d'annuler. */
  async jeter(doc) {
    const titre = titreAffiche(doc);
    const etaitOuvert = doc.id === this.documents.courant?.id;
    await this.documents.mettreALaCorbeille(doc.id);
    await this.rafraichir();
    this.boutonNouveau.focus();
    afficherMessage(`« ${titre} » est dans la corbeille.`, {
      action: 'Annuler',
      duree: 8000,
      surAction: async () => {
        await this.documents.remettre(doc.id);
        if (etaitOuvert) await this.documents.ouvrir(doc.id); // il redevient le document ouvert
        if (this.fenetre.open) await this.rafraichir();
        afficherMessage(`« ${titre} » est de retour dans tes documents.`);
      },
    });
  }

  // --- Corbeille ----------------------------------------------------------------

  async ouvrirCorbeille() {
    this.fenetre.close();
    await this.rafraichirCorbeille();
    ouvrirFenetre(this.corbeille.fenetre, { declencheur: this.boutonOuvrir });
    this.premierChoixCorbeille().focus();
  }

  premierChoixCorbeille() {
    return this.corbeille.liste.querySelector('.document-jete button') ?? this.corbeille.boutonRetour;
  }

  async rafraichirCorbeille() {
    const jetes = await this.documents.listerCorbeille();
    const elements = jetes.map((doc) => this.elementJete(doc));
    if (elements.length === 0) elements.push(elementVide('La corbeille est vide.'));
    this.corbeille.liste.replaceChildren(...elements);
    this.corbeille.boutonVider.hidden = jetes.length === 0;
  }

  elementJete(doc) {
    const titre = titreAffiche(doc);
    const li = document.createElement('li');
    li.className = 'document-jete';
    li.dataset.id = doc.id;
    const infos = document.createElement('div');
    infos.className = 'document-infos';
    infos.append(
      texte('span', 'document-titre', titre),
      texte('span', 'document-date', `Mis à la corbeille le ${dateLisible(doc.supprimeLe)}`),
      texte('span', 'document-date', `Suppression définitive dans ${pluriel(joursRestants(doc), 'jour')}`),
    );
    const actions = document.createElement('div');
    actions.className = 'document-actions';
    actions.append(
      boutonTexte('i-remettre', 'Remettre', `Remettre « ${titre} » dans mes documents`, () => this.remettre(doc)),
      boutonTexte('i-supprimer', 'Supprimer définitivement', `Supprimer définitivement « ${titre} »`, (e) =>
        this.supprimerDefinitivement(doc, e.currentTarget),
      ),
    );
    li.append(infos, actions);
    return li;
  }

  async remettre(doc) {
    await this.documents.remettre(doc.id);
    await this.rafraichirCorbeille();
    afficherMessage(`« ${titreAffiche(doc)} » est de retour dans tes documents.`);
    this.premierChoixCorbeille().focus();
  }

  async supprimerDefinitivement(doc, bouton) {
    const titre = titreAffiche(doc);
    const confirme = await demander({
      titre: 'Supprimer définitivement',
      message: `Supprimer définitivement « ${titre} » ? Cette action est irréversible.`,
      confirmer: 'Supprimer définitivement',
      annuler: 'Annuler',
      danger: true,
      declencheur: bouton,
    });
    if (!confirme) return;
    await this.documents.supprimerDefinitivement(doc.id);
    await this.rafraichirCorbeille();
    afficherMessage(`« ${titre} » a été supprimé définitivement.`);
    this.premierChoixCorbeille().focus();
  }

  async viderCorbeille() {
    const nombre = (await this.documents.listerCorbeille()).length;
    if (nombre === 0) return;
    const confirme = await demander({
      titre: 'Vider la corbeille',
      message: `${nombre > 1 ? `Les ${nombre} documents de la corbeille seront supprimés` : 'Le document de la corbeille sera supprimé'} définitivement. Cette action est irréversible.`,
      confirmer: 'Vider la corbeille',
      annuler: 'Annuler',
      danger: true,
      declencheur: this.corbeille.boutonVider,
    });
    if (!confirme) return;
    await this.documents.viderCorbeille();
    await this.rafraichirCorbeille();
    afficherMessage('La corbeille a été vidée.');
    this.corbeille.boutonRetour.focus();
  }
}

function texte(balise, classe, contenu) {
  const element = document.createElement(balise);
  element.className = classe;
  element.textContent = contenu;
  return element;
}

function elementVide(message) {
  return texte('li', 'liste-vide', message);
}

function icone(nom) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icone');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${nom}`);
  svg.append(use);
  return svg;
}

function boutonIcone(nomIcone, etiquette, infoBulle, action) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton bouton-icone bouton-discret';
  bouton.setAttribute('aria-label', etiquette);
  bouton.title = infoBulle;
  bouton.append(icone(nomIcone));
  bouton.addEventListener('click', action);
  return bouton;
}

function boutonTexte(nomIcone, libelle, etiquette, action) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.setAttribute('aria-label', etiquette);
  bouton.append(icone(nomIcone), libelle);
  bouton.addEventListener('click', action);
  return bouton;
}
