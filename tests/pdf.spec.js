// Export PDF : aide affichée une fois, titre du document comme nom de
// fichier, vrai PDF avec fond blanc, texte noir, couleurs conservées.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect, ouvrir } from './aides.js';

const ANALYSEUR = fileURLToPath(new URL('./analyser-pdf.py', import.meta.url));

function pythonDisponible() {
  try {
    execFileSync('python3', ['-c', 'import pdfplumber, pypdfium2'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function choisirExport(page, format) {
  await page.click('#bouton-exporter');
  await page.locator(`#fenetre-export [data-format="${format}"]`).click();
}

async function preparerDocument(page) {
  await ouvrir(page);
  await page.fill('#titre-document', 'Mon rapport');
  await page.evaluate(() => {
    const feuille = document.getElementById('feuille');
    feuille.innerHTML =
      '<h1>Titre principal</h1>' +
      '<p>Un texte <b>important</b> en <span style="color: rgb(229, 72, 77);">rouge</span> et <span style="background-color: rgb(255, 224, 102);">surligné</span>.</p>';
    feuille.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
  });
}

test('le titre du document sert de nom au fichier, l’aide ne s’affiche qu’une fois', async ({ page }) => {
  await preparerDocument(page);
  await page.evaluate(() => {
    window.print = () => {
      window.__titreImpression = document.title;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await choisirExport(page, 'pdf');
  const aide = page.locator('#fenetre-aide-pdf');
  await expect(aide).toBeVisible();
  await expect(aide).toContainText('Dans la fenêtre qui s\'ouvre, choisis « Enregistrer au format PDF » comme destination.');
  await expect(aide).toContainText('Sur Android');
  // « Annuler » : rien n'est imprimé.
  await aide.getByRole('button', { name: 'Annuler' }).click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__titreImpression)).toBeUndefined();
  // « Ne plus afficher » puis « Continuer ».
  await choisirExport(page, 'pdf');
  await aide.getByLabel('Ne plus afficher ce message').check();
  await aide.getByRole('button', { name: 'Continuer' }).click();
  await expect.poll(() => page.evaluate(() => window.__titreImpression)).toBe('Mon rapport');
  expect(await page.title()).toBe('Omni-Texte'); // titre d'origine remis en place
  // Deuxième export (Ctrl+P) : plus d'aide.
  await page.evaluate(() => {
    window.__titreImpression = null;
  });
  await page.locator('#feuille').click();
  await page.keyboard.press('Control+p');
  await expect.poll(() => page.evaluate(() => window.__titreImpression)).toBe('Mon rapport');
  await expect(aide).toBeHidden();
});

test('un vrai PDF : A4, fond blanc, texte noir, couleurs conservées, texte sélectionnable', async ({ page }, infos) => {
  test.skip(!pythonDisponible(), 'Python 3 avec pdfplumber et pypdfium2 est nécessaire pour analyser le PDF');
  await preparerDocument(page);
  // Thème sombre actif : le PDF doit quand même être blanc.
  expect(await page.locator('html').getAttribute('data-theme')).toBe('omni');
  const chemin = infos.outputPath('document.pdf');
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: chemin, preferCSSPageSize: true });
  const analyse = JSON.parse(execFileSync('python3', [ANALYSEUR, chemin], { encoding: 'utf8' }));

  expect(analyse.pages).toBe(1);
  expect(analyse.largeur).toBeCloseTo(595.3, 0); // A4 en points
  expect(analyse.hauteur).toBeCloseTo(841.9, 0);
  expect(analyse.texte).toContain('Titre principal');
  expect(analyse.texte).toContain('Un texte important en rouge et surligné.');
  // Rien de l'interface n'est imprimé.
  expect(analyse.texte).not.toContain('Exporter');
  expect(analyse.texte).not.toContain('mots');
  // Fond blanc aux quatre coins.
  for (const coin of analyse.coins) expect(coin).toEqual([255, 255, 255]);
  // Texte noir par défaut, rouge conservé.
  const noir = analyse.couleurs_texte['[0.0, 0.0, 0.0]'] ?? '';
  expect(noir).toContain('Titreprincipal');
  expect(noir).toContain('important');
  const rouge = Object.entries(analyse.couleurs_texte).find(([, texte]) => texte === 'rouge');
  expect(rouge, 'le mot « rouge » garde sa couleur').toBeTruthy();
  expect(JSON.parse(rouge[0])).toEqual([0.898, 0.282, 0.302]);
  // Le surlignage jaune est imprimé.
  expect(analyse.rectangles).toContain('[1.0, 0.878, 0.4]');
  // Le navigateur a reçu le titre du document au moment d'imprimer.
  expect(analyse.titre).toBe('Mon rapport');
});
