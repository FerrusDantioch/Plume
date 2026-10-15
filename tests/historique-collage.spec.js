// Annuler / Rétablir, et collage en texte brut.

import { test, expect, ouvrir, contenu, remplir, selectionner, curseurApres, commande, choisirCouleur } from './aides.js';

test.beforeEach(async ({ page }) => {
  await ouvrir(page);
});

test('10 actions variées annulées puis rétablies dans l’ordre exact', async ({ page }) => {
  const etats = [await contenu(page)];
  const noter = async () => etats.push(await contenu(page));

  await page.locator('#feuille').click();
  await page.keyboard.type('Bonjour le monde');
  await page.waitForTimeout(900); // pause dans la frappe : une étape d'annulation
  await noter(); // 1. frappe
  await selectionner(page, 'Bonjour');
  await commande(page, 'gras');
  await noter(); // 2. gras
  await selectionner(page, 'monde');
  await page.selectOption('#choix-taille', '24');
  await noter(); // 3. taille
  await selectionner(page, 'le');
  await choisirCouleur(page, 'couleur', 'Rouge');
  await noter(); // 4. couleur
  await curseurApres(page, 'monde');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Deuxième ligne');
  await page.waitForTimeout(900);
  await noter(); // 5. frappe
  await commande(page, 'liste-puces');
  await noter(); // 6. liste
  await selectionner(page, 'Deuxième');
  await commande(page, 'italique');
  await noter(); // 7. italique
  await selectionner(page, 'ligne');
  await choisirCouleur(page, 'surlignage', 'Jaune');
  await noter(); // 8. surlignage
  await curseurApres(page, 'Bonj');
  await page.selectOption('#choix-style', 'h1');
  await noter(); // 9. titre
  await commande(page, 'aligner-centre');
  await noter(); // 10. alignement

  expect(new Set(etats).size, 'chaque action change le document').toBe(11);

  // Annuler 10 fois (une fois sur deux au clavier, une fois avec le bouton).
  for (let i = 10; i >= 1; i--) {
    if (i % 2) await commande(page, 'annuler');
    else await page.keyboard.press('Control+z');
    expect(await contenu(page), `après annulation de l'action ${i}`).toBe(etats[i - 1]);
  }
  await expect(page.locator('[data-commande="annuler"]')).toBeDisabled();

  // Rétablir 10 fois (Ctrl+Y, Ctrl+Maj+Z et le bouton).
  for (let i = 1; i <= 10; i++) {
    if (i % 3 === 0) await page.keyboard.press('Control+y');
    else if (i % 3 === 1) await page.keyboard.press('Control+Shift+z');
    else await commande(page, 'retablir');
    expect(await contenu(page), `après rétablissement de l'action ${i}`).toBe(etats[i]);
  }
  await expect(page.locator('[data-commande="retablir"]')).toBeDisabled();
});

test("l'annulation native du navigateur est remplacée", async ({ page }) => {
  await page.locator('#feuille').click();
  await page.keyboard.type('abc');
  await page.waitForTimeout(900);
  await selectionner(page, 'abc');
  await page.selectOption('#choix-taille', '20');
  const avecTaille = await contenu(page);
  // Le menu « Annuler » du navigateur envoie un événement historyUndo.
  await page.evaluate(() =>
    document.getElementById('feuille').dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true })),
  );
  expect(await contenu(page)).toBe('<p>abc</p>');
  await page.evaluate(() =>
    document.getElementById('feuille').dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyRedo', bubbles: true, cancelable: true })),
  );
  expect(await contenu(page)).toBe(avecTaille);
});

test.describe('Collage', () => {
  test('texte riche : seul le texte brut est inséré, chaque ligne devient un paragraphe', async ({ page }) => {
    await page.locator('#feuille').click();
    await page.keyboard.type('Début fin');
    await page.waitForTimeout(900);
    await curseurApres(page, 'Début ');
    await page.evaluate(() => {
      const donnees = new DataTransfer();
      donnees.setData('text/html', '<h1 style="color:red">Titre <b>gras</b></h1><script>window.pirate=1</script><p onclick="x()">Para</p>');
      donnees.setData('text/plain', 'Ligne un\nLigne deux\r\n\r\nLigne quatre ');
      document.getElementById('feuille').dispatchEvent(new ClipboardEvent('paste', { clipboardData: donnees, bubbles: true, cancelable: true }));
    });
    expect(await contenu(page)).toBe('<p>Début Ligne un</p><p>Ligne deux</p><p><br></p><p>Ligne quatre fin</p>');
    expect(await page.evaluate(() => window.pirate)).toBeUndefined();
    // Le curseur est juste après le texte collé.
    await page.keyboard.type('X');
    expect(await contenu(page)).toContain('<p>Ligne quatre Xfin</p>');
    // Un seul « Annuler » retire tout le collage (plus la frappe du X).
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await contenu(page)).toBe('<p>Début fin</p>');
  });

  test('vrai collage au clavier (Ctrl+V) depuis le presse-papiers', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await remplir(page, '<p>X</p>');
    await page.evaluate(async () => {
      const item = new ClipboardItem({
        'text/html': new Blob(['<p style="color:red"><b>Rouge</b> et gras</p><p>Second</p>'], { type: 'text/html' }),
        'text/plain': new Blob(['Rouge et gras\nSecond'], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
    });
    await curseurApres(page, 'X');
    await page.keyboard.press('Control+v');
    expect(await contenu(page)).toBe('<p>XRouge et gras</p><p>Second</p>');
  });

  test('collage par-dessus une sélection', async ({ page }) => {
    await remplir(page, '<p>un deux trois</p>');
    await selectionner(page, 'deux');
    await page.evaluate(() => {
      const donnees = new DataTransfer();
      donnees.setData('text/plain', '2');
      document.getElementById('feuille').dispatchEvent(new ClipboardEvent('paste', { clipboardData: donnees, bubbles: true, cancelable: true }));
    });
    expect(await contenu(page)).toBe('<p>un 2 trois</p>');
  });
});
