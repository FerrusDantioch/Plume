// Outils pour manipuler la sélection dans la feuille de rédaction.
//
// Vocabulaire :
// - un « bloc » est un paragraphe, un titre ou un élément de liste ;
// - un « point » est un endroit précis du texte : un nœud et un décalage ;
// - une « position » est un simple nombre (voir positionDe plus bas).

export const BALISES_BLOC = new Set(['P', 'H1', 'H2', 'H3', 'LI']);
export const BALISES_LISTE = new Set(['UL', 'OL']);
export const BALISES_EN_LIGNE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN']);

// Caractère de largeur nulle : il sert de support invisible quand on choisit
// une mise en forme sans rien sélectionner (le texte tapé ensuite s'y loge).
// Il n'est jamais compté, ni enregistré, ni copié.
export const INVISIBLE = '\u200B';

export const estBloc = (n) => n?.nodeType === 1 && BALISES_BLOC.has(n.nodeName);
export const estListe = (n) => n?.nodeType === 1 && BALISES_LISTE.has(n.nodeName);
export const estEnLigne = (n) => n?.nodeType === 1 && BALISES_EN_LIGNE.has(n.nodeName);

/** Bloc (paragraphe, titre, élément de liste) qui contient ce nœud. */
export function blocDe(noeud, racine) {
  for (let n = noeud; n && n !== racine; n = n.parentNode) {
    if (estBloc(n)) return n;
  }
  return null;
}

/** Plage sélectionnée si elle se trouve dans la racine, sinon null. */
export function plageDans(racine) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const plage = selection.getRangeAt(0);
  return racine.contains(plage.commonAncestorContainer) ? plage : null;
}

export function selectionner(plage) {
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(plage);
}

/** Parcourt tous les nœuds sous la racine, dans l'ordre de lecture. */
export function* parcourir(racine) {
  let n = racine.firstChild;
  while (n) {
    yield n;
    if (n.firstChild) {
      n = n.firstChild;
      continue;
    }
    while (n !== racine && !n.nextSibling) n = n.parentNode;
    if (n === racine) return;
    n = n.nextSibling;
  }
}

// --- Positions --------------------------------------------------------------
// Une position est le nombre de caractères avant un point, en comptant 1 pour
// chaque début de bloc et chaque saut de ligne. Ce nombre ne change pas quand
// on réorganise les balises autour du texte (ajout d'un <span>, découpage d'un
// nœud…) : il permet donc de retrouver la sélection après une modification,
// et de l'enregistrer dans l'historique.

function poids(n) {
  if (n.nodeType === 3) return n.length;
  if (n.nodeName === 'BR' || estBloc(n)) return 1;
  return 0;
}

/** Nœud qui suit tout le sous-arbre de `noeud` (ou null). */
function suivantHorsSousArbre(noeud, racine) {
  for (let n = noeud; n && n !== racine; n = n.parentNode) {
    if (n.nextSibling) return n.nextSibling;
  }
  return null;
}

export function positionDe(racine, conteneur, decalage) {
  let total = 0;
  if (conteneur.nodeType === 3) {
    for (const n of parcourir(racine)) {
      if (n === conteneur) return total + decalage;
      total += poids(n);
    }
    return total;
  }
  // Point dans un élément : il se situe juste avant son enfant n° decalage.
  const cible =
    conteneur.childNodes[decalage] ?? (conteneur === racine ? null : suivantHorsSousArbre(conteneur, racine));
  for (const n of parcourir(racine)) {
    if (n === cible) return total;
    total += poids(n);
  }
  return total;
}

/**
 * Point correspondant à une position. Quand deux points sont possibles (fin
 * d'un nœud de texte et début du suivant), `preference` choisit : « avant »
 * garde la mise en forme du texte précédent (comportement normal du curseur),
 * « apres » prend le nœud suivant (utile pour le début d'une sélection).
 */
export function pointDe(racine, position, preference = 'avant') {
  let total = 0;
  let trouve = null;
  let dernierTexte = null;
  for (const n of parcourir(racine)) {
    if (total > position) break;
    if (n.nodeType === 3) {
      if (position >= total && position <= total + n.length) {
        const point = { noeud: n, decalage: position - total };
        if (preference === 'avant') return point;
        trouve = point;
      }
      dernierTexte = n;
    } else if (n.nodeName === 'BR' && position === total) {
      const point = { noeud: n.parentNode, decalage: indexDe(n) };
      if (preference === 'avant') return point;
      trouve = point;
    }
    total += poids(n);
    if (estBloc(n) && position === total && !n.firstChild) {
      const point = { noeud: n, decalage: 0 };
      if (preference === 'avant') return point;
      trouve = point;
    }
  }
  if (trouve) return trouve;
  // Position introuvable : début du premier bloc, ou fin du dernier texte.
  if (position <= 0 || !dernierTexte) {
    const premier = racine.querySelector('p, h1, h2, h3, li') ?? racine;
    return { noeud: premier, decalage: 0 };
  }
  return { noeud: dernierTexte, decalage: dernierTexte.length };
}

export function indexDe(noeud) {
  let i = 0;
  for (let n = noeud.previousSibling; n; n = n.previousSibling) i++;
  return i;
}

