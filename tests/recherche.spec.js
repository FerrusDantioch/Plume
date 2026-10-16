// Rechercher et remplacer (loupe de la barre d'outils, Ctrl+F).

import { test, expect, ouvrir, contenu, selectionner } from './aides.js';

const TEXTE =
  '<h1>Le chat</h1><p>Un chat dort. Le <b>ch</b>at mange. L’autre CHAT\u00A0!</p><p>Fin du texte, sans résultat.</p>';

async function preparer(page, html = TEXTE) {
  await ouvrir(page);
  await page.evaluate((h) => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML = h;
    feuille.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  }, html);
}

const resultat = (page) => page.locator('#resultat-recherche');

/** Texte des passages surlignés : tous les résultats, et le résultat actuel. */
function surlignages(page) {
  return page.evaluate(() => {
    const texte = (figee) => {
      const plage = document.createRange();
      plage.setStart(figee.startContainer, figee.startOffset);
      plage.setEnd(figee.endContainer, figee.endOffset);
      return plage.toString();
    };
    return {
      tous: [...(CSS.highlights.get('recherche') ?? [])].map(texte),
      actuel: [...(CSS.highlights.get('recherche-actuelle') ?? [])].map(texte),
    };
  });
}

test('Ctrl+F : majuscules ignorées, mise en forme traversée, suivant et précédent en boucle', async ({ page }) => {
  await preparer(page);
  await page.locator('#feuille').click();
  await page.keyboard.press('Control+f');
  const panneau = page.locator('#panneau-recherche');
  await expect(panneau).toBeVisible();
  await expect(page.locator('#champ-recherche')).toBeFocused();
  await expect(page.locator('#bouton-rechercher')).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.type('chat');
  await expect(resultat(page)).toHaveText(/^\d sur 4$/);
  const { tous, actuel } = await surlignages(page);
  expect(tous.length + actuel.length).toBe(4);
  expect([...tous, ...actuel].map((t) => t.toLowerCase())).toEqual(['chat', 'chat', 'chat', 'chat']);

  // Entrée : suivant ; Maj+Entrée : précédent ; en boucle.
  await page.locator('#champ-recherche').fill('');
  await page.locator('#champ-recherche').fill('chat');
  await page.waitForTimeout(200); // la recherche part peu après la frappe
  const numero = async () => Number((await resultat(page).textContent()).split(' ')[0]);
  const depart = await numero();
  await page.keyboard.press('Enter');
  expect(await numero()).toBe((depart % 4) + 1);
  await page.keyboard.press('Shift+Enter');
  expect(await numero()).toBe(depart);
  for (let i = 0; i < 4; i++) await page.click('[data-action="suivant"]');
  expect(await numero()).toBe(depart);

  // Apostrophe droite = apostrophe typographique ; espace = espace insécable.
  await page.locator('#champ-recherche').fill("l'autre chat !");
  await expect(resultat(page)).toHaveText('1 sur 1');
  await page.locator('#champ-recherche').fill('introuvable');
  await expect(resultat(page)).toHaveText('Aucun résultat');
  expect(await surlignages(page)).toEqual({ tous: [], actuel: [] });
});

