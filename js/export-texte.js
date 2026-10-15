// Export en texte brut (.txt) : le texte seul, sans mise en forme.
// Un paragraphe par ligne ; les éléments de liste commencent par « • » ou
// par leur numéro. Le fichier est en UTF-8 avec une marque d'encodage (BOM)
// et des fins de ligne Windows (CRLF) : les accents s'affichent correctement
// même dans les anciens éditeurs de texte de Windows.

const FIN_DE_LIGNE = '\r\n';

/** Texte d'un bloc ; un <br> final (qui ne crée pas de ligne) est ignoré. */
function texteDuBloc(bloc) {
  let texte = '';
  const marcheur = document.createTreeWalker(bloc, NodeFilter.SHOW_ALL);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (n.nodeType === 3) texte += n.data;
    else if (n.nodeName === 'BR') texte += '\n';
  }
  return texte.replace(/\n$/, '').replace(/​/g, '');
}

/**
 * @param {HTMLElement} conteneur  contenu nettoyé (voir sanitize.js : contenuPropre)
 * @returns {string}
 */
export function creerTexte(conteneur) {
  const lignes = [];
  for (const bloc of conteneur.children) {
    if (bloc.nodeName === 'UL' || bloc.nodeName === 'OL') {
      let numero = 1;
      for (const li of bloc.children) {
        lignes.push(`${bloc.nodeName === 'OL' ? `${numero++}.` : '•'} ${texteDuBloc(li)}`);
      }
    } else {
      lignes.push(texteDuBloc(bloc));
    }
  }
  return `﻿${lignes.join('\n').replace(/\n/g, FIN_DE_LIGNE)}${FIN_DE_LIGNE}`;
}