/** Sélection actuelle sous forme de deux positions, ou null. */
export function lirePositions(racine) {
  const plage = plageDans(racine);
  if (!plage) return null;
  return {
    debut: positionDe(racine, plage.startContainer, plage.startOffset),
    fin: positionDe(racine, plage.endContainer, plage.endOffset),
  };
}

/** Sélectionne le texte entre deux positions. */
export function ecrirePositions(racine, positions) {
  if (!positions) return null;
  const replie = positions.debut === positions.fin;
  const a = pointDe(racine, positions.debut, replie ? 'avant' : 'apres');
  const b = replie ? a : pointDe(racine, positions.fin, 'avant');
  const plage = document.createRange();
  plage.setStart(a.noeud, a.decalage);
  plage.setEnd(b.noeud, b.decalage);
  selectionner(plage);
  return plage;
}

// --- Repères qui survivent à un déplacement de nœuds ------------------------
// Utilisés pour les réparations de structure (ex. : envelopper du texte dans
// un <p>), où les nœuds de texte sont déplacés mais pas modifiés.

function repere(conteneur, decalage) {
  if (conteneur.nodeType === 3) return { texte: conteneur, decalage };
  return { parent: conteneur, enfant: conteneur.childNodes[decalage] ?? null };
}

function pointDuRepere(r, racine) {
  if (r.texte) return racine.contains(r.texte) ? { noeud: r.texte, decalage: Math.min(r.decalage, r.texte.length) } : null;
  if (r.enfant) return racine.contains(r.enfant) ? { noeud: r.enfant.parentNode, decalage: indexDe(r.enfant) } : null;
  return racine.contains(r.parent) ? { noeud: r.parent, decalage: r.parent.childNodes.length } : null;
}

/**
 * Exécute `modifier()` en conservant la sélection. `modifier` renvoie true
 * s'il a changé quelque chose. On essaie d'abord de retrouver les mêmes nœuds,
 * sinon on se sert des positions.
 */
export function avecSelectionConservee(racine, modifier) {
  const plage = plageDans(racine);
  if (!plage) return modifier();
  const positions = lirePositions(racine);
  const reperes = [repere(plage.startContainer, plage.startOffset), repere(plage.endContainer, plage.endOffset)];
  const change = modifier();
  if (!change) return false;
  const a = pointDuRepere(reperes[0], racine);
  const b = pointDuRepere(reperes[1], racine);
  if (a && b) {
    const nouvelle = document.createRange();
    nouvelle.setStart(a.noeud, a.decalage);
    nouvelle.setEnd(b.noeud, b.decalage);
    selectionner(nouvelle);
  } else {
    ecrirePositions(racine, positions);
  }
  return true;
}

// --- Contenu d'une plage ----------------------------------------------------

/**
 * Coupe les nœuds de texte aux bornes de la plage, pour que chaque nœud de
 * texte soit soit entièrement dedans, soit entièrement dehors.
 */
export function couperAuxBornes(plage) {
  let { startContainer: sc, startOffset: so, endContainer: ec, endOffset: eo } = plage;
  if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
  if (sc.nodeType === 3 && so > 0 && so < sc.length) {
    const suite = sc.splitText(so);
    if (ec === sc) {
      ec = suite;
      eo -= so;
    }
    sc = suite;
    so = 0;
  }
  plage.setStart(sc, so);
  plage.setEnd(ec, eo);
}

/** Nœuds de texte (non vides) contenus dans la plage. */
export function textesDe(plage) {
  const commun = plage.commonAncestorContainer;
  const resultat = [];
  const garder = (n) => {
    if (n.length === 0 || !plage.intersectsNode(n)) return;
    if (n === plage.startContainer && plage.startOffset >= n.length) return;
    if (n === plage.endContainer && plage.endOffset === 0) return;
    resultat.push(n);
  };
  if (commun.nodeType === 3) {
    garder(commun);
    return resultat;
  }
  const marcheur = document.createTreeWalker(commun, NodeFilter.SHOW_TEXT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) garder(n);
  return resultat;
}

/** Blocs touchés par la plage, dans l'ordre. */
export function blocsDe(plage, racine) {
  const blocs = [];
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (estBloc(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (!plage.intersectsNode(n)) continue;
    // Une sélection qui s'arrête tout au début d'un bloc ne le concerne pas
    // (cas du triple-clic, qui sélectionne jusqu'au début du bloc suivant).
    if (!plage.collapsed && blocs.length > 0 && finEstAuDebutDe(plage, n)) continue;
    blocs.push(n);
  }
  if (blocs.length === 0) {
    const bloc = blocDe(plage.startContainer, racine);
    if (bloc) blocs.push(bloc);
  }
  return blocs;
}

function finEstAuDebutDe(plage, bloc) {
  const avant = document.createRange();
  avant.setStart(bloc, 0);
  try {
    avant.setEnd(plage.endContainer, plage.endOffset);
  } catch {
    return false;
  }
  if (avant.collapsed && (plage.endContainer !== bloc || plage.endOffset !== 0)) return false;
  return avant.toString().replaceAll(INVISIBLE, '') === '' && !avant.cloneContents().querySelector('br');
}