test('le mot sélectionné devient la recherche ; Échap ferme et sélectionne le résultat', async ({ page }) => {
  await preparer(page);
  await selectionner(page, 'mange');
  await page.keyboard.press('Control+f');
  await expect(page.locator('#champ-recherche')).toHaveValue('mange');
  await expect(resultat(page)).toHaveText('1 sur 1');
  await page.keyboard.press('Escape');
  await expect(page.locator('#panneau-recherche')).toBeHidden();
  await expect(page.locator('#bouton-rechercher')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#feuille')).toBeFocused();
  expect(await page.evaluate(() => getSelection().toString())).toBe('mange');
  expect(await surlignages(page)).toEqual({ tous: [], actuel: [] });
  // La loupe ouvre et ferme le panneau.
  await page.click('#bouton-rechercher');
  await expect(page.locator('#panneau-recherche')).toBeVisible();
  await page.click('#bouton-rechercher');
  await expect(page.locator('#panneau-recherche')).toBeHidden();
});

test('Remplacer, puis Tout remplacer, annulable en une seule étape', async ({ page }) => {
  await preparer(page, '<p>Un chat, un <b>chat</b> gras, un CHAT.</p>');
  await page.locator('#feuille').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('chat');
  await expect(resultat(page)).toHaveText('1 sur 3');
  await page.fill('#champ-remplacement', 'chien');
  await page.click('[data-action="remplacer"]');
  expect(await contenu(page)).toBe('<p>Un chien, un <b>chat</b> gras, un CHAT.</p>');
  await expect(resultat(page)).toHaveText('1 sur 2');
  await expect(page.locator('[data-action="remplacer"]')).toBeFocused(); // le focus reste dans le panneau

  // Le remplacement prend la mise en forme du texte remplacé.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter'); // Entrée dans « Remplacer par » : remplace
  expect(await contenu(page)).toBe('<p>Un chien, un <b>chien</b> gras, un CHAT.</p>');

  await page.click('[data-action="tout-remplacer"]');
  expect(await contenu(page)).toBe('<p>Un chien, un <b>chien</b> gras, un chien.</p>');
  await expect(page.locator('.message', { hasText: '1 remplacement effectué.' })).toBeVisible();
  await expect(resultat(page)).toHaveText('Aucun résultat');

  // « Tout remplacer » sur plusieurs résultats, puis Annuler : tout revient.
  await page.fill('#champ-recherche', 'chien');
  await page.fill('#champ-remplacement', '');
  await page.click('[data-action="tout-remplacer"]');
  expect(await contenu(page)).toBe('<p>Un , un  gras, un .</p>');
  await expect(page.locator('.message', { hasText: '3 remplacements effectués.' })).toBeVisible();
  await page.click('[data-commande="annuler"]');
  expect(await contenu(page)).toBe('<p>Un chien, un <b>chien</b> gras, un chien.</p>');
  await expect(resultat(page)).toHaveText(/sur 3$/);
});

test('les résultats suivent les modifications du document', async ({ page }) => {
  await preparer(page, '<p>pomme</p>');
  await page.waitForTimeout(700); // le texte de départ devient une étape d'annulation
  await page.keyboard.press('Control+f');
  await page.keyboard.type('pomme');
  await expect(resultat(page)).toHaveText('1 sur 1');
  await page.locator('#feuille').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' et pomme');
  await expect(resultat(page)).toHaveText(/sur 2$/);
  await page.keyboard.press('Control+z');
  await expect(resultat(page)).toHaveText('1 sur 1');
});

test('Remplacer avance même quand le remplacement contient la recherche', async ({ page }) => {
  await preparer(page, '<p>paris et paris, puis chat et chat</p>');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('paris');
  await expect(resultat(page)).toHaveText('1 sur 2');
  await page.fill('#champ-remplacement', 'Paris');
  await page.click('[data-action="remplacer"]');
  await expect(resultat(page)).toHaveText('2 sur 2');
  await page.click('[data-action="remplacer"]');
  expect(await contenu(page)).toBe('<p>Paris et Paris, puis chat et chat</p>');

  await page.fill('#champ-recherche', 'chat');
  await page.waitForTimeout(200);
  await page.fill('#champ-remplacement', 'chats');
  await page.click('[data-action="remplacer"]');
  await page.click('[data-action="remplacer"]');
  expect(await contenu(page)).toBe('<p>Paris et Paris, puis chats et chats</p>');
});

test('écrire dans le document, panneau ouvert, ne fait pas sauter la page', async ({ page }) => {
  await preparer(page, '<p>cible en haut</p>' + '<p>ligne</p>'.repeat(150) + '<p>fin</p>');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('cible');
  await expect(resultat(page)).toHaveText('1 sur 1');
  const zone = page.locator('#zone-ecriture');
  await zone.evaluate((z) => z.scrollTo({ top: z.scrollHeight }));
  await page.locator('#feuille p').last().click();
  await page.keyboard.press('End');
  const avant = await zone.evaluate((z) => z.scrollTop);
  expect(avant).toBeGreaterThan(1000);
  await page.keyboard.type(' suite');
  await page.waitForTimeout(400); // la recherche a été refaite
  expect(await zone.evaluate((z) => z.scrollTop)).toBeGreaterThan(avant - 50);
  await expect(resultat(page)).toHaveText('1 sur 1');
});
