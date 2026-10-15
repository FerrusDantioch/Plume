// Assemblage de l'application : relie l'éditeur, la barre d'outils, les
// documents, les fenêtres, les thèmes, l'export PDF et le mode hors ligne.

import { creerChoixTheme } from './theme.js';
import {
  creerPreferences, ouvrirStockage, creerSauvegarde, lireSauvegarde, nomFichierSauvegarde, telecharger,
} from './storage.js';
import { Editeur } from './editor.js';
import { BarreOutils } from './barre-outils.js';
import { Documents, titreAffiche } from './documents.js';
import { TiroirDocuments, dateLisible } from './tiroir-documents.js';
import { initialiserFenetres, ouvrirFenetre, demander, informer, afficherMessage, remplirAPropos } from './ui.js';
import { ExportPdf } from './impression.js';
import { demarrerServiceWorker, estInstallee, installationPossible, installer, surChangementInstallation } from './pwa.js';

const CONFIG = globalThis.CONFIG_APP;
const $ = (id) => document.getElementById(id);
const formatNombre = new Intl.NumberFormat('fr-FR');
const accorder = (n, mot) => `${formatNombre.format(n)} ${mot}${n > 1 ? 's' : ''}`;

async function demarrer() {
  document.title = CONFIG.nom;
  const preferences = creerPreferences(CONFIG.idStockage);
  initialiserFenetres();
  suivreModaliteSaisie();
  suivreZoneVisible();
  empecherOuvertureDeFichiersDeposes();
  creerChoixTheme({ conteneur: $('choix-themes'), preferences });
  remplirAPropos($('fenetre-a-propos'), CONFIG);

  // --- Éditeur et barre d'outils ---
  const feuille = $('feuille');
  let documents = null;
  const compteur = creerCompteur($('compteur'));
  const editeur = new Editeur(feuille, {
    surModification: () => {
      documents?.signalerModification();
      compteur.planifier(editeur);
    },
  });
  const barre = new BarreOutils({ barre: $('barre-outils'), editeur });
  editeur.surEtat = (etat) => barre.mettreAJour(etat);

  // --- Documents ---
  const stockage = await ouvrirStockage({ nom: CONFIG.idStockage });
  const champTitre = $('titre-document');
  documents = new Documents({
    stockage,
    preferences,
    editeur,
    champTitre,
    indiquer: creerIndicateur($('etat-enregistrement')),
    surAffichage: () => compteur.planifier(editeur, true),
  });
  await documents.demarrer();
  editeur.activer(true);

  champTitre.addEventListener('input', () => documents.signalerModification());
  champTitre.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editeur.focaliser();
    }
  });

  if (stockage.mode !== 'indexeddb') avertirStockage(stockage.mode);

  // Enregistrement immédiat quand la page passe en arrière-plan ou se ferme.
  const enregistrerAvantFermeture = () => {
    documents.ecrireSecours();
    documents.enregistrer();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enregistrerAvantFermeture();
  });
  window.addEventListener('pagehide', enregistrerAvantFermeture);

  // --- Panneau « Mes documents » ---
  new TiroirDocuments({
    fenetre: $('tiroir-documents'),
    liste: $('liste-documents'),
    boutonOuvrir: $('bouton-documents'),
    boutonNouveau: $('bouton-nouveau-document'),
    documents,
    editeur,
  });

  // --- Export PDF ---
  const exportPdf = new ExportPdf({
    preferences,
    fenetreAide: $('fenetre-aide-pdf'),
    titre: () => titreAffiche({ titre: champTitre.value }),
    avant: () => documents.enregistrer(),
  });
  $('bouton-pdf').addEventListener('click', (e) => exportPdf.exporter(e.currentTarget));

  // --- Menu ---
  const menu = $('fenetre-menu');
  const boutonMenu = $('bouton-menu');
  boutonMenu.addEventListener('click', () => {
    ouvrirFenetre(menu, { declencheur: boutonMenu });
    placerMenu(menu, boutonMenu);
    menu.querySelector('input[name="theme"]:checked')?.focus();
  });
  $('bouton-sauvegarder').addEventListener('click', async () => {
    menu.close();
    await sauvegarderTout(documents);
  });
  const fichier = $('fichier-restauration');
  $('bouton-restaurer').addEventListener('click', () => {
    menu.close();
    fichier.value = '';
    fichier.click();
  });
  fichier.addEventListener('change', () => {
    if (fichier.files?.[0]) restaurer(fichier.files[0], documents, boutonMenu);
  });
  $('bouton-installer').addEventListener('click', (e) => {
    preparerAideInstallation();
    ouvrirFenetre($('fenetre-installation'), { declencheur: e.currentTarget, repli: boutonMenu });
  });
  $('bouton-installer-maintenant').addEventListener('click', async () => {
    if (await installer()) $('fenetre-installation').close();
  });
  surChangementInstallation(preparerAideInstallation);
  $('bouton-a-propos').addEventListener('click', (e) => {
    ouvrirFenetre($('fenetre-a-propos'), { declencheur: e.currentTarget, repli: boutonMenu });
  });

  // --- Raccourcis clavier généraux ---
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
    const touche = e.key.toLowerCase();
    if (touche === 's') {
      e.preventDefault();
      documents.enregistrer({ forcer: true }).then((ok) => {
        if (ok) afficherMessage('Enregistré.', { duree: 2000 });
      });
      return;
    }
    if (touche === 'p') {
      e.preventDefault();
      if (!document.querySelector('dialog[open]')) exportPdf.exporter(document.activeElement);
      return;
    }
    // Annuler / Rétablir : sauf dans un champ de saisie (titre…), qui garde
    // son propre historique.
    const dansUnChamp = e.target.closest?.('input, textarea, select');
    if (dansUnChamp || document.querySelector('dialog[open]')) return;
    if (touche === 'z' && !e.shiftKey) {
      e.preventDefault();
      editeur.annuler();
    } else if (touche === 'y' || (touche === 'z' && e.shiftKey)) {
      e.preventDefault();
      editeur.retablir();
    }
  });

  $('lien-evitement').addEventListener('click', (e) => {
    e.preventDefault();
    editeur.focaliser();
  });

  // --- Hors ligne et mises à jour ---
  demarrerServiceWorker({
    surMiseAJour: (appliquer) =>
      afficherMessage('Une nouvelle version est disponible.', { action: 'Recharger', surAction: appliquer, duree: 0 }),
    avantRechargement: () => documents.enregistrer(),
  });
}

