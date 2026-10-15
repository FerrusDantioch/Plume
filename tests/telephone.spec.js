// Téléphone : écran étroit (390 × 844) et écran tactile.

import { test, expect, ouvrir, contenu, remplir, selectionner } from './aides.js';

test.beforeEach(async ({ page }) => {
  await ouvrir(page);
});

test('aucun défilement horizontal de la page, feuille sur toute la largeur', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const feuille = await page.locator('#feuille').boundingBox();
  expect(feuille.x).toBe(0);
  expect(feuille.width).toBe(390);
  // Texte du document lisible : 12 pt = 16 px.
  expect(await page.locator('#feuille').evaluate((f) => getComputedStyle(f).fontSize)).toBe('16px');
});

test('la barre d’outils tient sur une ligne et défile horizontalement', async ({ page }) => {
  const barre = await page.locator('#barre-outils').evaluate((b) => ({
    defile: b.scrollWidth > b.clientWidth,
    debordement: getComputedStyle(b).overflowX,
    retourALaLigne: getComputedStyle(b).flexWrap,
    hauteur: b.offsetHeight,
  }));
  expect(barre).toMatchObject({ defile: true, debordement: 'auto', retourALaLigne: 'nowrap' });
  expect(barre.hauteur).toBeLessThan(70);
  // Le dernier bouton devient accessible en faisant défiler la barre.
  const dernier = page.locator('[data-commande="effacer"]');
  await dernier.scrollIntoViewIfNeeded();
  await expect(dernier).toBeInViewport();
});

test('tous les boutons font au moins 44 × 44 px', async ({ page }) => {
  const trop_petits = await page.evaluate(() =>
    [...document.querySelectorAll('.barre-app button, .barre-app input, .barre-outils button, .barre-outils select')]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { nom: e.getAttribute('aria-label') || e.textContent.trim() || e.id, largeur: r.width, hauteur: r.height };
      })
      .filter((b) => b.largeur < 44 || b.hauteur < 44),
  );
  expect(trop_petits).toEqual([]);
  // Mêmes règles dans le menu et dans le panneau des documents.
  await page.tap('#bouton-menu');
  const menu = await page.locator('#fenetre-menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(390);
  const petitsDansMenu = await page.locator('#fenetre-menu button, #fenetre-menu label').evaluateAll((liste) =>
    liste.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()),
  );
  expect(petitsDansMenu).toEqual([]);
});

test('au doigt : mise en forme d’une sélection et palette de couleurs', async ({ page }) => {
  await remplir(page, '<p>un deux trois</p>');
  await selectionner(page, 'deux');
  await page.tap('[data-commande="gras"]');
  expect(await contenu(page)).toBe('<p>un <b>deux</b> trois</p>');
  // La feuille garde le focus (le clavier du téléphone ne se ferme pas).
  expect(await page.evaluate(() => document.activeElement.id)).toBe('feuille');

  await selectionner(page, 'trois');
  const couleur = page.locator('#bouton-couleur');
  await couleur.scrollIntoViewIfNeeded();
  await couleur.tap();
  const palette = page.locator('.palette:not([hidden])');
  await expect(palette).toBeVisible();
  const boite = await palette.boundingBox();
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width).toBeLessThanOrEqual(390);
  await palette.locator('.pastille[aria-label="Vert"]').tap();
  await expect(palette).toBeHidden();
  expect(await contenu(page)).toBe('<p>un <b>deux</b> <span style="color: rgb(48, 164, 108);">trois</span></p>');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('feuille');
});

test('captures d’écran sur téléphone (contrôle visuel)', async ({ page }, infos) => {
  await page.fill('#titre-document', 'Notes de lecture');
  await page.evaluate(() => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML =
      '<h1>Chapitre un</h1><p>Il était une fois un <b>texte</b> écrit sur un téléphone, avec un mot <span style="background-color: rgb(140, 233, 154);">surligné</span>.</p>';
    feuille.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  });
  await page.screenshot({ path: infos.outputPath('telephone.png') });
  await page.tap('#bouton-menu');
  await page.waitForTimeout(300);
  await page.screenshot({ path: infos.outputPath('telephone-menu.png') });
  await page.keyboard.press('Escape');
  await page.tap('#bouton-documents');
  await page.waitForTimeout(300);
  await page.screenshot({ path: infos.outputPath('telephone-documents.png') });
});
