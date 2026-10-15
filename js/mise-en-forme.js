// Mise en forme des caractères faite « à la main » : taille, police, couleur,
// surlignage et effacement de la mise en forme.
//
// Principe : pour chaque morceau de texte sélectionné,
// 1. on retire la propriété (ex. la couleur) des balises qui l'entourent,
//    en découpant ces balises pour ne pas toucher au texte voisin ;
// 2. on entoure le texte d'un <span style="..."> avec la nouvelle valeur ;
// 3. on fait le ménage : balises vides supprimées, balises identiques
//    voisines fusionnées.

import { blocDe, estBloc, estListe, estEnLigne, INVISIBLE } from './selection.js';
import { versHexa, policeDepuisCss } from './palettes.js';

const BALISES_SIMPLES = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE']);

/**
 * Découpe les ancêtres de `noeud` jusqu'à `limite` (exclue), pour que `noeud`
 * soit seul dans chacun d'eux. Les frères situés avant et après partent dans
 * des copies de ces ancêtres : leur mise en forme ne change pas.
 */
export function isoler(noeud, limite) {
  let enfant = noeud;
  let parent = noeud.parentNode;
  while (parent && parent !== limite) {
    if (enfant.previousSibling) {
      const avant = parent.cloneNode(false);
      while (parent.firstChild !== enfant) avant.appendChild(parent.firstChild);
      parent.parentNode.insertBefore(avant, parent);
    }
    if (enfant.nextSibling) {
      const apres = parent.cloneNode(false);
      while (enfant.nextSibling) apres.appendChild(enfant.nextSibling);
      parent.parentNode.insertBefore(apres, parent.nextSibling);
    }
    enfant = parent;
    parent = parent.parentNode;
  }
}

