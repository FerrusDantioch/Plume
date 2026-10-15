// Thèmes : application, mémorisation, absence de flash, contrastes WCAG AA.

import { test, expect, ouvrir } from './aides.js';

const THEMES = { omni: 'Omni-système', sombre: 'Sombre', clair: 'Clair' };

test('chaque thème s’applique, se mémorise et ne produit pas de flash au rechargement', async ({ page }) => {
  // Note l'état de la page au moment précis où le <body> apparaît,
  // c'est-à-dire avant le premier affichage.
  await page.addInitScript(() => {
    new MutationObserver((mutations, observateur) => {
      if (!document.body) return;
      window.__auPremierAffichage = {
        theme: document.documentElement.dataset.theme,
        fond: getComputedStyle(document.documentElement).getPropertyValue('--fond').trim(),
      };
      observateur.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await ouvrir(page);
  // Sans choix mémorisé : Omni-système.
  expect(await page.evaluate(() => window.__auPremierAffichage)).toEqual({ theme: 'omni', fond: '#14111d' });

  const attendus = {
    omni: { fond: '#14111d', barre: '#1d1929', schema: 'dark' },
    sombre: { fond: '#1c1c1e', barre: '#2a2a2d', schema: 'dark' },
    clair: { fond: '#f1eff5', barre: '#ffffff', schema: 'light' },
  };
  for (const id of ['clair', 'sombre', 'omni']) {
    await page.click('#bouton-menu');
    await page.getByRole('radio', { name: THEMES[id] }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', attendus[id].barre);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', attendus[id].schema);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('#feuille[contenteditable="true"]').waitFor();
    expect(await page.evaluate(() => window.__auPremierAffichage)).toEqual({ theme: id, fond: attendus[id].fond });
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', attendus[id].barre);
  }
});

test('les pastilles d’aperçu montrent les couleurs de chaque thème', async ({ page }) => {
  await ouvrir(page);
  await page.click('#bouton-menu');
  const fonds = await page.locator('.pastille-theme').evaluateAll((p) => p.map((e) => getComputedStyle(e).backgroundColor));
  expect(fonds).toEqual(['rgb(20, 17, 29)', 'rgb(28, 28, 30)', 'rgb(241, 239, 245)']);
});

test('contrastes conformes WCAG AA dans les trois thèmes', async ({ page }) => {
  await ouvrir(page);
  const resultats = await page.evaluate(() => {
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const rapport = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const sortie = [];
    for (const theme of ['omni', 'sombre', 'clair']) {
      const temoin = document.createElement('div');
      temoin.dataset.theme = theme;
      document.body.append(temoin);
      const s = getComputedStyle(temoin);
      const v = (nom) => s.getPropertyValue(`--${nom}`).trim();
      temoin.remove();
      // [texte, fond, minimum] : 4,5 pour du texte, 3 pour un élément graphique.
      const paires = [
        ['texte', 'fond', 4.5], ['texte', 'surface', 4.5], ['texte', 'page', 4.5], ['texte', 'accent-doux', 4.5], ['texte', 'survol', 4.5],
        ['discret', 'fond', 4.5], ['discret', 'surface', 4.5], ['discret', 'page', 4.5],
        ['accent-texte', 'accent', 4.5], ['danger-texte', 'danger', 4.5], ['halo', 'surface', 4.5], ['halo', 'page', 4.5],
        ['danger', 'surface', 3], ['accent', 'surface', 3], ['accent', 'page', 3], ['halo', 'fond', 3],
      ];
      for (const [a, b, min] of paires) sortie.push({ theme, paire: `${a} / ${b}`, rapport: rapport(v(a), v(b)), min });
      for (const surlignage of ['#ffe066', '#8ce99a', '#74d7ee', '#f7a8d4', '#ffb36b', '#c4a7ff', '#ced4da']) {
        sortie.push({ theme, paire: `texte-surligne / ${surlignage}`, rapport: rapport(v('texte-surligne'), surlignage), min: 4.5 });
      }
    }
    return sortie;
  });
  const insuffisants = resultats.filter((r) => r.rapport < r.min).map((r) => `${r.theme} ${r.paire} : ${r.rapport.toFixed(2)}`);
  expect(insuffisants).toEqual([]);
});

test('captures d’écran des trois thèmes (contrôle visuel)', async ({ page }, infos) => {
  await ouvrir(page);
  await page.fill('#titre-document', 'Démonstration');
  await page.evaluate(() => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML =
      '<h1>Un titre de chapitre</h1><p>Un paragraphe avec du <b>gras</b>, de l’<i>italique</i>, du <u>souligné</u> et du <s>barré</s>.</p>' +
      '<p><span style="font-size: 18pt;">Plus grand</span>, <span style="color: rgb(229, 72, 77);">rouge</span>, <span style="background-color: rgb(255, 224, 102);">surligné</span>.</p>' +
      '<ul><li>Premier point</li><li>Deuxième point</li></ul>';
    feuille.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  });
  for (const id of ['omni', 'sombre', 'clair']) {
    await page.evaluate((id) => {
      document.documentElement.dataset.theme = id;
    }, id);
    await page.waitForTimeout(400); // fin des transitions de couleur
    await page.screenshot({ path: infos.outputPath(`theme-${id}.png`) });
  }
  await page.click('#bouton-menu');
  await page.waitForTimeout(400);
  await page.screenshot({ path: infos.outputPath('menu.png') });
  await page.keyboard.press('Escape');
  await page.click('#bouton-couleur');
  await page.waitForTimeout(400);
  await page.screenshot({ path: infos.outputPath('palette.png') });
  await page.keyboard.press('Escape');
  await page.click('#bouton-documents');
  await page.waitForTimeout(400);
  await page.screenshot({ path: infos.outputPath('documents.png') });
  await page.keyboard.press('Escape');
  await page.click('#bouton-menu');
  await page.click('#bouton-a-propos');
  await page.waitForTimeout(400);
  await page.screenshot({ path: infos.outputPath('a-propos.png') });
});