// --- Indicateur d'enregistrement et compteur --------------------------------

function creerIndicateur(element) {
  const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  let dernier = '';
  return (etat, dateIso) => {
    let texte = 'Modification…';
    if (etat === 'erreur') texte = "Erreur d'enregistrement";
    else if (etat === 'enregistre') {
      const date = dateIso ? new Date(dateIso) : new Date();
      const aujourdhui = date.toDateString() === new Date().toDateString();
      texte = aujourdhui ? `Enregistré à ${heure.format(date)}` : `Enregistré le ${dateLisible(dateIso)}`;
    }
    element.dataset.etat = etat;
    // On ne réécrit pas un texte identique (évite des annonces répétées).
    if (texte !== dernier) {
      element.textContent = texte;
      dernier = texte;
    }
    if (etat === 'erreur') {
      afficherMessage("Le document n'a pas pu être enregistré. Fais une sauvegarde depuis le menu par précaution.", { duree: 8000 });
    }
  };
}

function creerCompteur(element) {
  let minuterie = 0;
  const afficher = (editeur) => {
    const { mots, caracteres } = editeur.compter();
    element.textContent = `${accorder(mots, 'mot')} · ${accorder(caracteres, 'caractère')}`;
  };
  return {
    planifier(editeur, immediat = false) {
      clearTimeout(minuterie);
      if (immediat) afficher(editeur);
      else minuterie = setTimeout(() => afficher(editeur), 200);
    },
  };
}

// --- Sauvegarde et restauration par fichier ----------------------------------

async function sauvegarderTout(documents) {
  await documents.enregistrer();
  const tous = await documents.lister();
  const contenu = JSON.stringify(creerSauvegarde(tous, CONFIG), null, 1);
  telecharger(nomFichierSauvegarde(CONFIG), contenu);
  afficherMessage(`Sauvegarde téléchargée : ${accorder(tous.length, 'document')}.`);
}

