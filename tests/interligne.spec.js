// Interligne : simple, 1,5 (par défaut) ou double, par paragraphe.

import { test, expect, ouvrir, contenu, remplir, selectionner, curseurApres } from './aides.js';

async function choisirInterligne(page, nom) {
  await page.click('#bouton-interligne');
  await page.locator('.palette:not([hidden]) .choix', { hasText: nom }).click();
}

const choixActuel = (page) => page.locator('#palette-bouton-interligne .choix[aria-pressed="true"]');

test('double, simple, puis retour à 1,5 ; le bouton montre le choix actuel', async ({ page }) => {
  await ouvrir(page);
  await remplir(page, '<p>un</p><p>deux</p><h2>trois</h2>');
  await selectionner(page, 'un', { fin: 'deux' });
  await choisirInterligne(page, 'Double');
  expect(await contenu(page)).toBe('<p style="line-height: 2;">un</p><p style="line-height: 2;">deux</p><h2>trois</h2>');
  const hauteur = await page.locator('#feuille p').first().evaluate((p) => getComputedStyle(p).lineHeight);
  expect(hauteur).toBe('32px'); // 12 pt = 16 px, double = 32 px

  await curseurApres(page, 'deux');
  await page.click('#bouton-interligne');
  await expect(choixActuel(page)).toHaveText('Double');
  await page.keyboard.press('Escape');

  await selectionner(page, 'deux', { fin: 'trois' });
  await choisirInterligne(page, 'Simple');
  expect(await contenu(page)).toBe('<p style="line-height: 2;">un</p><p style="line-height: 1.15;">deux</p><h2 style="line-height: 1.15;">trois</h2>');

  await selectionner(page, 'un', { fin: 'trois' });
  await choisirInterligne(page, '1,5 (par défaut)');
  expect(await contenu(page)).toBe('<p>un</p><p>deux</p><h2>trois</h2>');
  await curseurApres(page, 'un');
  await page.click('#bouton-interligne');
  await expect(choixActuel(page)).toHaveText('1,5 (par défaut)');

  // Annuler revient au simple.
  await page.keyboard.press('Escape');
  await page.click('[data-commande="annuler"]');
  expect(await contenu(page)).toBe('<p style="line-height: 2;">un</p><p style="line-height: 1.15;">deux</p><h2 style="line-height: 1.15;">trois</h2>');
});

test('Entrée garde l’interligne ; le style de paragraphe et les listes aussi', async ({ page }) => {
  await ouvrir(page);
  await remplir(page, '<p style="line-height: 2;">premier</p>');
  await curseurApres(page, 'premier');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  expect(await contenu(page)).toBe('<p style="line-height: 2;">premier</p><p style="line-height: 2;">second</p>');
  await page.selectOption('#choix-style', 'h1');
  await selectionner(page, 'premier');
  await page.click('[data-commande="liste-puces"]');
  expect(await contenu(page)).toBe('<ul><li style="line-height: 2;">premier</li></ul><h1 style="line-height: 2;">second</h1>');
});

test('au clavier : flèches haut et bas dans la liste des interlignes', async ({ page }) => {
  await ouvrir(page);
  await remplir(page, '<p>mot</p>');
  await curseurApres(page, 'mot');
  await page.locator('#bouton-interligne').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.palette:not([hidden]) .choix[aria-label="1,5 (par défaut)"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.palette:not([hidden]) .choix[aria-label="Double"]')).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await contenu(page)).toBe('<p style="line-height: 2;">mot</p>');
  await expect(page.locator('#feuille')).toBeFocused(); // comme pour les couleurs : retour au texte
});

test('nettoyage : seules les valeurs proposées sont gardées, et seulement sur un paragraphe', async ({ page }) => {
  await ouvrir(page);
  const resultat = await page.evaluate(async () => {
    const { nettoyerHtml } = await import('./js/sanitize.js');
    return nettoyerHtml(
      '<p style="line-height: 1">a</p><p style="line-height: 1.5">b</p><p style="line-height: 10">c</p>' +
        '<p style="line-height: 24px">d</p><p><span style="line-height: 2">e</span></p><p style="line-height: calc(2)">f</p>',
    );
  });
  expect(resultat).toBe('<p style="line-height: 1.15;">a</p><p>b</p><p>c</p><p>d</p><p><span>e</span></p><p>f</p>');
});
