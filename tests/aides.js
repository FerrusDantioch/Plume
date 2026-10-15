// Outils communs aux tests.
// Chaque test vérifie aussi, à la fin, que la console du navigateur n'a
// affiché aucune erreur.

import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  erreurs: [
    async ({ page }, utiliser) => {
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(`Erreur JavaScript : ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') erreurs.push(`Console : ${m.text()}`);
      });
      await utiliser(erreurs);
      expect(erreurs, 'La console du navigateur doit rester sans erreur').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Ouvre l'application et attend qu'elle soit prête. */
export async function ouvrir(page) {
  await page.goto('./');
  await page.locator('#feuille[contenteditable="true"]').waitFor();
}

/** Code HTML de la feuille, sans les caractères invisibles. */
export function contenu(page) {
  return page.evaluate(() => document.getElementById('feuille').innerHTML.replaceAll('​', ''));
}

/** Remplace le contenu de la feuille (comme un document ouvert). */
export async function remplir(page, html) {
  await page.evaluate((h) => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML = h;
    feuille.focus();
  }, html);
}

/**
 * Sélectionne un passage de texte. `occurrence` : 0 pour la première
 * apparition. Si `fin` est donné, sélectionne de `texte` jusqu'à la fin de `fin`.
 */
export async function selectionner(page, texte, { occurrence = 0, fin = null } = {}) {
  await page.evaluate(
    ({ texte, occurrence, fin }) => {
      const feuille = document.getElementById('feuille');
      const noeuds = [];
      let complet = '';
      const marcheur = document.createTreeWalker(feuille, NodeFilter.SHOW_TEXT);
      for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
        noeuds.push({ n, debut: complet.length });
        complet += n.data;
      }
      let index = -1;
      for (let i = 0; i <= occurrence; i++) index = complet.indexOf(texte, index + 1);
      if (index < 0) throw new Error(`Texte introuvable : ${texte}`);
      const finIndex = fin ? complet.indexOf(fin, index) + fin.length : index + texte.length;
      const point = (pos, versLaFin) => {
        for (const { n, debut } of noeuds) {
          const fin = debut + n.length;
          if (versLaFin ? pos > debut && pos <= fin : pos >= debut && pos < fin) return [n, pos - debut];
        }
        const dernier = noeuds.at(-1);
        return [dernier.n, dernier.n.length];
      };
      const plage = document.createRange();
      plage.setStart(...point(index, false));
      plage.setEnd(...point(finIndex, true));
      feuille.focus();
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(plage);
    },
    { texte, occurrence, fin },
  );
}

/** Place le curseur juste après un texte. */
export async function curseurApres(page, texte) {
  await page.evaluate((texte) => {
    const feuille = document.getElementById('feuille');
    const marcheur = document.createTreeWalker(feuille, NodeFilter.SHOW_TEXT);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const i = n.data.indexOf(texte);
      if (i >= 0) {
        feuille.focus();
        const plage = document.createRange();
        plage.setStart(n, i + texte.length);
        getSelection().removeAllRanges();
        getSelection().addRange(plage);
        return;
      }
    }
    throw new Error(`Texte introuvable : ${texte}`);
  }, texte);
}

/** Style calculé du texte (taille en points, couleur, fond…) à un endroit. */
export function styleDu(page, texte) {
  return page.evaluate((texte) => {
    const marcheur = document.createTreeWalker(document.getElementById('feuille'), NodeFilter.SHOW_TEXT);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      if (n.data.includes(texte)) {
        const s = getComputedStyle(n.parentElement);
        let fond = null;
        for (let e = n.parentElement; e && e.id !== 'feuille'; e = e.parentElement) {
          if (e.style.backgroundColor) {
            fond = e.style.backgroundColor;
            break;
          }
        }
        return {
          taille: Math.round(parseFloat(s.fontSize) * 0.75 * 2) / 2,
          couleur: s.color,
          fond,
          gras: parseInt(s.fontWeight, 10) >= 600,
          italique: s.fontStyle === 'italic',
          police: s.fontFamily,
        };
      }
    }
    throw new Error(`Texte introuvable : ${texte}`);
  }, texte);
}

export const commande = (page, nom) => page.click(`[data-commande="${nom}"]`);

export async function choisirCouleur(page, palette, nom) {
  await page.click(palette === 'surlignage' ? '#bouton-surlignage' : '#bouton-couleur');
  await page.locator(`.palette:not([hidden]) .pastille[aria-label="${nom}"]`).click();
}

/** Attend que l'enregistrement automatique soit terminé. */
export async function attendreEnregistrement(page) {
  await expect(page.locator('#etat-enregistrement')).toHaveText(/^Enregistré/, { timeout: 5000 });
}