async function restaurer(fichier, documents, declencheur) {
  let liste;
  try {
    liste = lireSauvegarde(await fichier.text(), CONFIG);
  } catch (erreur) {
    await informer({ titre: 'Restauration impossible', message: erreur.message, declencheur });
    return;
  }
  const confirme = await demander({
    titre: 'Restaurer une sauvegarde',
    message: `Ce fichier contient ${accorder(liste.length, 'document')}. Ils seront ajoutés à tes documents actuels. Aucun document existant ne sera remplacé.`,
    confirmer: 'Ajouter les documents',
    annuler: 'Annuler',
    declencheur,
  });
  if (!confirme) return;
  try {
    const { ajoutes, dejaPresents } = await documents.restaurer(liste);
    let message = `${accorder(ajoutes, 'document')} ${ajoutes > 1 ? 'ajoutés' : 'ajouté'}.`;
    if (dejaPresents > 0) {
      message += ` ${accorder(dejaPresents, 'document')} ${dejaPresents > 1 ? 'étaient' : 'était'} déjà ${dejaPresents > 1 ? 'présents' : 'présent'} à l'identique : rien n'a été ajouté en double.`;
    }
    await informer({ titre: 'Restauration terminée', message, declencheur });
  } catch (erreur) {
    console.warn('Erreur de restauration :', erreur);
    await informer({
      titre: 'Restauration interrompue',
      message: "Une erreur s'est produite pendant l'ajout des documents. Les documents déjà ajoutés sont conservés.",
      declencheur,
    });
  }
}

// --- Aides diverses -------------------------------------------------------------

function avertirStockage(mode) {
  const message =
    mode === 'localstorage'
      ? 'Le stockage principal du navigateur est indisponible. Tes documents sont gardés dans un stockage de secours, plus petit. Pense à faire des sauvegardes depuis le menu.'
      : "Ce navigateur n'autorise pas l'enregistrement (navigation privée ?). Tes documents seront perdus à la fermeture de la page. Utilise « Sauvegarder tous mes documents » dans le menu.";
  afficherMessage(message, { duree: 0 });
}

function preparerAideInstallation() {
  $('installation-deja-faite').hidden = !estInstallee();
  $('bouton-installer-maintenant').hidden = !installationPossible();
}

/** Place le menu sous son bouton, aligné à droite. */
function placerMenu(menu, bouton) {
  const r = bouton.getBoundingClientRect();
  const largeurVue = document.documentElement.clientWidth;
  menu.style.top = `${Math.round(r.bottom + 6)}px`;
  menu.style.right = `${Math.max(8, Math.round(largeurVue - r.right))}px`;
  menu.style.left = 'auto';
  menu.style.maxHeight = `calc(100dvh - ${Math.round(r.bottom + 18)}px)`;
}

/** Clavier ou pointeur ? Sert à n'afficher le contour de la feuille qu'au clavier. */
function suivreModaliteSaisie() {
  const racine = document.documentElement;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') racine.dataset.modalite = 'clavier';
  });
  document.addEventListener('pointerdown', () => {
    racine.dataset.modalite = 'pointeur';
  });
}

/**
 * Sur téléphone, le clavier virtuel réduit la zone visible : la hauteur de
 * l'application suit cette zone, pour que la barre d'outils reste visible.
 */
function suivreZoneVisible() {
  const zone = window.visualViewport;
  if (!zone) return;
  const racine = document.documentElement;
  const mettreAJour = () => {
    if (Math.abs(zone.scale - 1) > 0.01) return; // zoom manuel : on ne touche à rien
    racine.style.setProperty('--hauteur-visible', `${Math.round(zone.height)}px`);
    racine.style.setProperty('--decalage-visible', `${Math.round(zone.offsetTop)}px`);
    garderCurseurVisible();
  };
  zone.addEventListener('resize', mettreAJour);
  zone.addEventListener('scroll', mettreAJour);
  mettreAJour();
}

function garderCurseurVisible() {
  const selection = document.getSelection();
  const feuille = $('feuille');
  if (!selection?.rangeCount || document.activeElement !== feuille) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  const zone = $('zone-ecriture').getBoundingClientRect();
  if (rect.height === 0 && rect.top === 0) return;
  if (rect.bottom > zone.bottom - 12) $('zone-ecriture').scrollBy({ top: rect.bottom - zone.bottom + 48 });
  else if (rect.top < zone.top + 12) $('zone-ecriture').scrollBy({ top: rect.top - zone.top - 48 });
}

/** Un fichier déposé hors de la feuille ne doit pas remplacer l'application. */
function empecherOuvertureDeFichiersDeposes() {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

demarrer().catch((erreur) => {
  console.warn('Démarrage impossible :', erreur);
  afficherMessage(
    "L'application n'a pas pu démarrer. Recharge la page. Si le problème continue, écris à l'adresse indiquée dans « À propos ».",
    { duree: 0 },
  );
});