/** Remplace un élément par son contenu. */
export function deballer(element) {
  const parent = element.parentNode;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

/** Retire une propriété de style ; supprime l'attribut s'il devient vide. */
function retirerPropriete(element, propriete) {
  element.style.removeProperty(propriete);
  if (element.style.length === 0) {
    if (element.nodeName === 'SPAN') deballer(element);
    else element.removeAttribute('style');
  }
}

/** Couleur choisie explicitement pour ce texte (ou null). */
function couleurExplicite(texte, bloc) {
  for (let n = texte.parentNode; n && n !== bloc; n = n.parentNode) {
    const couleur = n.style?.getPropertyValue('color');
    if (couleur) return couleur;
  }
  return null;
}

/** Taille réelle du texte, en points. */
export function taillePt(element) {
  return Math.round(parseFloat(getComputedStyle(element).fontSize) * 0.75 * 2) / 2;
}

/**
 * Applique `propriete: valeur` à un nœud de texte. `valeur` peut être null
 * (retour à la valeur par défaut) ou une fonction qui calcule la valeur à
 * partir du texte (utile pour A− et A+).
 */
export function styler(texte, propriete, valeur, racine) {
  const bloc = blocDe(texte, racine) ?? racine;
  if (typeof valeur === 'function') valeur = valeur(texte);

  // 1. Retirer la propriété des ancêtres qui la portent.
  let haut = null;
  for (let n = texte.parentNode; n && n !== bloc; n = n.parentNode) {
    if (n.style?.getPropertyValue(propriete)) haut = n;
  }
  if (haut) {
    const limite = haut.parentNode;
    isoler(texte, limite);
    for (let n = texte.parentNode; n && n !== limite; ) {
      const parent = n.parentNode;
      if (n.style?.getPropertyValue(propriete)) retirerPropriete(n, propriete);
      n = parent;
    }
  }
  if (!valeur) return;

  // Inutile d'ajouter une taille identique à celle héritée (ex. 12 pt).
  if (propriete === 'font-size' && taillePt(texte.parentNode) === parseFloat(valeur)) return;

  // 2. Entourer le texte d'un <span> portant la nouvelle valeur.
  const span = document.createElement('span');
  span.style.setProperty(propriete, valeur);
  // Un surlignage force le texte en sombre (voir redaction.css), sauf si une
  // couleur a été choisie : on la recopie pour qu'elle reste visible.
  if (propriete === 'background-color') {
    const couleur = couleurExplicite(texte, bloc);
    if (couleur) span.style.setProperty('color', couleur);
  }
  texte.parentNode.insertBefore(span, texte);
  span.appendChild(texte);
  remonter(span, bloc);
}

/**
 * Fait passer le <span> au-dessus des balises simples (<b>, <i>…) qui ne
 * contiennent que lui. Le rendu est identique, mais les <span> voisins
 * peuvent ensuite être fusionnés : le code HTML reste propre.
 */
function remonter(span, bloc) {
  let parent = span.parentNode;
  while (parent !== bloc && BALISES_SIMPLES.has(parent.nodeName) && !parent.hasAttribute('style') && parent.childNodes.length === 1) {
    parent.parentNode.insertBefore(span, parent);
    while (span.firstChild) parent.appendChild(span.firstChild);
    span.appendChild(parent);
    parent = span.parentNode;
  }
}

const BALISES_BARRE = new Set(['S', 'STRIKE']);

/** Vrai si le texte est barré (dans une balise <s>). */
export function estBarre(texte, racine) {
  const bloc = blocDe(texte, racine) ?? racine;
  for (let n = texte.parentNode; n && n !== bloc; n = n.parentNode) {
    if (BALISES_BARRE.has(n.nodeName)) return true;
  }
  return false;
}

/** Barre (activer = true) ou débarre un nœud de texte. */
export function barrer(texte, activer, racine) {
  const bloc = blocDe(texte, racine) ?? racine;
  if (activer) {
    if (estBarre(texte, racine)) return;
    const s = document.createElement('s');
    texte.parentNode.insertBefore(s, texte);
    s.appendChild(texte);
    return;
  }
  let haut = null;
  for (let n = texte.parentNode; n && n !== bloc; n = n.parentNode) {
    if (BALISES_BARRE.has(n.nodeName)) haut = n;
  }
  if (!haut) return;
  const limite = haut.parentNode;
  isoler(texte, limite);
  for (let n = texte.parentNode; n && n !== limite; ) {
    const parent = n.parentNode;
    if (BALISES_BARRE.has(n.nodeName)) deballer(n);
    n = parent;
  }
}

/** Retire toute mise en forme de caractères autour d'un nœud de texte. */
export function effacerFormat(texte, racine) {
  const bloc = blocDe(texte, racine) ?? racine;
  if (texte.parentNode === bloc) return;
  isoler(texte, bloc);
  for (let n = texte.parentNode; n && n !== bloc; ) {
    const parent = n.parentNode;
    if (estEnLigne(n)) deballer(n);
    n = parent;
  }
}

/**
 * Insère un caractère invisible à l'endroit du curseur et renvoie son nœud :
 * la mise en forme choisie lui est appliquée, et le texte tapé ensuite s'y
 * ajoute. Si le curseur est déjà dans un tel caractère, on le réutilise.
 */
export function insererSupportInvisible(plage) {
  const { startContainer: conteneur, startOffset: decalage } = plage;
  if (conteneur.nodeType === 3 && conteneur.data === INVISIBLE) return { texte: conteneur, ajoute: false };
  const texte = document.createTextNode(INVISIBLE);
  if (conteneur.nodeType === 3) {
    const suite = conteneur.splitText(decalage);
    suite.parentNode.insertBefore(texte, suite);
  } else {
    conteneur.insertBefore(texte, conteneur.childNodes[decalage] ?? null);
  }
  return { texte, ajoute: true };
}

/** Deux balises en ligne qui peuvent être fusionnées. */
function memeFormat(a, b) {
  return (
    a.nodeType === 1 &&
    b.nodeType === 1 &&
    a.nodeName === b.nodeName &&
    estEnLigne(a) &&
    (a.getAttribute('style') ?? '') === (b.getAttribute('style') ?? '')
  );
}

/**
 * Ménage dans un bloc : supprime les balises en ligne vides ou sans effet,
 * fusionne les balises identiques voisines et les nœuds de texte voisins.
 */
export function nettoyerEnLigne(element) {
  for (let enfant = element.firstChild; enfant; ) {
    const suivant = enfant.nextSibling;
    if (enfant.nodeType === 3 && enfant.length === 0) {
      enfant.remove();
    } else if (estEnLigne(enfant)) {
      nettoyerEnLigne(enfant);
      if (!enfant.firstChild) enfant.remove();
      else if (enfant.nodeName === 'SPAN' && enfant.style.length === 0) deballer(enfant);
    }
    enfant = suivant;
  }
  for (let enfant = element.firstChild; enfant; ) {
    const suivant = enfant.nextSibling;
    if (suivant && memeFormat(enfant, suivant)) {
      while (suivant.firstChild) enfant.appendChild(suivant.firstChild);
      suivant.remove();
      nettoyerEnLigne(enfant);
      continue;
    }
    enfant = suivant;
  }
  element.normalize();
}

// Styles que le navigateur peut ajouter de lui-même et que l'on garde.
const STYLES_EN_LIGNE_PERMIS = new Set([
  'font-size', 'font-family', 'color', 'background-color', 'font-weight', 'font-style',
  'text-decoration', 'text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness',
]);

/**
 * Retire d'un <span> les styles qui ne changent rien (même valeur que le
 * texte qui l'entoure, ex. « 12 pt » dans un paragraphe de 12 pt).
 */
function retirerStylesRedondants(span) {
  const propres = getComputedStyle(span);
  const autour = getComputedStyle(span.parentElement);
  for (const propriete of ['font-size', 'font-weight', 'font-style', 'font-family', 'color']) {
    if (!span.style.getPropertyValue(propriete)) continue;
    // Sur un surlignage, la couleur choisie doit rester écrite (sinon le
    // texte serait forcé en sombre).
    if (propriete === 'color' && span.style.getPropertyValue('background-color')) continue;
    if (propres.getPropertyValue(propriete) === autour.getPropertyValue(propriete)) span.style.removeProperty(propriete);
  }
}

/**
 * Chrome ajoute parfois des styles quand on fusionne deux paragraphes
 * (touche Retour arrière) : il recopie alors la couleur du thème, la police
 * par défaut ou des tailles en pixels. Cette fonction retire ces ajouts pour
 * que le document reste indépendant du thème. Renvoie true si modifié.
 */
export function nettoyerStylesAjoutes(racine) {
  let change = false;
  const styles = getComputedStyle(racine);
  const couleursDuTheme = new Set([versHexa(styles.color), versHexa(styles.getPropertyValue('--texte-surligne'))]);
  for (const element of [...racine.querySelectorAll('[style]')]) {
    const avant = element.getAttribute('style');
    const bloc = estBloc(element) || estListe(element);
    for (const propriete of [...element.style]) {
      const valeur = element.style.getPropertyValue(propriete);
      const garder = bloc ? propriete === 'text-align' : STYLES_EN_LIGNE_PERMIS.has(propriete);
      if (!garder) element.style.removeProperty(propriete);
      else if (propriete === 'color' && couleursDuTheme.has(versHexa(valeur))) element.style.removeProperty(propriete);
      else if (propriete === 'background-color' && !versHexa(valeur)) element.style.removeProperty(propriete);
      else if (propriete === 'font-family' && policeDepuisCss(valeur)?.pile == null) element.style.removeProperty(propriete);
      else if (propriete === 'font-size' && valeur.endsWith('px')) {
        element.style.setProperty('font-size', `${Math.round(parseFloat(valeur) * 0.75 * 2) / 2}pt`);
      }
    }
    if (element.nodeName === 'SPAN' && element.style.length) retirerStylesRedondants(element);
    if (element.getAttribute('style') === avant) continue;
    change = true;
    if (element.style.length === 0) {
      if (element.nodeName === 'SPAN') deballer(element);
      else element.removeAttribute('style');
    }
  }
  // <strike> (ajouté par le navigateur pour « barré ») devient <s>.
  for (const ancien of [...racine.querySelectorAll('strike')]) {
    const s = document.createElement('s');
    while (ancien.firstChild) s.appendChild(ancien.firstChild);
    ancien.replaceWith(s);
    change = true;
  }
  return change;
}
