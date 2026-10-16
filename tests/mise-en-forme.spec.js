// Mise en forme : gras, italique, souligné, barré, taille, couleurs,
// styles de paragraphe, listes, alignement, effacement.

import { test, expect, ouvrir, contenu, remplir, selectionner, curseurApres, styleDu, commande, choisirCouleur } from './aides.js';

test.beforeEach(async ({ page }) => {
  await ouvrir(page);
});

test.describe('Gras, italique, souligné, barré', () => {
  for (const [nom, balise, raccourci] of [
    ['gras', 'b', 'Control+b'],
    ['italique', 'i', 'Control+i'],
    ['souligne', 'u', 'Control+u'],
    ['barre', 's', null],
  ]) {
    test(`${nom} : application puis retrait sur une sélection`, async ({ page }) => {
      await remplir(page, '<p>un deux trois</p>');
      await selectionner(page, 'deux');
      await commande(page, nom);
      expect(await contenu(page)).toBe(`<p>un <${balise}>deux</${balise}> trois</p>`);
      await expect(page.locator(`[data-commande="${nom}"]`)).toHaveAttribute('aria-pressed', 'true');
      // Retrait (par le raccourci clavier quand il existe).
      await selectionner(page, 'deux');
      if (raccourci) await page.keyboard.press(raccourci);
      else await commande(page, nom);
      expect(await contenu(page)).toBe('<p>un deux trois</p>');
      await expect(page.locator(`[data-commande="${nom}"]`)).toHaveAttribute('aria-pressed', 'false');
    });

    test(`${nom} : sélection sur plusieurs paragraphes`, async ({ page }) => {
      await remplir(page, '<p>alpha beta</p><p>gamma</p><p>delta epsilon</p>');
      await selectionner(page, 'beta', { fin: 'delta' });
      await commande(page, nom);
      const html = await contenu(page);
      expect(html).toContain(`<${balise}>beta</${balise}>`);
      expect(html).toContain(`<${balise}>gamma</${balise}>`);
      expect(html).toContain(`<${balise}>delta</${balise}>`);
      expect(html).toContain(' epsilon</p>');
      await selectionner(page, 'beta', { fin: 'delta' });
      await commande(page, nom);
      expect(await contenu(page)).toBe('<p>alpha beta</p><p>gamma</p><p>delta epsilon</p>');
    });
  }

  test('barré : retrait sur une partie d’un mot déjà barré (document rouvert)', async ({ page }) => {
    await remplir(page, '<p>un <s>bonjour</s> trois</p>');
    await selectionner(page, 'jou');
    await expect(page.locator('[data-commande="barre"]')).toHaveAttribute('aria-pressed', 'true');
    await commande(page, 'barre');
    expect(await contenu(page)).toBe('<p>un <s>bon</s>jou<s>r</s> trois</p>');
    await selectionner(page, 'un', { fin: 'trois' });
    await commande(page, 'barre');
    expect(await contenu(page)).toBe('<p><s>un bonjour trois</s></p>');
  });

  test('barré sans sélection : le texte tapé ensuite est barré', async ({ page }) => {
    await remplir(page, '<p>avant</p>');
    await curseurApres(page, 'avant');
    await commande(page, 'barre');
    await page.keyboard.type(' barré');
    expect(await contenu(page)).toBe('<p>avant<s> barré</s></p>');
  });

  test('gras sur une sélection en partie grasse : tout devient gras, puis tout redevient normal', async ({ page }) => {
    await remplir(page, '<p>un <b>deux</b> trois</p>');
    await selectionner(page, 'un', { fin: 'trois' });
    await expect(page.locator('[data-commande="gras"]')).toHaveAttribute('aria-pressed', 'false');
    await commande(page, 'gras');
    expect(await contenu(page)).toBe('<p><b>un deux trois</b></p>');
    await commande(page, 'gras');
    expect(await contenu(page)).toBe('<p>un deux trois</p>');
  });

  test('gras dans un titre (déjà gras) : le bouton le retire, puis le remet', async ({ page }) => {
    await remplir(page, '<h1>Grand titre</h1>');
    await selectionner(page, 'titre');
    await expect(page.locator('[data-commande="gras"]')).toHaveAttribute('aria-pressed', 'true');
    await commande(page, 'gras');
    expect(await contenu(page)).toBe('<h1>Grand <span style="font-weight: normal;">titre</span></h1>');
    expect((await styleDu(page, 'titre')).gras).toBe(false);
    await expect(page.locator('[data-commande="gras"]')).toHaveAttribute('aria-pressed', 'false');
    await commande(page, 'gras');
    expect(await contenu(page)).toBe('<h1>Grand titre</h1>');
  });

  test('italique et souligné imbriqués, puis retrait du seul souligné', async ({ page }) => {
    await remplir(page, '<p><em>un <u>deux</u> trois</em></p>');
    await selectionner(page, 'deux');
    await expect(page.locator('[data-commande="italique"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-commande="souligne"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Control+u');
    expect(await contenu(page)).toBe('<p><em>un deux trois</em></p>');
    expect((await styleDu(page, 'deux')).italique).toBe(true);
  });

  test('gras sans sélection : le texte tapé ensuite est en gras', async ({ page }) => {
    await remplir(page, '<p>avant</p>');
    await curseurApres(page, 'avant');
    await commande(page, 'gras');
    await page.keyboard.type(' fort');
    expect(await contenu(page)).toBe('<p>avant<b> fort</b></p>');
  });
});

test.describe('Taille du texte', () => {
  test('24 sur tout, puis 12 sur un seul mot : le reste garde 24', async ({ page }) => {
    await remplir(page, '<p>Le petit chat dort</p>');
    await selectionner(page, 'Le', { fin: 'dort' });
    await page.selectOption('#choix-taille', '24');
    expect((await styleDu(page, 'Le')).taille).toBe(24);
    await selectionner(page, 'chat');
    await expect(page.locator('#choix-taille')).toHaveValue('24');
    await page.selectOption('#choix-taille', '12');
    expect((await styleDu(page, 'Le petit')).taille).toBe(24);
    expect((await styleDu(page, 'chat')).taille).toBe(12);
    expect((await styleDu(page, 'dort')).taille).toBe(24);
    expect(await contenu(page)).toBe(
      '<p><span style="font-size: 24pt;">Le petit </span>chat<span style="font-size: 24pt;"> dort</span></p>',
    );
  });

  test('A+ et A− passent à la taille voisine et la valeur affichée suit', async ({ page }) => {
    await remplir(page, '<p>mot</p>');
    await selectionner(page, 'mot');
    await expect(page.locator('#choix-taille')).toHaveValue('12');
    await commande(page, 'taille-plus');
    await expect(page.locator('#choix-taille')).toHaveValue('14');
    await commande(page, 'taille-plus');
    await expect(page.locator('#choix-taille')).toHaveValue('16');
    await commande(page, 'taille-moins');
    await commande(page, 'taille-moins');
    await commande(page, 'taille-moins');
    await expect(page.locator('#choix-taille')).toHaveValue('11');
    expect((await styleDu(page, 'mot')).taille).toBe(11);
  });

  test('la valeur affichée suit le curseur', async ({ page }) => {
    await remplir(page, '<p><span style="font-size: 36pt;">grand</span> normal</p>');
    await curseurApres(page, 'gra');
    await expect(page.locator('#choix-taille')).toHaveValue('36');
    await curseurApres(page, 'norm');
    await expect(page.locator('#choix-taille')).toHaveValue('12');
  });

  test('taille sans sélection : le texte tapé prend la taille choisie', async ({ page }) => {
    await remplir(page, '<p>debut</p>');
    await curseurApres(page, 'debut');
    await page.selectOption('#choix-taille', '20');
    await page.locator('#feuille').focus();
    await page.keyboard.type(' suite');
    expect((await styleDu(page, 'suite')).taille).toBe(20);
    expect((await styleDu(page, 'debut')).taille).toBe(12);
  });
});

test.describe('Couleur du texte et surlignage', () => {
  test('couleur : appliquer, retirer au milieu, « Automatique »', async ({ page }) => {
    await remplir(page, '<p>un deux trois quatre</p>');
    await selectionner(page, 'un', { fin: 'quatre' });
    await choisirCouleur(page, 'couleur', 'Rouge');
    expect((await styleDu(page, 'deux')).couleur).toBe('rgb(229, 72, 77)');
    // La pastille « Rouge » est cochée.
    await page.click('#bouton-couleur');
    await expect(page.locator('.palette:not([hidden]) .pastille[aria-label="Rouge"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    // « Automatique » sur un mot au milieu.
    await selectionner(page, 'deux');
    await choisirCouleur(page, 'couleur', 'Automatique');
    const auto = await page.evaluate(() => getComputedStyle(document.getElementById('feuille')).color);
    expect((await styleDu(page, 'deux')).couleur).toBe(auto);
    expect((await styleDu(page, 'un')).couleur).toBe('rgb(229, 72, 77)');
    expect((await styleDu(page, 'trois')).couleur).toBe('rgb(229, 72, 77)');
    expect(await contenu(page)).toBe(
      '<p><span style="color: rgb(229, 72, 77);">un </span>deux<span style="color: rgb(229, 72, 77);"> trois quatre</span></p>',
    );
  });

  test('surlignage : appliquer, retirer au milieu, « Aucun », texte toujours lisible', async ({ page }) => {
    await remplir(page, '<p>un deux trois</p>');
    await selectionner(page, 'un', { fin: 'trois' });
    await choisirCouleur(page, 'surlignage', 'Jaune');
    const surligne = await styleDu(page, 'deux');
    expect(surligne.fond).toBe('rgb(255, 224, 102)');
    // Texte sombre imposé sur le surlignage (thème sombre par défaut).
    expect(surligne.couleur).toBe('rgb(20, 17, 29)');
    await selectionner(page, 'deux');
    await choisirCouleur(page, 'surlignage', 'Aucun');
    const sansFond = await styleDu(page, 'deux');
    expect(sansFond.fond).toBeNull();
    // Le texte retrouve la couleur normale du thème.
    const auto = await page.evaluate(() => getComputedStyle(document.getElementById('feuille')).color);
    expect(sansFond.couleur).toBe(auto);
    expect((await styleDu(page, 'un')).fond).toBe('rgb(255, 224, 102)');
    expect((await styleDu(page, 'trois')).fond).toBe('rgb(255, 224, 102)');
  });

  test('une couleur choisie reste visible sur un surlignage', async ({ page }) => {
    await remplir(page, '<p>important</p>');
    await selectionner(page, 'important');
    await choisirCouleur(page, 'couleur', 'Rouge');
    await selectionner(page, 'important');
    await choisirCouleur(page, 'surlignage', 'Jaune');
    const style = await styleDu(page, 'important');
    expect(style.couleur).toBe('rgb(229, 72, 77)');
    expect(style.fond).toBe('rgb(255, 224, 102)');
  });

  test('les pastilles ont un nom accessible', async ({ page }) => {
    await page.click('#bouton-couleur');
    const noms = await page.locator('.palette:not([hidden]) .pastille').evaluateAll((p) => p.map((b) => b.getAttribute('aria-label')));
    expect(noms).toEqual(['Automatique', 'Noir', 'Blanc', 'Gris', 'Rouge', 'Orange', 'Jaune', 'Vert', 'Cyan', 'Bleu', 'Violet', 'Rose']);
    await page.keyboard.press('Escape');
    await page.click('#bouton-surlignage');
    const nomsSurlignage = await page.locator('.palette:not([hidden]) .pastille').evaluateAll((p) => p.map((b) => b.getAttribute('aria-label')));
    expect(nomsSurlignage).toEqual(['Aucun', 'Jaune', 'Vert', 'Cyan', 'Rose', 'Orange', 'Violet', 'Gris']);
  });
});

test.describe('Paragraphes', () => {
  test('styles de paragraphe : titres et texte normal', async ({ page }) => {
    await remplir(page, '<p>Mon titre</p><p>Du texte</p>');
    await curseurApres(page, 'Mon');
    await page.selectOption('#choix-style', 'h1');
    expect(await contenu(page)).toBe('<h1>Mon titre</h1><p>Du texte</p>');
    await page.selectOption('#choix-style', 'h2');
    expect(await contenu(page)).toBe('<h2>Mon titre</h2><p>Du texte</p>');
    await page.selectOption('#choix-style', 'p');
    expect(await contenu(page)).toBe('<p>Mon titre</p><p>Du texte</p>');
  });

  test('alignements', async ({ page }) => {
    await remplir(page, '<p>texte</p>');
    await curseurApres(page, 'tex');
    for (const [cmd, valeur] of [['aligner-centre', 'center'], ['aligner-droite', 'right'], ['justifier', 'justify']]) {
      await commande(page, cmd);
      expect(await contenu(page)).toBe(`<p style="text-align: ${valeur};">texte</p>`);
      await expect(page.locator(`[data-commande="${cmd}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    await commande(page, 'aligner-gauche');
    expect(await contenu(page)).toBe('<p>texte</p>');
  });

  test('listes à puces et numérotée', async ({ page }) => {
    await remplir(page, '<p>un</p><p>deux</p><p>trois</p>');
    await selectionner(page, 'un', { fin: 'deux' });
    await commande(page, 'liste-puces');
    expect(await contenu(page)).toBe('<ul><li>un</li><li>deux</li></ul><p>trois</p>');
    await expect(page.locator('[data-commande="liste-puces"]')).toHaveAttribute('aria-pressed', 'true');
    await selectionner(page, 'un', { fin: 'trois' });
    await commande(page, 'liste-numeros');
    expect(await contenu(page)).toBe('<ol><li>un</li><li>deux</li><li>trois</li></ol>');
    await selectionner(page, 'deux');
    await commande(page, 'liste-numeros');
    expect(await contenu(page)).toBe('<ol><li>un</li></ol><p>deux</p><ol><li>trois</li></ol>');
  });

  test('effacer la mise en forme', async ({ page }) => {
    await remplir(page, '<p><b>gras <span style="color: rgb(229, 72, 77);">rouge</span></b> <i>fin</i></p>');
    await selectionner(page, 'gras', { fin: 'fin' });
    await commande(page, 'effacer');
    expect(await contenu(page)).toBe('<p>gras rouge fin</p>');
  });
});

test.describe('Fusion de paragraphes (Retour arrière et Suppr)', () => {
  test('Retour arrière au début d’un paragraphe : il rejoint le titre au-dessus, sans style parasite', async ({ page }) => {
    await page.locator('#feuille').click();
    await page.keyboard.type('Titre');
    await page.selectOption('#choix-style', 'h1');
    await page.locator('#feuille').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraphe');
    expect(await contenu(page)).toBe('<h1>Titre</h1><p>Paragraphe</p>');
    await page.keyboard.press('Home');
    await page.keyboard.press('Backspace');
    expect(await contenu(page)).toBe('<h1>TitreParagraphe</h1>');
    // Le curseur est à la jonction.
    await page.keyboard.type('|');
    expect(await contenu(page)).toBe('<h1>Titre|Paragraphe</h1>');
    // Une seule annulation de la frappe, puis de la fusion.
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await contenu(page)).toBe('<h1>Titre</h1><p>Paragraphe</p>');
  });

  test('Suppr à la fin d’un paragraphe coloré : le suivant le rejoint sans style ajouté', async ({ page }) => {
    await remplir(page, '<p><span style="color: rgb(229, 72, 77);">rouge</span></p><p>noir</p>');
    await curseurApres(page, 'rouge');
    await page.keyboard.press('Delete');
    expect(await contenu(page)).toBe('<p><span style="color: rgb(229, 72, 77);">rouge</span>noir</p>');
  });

  test('Retour arrière sous un paragraphe vide : le vide disparaît, le titre reste un titre', async ({ page }) => {
    await remplir(page, '<p><br></p><h2>Sous-titre</h2>');
    await page.evaluate(() => {
      const plage = document.createRange();
      plage.setStart(document.querySelector('#feuille h2').firstChild, 0);
      getSelection().removeAllRanges();
      getSelection().addRange(plage);
    });
    await page.keyboard.press('Backspace');
    expect(await contenu(page)).toBe('<h2>Sous-titre</h2>');
  });
});

test.describe('Caractère invisible', () => {
  test("n'est jamais compté dans les mots et les caractères", async ({ page }) => {
    await page.locator('#feuille').click();
    await page.selectOption('#choix-taille', '24');
    await choisirCouleur(page, 'couleur', 'Bleu');
    // Un caractère invisible est maintenant dans le document…
    const invisibles = await page.evaluate(() => document.getElementById('feuille').textContent.split('\u200B').length - 1);
    expect(invisibles).toBeGreaterThan(0);
    // … mais le compteur reste à zéro.
    await expect(page.locator('#compteur')).toHaveText('0 mot · 0 caractère');
    await page.keyboard.type('abc');
    await expect(page.locator('#compteur')).toHaveText('1 mot · 3 caractères');
    expect((await styleDu(page, 'abc')).taille).toBe(24);
    expect((await styleDu(page, 'abc')).couleur).toBe('rgb(0, 144, 255)');
  });

  test("est retiré de la copie et du texte enregistré", async ({ page }) => {
    await page.locator('#feuille').click();
    await page.keyboard.type('mot ');
    await page.selectOption('#choix-taille', '20');
    await page.locator('#feuille').focus();
    await page.keyboard.type('grand');
    const copie = await page.evaluate(() => {
      const feuille = document.getElementById('feuille');
      const plage = document.createRange();
      plage.selectNodeContents(feuille);
      getSelection().removeAllRanges();
      getSelection().addRange(plage);
      const donnees = new DataTransfer();
      feuille.dispatchEvent(new ClipboardEvent('copy', { clipboardData: donnees, bubbles: true, cancelable: true }));
      return { texte: donnees.getData('text/plain'), html: donnees.getData('text/html') };
    });
    expect(copie.texte).toBe('mot grand');
    expect(copie.html).not.toContain('\u200B');
  });
});
