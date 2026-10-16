// Typographie française automatique, appliquée pendant la frappe :
// - espace insécable avant « : » et espace fine insécable avant « ; ! ? »
//   (ajoutée si besoin, ou remplace l'espace tapée) ;
// - guillemets droits " transformés en « » avec leurs espaces insécables ;
// - apostrophe droite ' transformée en apostrophe typographique ’.
// Une espace « insécable » empêche le signe de partir seul à la ligne suivante.
// Réglage : Menu → « Typographie française automatique ».

import { INVISIBLE, blocDe, plageDans, selectionner } from './selection.js';

export const ESPACE_INSECABLE = ' ';
export const ESPACE_FINE = ' ';

const DECLENCHEURS = new Set([':', ';', '!', '?', '"', '«', '»', "'", ' ']);
const ESPACES = new Set([' ', ESPACE_INSECABLE, ESPACE_FINE, '\t', '\n']);
const OUVRANTS = new Set(['(', '[', '{', '«', '‘', '“', '—', '–', '-', '/']);

/** Texte du bloc situé avant le caractère tapé (sans les caractères invisibles). */
function texteAvant(bloc, texte, decalage) {
  const plage = document.createRange();
  plage.setStart(bloc, 0);
  plage.setEnd(texte, decalage);
  return plage.toString().replaceAll(INVISIBLE, '');
}

/**
 * Corrige le caractère qui vient d'être tapé (juste avant le curseur).
 * Renvoie true si le texte a été modifié.
 */
export function corrigerTypographie(racine, caractere) {
  if (!DECLENCHEURS.has(caractere)) return false;
  const plage = plageDans(racine);
  if (!plage || !plage.collapsed) return false;
  const texte = plage.startContainer;
  const o = plage.startOffset;
  if (texte.nodeType !== 3 || o < 1 || texte.data[o - 1] !== caractere) return false;

  // Espace tapée juste après « et son espace insécable : elle est en trop.
  if (caractere === ' ') {
    if (o < 3 || texte.data[o - 2] !== ESPACE_INSECABLE || texte.data[o - 3] !== '«') return false;
    texte.deleteData(o - 1, 1);
    const curseur = document.createRange();
    curseur.setStart(texte, o - 1);
    selectionner(curseur);
    return true;
  }

  const bloc = blocDe(texte, racine);
  if (!bloc) return false;
  const avant = texteAvant(bloc, texte, o - 1);
  const precedent = avant.at(-1);
  // L'espace précédente est-elle dans le même nœud de texte (modifiable ici) ?
  const espaceIci = o >= 2 && texte.data[o - 2] === ' ';

  const modifier = (debut, longueur, remplacement, curseur) => {
    texte.replaceData(debut, longueur, remplacement);
    const nouvelle = document.createRange();
    nouvelle.setStart(texte, curseur);
    selectionner(nouvelle);
    return true;
  };

  if (caractere === "'") return modifier(o - 1, 1, '’', o);

  if (caractere === ':' || caractere === ';' || caractere === '!' || caractere === '?') {
    const espace = caractere === ':' ? ESPACE_INSECABLE : ESPACE_FINE;
    if (precedent === undefined) return false;
    if (caractere === ':' && (/\d$/.test(avant) || /(?:^|[\s(])(?:https?|ftp|file|mailto)$/i.test(avant))) return false;
    if ('!?'.includes(caractere) && '!?'.includes(precedent)) return false; // « ?! », « !! »
    if (precedent === ' ') {
      const avantEspace = avant.at(-2);
      if (!espaceIci || avantEspace === undefined || ESPACES.has(avantEspace)) return false;
      return modifier(o - 2, 1, espace, o);
    }
    if (ESPACES.has(precedent)) return false;
    return modifier(o - 1, 1, espace + caractere, o + 1);
  }

  if (caractere === '"') {
    const ouvrant = precedent === undefined || ESPACES.has(precedent) || OUVRANTS.has(precedent);
    if (ouvrant) return modifier(o - 1, 1, `«${ESPACE_INSECABLE}`, o + 1);
    if (precedent === ' ' && espaceIci) return modifier(o - 2, 2, `${ESPACE_INSECABLE}»`, o);
    return modifier(o - 1, 1, `${ESPACE_INSECABLE}»`, o + 1);
  }

  if (caractere === '«') return modifier(o - 1, 1, `«${ESPACE_INSECABLE}`, o + 1);

  // caractere === '»'
  if (precedent === undefined) return false;
  if (precedent === ' ') return espaceIci ? modifier(o - 2, 1, ESPACE_INSECABLE, o) : false;
  if (ESPACES.has(precedent)) return false;
  return modifier(o - 1, 1, `${ESPACE_INSECABLE}»`, o + 1);
}
