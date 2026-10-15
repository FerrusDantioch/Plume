// Panneau latéral « Mes documents » : liste, création, ouverture,
// duplication et suppression (avec confirmation).

import { titreAffiche } from './documents.js';
import { ouvrirFenetre, demander, afficherMessage } from './ui.js';

const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « Modifié le 15 octobre 2026 à 14:32 ». */
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

export class TiroirDocuments {
  constructor({ fenetre, liste, boutonOuvrir, boutonNouveau, documents, editeur }) {
    this.fenetre = fenetre;
    this.liste = liste;
    this.boutonOuvrir = boutonOuvrir;
    this.boutonNouveau = boutonNouveau;
    this.documents = documents;
    this.editeur = editeur;

    boutonOuvrir.addEventListener('click', () => this.ouvrir());
    boutonNouveau.addEventListener('click', async () => {
      await documents.nouveau();
      this.fermerVersLaFeuille();
    });
  }

  async ouvrir() {
    await this.documents.enregistrer();
    await this.rafraichir();
    ouvrirFenetre(this.fenetre, { declencheur: this.boutonOuvrir });
    const actuel = this.liste.querySelector('[aria-current="true"] .document-ouvrir');
    (actuel ?? this.boutonNouveau).focus();
  }

  fermerVersLaFeuille() {
    this.fenetre.close();
    this.editeur.focaliser();
  }

  async rafraichir() {
    const documents = await this.documents.lister();
    const elements = documents.map((doc) => this.element(doc));
    if (elements.length === 0) {
      const vide = document.createElement('li');
      vide.className = 'liste-vide';
      vide.textContent = 'Aucun document.';
      elements.push(vide);
    }
    this.liste.replaceChildren(...elements);
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
    const nomTitre = document.createElement('span');
    nomTitre.className = 'document-titre';
    nomTitre.textContent = titre;
    const date = document.createElement('span');
    date.className = 'document-date';
    date.textContent = `Modifié le ${dateLisible(doc.modifieLe)}`;
    const apercu = document.createElement('span');
    apercu.className = 'document-extrait';
    apercu.textContent = extrait(doc.html) || 'Document vide';
    ouvrir.append(nomTitre);
    if (estOuvert) {
      const etiquette = document.createElement('span');
      etiquette.className = 'document-etiquette-ouvert';
      etiquette.textContent = 'Ouvert actuellement';
      ouvrir.append(etiquette);
    }
    ouvrir.append(date, apercu);
    ouvrir.addEventListener('click', async () => {
      await this.documents.ouvrir(doc.id);
      this.fermerVersLaFeuille();
    });

    const actions = document.createElement('div');
    actions.className = 'document-actions';
    actions.append(
      boutonIcone('i-dupliquer', `Dupliquer « ${titre} »`, 'Dupliquer', () => this.dupliquer(doc)),
      boutonIcone('i-supprimer', `Supprimer « ${titre} »`, 'Supprimer', (e) => this.supprimer(doc, e.currentTarget)),
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

  async supprimer(doc, bouton) {
    const titre = titreAffiche(doc);
    const confirme = await demander({
      titre: 'Supprimer le document',
      message: `Supprimer définitivement « ${titre} » ? Cette action est irréversible.`,
      confirmer: 'Supprimer',
      annuler: 'Annuler',
      danger: true,
      declencheur: bouton,
    });
    if (!confirme) return;
    await this.documents.supprimer(doc.id);
    await this.rafraichir();
    afficherMessage(`« ${titre} » a été supprimé.`);
    this.boutonNouveau.focus();
  }
}

function boutonIcone(icone, etiquette, infoBulle, action) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton bouton-icone bouton-discret';
  bouton.setAttribute('aria-label', etiquette);
  bouton.title = infoBulle;
  bouton.innerHTML = `<svg class="icone" aria-hidden="true"><use href="#${icone}"></use></svg>`;
  bouton.addEventListener('click', action);
  return bouton;
}
